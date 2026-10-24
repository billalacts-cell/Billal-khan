import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Users, 
  CheckSquare, 
  Square, 
  AlertCircle,
  AlertTriangle,
  Save,
  Server,
  Key,
  Send,
  CheckCircle2,
  RotateCcw,
  RefreshCw,
  ShieldCheck,
  FileSpreadsheet,
  Code2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Clock,
  Sparkles
} from 'lucide-react';
import { CalibrationRecipient } from '../../types';
import { 
  getStoredRecipients, 
  saveLocalRecipients, 
  addRecipient, 
  updateRecipient, 
  deleteRecipient, 
  selectAllRecipients,
  subscribeToRecipients,
  getSmtpConfig,
  saveSmtpConfig,
  testSmtpDelivery,
  resetEquipmentNotificationStatus,
  getAppsScriptConfig,
  saveAppsScriptConfig,
  testAppsScriptConnection,
  testAppsScriptDelivery,
  triggerAppsScriptCheck,
  setupAppsScriptTrigger,
  getSelectedRecipientEmails
} from '../../services/calibrationService';
import { auth, signInWithGoogle, getAccessToken } from '../../firebase';
import { sendGmailTestEmail, runCalibrationCheckViaGmail } from '../../services/gmailService';

interface ReceiverEmailSettingsProps {
  onToast?: (message: string) => void;
}

export const ReceiverEmailSettings: React.FC<ReceiverEmailSettingsProps> = ({ onToast }) => {
  const [recipients, setRecipients] = useState<CalibrationRecipient[]>([]);
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Google Apps Script Settings State
  const [gasUrl, setGasUrl] = useState('');
  const [gasSecret, setGasSecret] = useState('');
  const [gasSpreadsheetId, setGasSpreadsheetId] = useState('1-zp0508H-nlZNPql2JQlQClK1aRYF1vFqn7y9U3L6kk');
  const [gasConfigured, setGasConfigured] = useState(false);
  const [gasInfo, setGasInfo] = useState<any>(null);
  const [isSavingGas, setIsSavingGas] = useState(false);
  const [isTestingGasConn, setIsTestingGasConn] = useState(false);
  const [isSendingGasTest, setIsSendingGasTest] = useState(false);
  const [isTriggeringGasCheck, setIsTriggeringGasCheck] = useState(false);
  const [isInstallingTrigger, setIsInstallingTrigger] = useState(false);
  const [gasFeedback, setGasFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showDeploymentGuide, setShowDeploymentGuide] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // SMTP Settings State
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [smtpHasPassword, setSmtpHasPassword] = useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpFeedback, setSmtpFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Primary Gmail Delivery State
  const [hasGmailToken, setHasGmailToken] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isSendingGmailTest, setIsSendingGmailTest] = useState(false);
  const [isSendingGmailCheck, setIsSendingGmailCheck] = useState(false);
  const [gmailFeedback, setGmailFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    getAccessToken().then((t) => setHasGmailToken(Boolean(t)));
  }, []);

  useEffect(() => {
    const unsub = subscribeToRecipients((items) => {
      setRecipients(items);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // Load initial Apps Script settings from backend
    getAppsScriptConfig().then((cfg) => {
      if (cfg) {
        setGasConfigured(Boolean(cfg.configured));
        setGasUrl(cfg.webAppUrl || '');
        setGasSpreadsheetId(cfg.spreadsheetId || '1-zp0508H-nlZNPql2JQlQClK1aRYF1vFqn7y9U3L6kk');
        if (!cfg.configured) {
          setShowDeploymentGuide(true);
        } else {
          // Test connection silently to load sheet metadata
          testAppsScriptConnection(cfg.webAppUrl).then((res) => {
            if (res.success && res.data) {
              setGasInfo(res.data);
            }
          }).catch(() => {});
        }
      }
    }).catch(() => {});

    // Load initial SMTP settings from server
    getSmtpConfig().then((cfg) => {
      if (cfg) {
        setSmtpHost(cfg.host || 'smtp.gmail.com');
        setSmtpPort(cfg.port || 587);
        setSmtpUser(cfg.user || '');
        setSmtpFrom(cfg.from || '');
        setSmtpConfigured(Boolean(cfg.configured));
        setSmtpHasPassword(Boolean(cfg.hasPassword));
      }
    }).catch(() => {});
  }, []);

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = nameInput.trim();
    const cleanEmail = emailInput.trim();

    if (!cleanName) {
      setErrorMessage('Receiver Name is required.');
      return;
    }

    if (!cleanEmail) {
      setErrorMessage('Receiver Email Address is required.');
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (recipients.some((r) => r.email.toLowerCase() === cleanEmail.toLowerCase())) {
      setErrorMessage('This email address is already added to the recipient list.');
      return;
    }

    try {
      await addRecipient({ name: cleanName, email: cleanEmail });
      setNameInput('');
      setEmailInput('');
      onToast?.(`Recipient ${cleanName} (${cleanEmail}) saved.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save recipient.');
    }
  };

  const startEdit = (recipient: CalibrationRecipient) => {
    setEditingId(recipient.id);
    setEditName(recipient.name);
    setEditEmail(recipient.email);
    setErrorMessage(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditEmail('');
  };

  const handleSaveEdit = async (id: string) => {
    setErrorMessage(null);
    const cleanName = editName.trim();
    const cleanEmail = editEmail.trim();

    if (!cleanName) {
      setErrorMessage('Receiver Name is required.');
      return;
    }

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }

    try {
      await updateRecipient(id, { name: cleanName, email: cleanEmail });
      setEditingId(null);
      onToast?.('Recipient updated successfully.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update recipient.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (recipients.length <= 1) {
      setErrorMessage('At least one recipient must remain configured.');
      return;
    }
    try {
      await deleteRecipient(id);
      onToast?.(`Removed recipient ${name}.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete recipient.');
    }
  };

  const handleToggleSelect = async (id: string, currentSelected: boolean) => {
    await updateRecipient(id, { selected: !currentSelected });
  };

  const handleToggleAll = (select: boolean) => {
    selectAllRecipients(select);
    onToast?.(select ? 'Selected all recipients for reminder emails.' : 'Deselected all recipients.');
  };

  const allSelected = recipients.length > 0 && recipients.every((r) => r.selected);
  const selectedCount = recipients.filter((r) => r.selected).length;

  // ==========================================
  // GOOGLE APPS SCRIPT HANDLERS
  // ==========================================

  const handleSaveAndTestGas = async (e: React.FormEvent) => {
    e.preventDefault();
    setGasFeedback(null);
    const cleanUrl = gasUrl.trim();

    if (!cleanUrl) {
      setGasFeedback({ type: 'error', message: 'Google Apps Script Web App URL is required.' });
      return;
    }

    try {
      setIsTestingGasConn(true);
      setIsSavingGas(true);

      // Save to backend configuration
      await saveAppsScriptConfig({
        webAppUrl: cleanUrl,
        secret: gasSecret.trim() || undefined,
        spreadsheetId: gasSpreadsheetId.trim() || undefined
      });

      // Test connection
      const testRes = await testAppsScriptConnection(cleanUrl, gasSecret.trim() || undefined);

      if (testRes.success) {
        setGasConfigured(true);
        setGasInfo(testRes.data);
        setGasFeedback({
          type: 'success',
          message: `Connected successfully to Google Apps Script! Connected to spreadsheet: "${testRes.data?.spreadsheetTitle || testRes.data?.spreadsheetId}". Daily checks will use native MailApp.`
        });
        onToast?.('Google Apps Script connected and verified!');
      } else {
        setGasFeedback({
          type: 'error',
          message: testRes.error || 'Failed to connect to Google Apps Script Web App.'
        });
      }
    } catch (err: any) {
      setGasFeedback({
        type: 'error',
        message: err.message || 'Error communicating with Google Apps Script.'
      });
    } finally {
      setIsTestingGasConn(false);
      setIsSavingGas(false);
    }
  };

  const handleSendGasTestEmail = async () => {
    const activeRecipients = recipients.filter((r) => r.selected).map((r) => r.email);
    const targetEmail = activeRecipients[0] || recipients[0]?.email;

    if (!targetEmail) {
      setGasFeedback({ type: 'error', message: 'No recipient email available to send test email to.' });
      return;
    }

    try {
      setIsSendingGasTest(true);
      setGasFeedback(null);
      const res = await testAppsScriptDelivery(targetEmail, gasUrl.trim() || undefined, gasSecret.trim() || undefined);

      if (res.success) {
        setGasFeedback({
          type: 'success',
          message: `Live test email successfully delivered to ${targetEmail} via MailApp!`
        });
        onToast?.(`Test email delivered to ${targetEmail} via MailApp!`);
      } else {
        setGasFeedback({
          type: 'error',
          message: res.error || 'Failed to send test email via Google Apps Script MailApp.'
        });
      }
    } catch (err: any) {
      setGasFeedback({
        type: 'error',
        message: err.message || 'Error dispatching test email.'
      });
    } finally {
      setIsSendingGasTest(false);
    }
  };

  const handleRunGasDailyCheck = async () => {
    const activeRecipients = recipients.filter((r) => r.selected).map((r) => r.email);

    try {
      setIsTriggeringGasCheck(true);
      setGasFeedback(null);
      const res = await triggerAppsScriptCheck({
        force: true,
        recipients: activeRecipients.length > 0 ? activeRecipients : undefined
      });

      if (res.success && res.status === 'sent') {
        setGasFeedback({
          type: 'success',
          message: res.message || 'Calibration check executed and email delivered via MailApp!'
        });
        onToast?.('Calibration reminder email sent via MailApp!');
      } else if (res.status === 'skipped_no_items') {
        setGasFeedback({
          type: 'success',
          message: res.message || 'No calibration equipment due or overdue today in sheet.'
        });
        onToast?.('No calibration equipment due today in sheet.');
      } else {
        setGasFeedback({
          type: 'error',
          message: res.error || res.message || 'Execution failed.'
        });
      }
    } catch (err: any) {
      setGasFeedback({
        type: 'error',
        message: err.message || 'Error triggering check via Apps Script.'
      });
    } finally {
      setIsTriggeringGasCheck(false);
    }
  };

  const handleInstallDailyTrigger = async () => {
    try {
      setIsInstallingTrigger(true);
      setGasFeedback(null);
      const res = await setupAppsScriptTrigger();
      if (res.success) {
        setGasFeedback({
          type: 'success',
          message: 'Automatic Daily 8:00 AM Trigger successfully installed in Google Cloud! Reminder emails will now run automatically each day with no manual action needed.'
        });
        onToast?.('Automatic daily 8:00 AM trigger scheduled!');
      } else {
        setGasFeedback({
          type: 'error',
          message: res.error || 'Failed to install cloud trigger. Please verify your Apps Script URL.'
        });
      }
    } catch (err: any) {
      setGasFeedback({
        type: 'error',
        message: err.message || 'Error configuring cloud trigger'
      });
    } finally {
      setIsInstallingTrigger(false);
    }
  };

  const handleCopyScriptCode = () => {
    const scriptCode = `// See google-apps-script/Code.gs for the full source code\n// Open Extensions > Apps Script in your spreadsheet, paste Code.gs, and run createDailyCalibrationTrigger()`;
    navigator.clipboard.writeText(scriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
    onToast?.('Apps Script instructions copied to clipboard!');
  };

  // ==========================================
  // SMTP HANDLERS
  // ==========================================

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmtpFeedback(null);

    const cleanUser = smtpUser.trim();
    if (!cleanUser) {
      setSmtpFeedback({ type: 'error', message: 'SMTP Username / Email is required.' });
      return;
    }

    if (!smtpPass && !smtpHasPassword) {
      setSmtpFeedback({ type: 'error', message: 'SMTP Password or App Password is required.' });
      return;
    }

    try {
      setIsSavingSmtp(true);
      const res = await saveSmtpConfig({
        host: smtpHost.trim() || 'smtp.gmail.com',
        port: Number(smtpPort) || 587,
        user: cleanUser,
        pass: smtpPass.trim() || undefined,
        from: smtpFrom.trim() || undefined
      });

      if (res.success) {
        setSmtpConfigured(true);
        setSmtpHasPassword(true);
        setSmtpFeedback({
          type: 'success',
          message: 'SMTP settings verified and saved! Live email sending is active.'
        });
        onToast?.('SMTP connected and verified successfully!');
      } else {
        setSmtpFeedback({
          type: 'error',
          message: res.error || 'Failed to verify SMTP credentials.'
        });
      }
    } catch (err: any) {
      setSmtpFeedback({
        type: 'error',
        message: err.message || 'Error communicating with server.'
      });
    } finally {
      setIsSavingSmtp(false);
    }
  };

  const handleSendTestEmail = async () => {
    const activeRecipients = recipients.filter((r) => r.selected).map((r) => r.email);
    const targetEmail = activeRecipients[0] || recipients[0]?.email;

    if (!targetEmail) {
      setSmtpFeedback({ type: 'error', message: 'No recipient email available to send test email to.' });
      return;
    }

    try {
      setIsTestingSmtp(true);
      setSmtpFeedback(null);
      const res = await testSmtpDelivery(targetEmail);

      if (res.success) {
        setSmtpFeedback({
          type: 'success',
          message: `Live test email successfully delivered to ${targetEmail} via SMTP!`
        });
        onToast?.(`Test email delivered to ${targetEmail}!`);
      } else {
        setSmtpFeedback({
          type: 'error',
          message: res.error || 'Failed to send test email via SMTP.'
        });
      }
    } catch (err: any) {
      setSmtpFeedback({
        type: 'error',
        message: err.message || 'Error sending test email.'
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleConnectPrimaryGoogle = async () => {
    try {
      setIsConnectingGoogle(true);
      setGmailFeedback(null);
      const res = await signInWithGoogle();
      if (res.accessToken) {
        setHasGmailToken(true);
        setGmailFeedback({
          type: 'success',
          message: `Connected successfully to your primary Google account (${res.user.email})! Direct Gmail delivery is active.`
        });
        onToast?.(`Connected to ${res.user.email}!`);
      }
    } catch (err: any) {
      setGmailFeedback({
        type: 'error',
        message: err.message || 'Google authorization was cancelled or failed.'
      });
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleSendGmailTest = async () => {
    try {
      setIsSendingGmailTest(true);
      setGmailFeedback(null);
      const activeRecipients = recipients.filter((r) => r.selected).map((r) => r.email);
      const target = activeRecipients[0] || recipients[0]?.email || 'billal.acts@gmail.com';
      const res = await sendGmailTestEmail(target);
      if (res.success) {
        setHasGmailToken(true);
        setGmailFeedback({ type: 'success', message: res.message || 'Test email sent via Gmail API!' });
        onToast?.(`Test email delivered to ${target}!`);
      } else {
        setGmailFeedback({ type: 'error', message: res.error || 'Failed to send test email' });
      }
    } catch (err: any) {
      setGmailFeedback({ type: 'error', message: err.message || 'Error sending test email' });
    } finally {
      setIsSendingGmailTest(false);
    }
  };

  const handleRunGmailCheck = async () => {
    try {
      setIsSendingGmailCheck(true);
      setGmailFeedback(null);
      const activeRecipients = recipients.filter((r) => r.selected).map((r) => r.email);
      const res = await runCalibrationCheckViaGmail({
        recipients: activeRecipients.length > 0 ? activeRecipients : undefined,
        force: true
      });
      if (res.success) {
        setHasGmailToken(true);
        setGmailFeedback({ type: 'success', message: res.message });
        onToast?.('Calibration reminder email sent via Gmail API!');
      } else {
        setGmailFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setGmailFeedback({ type: 'error', message: err.message || 'Error running check via Gmail' });
    } finally {
      setIsSendingGmailCheck(false);
    }
  };

  const handleResetSimulatedStatuses = () => {
    resetEquipmentNotificationStatus();
    onToast?.('Reset all equipment reminder statuses back to Pending');
  };

  const isUserLoggedIn = Boolean(auth?.currentUser);
  const primaryAccountEmail = auth?.currentUser?.email || 'billal.acts@gmail.com';

  return (
    <div className="space-y-6">

      {/* 0. Primary Email Delivery (Google Workspace / Gmail API) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-5 shadow-xs">
        
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Primary Email Delivery (Google Workspace / Gmail API)</span>
              </h3>
            </div>
          </div>

          {/* Connection Status Badge */}
          <div className="flex items-center gap-2">
            {hasGmailToken || isUserLoggedIn ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Primary Mail Connected ({primaryAccountEmail})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Google Account Not Connected</span>
              </span>
            )}
          </div>
        </div>

        {/* Feedback Alert */}
        {gmailFeedback && (
          <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
            gmailFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300'
          }`}>
            {gmailFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span className="font-medium">{gmailFeedback.message}</span>
          </div>
        )}

        {/* Account Info and Actions */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Primary Sender Account:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 text-sm font-mono">
                {primaryAccountEmail}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Delivery Mechanism:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Google Workspace Gmail API (OAuth Scopes: <code className="text-indigo-600 dark:text-indigo-400">gmail.send</code>)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {!hasGmailToken && (
              <button
                type="button"
                onClick={handleConnectPrimaryGoogle}
                disabled={isConnectingGoogle}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-xs flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                <span>{isConnectingGoogle ? 'Connecting...' : 'Authorize Primary Gmail Account'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSendGmailTest}
              disabled={isSendingGmailTest}
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${isSendingGmailTest ? 'animate-spin' : ''}`} />
              <span>{isSendingGmailTest ? 'Sending via Gmail...' : 'Send Live Test Email from Primary Mail'}</span>
            </button>

            <button
              type="button"
              onClick={handleRunGmailCheck}
              disabled={isSendingGmailCheck}
              className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
            >
              <Clock className={`w-3.5 h-3.5 ${isSendingGmailCheck ? 'animate-spin' : ''}`} />
              <span>{isSendingGmailCheck ? 'Dispatching...' : 'Send Calibration Reminders via Primary Mail Now'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* 1. Receiver Email Settings */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-5 shadow-xs">
        {/* Section Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Receiver Email Settings</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
                  {selectedCount} of {recipients.length} Selected
                </span>
              </h3>
            </div>
          </div>

          {/* Action Controls for Selection */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleToggleAll(!allSelected)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer"
            >
              {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-indigo-600" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
              <span>{allSelected ? 'Deselect All' : 'Select All Recipients'}</span>
            </button>
          </div>
        </div>

        {/* Error alert */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Add Receiver Form */}
        <form onSubmit={handleAddRecipient} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Receiver Name
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Quality Assurance Manager"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Receiver Email Address
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="e.g. qa.calibration@company.com"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="sm:col-span-1">
              <button
                type="submit"
                className="w-full py-2 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Receiver</span>
              </button>
            </div>
          </div>
        </form>

        {/* Receiver List */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Receiver List
          </h4>

          {recipients.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              No recipients configured yet. Add your first receiver above.
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {recipients.map((recipient) => {
                const isEditing = editingId === recipient.id;

                return (
                  <div 
                    key={recipient.id}
                    className={`p-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 transition-colors ${
                      recipient.selected 
                        ? 'bg-slate-50/50 dark:bg-slate-800/30' 
                        : 'opacity-70 bg-white dark:bg-slate-900'
                    }`}
                  >
                    {/* Select Checkbox & Details */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleSelect(recipient.id, recipient.selected)}
                        className="p-1 text-indigo-600 hover:text-indigo-700 cursor-pointer rounded"
                        title={recipient.selected ? 'Selected for reminders' : 'Not selected for reminders'}
                      >
                        {recipient.selected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </button>

                      {isEditing ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="px-2.5 py-1 text-xs rounded-lg border border-indigo-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            placeholder="Receiver Name"
                          />
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="px-2.5 py-1 text-xs rounded-lg border border-indigo-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            placeholder="Receiver Email Address"
                          />
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {recipient.name}
                            </span>
                            {recipient.selected && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                Active Receiver
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                            {recipient.email}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions: Edit / Save / Cancel / Delete */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(recipient.id)}
                            className="px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="px-2.5 py-1 text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(recipient)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors cursor-pointer"
                            title="Edit recipient"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(recipient.id, recipient.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                            title="Delete recipient"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. Google Apps Script Backend (MailApp & Sheets) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-5 shadow-xs">
        
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Google Apps Script Backend (MailApp & Google Sheets)</span>
              </h3>
            </div>
          </div>

          {/* Connection Status Badge */}
          <div className="flex items-center gap-2">
            {gasConfigured ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Apps Script Connected (MailApp Active)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Apps Script Not Deployed</span>
              </span>
            )}
          </div>
        </div>

        {/* Live Connected Sheet Metadata Card */}
        {gasInfo && gasConfigured && (
          <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Active Google Sheet: {gasInfo.spreadsheetTitle || gasInfo.spreadsheetId}</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                Tab: {gasInfo.activeSheet} • Timezone: {gasInfo.timezone}
              </span>
            </div>

            {Array.isArray(gasInfo.detectedHeaders) && gasInfo.detectedHeaders.length > 0 && (
              <div className="text-[11px] text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Detected Sheet Columns:</span>{' '}
                {gasInfo.detectedHeaders.join(' • ')}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1 text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Daily Automatic Check: 8:00 AM (Asia/Riyadh)</span>
              </span>
              <span>•</span>
              <span>Sender Account: {gasInfo.authorizedUser || 'Google Account'}</span>
            </div>
          </div>
        )}

        {/* Feedback Alert */}
        {gasFeedback && (
          <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
            gasFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300'
          }`}>
            {gasFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span className="font-medium">{gasFeedback.message}</span>
          </div>
        )}

        {/* Apps Script Form */}
        <form onSubmit={handleSaveAndTestGas} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            {/* Web App URL */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Google Apps Script Web App URL
              </label>
              <input
                type="url"
                value={gasUrl}
                onChange={(e) => setGasUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
              />
            </div>

            {/* Secret Key */}
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                API Secret Key (Optional)
              </label>
              <input
                type="password"
                value={gasSecret}
                onChange={(e) => setGasSecret(e.target.value)}
                placeholder="Leave blank if not set"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
              />
            </div>

            {/* Target Spreadsheet ID */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Target Google Spreadsheet ID
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={gasSpreadsheetId}
                  onChange={(e) => setGasSpreadsheetId(e.target.value)}
                  placeholder="1-zp0508H-nlZNPql2JQlQClK1aRYF1vFqn7y9U3L6kk"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                />
                <a
                  href={`https://docs.google.com/spreadsheets/d/${gasSpreadsheetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Sheet</span>
                </a>
              </div>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={isSavingGas || isTestingGasConn}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
              >
                {isTestingGasConn ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                <span>{isTestingGasConn ? 'Testing Connection...' : 'Save & Verify Connection'}</span>
              </button>

              <button
                type="button"
                onClick={handleSendGasTestEmail}
                disabled={isSendingGasTest || !gasUrl}
                className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
              >
                <Send className={`w-3.5 h-3.5 ${isSendingGasTest ? 'animate-spin' : ''}`} />
                <span>{isSendingGasTest ? 'Sending via MailApp...' : 'Send Live Test Email (MailApp)'}</span>
              </button>

              <button
                type="button"
                onClick={handleRunGasDailyCheck}
                disabled={isTriggeringGasCheck || !gasUrl}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
              >
                <Clock className={`w-3.5 h-3.5 ${isTriggeringGasCheck ? 'animate-spin' : ''}`} />
                <span>{isTriggeringGasCheck ? 'Checking Sheet...' : 'Test Apps Script Check Now'}</span>
              </button>

              <button
                type="button"
                onClick={handleInstallDailyTrigger}
                disabled={isInstallingTrigger || !gasUrl}
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                title="Schedules an automatic daily trigger in Google Cloud (Runs every day at 08:00 AM Asia/Riyadh without opening this app)"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isInstallingTrigger ? 'animate-spin' : ''}`} />
                <span>{isInstallingTrigger ? 'Scheduling Cloud Trigger...' : 'Schedule 8:00 AM Cloud Trigger'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowDeploymentGuide(!showDeploymentGuide)}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>{showDeploymentGuide ? 'Hide Deployment Guide' : 'View Deployment Guide'}</span>
              {showDeploymentGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </form>

        {/* Collapsible Deployment Guide */}
        {showDeploymentGuide && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span>Quick Deployment Steps in Google Sheets</span>
              </h5>
              <button
                type="button"
                onClick={handleCopyScriptCode}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedCode ? 'Copied!' : 'Copy Guide Reference'}</span>
              </button>
            </div>

            <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
              <li>
                Open your spreadsheet:{' '}
                <a
                  href={`https://docs.google.com/spreadsheets/d/${gasSpreadsheetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 underline font-mono"
                >
                  docs.google.com/spreadsheets/d/{gasSpreadsheetId}
                </a>
              </li>
              <li>
                Click <span className="font-bold">Extensions &gt; Apps Script</span> in the top menu bar.
              </li>
              <li>
                Replace any code in <span className="font-mono bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">Code.gs</span> with the content of{' '}
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">google-apps-script/Code.gs</span> and press <span className="font-bold">Save</span>.
              </li>
              <li>
                In the function dropdown, select <span className="font-bold font-mono">createDailyCalibrationTrigger</span> and click <span className="font-bold">Run</span> to authorize permissions and schedule the daily 8:00 AM check.
              </li>
              <li>
                Click <span className="font-bold">Deploy &gt; New deployment &gt; Web app</span>, set <span className="font-bold">Execute as: Me</span> and <span className="font-bold">Who has access: Anyone</span>, then click <span className="font-bold">Deploy</span>.
              </li>
              <li>
                Copy the Web App URL and paste it into the input above, then click <span className="font-bold">Save &amp; Verify Connection</span>!
              </li>
            </ol>
          </div>
        )}

      </div>

      {/* 3. SMTP Delivery Settings (Alternate / Direct Delivery) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-5 shadow-xs">
        
        {/* SMTP Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>SMTP Server Settings (Direct Email Delivery)</span>
              </h3>
            </div>
          </div>

          {/* Connection Status Badge */}
          <div className="flex items-center gap-2">
            {smtpConfigured ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>SMTP Connected</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>Optional Backup SMTP</span>
              </span>
            )}
          </div>
        </div>

        {/* Feedback Alert */}
        {smtpFeedback && (
          <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
            smtpFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300'
          }`}>
            {smtpFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span className="font-medium">{smtpFeedback.message}</span>
          </div>
        )}

        {/* SMTP Configuration Form */}
        <form onSubmit={handleSaveSmtp} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            
            {/* SMTP Host */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                SMTP Host / Server
              </label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.gmail.com"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
            </div>

            {/* SMTP Port */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                SMTP Port
              </label>
              <input
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(Number(e.target.value))}
                placeholder="587"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
            </div>

            {/* Sender / Username */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Sender Email Address / Username
              </label>
              <input
                type="email"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="your.email@gmail.com"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* App Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                App Password / Password {smtpHasPassword && !smtpPass && '(Saved on server)'}
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder={smtpHasPassword ? '•••••••••••••••• (Leave blank to keep)' : '16-character App Password'}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                />
              </div>
            </div>

            {/* Sender Display Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                From Name / Header (Optional)
              </label>
              <input
                type="text"
                value={smtpFrom}
                onChange={(e) => setSmtpFrom(e.target.value)}
                placeholder="Calibration Reminder Hub <your.email@gmail.com>"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={isSavingSmtp}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
              >
                {isSavingSmtp ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                <span>{isSavingSmtp ? 'Verifying & Saving...' : 'Save & Verify SMTP'}</span>
              </button>

              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={isTestingSmtp}
                className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
              >
                <Send className={`w-3.5 h-3.5 ${isTestingSmtp ? 'animate-spin' : ''}`} />
                <span>{isTestingSmtp ? 'Sending Test Email...' : 'Send Live Test Email'}</span>
              </button>
            </div>

            {/* Reset Simulated Statuses */}
            <button
              type="button"
              onClick={handleResetSimulatedStatuses}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              title="Clears all local simulation badges back to Pending"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Simulated Statuses</span>
            </button>
          </div>
        </form>

      </div>

    </div>
  );
};
