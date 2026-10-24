import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Calendar, 
  Users, 
  CheckSquare, 
  Square 
} from 'lucide-react';
import { CalibrationEmailPreview, CalibrationEmailLog, EquipmentItem, CalibrationRecipient } from '../../types';
import { 
  triggerServerDailyCheck, 
  getStoredRecipients, 
  subscribeToRecipients,
  DEFAULT_CONFIGURED_EMAIL 
} from '../../services/calibrationService';
import { auth, getAccessToken, signInWithGoogle } from '../../firebase';
import { sendEmailViaGmailApi } from '../../services/gmailService';
import { getLocalEquipment, saveLocalEquipment } from '../../services/equipmentStorage';

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  preview: CalibrationEmailPreview | null;
  equipmentList: EquipmentItem[];
  onSent: (log: CalibrationEmailLog) => void;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  isOpen,
  onClose,
  preview,
  equipmentList,
  onSent
}) => {
  const [recipients, setRecipients] = useState<CalibrationRecipient[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredRecipients();
      setRecipients(stored);
      const active = stored.filter((r) => r.selected).map((r) => r.email);
      setSelectedEmails(active.length > 0 ? active : [DEFAULT_CONFIGURED_EMAIL]);
    }
  }, [isOpen]);

  useEffect(() => {
    const unsub = subscribeToRecipients((items) => {
      setRecipients(items);
    });
    return () => unsub();
  }, []);

  if (!isOpen || !preview) return null;

  const handleToggleEmail = (email: string) => {
    setSelectedEmails((prev) => {
      if (prev.includes(email)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((e) => e !== email);
      } else {
        return [...prev, email];
      }
    });
  };

  const handleToggleAll = () => {
    if (selectedEmails.length === recipients.length) {
      // select only the first
      setSelectedEmails([recipients[0]?.email || DEFAULT_CONFIGURED_EMAIL]);
    } else {
      setSelectedEmails(recipients.map((r) => r.email));
    }
  };

  const handleSendNow = async (force: boolean = false) => {
    if (selectedEmails.length === 0) {
      setErrorMessage('Please select at least one recipient email.');
      return;
    }

    try {
      setIsSending(true);
      setErrorMessage(null);
      setResultMessage(null);

      // 1. Try sending directly from primary Google account (billal.acts@gmail.com) via Gmail API
      let token = await getAccessToken();
      if (!token) {
        try {
          const authRes = await signInWithGoogle();
          token = authRes.accessToken;
        } catch (authErr) {
          console.warn('Google sign-in popup skipped:', authErr);
        }
      }

      if (token) {
        const gmailRes = await sendEmailViaGmailApi({
          to: selectedEmails,
          subject: preview.subject,
          htmlBody: preview.htmlBody
        });

        if (gmailRes.success) {
          const sender = gmailRes.sentFrom || auth?.currentUser?.email || 'billal.acts@gmail.com';
          setResultMessage(`Email successfully delivered from your primary account (${sender}) to ${selectedEmails.join(', ')}!`);

          // Update local equipment notification cycle state
          const now = Date.now();
          const current = getLocalEquipment();
          const next = current.map((item) => {
            const isDue = preview.internalItems.some((i) => i.equipmentId.toLowerCase() === item.id.toLowerCase()) ||
                          preview.externalItems.some((i) => i.equipmentId.toLowerCase() === item.id.toLowerCase()) ||
                          preview.projectsItems.some((p) => p.items.some((i) => i.equipmentId.toLowerCase() === item.id.toLowerCase())) ||
                          (preview.overdueItems || []).some((o) => o.equipmentId.toLowerCase() === item.id.toLowerCase());
            if (isDue) {
              return {
                ...item,
                lastNotifiedDueDate: item.calibrationDueDate,
                lastNotifiedAt: now,
                lastNotificationStatus: 'sent' as const
              };
            }
            return item;
          });
          saveLocalEquipment(next);

          const log: CalibrationEmailLog = {
            id: `gmail_modal_${now}`,
            dateString: preview.dateString,
            sentAt: now,
            recipientEmail: selectedEmails.join(', '),
            subject: preview.subject,
            totalEquipmentNotified: preview.totalDue + (preview.totalOverdue || 0),
            groupedSummary: {
              overdueCount: preview.totalOverdue || 0,
              projectsCount: preview.projectsItems.reduce((acc, p) => acc + p.items.length, 0),
              internalCount: preview.internalItems.length,
              externalCount: preview.externalItems.length
            },
            notifiedItems: [],
            status: 'sent',
            htmlPreview: preview.htmlBody
          };
          onSent(log);
          return;
        } else {
          setErrorMessage(gmailRes.error || 'Failed to send email via Gmail API');
          return;
        }
      }

      // 2. Fallback to server check (Google Apps Script / SMTP / Simulation)
      const res = await triggerServerDailyCheck({
        force,
        equipmentData: equipmentList,
        recipients: selectedEmails
      });

      if (!res.success && res.status === 'failed') {
        setErrorMessage(res.message);
      } else {
        setResultMessage(res.message);
        if (res.log) {
          onSent(res.log);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error executing consolidated email check');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Consolidated Email Preview</span>
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Alerts */}
        {resultMessage && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{resultMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Recipients Bar */}
        <div className="mx-5 mt-4 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Users className="w-3.5 h-3.5 text-indigo-500" />
              <span>Target Recipients ({selectedEmails.length} selected):</span>
            </div>
            <button
              type="button"
              onClick={handleToggleAll}
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              {selectedEmails.length === recipients.length ? 'Deselect Extra' : 'Select All'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {recipients.map((rec) => {
              const isSelected = selectedEmails.includes(rec.email);
              return (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => handleToggleEmail(rec.email)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-800 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-200 font-bold'
                      : 'bg-white border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 opacity-60'
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>{rec.name}</span>
                  <span className="font-mono text-[10px] opacity-75">({rec.email})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Metadata summary bar */}
        <div className="p-3 mx-5 mt-3 bg-slate-50/50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Subject:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100 truncate block" title={preview.subject}>
              {preview.subject}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Riyadh Date:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              {preview.dateString}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Due in 20d:</span>
            <span className={`font-bold ${preview.totalDue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
              {preview.totalDue} item{preview.totalDue === 1 ? '' : 's'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Notice Window:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              20 Days Notice
            </span>
          </div>
        </div>

        {/* HTML Email Sandbox / Preview Frame */}
        <div className="p-4 sm:p-5 flex-1 overflow-auto">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-inner bg-white">
            <iframe
              srcDoc={preview.htmlBody}
              title="Email Preview"
              className="w-full h-[360px] border-0"
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="text-xs text-slate-500">
            {preview.totalDue === 0 ? (
              <span className="text-slate-400 italic">No equipment due for calibration in 20 days.</span>
            ) : (
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {preview.totalDue} equipment item{preview.totalDue === 1 ? '' : 's'} due for 20-day calibration reminder.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Close Preview
            </button>

            <button
              type="button"
              onClick={() => handleSendNow(false)}
              disabled={isSending}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer disabled:opacity-50"
              title="Runs daily check with idempotency"
            >
              <Send className={`w-3.5 h-3.5 ${isSending ? 'animate-spin' : ''}`} />
              <span>{isSending ? 'Dispatching...' : 'Trigger Daily Check Now'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSendNow(true)}
              disabled={isSending}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              title="Force re-send even if already run today"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Force Run</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
