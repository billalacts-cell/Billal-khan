import React, { useState, useMemo } from 'react';
import { 
  Wrench, 
  Search, 
  X, 
  Filter, 
  Plus, 
  RefreshCw, 
  Upload, 
  Download, 
  Building, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRightLeft, 
  Eye, 
  Edit3, 
  Trash2, 
  FileSpreadsheet,
  Layers,
  Calendar,
  Camera,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import { 
  EquipmentItem, 
  EquipmentStatus, 
  CalibrationStatus, 
  SheetInspectionResult 
} from '../../types';
import { TARGET_SPREADSHEET_ID } from '../../services/googleSheetsService';

interface EquipmentDashboardProps {
  equipmentList: EquipmentItem[];
  inspectionResult: SheetInspectionResult | null;
  isSyncingSheet: boolean;
  onSyncSheet: () => void;
  onOpenAddModal: () => void;
  onOpenBulkCalibration?: () => void;
  onNavigateToCalibration?: () => void;
  onOpenImportModal: () => void;
  onExportCsv: () => void;
  onSelectEquipment: (item: EquipmentItem) => void;
  onOpenTransferModal: (item: EquipmentItem) => void;
  onEditEquipment: (item: EquipmentItem) => void;
  onDeleteEquipment: (id: string, name: string) => void;
  isSignedIn: boolean;
  onSignIn: () => void;
}

export const EquipmentDashboard: React.FC<EquipmentDashboardProps> = ({
  equipmentList,
  inspectionResult,
  isSyncingSheet,
  onSyncSheet,
  onOpenAddModal,
  onOpenBulkCalibration,
  onNavigateToCalibration,
  onOpenImportModal,
  onExportCsv,
  onSelectEquipment,
  onOpenTransferModal,
  onEditEquipment,
  onDeleteEquipment,
  isSignedIn,
  onSignIn,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [projectFilter, setProjectFilter] = useState<string>('All');
  const [calibrationFilter, setCalibrationFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [showInspectionDetails, setShowInspectionDetails] = useState(false);

  // Derived filter options
  const categories = useMemo(() => {
    const set = new Set<string>();
    equipmentList.forEach((e) => {
      if (e.category && e.category !== 'Not recorded') set.add(e.category);
    });
    return Array.from(set);
  }, [equipmentList]);

  const projects = useMemo(() => {
    const set = new Set<string>();
    equipmentList.forEach((e) => {
      if (e.currentProject && e.currentProject !== 'Not recorded') set.add(e.currentProject);
    });
    return Array.from(set);
  }, [equipmentList]);

  // Calculations for summary stats
  const stats = useMemo(() => {
    const total = equipmentList.length;
    const assigned = equipmentList.filter((e) => e.status === 'Assigned' || (e.currentProject && e.currentProject.toLowerCase() !== 'in stock' && e.currentProject.toLowerCase() !== 'stock')).length;
    const inStock = equipmentList.filter((e) => e.status === 'In Stock' || (e.currentProject && e.currentProject.toLowerCase() === 'in stock')).length;
    const maintenance = equipmentList.filter((e) => e.status === 'Under Maintenance').length;
    const calibrationDueOrExpired = equipmentList.filter((e) => e.calibrationStatus === 'Expired' || e.calibrationStatus === 'Upcoming' || e.status === 'Calibration Due').length;
    const expiredCount = equipmentList.filter((e) => e.calibrationStatus === 'Expired').length;
    return { total, assigned, inStock, maintenance, calibrationDueOrExpired, expiredCount };
  }, [equipmentList]);

  // Search and filtered items
  const filteredEquipment = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return equipmentList.filter((item) => {
      // Search matching: ID, name, project, manufacturer, model, serial number
      if (q) {
        const matchesId = item.id.toLowerCase().includes(q);
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesProject = (item.currentProject || '').toLowerCase().includes(q);
        const matchesLocation = (item.currentLocation || '').toLowerCase().includes(q);
        const matchesMfg = (item.manufacturer || '').toLowerCase().includes(q);
        const matchesModel = (item.model || '').toLowerCase().includes(q);
        const matchesSerial = (item.serialNumber || '').toLowerCase().includes(q);

        if (!matchesId && !matchesName && !matchesProject && !matchesLocation && !matchesMfg && !matchesModel && !matchesSerial) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'All' && item.status !== statusFilter) {
        return false;
      }

      // Category filter
      if (categoryFilter !== 'All' && item.category !== categoryFilter) {
        return false;
      }

      // Project filter
      if (projectFilter !== 'All' && item.currentProject !== projectFilter) {
        return false;
      }

      // Calibration filter
      if (calibrationFilter !== 'All' && item.calibrationStatus !== calibrationFilter) {
        return false;
      }

      return true;
    });
  }, [equipmentList, searchQuery, statusFilter, categoryFilter, projectFilter, calibrationFilter]);

  const getStatusBadge = (status: EquipmentStatus) => {
    switch (status) {
      case 'Assigned':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
            <Building className="w-3 h-3" />
            Assigned
          </span>
        );
      case 'In Stock':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3" />
            In Stock
          </span>
        );
      case 'Under Maintenance':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            <Wrench className="w-3 h-3" />
            Under Maintenance
          </span>
        );
      case 'Calibration Due':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
            <AlertTriangle className="w-3 h-3" />
            Calibration Due
          </span>
        );
      case 'Decommissioned':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
            Decommissioned
          </span>
        );
    }
  };

  const getCalibrationBadge = (calStatus: CalibrationStatus, dueDate: string | null) => {
    switch (calStatus) {
      case 'Valid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
            <CheckCircle2 className="w-3 h-3" />
            Calibrated ({dueDate || 'Valid'})
          </span>
        );
      case 'Upcoming':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
            <Clock className="w-3 h-3" />
            Due soon: {dueDate}
          </span>
        );
      case 'Expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
            <AlertCircle className="w-3 h-3" />
            Expired: {dueDate}
          </span>
        );
      case 'Not Applicable':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            N/A
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Sync Information Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md relative overflow-hidden border border-indigo-900/40">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                Asset & Movement Management
              </span>
              <span className="text-xs text-slate-300">
                Connected Sheet ID: <code className="bg-slate-800/80 px-1.5 py-0.5 rounded text-[11px] text-indigo-300 font-mono">{TARGET_SPREADSHEET_ID.substring(0, 10)}...</code>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Wrench className="w-6 h-6 text-indigo-400" />
              Equipment Tracking Dashboard
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1">
              Real-time equipment inventory, location assignments, movement tracking audit trails, and calibration schedules.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={onSyncSheet}
              disabled={isSyncingSheet}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Sync with Google Sheet via Google Sheets API"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingSheet ? 'animate-spin' : ''}`} />
              <span>{isSyncingSheet ? 'Syncing Sheet...' : 'Sync Google Sheet'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenImportModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
              title="Import equipment from CSV or spreadsheet export"
            >
              <Upload className="w-4 h-4 text-slate-300" />
              <span>Import CSV</span>
            </button>

            <button
              type="button"
              onClick={onExportCsv}
              disabled={equipmentList.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer disabled:opacity-40"
              title="Export equipment list as CSV"
            >
              <Download className="w-4 h-4 text-slate-300" />
              <span className="hidden sm:inline">Export</span>
            </button>

            {onNavigateToCalibration && (
              <button
                type="button"
                onClick={onNavigateToCalibration}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-400/30 transition-colors cursor-pointer"
                title="Go to Calibration Reminders & Bulk Entry"
              >
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>Calibration Hub</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Register Equipment</span>
            </button>
          </div>
        </div>

        {/* Sheet Inspection Summary bar */}
        {inspectionResult && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
            {inspectionResult.error ? (
              <div className="flex items-center gap-2 text-amber-300 flex-1">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs">{inspectionResult.error}</span>
                {!isSignedIn && (
                  <button
                    type="button"
                    onClick={onSignIn}
                    className="ml-auto px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                  >
                    Authorize Google Account
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Sheet Connected: {inspectionResult.title || 'Equipment Registry'}
                  </span>
                  <span className="text-slate-400">|</span>
                  <span>Tab: <strong className="text-white">{inspectionResult.activeSheet}</strong></span>
                  <span className="text-slate-400">|</span>
                  <span>Mapped Headers: <strong className="text-white">{Object.keys(inspectionResult.mappedColumns).length}</strong></span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowInspectionDetails(!showInspectionDetails)}
                  className="text-xs text-indigo-300 hover:text-indigo-200 font-medium underline underline-offset-2 cursor-pointer flex items-center gap-1"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>{showInspectionDetails ? 'Hide inspection details' : 'View sheet column mappings'}</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* Expanded Column Mapping Details */}
        {showInspectionDetails && inspectionResult && (
          <div className="mt-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-2">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
              Sheet Inspection Report ({inspectionResult.spreadsheetId})
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Detected Sheet Columns ({inspectionResult.headers.length}):
                </p>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {inspectionResult.headers.map((h, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 text-[11px] font-mono">
                      {h}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Active Column Mappings:
                </p>
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  {Object.entries(inspectionResult.mappedColumns).map(([field, colName]) => (
                    <div key={field} className="flex items-center gap-1 text-slate-300">
                      <span className="text-slate-400 capitalize">{field}:</span>
                      <strong className="text-indigo-300 truncate">{colName}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {inspectionResult.missingFields.length > 0 && (
              <div className="pt-2 text-[11px] text-amber-300/90 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Unmapped fields defaulting to <em>"Not recorded"</em>: {inspectionResult.missingFields.join(', ')}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Records */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Records</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
            {stats.total}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Registered equipment assets
          </div>
        </div>

        {/* Assigned */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Assigned</span>
            <Building className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400">
            {stats.assigned}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Deployed to active projects
          </div>
        </div>

        {/* In Stock */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">In Stock</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {stats.inStock}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Available in storage
          </div>
        </div>

        {/* Maintenance */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Maintenance</span>
            <Wrench className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400">
            {stats.maintenance}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Service & repair queue
          </div>
        </div>

        {/* Calibration Due / Expired */}
        <div 
          onClick={onNavigateToCalibration}
          className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs col-span-2 sm:col-span-1 transition-all ${
            onNavigateToCalibration ? 'cursor-pointer hover:border-rose-400 hover:shadow-sm' : ''
          }`}
          title={onNavigateToCalibration ? "Click to open Calibration Hub" : undefined}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Calibration Due</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 flex items-baseline gap-1.5">
            {stats.calibrationDueOrExpired}
            {stats.expiredCount > 0 && (
              <span className="text-xs font-bold text-rose-500 dark:text-rose-400">
                ({stats.expiredCount} expired)
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
            <span>Needs certification check</span>
            {onNavigateToCalibration && <ChevronRight className="w-3 h-3 text-rose-500" />}
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Quick Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID (e.g. C3332), Name (e.g. Thermometer), Project (e.g. CRCC), or Model..."
              className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Select */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="In Stock">In Stock</option>
              <option value="Assigned">Assigned</option>
              <option value="Under Maintenance">Under Maintenance</option>
              <option value="Calibration Due">Calibration Due</option>
              <option value="Decommissioned">Decommissioned</option>
            </select>

            {/* Calibration Select */}
            <select
              value={calibrationFilter}
              onChange={(e) => setCalibrationFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="All">All Calibrations</option>
              <option value="Valid">Valid</option>
              <option value="Upcoming">Upcoming (Due in 30d)</option>
              <option value="Expired">Expired</option>
              <option value="Not Applicable">N/A</option>
            </select>

            {/* Project Select */}
            {projects.length > 0 && (
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer max-w-[140px]"
              >
                <option value="All">All Projects</option>
                {projects.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden ml-auto">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                title="Card Grid View"
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                title="Compact Table View"
              >
                Table
              </button>
            </div>
          </div>
        </div>

        {/* Active Filter Chips */}
        {(statusFilter !== 'All' || categoryFilter !== 'All' || projectFilter !== 'All' || calibrationFilter !== 'All' || searchQuery) && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs text-slate-500">
            <span>Filtered results: <strong>{filteredEquipment.length}</strong> of {equipmentList.length}</span>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('All');
                setCategoryFilter('All');
                setProjectFilter('All');
                setCalibrationFilter('All');
              }}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer ml-auto"
            >
              Reset filters
            </button>
          </div>
        )}
      </div>

      {/* Equipment Records Display */}
      {filteredEquipment.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4">
            <Wrench className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {equipmentList.length === 0 ? 'No Equipment Registered Yet' : 'No Equipment Matching Search'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-6">
            {equipmentList.length === 0
              ? `Sync from Google Sheet (${TARGET_SPREADSHEET_ID.substring(0, 12)}...), import an existing CSV inventory, or register your first equipment asset manually.`
              : 'Try clearing your search query or selecting "All" in the status, category, and project filters.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onSyncSheet}
              disabled={isSyncingSheet}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheet ? 'animate-spin' : ''}`} />
              <span>Sync Google Sheet</span>
            </button>
            <button
              type="button"
              onClick={onOpenImportModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import CSV File</span>
            </button>
            <button
              type="button"
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Equipment</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* Card Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEquipment.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700/60 transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Header: ID, Status, Photos count */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                      #{item.id}
                    </span>
                    {getStatusBadge(item.status)}
                  </div>

                  {item.photos && item.photos.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      <Camera className="w-3 h-3" />
                      {item.photos.length}
                    </span>
                  )}
                </div>

                {/* Name & Category */}
                <h3 
                  onClick={() => onSelectEquipment(item)}
                  className="text-base font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors line-clamp-1"
                  title="Click to view full equipment details"
                >
                  {item.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3 flex items-center gap-2">
                  <span>{item.category || 'General Equipment'}</span>
                  {item.manufacturer && item.manufacturer !== 'Not recorded' && (
                    <>
                      <span>•</span>
                      <span className="truncate">{item.manufacturer}</span>
                    </>
                  )}
                </p>

                {/* Key specs grid */}
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Building className="w-3.5 h-3.5" /> Project:
                    </span>
                    <strong className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[140px]">
                      {item.currentProject}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> Location:
                    </span>
                    <span className="truncate max-w-[140px] text-slate-700 dark:text-slate-300">
                      {item.currentLocation}
                    </span>
                  </div>

                  {item.model && item.model !== 'Not recorded' && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Model:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                        {item.model}
                      </span>
                    </div>
                  )}

                  {/* Calibration status chip */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-400 text-[11px]">Calibration:</span>
                    <div>{getCalibrationBadge(item.calibrationStatus, item.calibrationDueDate)}</div>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onSelectEquipment(item)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Details</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onOpenTransferModal(item)}
                    title="Transfer equipment to project / location"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onEditEquipment(item)}
                    title="Edit equipment record"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteEquipment(item.id, item.name)}
                    title="Delete record"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Compact Table View */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                  <th className="py-3 px-4">Asset ID</th>
                  <th className="py-3 px-4">Equipment Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Current Project</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Calibration</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredEquipment.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {item.id}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => onSelectEquipment(item)}
                        className="font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer text-left"
                      >
                        {item.name}
                      </button>
                      {item.manufacturer && item.manufacturer !== 'Not recorded' && (
                        <span className="block text-[11px] text-slate-400 truncate max-w-[160px]">
                          {item.manufacturer} {item.model !== 'Not recorded' ? item.model : ''}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {item.category || 'General'}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {item.currentProject}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {item.currentLocation}
                    </td>
                    <td className="py-3 px-4">
                      {getCalibrationBadge(item.calibrationStatus, item.calibrationDueDate)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectEquipment(item)}
                          className="px-2 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg cursor-pointer"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenTransferModal(item)}
                          title="Transfer"
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditEquipment(item)}
                          title="Edit"
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
