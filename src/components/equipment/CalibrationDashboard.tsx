import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, 
  Layers, 
  Mail, 
  Send, 
  Search, 
  X, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Edit3, 
  Eye, 
  Building, 
  ChevronRight, 
  RefreshCw, 
  History, 
  CheckSquare, 
  Square, 
  RotateCcw,
  Sparkles,
  ExternalLink,
  Plus,
  Trash2
} from 'lucide-react';
import { 
  EquipmentItem, 
  CalibrationCategory, 
  CalibrationEmailLog, 
  BulkCalibrationBatch,
  CalibrationEmailPreview 
} from '../../types';
import { 
  getRiyadhDateString, 
  getDaysUntilDue, 
  isDueFor20DayReminder, 
  getStoredEmailLogs, 
  getStoredBulkBatches,
  subscribeToEmailLogs,
  generateConsolidatedEmailPreview,
  triggerServerDailyCheck,
  DEFAULT_CONFIGURED_EMAIL,
  getStoredRecipients,
  subscribeToRecipients,
  resetEquipmentNotificationStatus
} from '../../services/calibrationService';
import { deleteEquipmentItem, deleteEquipmentBatch } from '../../services/equipmentStorage';
import { auth, getAccessToken, signInWithGoogle } from '../../firebase';
import { runCalibrationCheckViaGmail } from '../../services/gmailService';
import { BulkCalibrationModal } from './BulkCalibrationModal';
import { BatchDueDateModal } from './BatchDueDateModal';
import { EmailPreviewModal } from './EmailPreviewModal';
import { ReceiverEmailSettings } from './ReceiverEmailSettings';

interface CalibrationDashboardProps {
  equipmentList: EquipmentItem[];
  onSelectEquipment: (item: EquipmentItem) => void;
  onEditEquipment: (item: EquipmentItem) => void;
  currentUserEmail?: string;
  onNavigateToEquipmentInventory: () => void;
  onToast: (message: string) => void;
}

type TabKey = 
  | 'all'
  | 'internal'
  | 'external'
  | 'due_20_days'
  | 'overdue'
  | 'upcoming'
  | 'bulk_batches'
  | 'email_logs'
  | 'recipients';

export const CalibrationDashboard: React.FC<CalibrationDashboardProps> = ({
  equipmentList,
  onSelectEquipment,
  onEditEquipment,
  currentUserEmail,
  onNavigateToEquipmentInventory,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isBatchDueDateModalOpen, setIsBatchDueDateModalOpen] = useState(false);
  const [isEmailPreviewModalOpen, setIsEmailPreviewModalOpen] = useState(false);
  const [emailPreviewData, setEmailPreviewData] = useState<CalibrationEmailPreview | null>(null);

  // Delete state
  const [itemToDelete, setItemToDelete] = useState<EquipmentItem | null>(null);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Email logs & batches history state
  const [emailLogs, setEmailLogs] = useState<CalibrationEmailLog[]>([]);
  const [bulkBatches, setBulkBatches] = useState<BulkCalibrationBatch[]>([]);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [isCheckingServer, setIsCheckingServer] = useState(false);

  // Current Riyadh Date
  const currentRiyadhDate = useMemo(() => getRiyadhDateString(), []);

  // Subscribe to email logs, recipients & load batches
  useEffect(() => {
    const unsubLogs = subscribeToEmailLogs((logs) => {
      setEmailLogs(logs);
    });
    const unsubRecipients = subscribeToRecipients((recs) => {
      setRecipients(recs);
    });
    setBulkBatches(getStoredBulkBatches());

    const handleTabNav = (e: Event) => {
      const custom = e as CustomEvent<TabKey>;
      if (custom.detail) {
        setActiveTab(custom.detail);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('navigate_calibration_tab', handleTabNav);
    }

    return () => {
      unsubLogs();
      unsubRecipients();
      if (typeof window !== 'undefined') {
        window.removeEventListener('navigate_calibration_tab', handleTabNav);
      }
    };
  }, []);

  // Compute stats across calibration records
  const stats = useMemo(() => {
    const total = equipmentList.length;
    let projectsCount = 0;
    let internalCount = 0;
    let externalCount = 0;
    let due20DaysCount = 0;
    let overdueCount = 0;
    let upcomingCount = 0;

    equipmentList.forEach((e) => {
      const option = e.calibrationCategory === 'External Calibration' ? 'External Calibration' : 'Internal Calibration';
      if (option === 'External Calibration') externalCount++;
      else internalCount++;

      if (e.calibrationDueDate) {
        const days = getDaysUntilDue(e.calibrationDueDate, currentRiyadhDate);
        if (days !== null) {
          if (days < 0) overdueCount++;
          else if (days === 20) due20DaysCount++;
          else if (days > 0 && days <= 90) upcomingCount++;
        }
      }
    });

    return {
      total,
      internalCount,
      externalCount,
      due20DaysCount,
      overdueCount,
      upcomingCount
    };
  }, [equipmentList, currentRiyadhDate]);

  // Filtered equipment records based on active tab and search
  const filteredEquipment = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return equipmentList.filter((item) => {
      // Search matching
      if (q) {
        const matchesId = item.id.toLowerCase().includes(q);
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesProject = (item.currentProject || '').toLowerCase().includes(q);
        const matchesProvider = (item.externalProvider || '').toLowerCase().includes(q);
        const matchesSerial = (item.serialNumber || '').toLowerCase().includes(q);
        const matchesDueDate = (item.calibrationDueDate || '').toLowerCase().includes(q);

        if (!matchesId && !matchesName && !matchesProject && !matchesProvider && !matchesSerial && !matchesDueDate) {
          return false;
        }
      }

      const option = item.calibrationCategory === 'External Calibration' ? 'External Calibration' : 'Internal Calibration';
      const days = item.calibrationDueDate ? getDaysUntilDue(item.calibrationDueDate, currentRiyadhDate) : null;

      switch (activeTab) {
        case 'internal':
          return option === 'Internal Calibration';
        case 'external':
          return option === 'External Calibration';
        case 'due_20_days':
          return days === 20;
        case 'overdue':
          return days !== null && days < 0;
        case 'upcoming':
          return days !== null && days >= 0 && days <= 90;
        case 'all':
        default:
          return true;
      }
    });
  }, [equipmentList, activeTab, searchQuery, currentRiyadhDate]);

  // Selected items objects
  const selectedEquipmentItems = useMemo(() => {
    return equipmentList.filter((e) => selectedIds.has(e.id));
  }, [equipmentList, selectedIds]);

  // Handle Multi-Select Checkboxes
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredEquipment.length && filteredEquipment.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEquipment.map((e) => e.id)));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Open Preview Modal
  const handleOpenEmailPreview = () => {
    const preview = generateConsolidatedEmailPreview(
      equipmentList,
      DEFAULT_CONFIGURED_EMAIL,
      currentRiyadhDate
    );
    setEmailPreviewData(preview);
    setIsEmailPreviewModalOpen(true);
  };

  // Run Daily Check (Prioritizes sending from Primary Mail via Gmail API)
  const handleRunDailyCheckNow = async () => {
    try {
      setIsCheckingServer(true);

      // 1. Check if OAuth access token is available in memory
      let token = await getAccessToken();

      // 2. If not yet acquired, prompt Google Sign-in to connect primary mail (billal.acts@gmail.com)
      if (!token) {
        try {
          onToast('Authorizing primary Google account (billal.acts@gmail.com) to send email...');
          const authRes = await signInWithGoogle();
          token = authRes.accessToken;
        } catch (signInErr: any) {
          console.warn('Google sign-in popup skipped:', signInErr);
        }
      }

      // 3. If primary Google account is connected, send directly via Gmail API!
      if (token) {
        const sender = auth?.currentUser?.email || 'billal.acts@gmail.com';
        onToast(`Sending calibration email from primary mail (${sender}) via Gmail API...`);
        const gmailRes = await runCalibrationCheckViaGmail({
          equipmentList,
          force: false
        });

        if (gmailRes.success) {
          onToast(gmailRes.message);
          return;
        } else {
          onToast(`Gmail: ${gmailRes.message}`);
          return;
        }
      }

      // 4. Fallback to server check (Google Apps Script / SMTP / Simulation)
      onToast(`Running check in Asia/Riyadh (${currentRiyadhDate})...`);
      const res = await triggerServerDailyCheck({
        force: false,
        equipmentData: equipmentList
      });

      if (res.success) {
        onToast(res.message);
      } else {
        onToast(`Notice: ${res.message}`);
      }
    } catch (err: any) {
      onToast(`Error: ${err.message || 'Daily check failed'}`);
    } finally {
      setIsCheckingServer(false);
    }
  };

  const handleDeleteSingle = async () => {
    if (!itemToDelete) return;
    try {
      setIsDeleting(true);
      await deleteEquipmentItem(itemToDelete.id);
      onToast(`Deleted record "${itemToDelete.name}" (${itemToDelete.id})`);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(itemToDelete.id);
        return next;
      });
      setItemToDelete(null);
    } catch (err: any) {
      onToast(`Failed to delete record: ${err?.message || 'Error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteBatch = async () => {
    if (selectedIds.size === 0) return;
    try {
      setIsDeleting(true);
      const ids = Array.from(selectedIds);
      await deleteEquipmentBatch(ids);
      onToast(`Deleted ${ids.length} selected calibration records`);
      setSelectedIds(new Set());
      setShowBatchDeleteConfirm(false);
    } catch (err: any) {
      onToast(`Failed to delete selected records: ${err?.message || 'Error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      
      {/* Header: Calibration Reminder & Schedule Hub */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Calendar className="w-6 h-6 text-indigo-400 shrink-0" />
              <span>Calibration Reminder & Schedule Hub</span>
            </h1>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-emerald-300 font-semibold bg-emerald-950/40 border border-emerald-500/30 px-3 py-1 rounded-full w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>Automatic Email Reminders: ACTIVE • Scheduled daily at 08:00 AM (Asia/Riyadh)</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleOpenEmailPreview}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              <Mail className="w-4 h-4 text-slate-300" />
              <span>Preview Email</span>
            </button>

            <button
              type="button"
              onClick={handleRunDailyCheckNow}
              disabled={isCheckingServer}
              title="Emails are sent automatically every morning at 08:00 AM. Click here only if you wish to run a manual test now."
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-700/60 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Send className={`w-4 h-4 ${isCheckingServer ? 'animate-spin' : ''}`} />
              <span>{isCheckingServer ? 'Testing Check...' : 'Test Email Check Now'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Entry</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Records */}
        <div 
          onClick={() => setActiveTab('all')}
          className={`p-3.5 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-xs ${activeTab === 'all' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            Total Records
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {stats.total}
          </div>
        </div>

        {/* 1. Internal Calibration */}
        <div 
          onClick={() => setActiveTab('internal')}
          className={`p-3.5 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-xs ${activeTab === 'internal' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
            Internal Calib.
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {stats.internalCount}
          </div>
        </div>

        {/* 2. External Calibration */}
        <div 
          onClick={() => setActiveTab('external')}
          className={`p-3.5 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-xs ${activeTab === 'external' ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-1">
            External Calib.
          </div>
          <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
            {stats.externalCount}
          </div>
        </div>

        {/* Due within 20 Days */}
        <div 
          onClick={() => setActiveTab('due_20_days')}
          className={`p-3.5 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-xs ${activeTab === 'due_20_days' ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20 dark:bg-amber-950/20' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1 flex items-center justify-between">
            <span>Due in 20d</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {stats.due20DaysCount}
          </div>
        </div>

        {/* Overdue */}
        <div 
          onClick={() => setActiveTab('overdue')}
          className={`p-3.5 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-xs ${activeTab === 'overdue' ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1 flex items-center justify-between">
            <span>Overdue</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
            {stats.overdueCount}
          </div>
        </div>

        {/* Receiver Emails */}
        <div 
          onClick={() => setActiveTab('recipients')}
          className={`p-3.5 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-xs ${activeTab === 'recipients' ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1 flex items-center justify-between">
            <span>Receiver Emails</span>
            <Mail className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
            {recipients.length}
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All Records ({equipmentList.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('internal')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'internal'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Internal Calibration ({stats.internalCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('external')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'external'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            External Calibration ({stats.externalCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('due_20_days')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'due_20_days'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Due in 20d ({stats.due20DaysCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overdue')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'overdue'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Overdue ({stats.overdueCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bulk_batches')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'bulk_batches'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Bulk Entry History ({bulkBatches.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('email_logs')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'email_logs'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email Logs ({emailLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recipients')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'recipients'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-indigo-400" />
            <span>Receiver Email Settings ({recipients.length})</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'recipients' ? (
        <ReceiverEmailSettings onToast={onToast} />
      ) : activeTab === 'bulk_batches' ? (
        /* Bulk Batches History View */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-500" />
              <span>Bulk Calibration Entry Batches</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs"
            >
              + New Bulk Entry
            </button>
          </div>

          {bulkBatches.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400">
              No bulk batches recorded yet. Click "Bulk Calibration Entry" to record your first batch.
            </div>
          ) : (
            <div className="space-y-4">
              {bulkBatches.map((batch) => (
                <div key={batch.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-200 dark:border-slate-700/60">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{batch.id}</span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                        {batch.totalCount} items saved
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(batch.timestamp).toLocaleString()} • Recorded by {batch.recordedBy || 'User'}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="text-slate-400 text-[11px]">
                          <th className="py-1 px-2">Equipment ID</th>
                          <th className="py-1 px-2">Project</th>
                          <th className="py-1 px-2">Calibration Station Remark</th>
                          <th className="py-1 px-2">Due Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {batch.records.slice(0, 10).map((r, i) => (
                          <tr key={i} className="text-slate-700 dark:text-slate-300">
                            <td className="py-1 px-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">{r.equipmentId}</td>
                            <td className="py-1 px-2 font-medium">{r.projectName || 'CRCC'}</td>
                            <td className="py-1 px-2 text-slate-500">{r.remarks || '—'}</td>
                            <td className="py-1 px-2 font-semibold text-amber-600">{r.dueDate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {batch.records.length > 10 && (
                      <p className="text-[11px] text-slate-400 italic mt-1 px-2">
                        + {batch.records.length - 10} more records in this batch
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'email_logs' ? (
        /* Email Logs History View */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Mail className="w-5 h-5 text-indigo-500" />
                <span>Email Notification History</span>
              </h3>
            </div>
            <button
              type="button"
              onClick={handleOpenEmailPreview}
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-xs"
            >
              Preview Today's Email
            </button>
          </div>

          {emailLogs.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400">
              No email notification logs yet. Use "Run Daily Email Check Now" to test or wait for the scheduled daily runner.
            </div>
          ) : (
            <div className="space-y-3">
              {emailLogs.map((log) => {
                const isSuccess = log.status === 'sent' || log.status === 'simulated';
                const isSkipped = log.status === 'skipped_no_items' || log.status === 'already_sent_today';

                return (
                  <div key={log.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-200 dark:border-slate-700/60">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold">{log.dateString}</span>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                          isSuccess
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : isSkipped
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}>
                          {log.status}
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-300">
                          {log.totalEquipmentNotified} equipment item{log.totalEquipmentNotified === 1 ? '' : 's'} notified
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(log.sentAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                      <div><strong>Subject:</strong> {log.subject}</div>
                      <div><strong>Recipient:</strong> <code className="font-mono">{log.recipientEmail}</code></div>
                      <div className="text-[11px] text-slate-500">
                        Total items: {log.totalEquipmentNotified}{(log.groupedSummary.overdueCount || 0) > 0 ? ` • ${log.groupedSummary.overdueCount} Overdue` : ''}
                      </div>
                      {log.errorDetails && (
                        <div className="text-rose-600 dark:text-rose-400 text-xs mt-1">
                          {log.errorDetails}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Standard Table View with Search, Multi-select, and Bulk Update */
        <div className="space-y-4">
          
          {/* Search Bar & Multi-Select Action Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Quick Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ID (e.g. C3332), Name, Project, Serial..."
                className="w-full pl-10 pr-9 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Multi-Select Batch Actions (When 1+ rows selected) */}
            {selectedIds.size > 0 ? (
              <div className="flex flex-wrap items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-3 py-1.5 rounded-xl text-xs text-amber-900 dark:text-amber-200 animate-in fade-in">
                <span className="font-bold">{selectedIds.size} selected</span>
                <span className="text-amber-300">|</span>
                <button
                  type="button"
                  onClick={() => setIsBatchDueDateModalOpen(true)}
                  className="px-3 py-1 font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Update Due Dates Together</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowBatchDeleteConfirm(true)}
                  className="px-3 py-1 font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedIds.size})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-amber-700 dark:text-amber-300 hover:underline cursor-pointer ml-1"
                >
                  Deselect All
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Entry</span>
                </button>
              </div>
            )}
          </div>

          {/* Table Container */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            
            {/* Mobile Header: Select All + Record Count */}
            <div className="md:hidden p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="cursor-pointer text-slate-600 dark:text-slate-300 hover:text-indigo-600 flex items-center gap-2 font-bold"
              >
                {selectedIds.size === filteredEquipment.length && filteredEquipment.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span>Select All ({selectedIds.size})</span>
              </button>
              <span className="text-slate-500 font-medium text-[11px]">
                {filteredEquipment.length} records
              </span>
            </div>

            {/* Mobile View: Clean Card Layout for each record */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredEquipment.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No equipment calibration records found matching this view.
                </div>
              ) : (
                filteredEquipment.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  const option = item.calibrationCategory === 'External Calibration' ? 'External Calibration' : 'Internal Calibration';
                  const days = item.calibrationDueDate ? getDaysUntilDue(item.calibrationDueDate, currentRiyadhDate) : null;
                  const isDueToday = days === 20;

                  return (
                    <div 
                      key={item.id}
                      className={`p-3.5 transition-colors ${
                        isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : isDueToday ? 'bg-amber-50/30 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      {/* Top row: Checkbox, ID, Option & Days Left */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectItem(item.id)}
                            className="cursor-pointer text-slate-400 hover:text-indigo-600 shrink-0"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                          <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                            {item.id}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            option === 'External Calibration'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          }`}>
                            {option === 'External Calibration' ? 'External' : 'Internal'}
                          </span>
                        </div>

                        <div className="shrink-0 text-right">
                          {days === null ? (
                            <span className="text-slate-400 text-xs">—</span>
                          ) : days < 0 ? (
                            <span className="inline-flex items-center gap-1 font-bold text-xs text-rose-600 dark:text-rose-400">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {Math.abs(days)}d Overdue
                            </span>
                          ) : days === 20 ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold text-xs bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              20d Due
                            </span>
                          ) : (
                            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                              {days}d left
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Name & Details */}
                      <div className="mb-2.5">
                        <button
                          type="button"
                          onClick={() => onSelectEquipment(item)}
                          className="font-bold text-sm text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 text-left block"
                        >
                          {item.name}
                        </button>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span>Due: <strong className="text-slate-700 dark:text-slate-300">{item.calibrationDueDate || 'Not set'}</strong></span>
                          {item.serialNumber && item.serialNumber !== 'Not recorded' && (
                            <span>• SN: <code className="font-mono">{item.serialNumber}</code></span>
                          )}
                          {item.currentProject && <span>• {item.currentProject}</span>}
                          {item.notes && <span>• {item.notes}</span>}
                        </div>
                      </div>

                      {/* Bottom Bar: Notification status & Row actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="text-[11px]">
                          {item.lastNotificationStatus === 'sent' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                              <CheckCircle2 className="w-3 h-3" /> Sent to Inbox
                            </span>
                          ) : item.lastNotificationStatus === 'simulated' ? (
                            <span className="inline-flex items-center gap-1 text-amber-500 dark:text-amber-400 font-medium">
                              <AlertTriangle className="w-3 h-3" /> Simulated
                            </span>
                          ) : (
                            <span className="text-slate-400">Reminder: Pending</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {(item.lastNotifiedDueDate || item.lastNotificationStatus) && (
                            <button
                              type="button"
                              onClick={() => {
                                resetEquipmentNotificationStatus(item.id);
                                onToast(`Reset reminder status for ${item.id} to Pending`);
                              }}
                              title="Reset notification status to Pending"
                              className="p-1.5 text-slate-400 hover:text-indigo-400 rounded cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedIds(new Set([item.id]));
                              setIsBatchDueDateModalOpen(true);
                            }}
                            title="Update calibration due date"
                            className="p-1.5 text-slate-400 hover:text-amber-600 rounded cursor-pointer"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditEquipment(item)}
                            title="Edit equipment record"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setItemToDelete(item)}
                            title="Delete calibration entry"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop View: Full Table (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                    <th className="py-3 px-4 w-12 text-center">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="cursor-pointer text-slate-400 hover:text-indigo-600"
                        title="Select/Deselect all visible records"
                      >
                        {selectedIds.size === filteredEquipment.length && filteredEquipment.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4">Asset ID</th>
                    <th className="py-3 px-4">Equipment Name</th>
                    <th className="py-3 px-4">Calibration Option</th>
                    <th className="py-3 px-4">Project Name</th>
                    <th className="py-3 px-4">Serial No.</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Days to Due</th>
                    <th className="py-3 px-4">Cycle Notification</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {filteredEquipment.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-xs text-slate-400">
                        No equipment calibration records found matching this view.
                      </td>
                    </tr>
                  ) : (
                    filteredEquipment.map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      const option = item.calibrationCategory === 'External Calibration' ? 'External Calibration' : 'Internal Calibration';
                      const days = item.calibrationDueDate ? getDaysUntilDue(item.calibrationDueDate, currentRiyadhDate) : null;
                      const isDueToday = days === 20;

                      return (
                        <tr 
                          key={item.id} 
                          className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                            isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : isDueToday ? 'bg-amber-50/30 dark:bg-amber-950/20' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleSelectItem(item.id)}
                              className="cursor-pointer text-slate-400 hover:text-indigo-600"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-indigo-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>

                          {/* ID */}
                          <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {item.id}
                          </td>

                          {/* Name */}
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => onSelectEquipment(item)}
                              className="font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer text-left"
                            >
                              {item.name}
                            </button>
                          </td>

                          {/* Calibration Option */}
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                              option === 'External Calibration'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            }`}>
                              {option === 'External Calibration' ? 'External' : 'Internal'}
                            </span>
                          </td>

                          {/* Project Name */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {item.currentProject || '—'}
                            </div>
                            {item.notes ? (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={item.notes}>
                                {item.notes}
                              </div>
                            ) : null}
                          </td>

                          {/* Serial */}
                          <td className="py-3 px-4 font-mono text-slate-500">
                            {item.serialNumber && item.serialNumber !== 'Not recorded' ? item.serialNumber : '—'}
                          </td>

                          {/* Due Date */}
                          <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                            {item.calibrationDueDate || 'Not set'}
                          </td>

                          {/* Days to Due */}
                          <td className="py-3 px-4">
                            {days === null ? (
                              <span className="text-slate-400">—</span>
                            ) : days < 0 ? (
                              <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
                                <AlertCircle className="w-3.5 h-3.5" />
                                {Math.abs(days)}d Overdue
                              </span>
                            ) : days === 20 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                20d (Due Today)
                              </span>
                            ) : (
                              <span className="text-slate-600 dark:text-slate-400">
                                {days} days left
                              </span>
                            )}
                          </td>

                          {/* Notification Cycle state */}
                          <td className="py-3 px-4 text-[11px]">
                            {item.lastNotificationStatus === 'sent' ? (
                              <span 
                                className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold"
                                title="Delivered to real recipient inboxes via SMTP"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Sent to Inbox
                              </span>
                            ) : item.lastNotificationStatus === 'simulated' || (item.lastNotifiedDueDate === item.calibrationDueDate && item.lastNotifiedDueDate) ? (
                              <span 
                                className="inline-flex items-center gap-1 text-amber-500 dark:text-amber-400 font-medium"
                                title="Simulated locally - SMTP not configured yet"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                Simulated (No SMTP)
                              </span>
                            ) : (
                              <span className="text-slate-400">Pending</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {(item.lastNotifiedDueDate || item.lastNotificationStatus) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    resetEquipmentNotificationStatus(item.id);
                                    onToast(`Reset reminder status for ${item.id} to Pending`);
                                  }}
                                  title="Reset notification status to Pending"
                                  className="p-1 text-slate-400 hover:text-indigo-400 rounded cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedIds(new Set([item.id]));
                                  setIsBatchDueDateModalOpen(true);
                                }}
                                title="Update calibration due date"
                                className="p-1 text-slate-400 hover:text-amber-600 rounded cursor-pointer"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditEquipment(item)}
                                title="Edit equipment record"
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setItemToDelete(item)}
                                title="Delete calibration entry"
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Entry Modal */}
      <BulkCalibrationModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onSuccess={(count) => {
          onToast(`Successfully saved ${count} calibration records!`);
          setBulkBatches(getStoredBulkBatches());
        }}
        currentUserEmail={currentUserEmail}
        existingIds={equipmentList.map((e) => e.id)}
      />

      {/* Batch Due Date Update Modal */}
      <BatchDueDateModal
        isOpen={isBatchDueDateModalOpen}
        selectedItems={selectedEquipmentItems}
        onClose={() => setIsBatchDueDateModalOpen(false)}
        onSuccess={(count) => {
          onToast(`Updated calibration due date for ${count} equipment records!`);
          setSelectedIds(new Set());
        }}
      />

      {/* Email Preview Modal */}
      <EmailPreviewModal
        isOpen={isEmailPreviewModalOpen}
        onClose={() => setIsEmailPreviewModalOpen(false)}
        preview={emailPreviewData}
        equipmentList={equipmentList}
        onSent={(log) => {
          onToast(`Consolidated daily check completed: ${log.status}`);
          setEmailLogs((prev) => [log, ...prev.filter((l) => l.id !== log.id)]);
        }}
      />

      {/* Single Item Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Delete Calibration Record
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Are you sure you want to remove this record from the entry list?
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Asset ID:</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{itemToDelete.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Equipment Name:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{itemToDelete.name}</span>
              </div>
              {itemToDelete.serialNumber && itemToDelete.serialNumber !== 'Not recorded' && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Serial Number:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{itemToDelete.serialNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Due Date:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{itemToDelete.calibrationDueDate || 'None'}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSingle}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Record'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {showBatchDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Delete {selectedIds.size} Records
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Are you sure you want to permanently delete all {selectedIds.size} selected calibration records?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBatchDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBatch}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : `Delete ${selectedIds.size} Records`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
