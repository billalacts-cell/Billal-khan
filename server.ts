import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const CONFIGURED_RECIPIENT = process.env.CALIBRATION_EMAIL_RECIPIENT || 'billal.acts@gmail.com';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * In-memory email logs cache for idempotency & history
 */
interface ServerEmailLog {
  id: string;
  dateString: string;
  sentAt: number;
  recipientEmail: string;
  subject: string;
  totalEquipmentNotified: number;
  groupedSummary: {
    overdueCount: number;
    projectsCount: number;
    internalCount: number;
    externalCount: number;
  };
  notifiedItems: any[];
  status: 'sent' | 'skipped_no_items' | 'already_sent_today' | 'failed' | 'simulated';
  errorDetails?: string;
  htmlPreview?: string;
}

const EQUIPMENT_FILE = path.join(__dirname, 'equipment-cache.json');
const EMAIL_LOGS_FILE = path.join(__dirname, 'email-logs-cache.json');

function loadPersistedLogs(): ServerEmailLog[] {
  try {
    if (fs.existsSync(EMAIL_LOGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(EMAIL_LOGS_FILE, 'utf-8'));
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.error('Error reading persisted email logs:', err);
  }
  return [];
}

function savePersistedLogs(logs: ServerEmailLog[]) {
  try {
    fs.writeFileSync(EMAIL_LOGS_FILE, JSON.stringify(logs.slice(0, 50), null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing persisted email logs:', err);
  }
}

function loadPersistedEquipment(): any[] {
  try {
    if (fs.existsSync(EQUIPMENT_FILE)) {
      const data = JSON.parse(fs.readFileSync(EQUIPMENT_FILE, 'utf-8'));
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.error('Error reading persisted equipment:', err);
  }
  return [];
}

function savePersistedEquipment(items: any[]) {
  try {
    fs.writeFileSync(EQUIPMENT_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing persisted equipment:', err);
  }
}

const serverEmailLogs: ServerEmailLog[] = loadPersistedLogs();
let cachedEquipment: any[] = loadPersistedEquipment();

/**
 * Returns current date string formatted as YYYY-MM-DD in Asia/Riyadh
 */
function getRiyadhDate(d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  } catch {
    return d.toISOString().split('T')[0];
  }
}

/**
 * Calculates number of calendar days between today in Riyadh and due date
 */
function getDaysUntilDue(dueDateStr: string, referenceDateStr?: string): number | null {
  if (!dueDateStr) return null;
  const todayStr = referenceDateStr || getRiyadhDate();
  const d1 = new Date(todayStr + 'T00:00:00Z');
  const d2 = new Date(dueDateStr + 'T00:00:00Z');
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculates reminder date (20 calendar days before due date)
 */
function calculateReminderDate(dueDateStr: string): string | null {
  if (!dueDateStr) return null;
  const parts = dueDateStr.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  const d = new Date(Date.UTC(year, month, day));
  d.setUTCDate(d.getUTCDate() - 20);
  return d.toISOString().split('T')[0];
}

/**
 * Set up Nodemailer transport
 */
function createMailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
  }

  // Fallback jsonTransport when SMTP is not explicitly set in environment
  return nodemailer.createTransport({
    jsonTransport: true
  });
}

/**
 * Generates consolidated HTML email body with Overdue Alert and 20-Day Notice
 */
function buildConsolidatedEmailHtml(
  dateString: string,
  overdueItems: any[],
  projectsItems: { projectName: string; items: any[] }[],
  internalItems: any[] = [],
  externalItems: any[] = []
): string {
  const totalUpcoming = projectsItems.reduce((acc, p) => acc + p.items.length, 0) + internalItems.length + externalItems.length;

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; line-height: 1.5; }
    .container { max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #0f172a; color: #ffffff; padding: 24px 28px; }
    .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff; }
    .header p { margin: 0; font-size: 13px; color: #94a3b8; }
    .body-content { padding: 24px 28px; }
    .notice { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 14px 18px; border-radius: 8px; font-size: 13px; margin-bottom: 24px; }
    .project-header { font-size: 13px; font-weight: 700; color: #2563eb; margin: 12px 0 6px 0; text-transform: uppercase; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }
    th { background: #f1f5f9; color: #475569; font-weight: 600; text-align: left; padding: 8px 10px; border-bottom: 1px solid #cbd5e1; }
    td { padding: 9px 10px; border-bottom: 1px solid #f1f5f9; }
    .tag { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; font-family: monospace; background: #eff6ff; color: #1d4ed8; }
    .due-date { font-weight: 700; color: #b45309; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; text-align: center; font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Calibration 20-Day Reminder Notice</h1>
      <p>Automated reminder for <strong>Asia/Riyadh</strong> • Date: <strong>${dateString}</strong></p>
    </div>
    <div class="body-content">
      <div class="notice">
        <strong>20-Day Calibration Notice:</strong> The following <strong>${totalUpcoming}</strong> equipment record(s) are due for calibration within <strong>20 calendar days</strong>. Please arrange for calibration certification or service as needed.
      </div>
  `;

  // Focus directly on Project Name (Sections 2 and 3 removed)
  if (projectsItems.length === 0) {
    html += `<p style="font-size: 13px; color: #94a3b8; font-style: italic; text-align: center; padding: 20px 0;">No equipment records due for calibration.</p>`;
  } else {
    projectsItems.forEach((group) => {
      html += `
        <div style="margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #ffffff;">
          <div style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 13px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">PROJECT: ${group.projectName}</span>
            <span style="font-size: 11px; color: #64748b; font-weight: 600;">${group.items.length} item${group.items.length === 1 ? '' : 's'}</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #ffffff; color: #475569; font-weight: 700; text-align: left;">
                <th style="width: 120px; padding: 9px 14px; border-bottom: 2px solid #e2e8f0; font-size: 12px;">Asset ID</th>
                <th style="padding: 9px 14px; border-bottom: 2px solid #e2e8f0; font-size: 12px;">Item Description</th>
                <th style="width: 130px; padding: 9px 14px; border-bottom: 2px solid #e2e8f0; font-size: 12px;">Serial Number</th>
                <th style="width: 110px; padding: 9px 14px; border-bottom: 2px solid #e2e8f0; font-size: 12px;">Due Date</th>
              </tr>
            </thead>
            <tbody>
      `;
      group.items.forEach((item) => {
        const isExternal = item.category === 'External Calibration' || item.calibrationCategory === 'External Calibration';
        html += `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 11px 14px; vertical-align: top;"><span class="tag">${item.equipmentId}</span></td>
                <td style="padding: 11px 14px; vertical-align: top;">
                  <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${item.name}</div>
                  <div style="margin-top: 4px;">
                    <span style="display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; ${
                      isExternal
                        ? 'background: #ede9fe; color: #5b21b6; border: 1px solid #ddd6fe;'
                        : 'background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0;'
                    }">
                      ${isExternal ? 'External Calibration' : 'Internal Calibration'}
                    </span>
                    ${item.location || item.remarks ? `<span style="font-size: 11px; color: #64748b; margin-left: 6px;">• ${item.location || item.remarks}</span>` : ''}
                  </div>
                </td>
                <td style="padding: 11px 14px; vertical-align: top; font-family: monospace; color: #475569;">${item.serialNumber || '—'}</td>
                <td style="padding: 11px 14px; vertical-align: top; font-weight: 700; color: #b45309;" class="due-date">${item.dueDate}</td>
              </tr>
        `;
      });
      html += `
            </tbody>
          </table>
        </div>
      `;
    });
  }

  html += `
    </div>
    <div class="footer">
      My Notes Hub • Automated Calibration Management • Asia/Riyadh Scheduler
    </div>
  </div>
</body>
</html>
  `;
  return html;
}

// ==========================================
// API ROUTES
// ==========================================

/**
 * Status endpoint
 */
app.get('/api/calibration/status', (req: Request, res: Response) => {
  const riyadhDate = getRiyadhDate();
  const todayLog = serverEmailLogs.find((l) => l.dateString === riyadhDate && (l.status === 'sent' || l.status === 'simulated'));
  const isSmtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

  res.json({
    status: 'ok',
    timezone: 'Asia/Riyadh',
    currentRiyadhDate: riyadhDate,
    configuredRecipient: CONFIGURED_RECIPIENT,
    smtpConfigured: isSmtpConfigured,
    hasSentToday: Boolean(todayLog),
    todayLog: todayLog || null,
    totalLogsCount: serverEmailLogs.length
  });
});

/**
 * SMTP Configuration endpoints
 */
app.get('/api/calibration/smtp-config', (req: Request, res: Response) => {
  const isConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  res.json({
    configured: isConfigured,
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
    user: process.env.SMTP_USER || '',
    from: process.env.SMTP_FROM || '',
    hasPassword: Boolean(process.env.SMTP_PASS)
  });
});

app.post('/api/calibration/smtp-config', async (req: Request, res: Response) => {
  try {
    const { host, port = 587, user, pass, from } = req.body;
    if (!host || !user) {
      return res.status(400).json({ error: 'SMTP Host and User/Email are required.' });
    }

    const testPassword = pass || process.env.SMTP_PASS || '';
    if (!testPassword) {
      return res.status(400).json({ error: 'SMTP Password or Google App Password is required.' });
    }

    // Verify SMTP connection live
    const testTransporter = nodemailer.createTransport({
      host: host.trim(),
      port: Number(port),
      secure: Number(port) === 465,
      auth: {
        user: user.trim(),
        pass: testPassword.trim()
      }
    });

    try {
      await testTransporter.verify();
    } catch (verifyErr: any) {
      return res.status(400).json({
        success: false,
        error: `SMTP Authentication failed: ${verifyErr.message}. For Gmail, use a 16-character Google App Password (not your normal password).`
      });
    }

    // Update runtime env
    process.env.SMTP_HOST = host.trim();
    process.env.SMTP_PORT = String(port);
    process.env.SMTP_USER = user.trim();
    process.env.SMTP_PASS = testPassword.trim();
    if (from) process.env.SMTP_FROM = from.trim();

    // Persist to .env
    const envPath = path.join(process.cwd(), '.env');
    const envLines = [
      `SMTP_HOST="${process.env.SMTP_HOST}"`,
      `SMTP_PORT="${process.env.SMTP_PORT}"`,
      `SMTP_USER="${process.env.SMTP_USER}"`,
      `SMTP_PASS="${process.env.SMTP_PASS}"`,
      `SMTP_FROM="${process.env.SMTP_FROM || `"My Notes Hub" <${process.env.SMTP_USER}>`}"`
    ];
    fs.writeFileSync(envPath, envLines.join('\n') + '\n', 'utf-8');

    res.json({
      success: true,
      message: 'SMTP settings successfully verified and saved! Real emails will now be sent directly to recipient inboxes.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save SMTP settings.' });
  }
});

app.post('/api/calibration/test-smtp', async (req: Request, res: Response) => {
  try {
    const isConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    if (!isConfigured) {
      return res.status(400).json({
        success: false,
        error: 'SMTP is not configured yet. Please configure your SMTP credentials above.'
      });
    }

    const { recipient = CONFIGURED_RECIPIENT } = req.body;
    const transporter = createMailTransporter();
    const mailOptions = {
      from: process.env.SMTP_FROM || `"My Notes Hub" <${process.env.SMTP_USER}>`,
      to: recipient,
      subject: `[Live Test] Calibration Reminder Service Connected – ${getRiyadhDate()}`,
      html: `
        <div style="font-family: sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <h2 style="color: #16a34a; margin-top: 0;">✓ Email Delivery Service Connected</h2>
          <p>This is a live test notification from your <strong>Calibration Reminder & Schedule Hub</strong>.</p>
          <div style="background: #f8fafc; padding: 14px; border-radius: 8px; font-size: 13px; margin: 16px 0;">
            <div><strong>Recipient:</strong> ${recipient}</div>
            <div><strong>SMTP Host:</strong> ${process.env.SMTP_HOST}</div>
            <div><strong>Timezone:</strong> Asia/Riyadh</div>
          </div>
          <p style="color: #64748b; font-size: 12px; margin-top: 24px;">Your calibration overdue alerts and 20-day reminder notices will now be delivered reliably to this inbox.</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    res.json({
      success: true,
      message: `Test email successfully delivered to ${recipient}! (Message ID: ${info.messageId || 'Delivered'})`
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to deliver test email: ${err.message}`
    });
  }
});

/**
 * -------------------------------------------------------------
 * GOOGLE APPS SCRIPT INTEGRATION ENDPOINTS (MailApp & Sheets)
 * -------------------------------------------------------------
 */

app.get('/api/apps-script/config', (req: Request, res: Response) => {
  res.json({
    configured: Boolean(process.env.APPS_SCRIPT_WEB_APP_URL),
    webAppUrl: process.env.APPS_SCRIPT_WEB_APP_URL || '',
    spreadsheetId: process.env.APPS_SCRIPT_SPREADSHEET_ID || '1-zp0508H-nlZNPql2JQlQClK1aRYF1vFqn7y9U3L6kk',
    hasSecret: Boolean(process.env.APPS_SCRIPT_SECRET)
  });
});

app.post('/api/apps-script/config', async (req: Request, res: Response) => {
  try {
    const { webAppUrl, secret, spreadsheetId } = req.body;
    if (webAppUrl !== undefined) process.env.APPS_SCRIPT_WEB_APP_URL = (webAppUrl || '').trim();
    if (secret !== undefined) process.env.APPS_SCRIPT_SECRET = (secret || '').trim();
    if (spreadsheetId !== undefined) process.env.APPS_SCRIPT_SPREADSHEET_ID = (spreadsheetId || '').trim();

    // Persist to .env
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';
    try {
      envContent = fs.readFileSync(envPath, 'utf-8');
    } catch {}

    const updateEnvVar = (key: string, val: string) => {
      const reg = new RegExp(`^${key}=.*$`, 'm');
      if (reg.test(envContent)) {
        envContent = envContent.replace(reg, `${key}="${val}"`);
      } else {
        envContent += `\n${key}="${val}"`;
      }
    };

    updateEnvVar('APPS_SCRIPT_WEB_APP_URL', process.env.APPS_SCRIPT_WEB_APP_URL || '');
    updateEnvVar('APPS_SCRIPT_SECRET', process.env.APPS_SCRIPT_SECRET || '');
    updateEnvVar('APPS_SCRIPT_SPREADSHEET_ID', process.env.APPS_SCRIPT_SPREADSHEET_ID || '1-zp0508H-nlZNPql2JQlQClK1aRYF1vFqn7y9U3L6kk');

    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8');

    res.json({
      success: true,
      message: 'Google Apps Script configuration updated and persisted.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save Apps Script config' });
  }
});

app.post('/api/apps-script/test-connection', async (req: Request, res: Response) => {
  try {
    const url = (req.body.webAppUrl || process.env.APPS_SCRIPT_WEB_APP_URL || '').trim();
    const secret = req.body.secret || process.env.APPS_SCRIPT_SECRET || '';

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Google Apps Script Web App URL is required.'
      });
    }

    const testUrl = new URL(url);
    testUrl.searchParams.set('action', 'ping');
    if (secret) testUrl.searchParams.set('apiKey', secret);

    const response = await fetch(testUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        error: `Google Apps Script returned HTTP ${response.status}: ${response.statusText}. Please verify the Web App deployment permissions (set 'Who has access' to 'Anyone').`
      });
    }

    const data = await response.json();
    if (data.error) {
      return res.status(400).json({ success: false, error: data.error });
    }

    res.json({
      success: true,
      message: `Successfully connected to Google Apps Script! Connected to spreadsheet "${data.spreadsheetTitle || data.spreadsheetId}".`,
      data
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to connect to Google Apps Script: ${err.message}`
    });
  }
});

app.post('/api/apps-script/test-email', async (req: Request, res: Response) => {
  try {
    const url = (req.body.webAppUrl || process.env.APPS_SCRIPT_WEB_APP_URL || '').trim();
    const secret = req.body.secret || process.env.APPS_SCRIPT_SECRET || '';
    const recipient = req.body.recipient || CONFIGURED_RECIPIENT;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Google Apps Script Web App URL is not configured. Please paste your deployed Web App URL first.'
      });
    }

    const postUrl = new URL(url);
    if (secret) postUrl.searchParams.set('apiKey', secret);

    const response = await fetch(postUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'testEmail',
        recipient
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return res.status(400).json({
        success: false,
        error: data.error || `Apps Script returned error (${response.status})`
      });
    }

    res.json({
      success: true,
      message: data.message || `Test email successfully sent to ${recipient} via MailApp!`
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to send test email via Apps Script: ${err.message}`
    });
  }
});

app.post('/api/apps-script/check-and-send', async (req: Request, res: Response) => {
  try {
    const url = (process.env.APPS_SCRIPT_WEB_APP_URL || '').trim();
    const secret = process.env.APPS_SCRIPT_SECRET || '';
    const force = Boolean(req.body.force);
    const recipients = req.body.recipients || [CONFIGURED_RECIPIENT];

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Google Apps Script Web App URL is not configured.'
      });
    }

    const postUrl = new URL(url);
    if (secret) postUrl.searchParams.set('apiKey', secret);

    const response = await fetch(postUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'checkAndSend',
        force,
        recipients
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return res.status(400).json({
        success: false,
        error: data.error || `Apps Script returned error (${response.status})`
      });
    }

    if (data.log) {
      serverEmailLogs.unshift(data.log);
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to run check via Apps Script: ${err.message}`
    });
  }
});

app.post('/api/calibration/preview', (req: Request, res: Response) => {
  try {
    const equipment = req.body.equipment || req.body.equipmentData || req.body.equipmentList || [];
    const dateOverride = req.body.dateOverride;
    const rawRecipients = req.body.recipients || req.body.recipientEmail || CONFIGURED_RECIPIENT;
    let targetRecipients: string[] = [];
    if (Array.isArray(rawRecipients)) {
      targetRecipients = rawRecipients.map((r: any) => String(r).trim()).filter(Boolean);
    } else if (typeof rawRecipients === 'string') {
      targetRecipients = rawRecipients.split(',').map((r: string) => r.trim()).filter(Boolean);
    }
    if (targetRecipients.length === 0) {
      targetRecipients = [CONFIGURED_RECIPIENT];
    }
    const recipientEmail = targetRecipients.join(', ');

    const riyadhDate = dateOverride || getRiyadhDate();

    // Filter strictly for 20-day reminder cycle (excluding overdue days < 0)
    const overdueItems: any[] = [];
    const projectMap = new Map<string, any[]>();
    const internalItems: any[] = [];
    const externalItems: any[] = [];

    equipment.forEach((item: any) => {
      if (!item.calibrationDueDate) return;
      const days = getDaysUntilDue(item.calibrationDueDate, riyadhDate);
      if (days === null || days < 0) return; // Completely exclude overdue items

      const cat = item.calibrationCategory === 'External Calibration' ? 'External Calibration' : 'Internal Calibration';
      const row = {
        equipmentId: item.id,
        name: item.name,
        serialNumber: item.serialNumber && item.serialNumber !== 'Not recorded' ? item.serialNumber : '—',
        dueDate: item.calibrationDueDate,
        location: item.currentLocation,
        externalProvider: item.externalProvider,
        projectName: item.currentProject,
        daysOverdue: 0,
        category: cat
      };

      if (calculateReminderDate(item.calibrationDueDate) === riyadhDate || (days >= 0 && days <= 20)) {
        const pName = (item.currentProject && item.currentProject.trim() && item.currentProject.toLowerCase() !== 'in stock')
          ? item.currentProject.trim()
          : (item.currentProject || 'General / In Stock');
        const list = projectMap.get(pName) || [];
        list.push(row);
        projectMap.set(pName, list);
      }
    });

    const projectsItems = Array.from(projectMap.entries()).map(([projectName, items]) => ({
      projectName,
      items
    }));

    const totalEligible = projectsItems.reduce((acc, p) => acc + p.items.length, 0);
    const subject = `Calibration 20-Day Reminder Notice – ${riyadhDate}`;

    const html = buildConsolidatedEmailHtml(riyadhDate, overdueItems, projectsItems, internalItems, externalItems);

    res.json({
      subject,
      recipientEmail,
      recipientEmails: targetRecipients,
      dateString: riyadhDate,
      totalDue: totalEligible,
      totalOverdue: 0,
      overdueItems: [],
      projectsItems,
      internalItems,
      externalItems,
      htmlBody: html
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Check and Send Consolidated Email: Covers Overdue equipment and 20-day notice items
 */
/**
 * Internal logic for checking equipment and sending consolidated email
 */
async function executeConsolidatedEmailCheckInternal(options: {
  equipment?: any[];
  force?: boolean;
  recipients?: string[] | string;
  triggerSource?: string;
}): Promise<{
  success: boolean;
  status: string;
  isRealSend: boolean;
  sentVia?: string;
  message: string;
  log: ServerEmailLog;
  notifiedIds: string[];
}> {
  const incomingEquipment = options.equipment || [];
  if (Array.isArray(incomingEquipment) && incomingEquipment.length > 0) {
    cachedEquipment = incomingEquipment;
    savePersistedEquipment(incomingEquipment);
  }

  const equipment = (Array.isArray(cachedEquipment) && cachedEquipment.length > 0)
    ? cachedEquipment
    : incomingEquipment;

  const force = Boolean(options.force);
  const rawRecipients = options.recipients || CONFIGURED_RECIPIENT;
  let targetRecipients: string[] = [];
  if (Array.isArray(rawRecipients)) {
    targetRecipients = rawRecipients.map((r: any) => String(r).trim()).filter(Boolean);
  } else if (typeof rawRecipients === 'string') {
    targetRecipients = rawRecipients.split(',').map((r: string) => r.trim()).filter(Boolean);
  }
  if (targetRecipients.length === 0) {
    targetRecipients = [CONFIGURED_RECIPIENT];
  }
  const recipientEmail = targetRecipients.join(', ');

  const riyadhDate = getRiyadhDate();

  // 1. Check idempotency: Have we already sent today?
  const existingToday = serverEmailLogs.find(
    (l) => l.dateString === riyadhDate && (l.status === 'sent' || l.status === 'simulated')
  );

  if (existingToday && !force) {
    return {
      success: true,
      status: 'already_sent_today',
      isRealSend: existingToday.status === 'sent',
      sentVia: 'Saved Log',
      message: `Consolidated calibration reminder for ${riyadhDate} has already been executed today.`,
      log: existingToday,
      notifiedIds: []
    };
  }

  // 2. Identify 20-day notice items (strictly upcoming, excluding overdue)
  const overdueItems: any[] = [];
  const projectMap = new Map<string, any[]>();
  const internalItems: any[] = [];
  const externalItems: any[] = [];
  const notifiedIds: string[] = [];

  const eligibleItems = equipment.filter((item: any) => {
    if (!item.calibrationDueDate) return false;
    const days = getDaysUntilDue(item.calibrationDueDate, riyadhDate);
    if (days === null || days < 0) return false; // Strictly exclude overdue items

    const is20DayDue = calculateReminderDate(item.calibrationDueDate) === riyadhDate || (days >= 0 && days <= 20);
    if (!is20DayDue) return false;

    if (!force && item.lastNotifiedDueDate === item.calibrationDueDate && item.lastNotificationStatus === 'sent') {
      return false;
    }
    return true;
  });

  if (eligibleItems.length === 0) {
    const skipLog: ServerEmailLog = {
      id: `log_skip_${Date.now()}`,
      dateString: riyadhDate,
      sentAt: Date.now(),
      recipientEmail,
      subject: `Calibration 20-Day Reminder Notice – ${riyadhDate}`,
      totalEquipmentNotified: 0,
      groupedSummary: { overdueCount: 0, projectsCount: 0, internalCount: 0, externalCount: 0 },
      notifiedItems: [],
      status: 'skipped_no_items',
      errorDetails: 'No equipment items were due for 20-day calibration reminder today.'
    };
    serverEmailLogs.unshift(skipLog);
    savePersistedLogs(serverEmailLogs);

    return {
      success: true,
      status: 'skipped_no_items',
      isRealSend: false,
      message: `Automated daily check completed: No equipment items are due for calibration in 20 days on ${riyadhDate}.`,
      log: skipLog,
      notifiedIds: []
    };
  }

  eligibleItems.forEach((item: any) => {
    notifiedIds.push(item.id);
    const cat = item.calibrationCategory === 'External Calibration' ? 'External Calibration' : 'Internal Calibration';
    const row = {
      equipmentId: item.id,
      name: item.name,
      serialNumber: item.serialNumber && item.serialNumber !== 'Not recorded' ? item.serialNumber : '—',
      dueDate: item.calibrationDueDate,
      location: item.currentLocation,
      externalProvider: item.externalProvider,
      projectName: item.currentProject,
      daysOverdue: 0,
      category: cat,
      remarks: item.notes
    };

    const pName = (item.currentProject && item.currentProject.trim() && item.currentProject.toLowerCase() !== 'in stock')
      ? item.currentProject.trim()
      : (item.currentProject || 'General / In Stock');
    const list = projectMap.get(pName) || [];
    list.push(row);
    projectMap.set(pName, list);
  });

  const projectsItems = Array.from(projectMap.entries()).map(([projectName, items]) => ({
    projectName,
    items
  }));

  const subject = `Calibration 20-Day Reminder Notice – ${riyadhDate}`;

  const htmlBody = buildConsolidatedEmailHtml(riyadhDate, overdueItems, projectsItems, internalItems, externalItems);

  // Send consolidated email
  const isAppsScriptConfigured = Boolean(process.env.APPS_SCRIPT_WEB_APP_URL);
  const isSmtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

  let deliveryStatus: 'sent' | 'simulated' | 'failed' = (isAppsScriptConfigured || isSmtpConfigured) ? 'sent' : 'simulated';
  let deliveryError: string | undefined;
  let sentVia: string = 'Simulation (No Service Configured)';

  if (isAppsScriptConfigured) {
    try {
      const postUrl = new URL(process.env.APPS_SCRIPT_WEB_APP_URL!);
      if (process.env.APPS_SCRIPT_SECRET) postUrl.searchParams.set('apiKey', process.env.APPS_SCRIPT_SECRET);
      const gasRes = await fetch(postUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkAndSend',
          force,
          recipients: targetRecipients
        })
      });
      const gasData = await gasRes.json();
      if (gasRes.ok && gasData.success) {
        deliveryStatus = 'sent';
        sentVia = 'Google Apps Script MailApp';
        console.log(`[Riyadh Daily Check] Email sent via Google Apps Script MailApp to ${recipientEmail}`);
      } else {
        deliveryStatus = 'failed';
        deliveryError = gasData.error || `Apps Script returned HTTP ${gasRes.status}`;
        console.error('[Riyadh Daily Check] Apps Script sending failed:', deliveryError);
      }
    } catch (gasErr: any) {
      deliveryStatus = 'failed';
      deliveryError = gasErr.message;
      console.error('[Riyadh Daily Check] Apps Script fetch error:', gasErr);
    }
  } else if (isSmtpConfigured) {
    try {
      const transporter = createMailTransporter();
      const mailOptions = {
        from: process.env.SMTP_FROM || `"My Notes Hub" <${process.env.SMTP_USER}>`,
        to: recipientEmail,
        subject,
        html: htmlBody
      };

      const sendResult = await transporter.sendMail(mailOptions);
      deliveryStatus = 'sent';
      sentVia = 'SMTP';
      console.log(`[Riyadh Daily Check] Consolidated email dispatched to ${recipientEmail} for ${riyadhDate}:`, sendResult.messageId || 'Delivered');
    } catch (sendErr: any) {
      console.error('[Riyadh Daily Check] Failed to send email via SMTP:', sendErr);
      deliveryStatus = 'failed';
      deliveryError = sendErr?.message || 'SMTP delivery failure';
    }
  } else {
    console.log(`[Riyadh Daily Check] Neither Google Apps Script nor SMTP is configured. Notification ran in SIMULATION mode for ${recipientEmail}.`);
  }

  const emailLog: ServerEmailLog = {
    id: `log_${Date.now()}`,
    dateString: riyadhDate,
    sentAt: Date.now(),
    recipientEmail,
    subject,
    totalEquipmentNotified: eligibleItems.length,
    groupedSummary: {
      overdueCount: overdueItems.length,
      projectsCount: projectsItems.reduce((acc, p) => acc + p.items.length, 0),
      internalCount: internalItems.length,
      externalCount: externalItems.length
    },
    notifiedItems: eligibleItems.map((i: any) => ({
      equipmentId: i.id,
      name: i.name,
      category: i.calibrationCategory || 'Projects',
      projectName: i.currentProject,
      dueDate: i.calibrationDueDate,
      serialNumber: i.serialNumber,
      externalProvider: i.externalProvider,
      isOverdue: false
    })),
    status: deliveryStatus,
    errorDetails: deliveryError,
    htmlPreview: htmlBody
  };

  serverEmailLogs.unshift(emailLog);
  savePersistedLogs(serverEmailLogs);

  const isRealSend = deliveryStatus === 'sent';

  return {
    success: isRealSend || deliveryStatus === 'simulated',
    status: deliveryStatus,
    isRealSend,
    sentVia,
    message: deliveryStatus === 'sent'
      ? `Consolidated email automatically sent via ${sentVia} to ${recipientEmail} (${eligibleItems.length} items notified: 20-day notice).`
      : deliveryStatus === 'simulated'
      ? `Simulation Mode: Email prepared for ${recipientEmail} with ${eligibleItems.length} items due in 20 days. Real email was NOT sent because neither Google Apps Script nor SMTP is configured.`
      : `Email delivery failed: ${deliveryError || 'Unknown delivery failure'}`,
    log: emailLog,
    notifiedIds: isRealSend ? notifiedIds : []
  };
}

/**
 * Check and Send Consolidated Email: Covers Overdue equipment and 20-day notice items
 */
app.post('/api/calibration/check-and-send', async (req: Request, res: Response) => {
  try {
    const result = await executeConsolidatedEmailCheckInternal({
      equipment: req.body.equipment || req.body.equipmentData || req.body.equipmentList,
      force: Boolean(req.body.force),
      recipients: req.body.recipients || req.body.recipientEmail,
      triggerSource: 'api_request'
    });
    res.json(result);
  } catch (err: any) {
    console.error('Error in /api/calibration/check-and-send:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * Sync equipment records from client to server cache
 */
app.post('/api/calibration/sync-equipment', (req: Request, res: Response) => {
  const items = req.body.equipment || req.body.items || [];
  if (Array.isArray(items) && items.length > 0) {
    cachedEquipment = items;
    savePersistedEquipment(items);
  }
  res.json({ success: true, count: cachedEquipment.length });
});

/**
 * Status of the automatic daily email scheduler
 */
app.get('/api/calibration/scheduler-status', (req: Request, res: Response) => {
  const riyadhDate = getRiyadhDate();
  const sentToday = serverEmailLogs.some(
    (l) => l.dateString === riyadhDate && (l.status === 'sent' || l.status === 'simulated')
  );
  res.json({
    active: true,
    timezone: 'Asia/Riyadh',
    targetHour: 8,
    targetHourDisplay: '08:00 AM (Asia/Riyadh)',
    currentRiyadhDate: riyadhDate,
    alreadySentToday: sentToday,
    cachedEquipmentCount: cachedEquipment.length,
    lastLog: serverEmailLogs[0] || null
  });
});

/**
 * Get email logs
 */
app.get('/api/calibration/email-logs', (req: Request, res: Response) => {
  res.json({ logs: serverEmailLogs });
});

// ==========================================
// VITE OR STATIC FRONTEND MOUNTING
// ==========================================

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`My Notes Hub server running on port ${PORT} (Timezone: Asia/Riyadh active)`);

    // Automatic Daily Email Background Scheduler (Evaluates every 60 seconds)
    setInterval(async () => {
      try {
        const riyadhNow = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Riyadh',
          hour: 'numeric',
          hour12: false
        });
        const currentHour = parseInt(formatter.format(riyadhNow), 10);
        const riyadhDate = getRiyadhDate(riyadhNow);

        // Runs every morning starting from 08:00 AM (Asia/Riyadh)
        if (currentHour >= 8) {
          const alreadyRanToday = serverEmailLogs.some(
            (l) => l.dateString === riyadhDate && (l.status === 'sent' || l.status === 'simulated' || l.status === 'skipped_no_items')
          );

          if (!alreadyRanToday && cachedEquipment.length > 0) {
            console.log(`[AUTOMATIC EMAIL REMINDER] Daily 08:00 AM trigger fired for date ${riyadhDate} (${cachedEquipment.length} items evaluated)...`);
            await executeConsolidatedEmailCheckInternal({
              equipment: cachedEquipment,
              force: false,
              triggerSource: 'auto_daily_scheduler'
            });
          }
        }
      } catch (schedErr) {
        console.error('[AUTOMATIC EMAIL REMINDER] Error in scheduled interval check:', schedErr);
      }
    }, 60 * 1000);

    // Initial check 5s after startup in case server booted after 8:00 AM
    setTimeout(async () => {
      try {
        const riyadhNow = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Riyadh',
          hour: 'numeric',
          hour12: false
        });
        const currentHour = parseInt(formatter.format(riyadhNow), 10);
        const riyadhDate = getRiyadhDate(riyadhNow);

        if (currentHour >= 8 && cachedEquipment.length > 0) {
          const alreadyRanToday = serverEmailLogs.some(
            (l) => l.dateString === riyadhDate && (l.status === 'sent' || l.status === 'simulated' || l.status === 'skipped_no_items')
          );
          if (!alreadyRanToday) {
            console.log(`[AUTOMATIC EMAIL REMINDER] Startup check: executing daily check for ${riyadhDate}...`);
            await executeConsolidatedEmailCheckInternal({
              equipment: cachedEquipment,
              force: false,
              triggerSource: 'startup_auto_check'
            });
          }
        }
      } catch (startupErr) {
        console.error('[AUTOMATIC EMAIL REMINDER] Startup check error:', startupErr);
      }
    }, 5000);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
