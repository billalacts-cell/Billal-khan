/**
 * Gmail API Service for sending calibration reminder emails
 * Scopes: https://www.googleapis.com/auth/gmail.send
 */
import { getAccessToken, signInWithGoogle, auth } from '../firebase';
import { CalibrationEmailPreview, EquipmentItem, CalibrationEmailLog } from '../types';
import { 
  generateConsolidatedEmailPreview, 
  getStoredEmailLogs, 
  saveLocalEmailLogs,
  getSelectedRecipientEmails
} from './calibrationService';
import { getLocalEquipment, saveLocalEquipment } from './equipmentStorage';

/**
 * Base64url encode string
 */
function base64UrlEncode(str: string): string {
  // Use TextEncoder to handle all UTF-8 characters safely
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Construct RFC 2822 email message format for Gmail API
 */
export function buildRawGmailMessage(options: {
  to: string | string[];
  from?: string;
  subject: string;
  htmlBody: string;
}): string {
  const toStr = Array.isArray(options.to) ? options.to.join(', ') : options.to;
  const fromStr = options.from || auth?.currentUser?.email || 'me';

  const lines = [
    `To: ${toStr}`,
    `From: ${fromStr}`,
    `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(options.subject)))}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    options.htmlBody
  ];

  return base64UrlEncode(lines.join('\r\n'));
}

/**
 * Sends an email directly via the Gmail REST API using the user's OAuth access token
 */
export async function sendEmailViaGmailApi(options: {
  to: string | string[];
  subject: string;
  htmlBody: string;
  from?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string; sentFrom?: string }> {
  let token = await getAccessToken();

  // If token is not yet in memory, trigger Google Sign-In with popup
  if (!token) {
    try {
      const authResult = await signInWithGoogle();
      token = authResult.accessToken;
      if (!token) {
        throw new Error('Google Sign-In completed, but no access token was returned.');
      }
    } catch (authErr: any) {
      return {
        success: false,
        error: `Google authorization required to send from primary mail: ${authErr.message}`
      };
    }
  }

  const senderEmail = auth?.currentUser?.email || 'billal.acts@gmail.com';
  const rawMessage = buildRawGmailMessage({
    to: options.to,
    from: senderEmail,
    subject: options.subject,
    htmlBody: options.htmlBody
  });

  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: rawMessage })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.error?.message || `Gmail API error (${res.status})`;
      return {
        success: false,
        error: `Gmail delivery failed: ${errMsg}`
      };
    }

    const data = await res.json();
    return {
      success: true,
      messageId: data.id,
      sentFrom: senderEmail
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Network error connecting to Gmail API: ${err.message}`
    };
  }
}

/**
 * Sends a live test email directly from the primary Google account
 */
export async function sendGmailTestEmail(targetRecipient?: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const recipient = targetRecipient || getSelectedRecipientEmails()[0] || 'billal.acts@gmail.com';
  const sender = auth?.currentUser?.email || 'billal.acts@gmail.com';
  const today = new Date().toISOString().split('T')[0];

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; background: #f8fafc; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
          <h2 style="color: #16a34a; margin-top: 0;">✓ Primary Gmail Delivery Connected</h2>
          <p>This is a live test notification sent directly from your primary Google account.</p>
          <div style="background: #f1f5f9; padding: 14px 18px; border-radius: 8px; font-size: 13px; margin: 16px 0;">
            <div><strong>Sender (Primary Mail):</strong> ${sender}</div>
            <div><strong>Target Recipient:</strong> ${recipient}</div>
            <div><strong>Service:</strong> Google Workspace Gmail API (OAuth)</div>
            <div><strong>Date:</strong> ${today}</div>
          </div>
          <p style="color: #64748b; font-size: 12px; margin-top: 24px;">Your calibration reminders will now be sent directly from ${sender}.</p>
        </div>
      </body>
    </html>
  `;

  const res = await sendEmailViaGmailApi({
    to: recipient,
    subject: `[Live Test] Calibration Email Service Connected – ${today}`,
    htmlBody
  });

  if (res.success) {
    return {
      success: true,
      message: `Test email successfully sent from ${res.sentFrom || sender} to ${recipient} via Gmail API!`
    };
  } else {
    return {
      success: false,
      error: res.error || 'Failed to send test email via Gmail API'
    };
  }
}

/**
 * Runs the daily calibration reminder check using primary Gmail account
 */
export async function runCalibrationCheckViaGmail(options?: {
  equipmentList?: EquipmentItem[];
  recipients?: string[];
  force?: boolean;
}): Promise<{
  success: boolean;
  message: string;
  totalDue?: number;
  totalOverdue?: number;
  notifiedIds?: string[];
}> {
  const equipment = options?.equipmentList || getLocalEquipment();
  const recipientList = (options?.recipients && options.recipients.length > 0)
    ? options.recipients
    : getSelectedRecipientEmails();

  const preview = generateConsolidatedEmailPreview(equipment, recipientList);

  if (preview.totalDue === 0) {
    return {
      success: true,
      message: `No equipment items are currently due for calibration in 20 days.`,
      totalDue: 0,
      totalOverdue: 0,
      notifiedIds: []
    };
  }

  // Send real email via Gmail API
  const sendRes = await sendEmailViaGmailApi({
    to: recipientList,
    subject: preview.subject,
    htmlBody: preview.htmlBody
  });

  if (!sendRes.success) {
    return {
      success: false,
      message: sendRes.error || 'Failed to send calibration email via Gmail API'
    };
  }

  // Update notified items in local storage
  const now = Date.now();
  const notifiedIds: string[] = [];

  // 20-day upcoming items that were included
  const nextEquipment = equipment.map((item) => {
    const isDue = preview.projectsItems.some((p) => p.items.some((i) => i.equipmentId.toLowerCase() === item.id.toLowerCase()));

    if (isDue) {
      notifiedIds.push(item.id);
      return {
        ...item,
        lastNotifiedDueDate: item.calibrationDueDate,
        lastNotifiedAt: now,
        lastNotificationStatus: 'sent' as const
      };
    }
    return item;
  });

  saveLocalEquipment(nextEquipment);

  // Record log
  const log: CalibrationEmailLog = {
    id: `gmail_log_${now}`,
    dateString: preview.dateString,
    sentAt: now,
    recipientEmail: recipientList.join(', '),
    subject: preview.subject,
    totalEquipmentNotified: notifiedIds.length,
    groupedSummary: {
      overdueCount: 0,
      projectsCount: preview.projectsItems.reduce((acc, p) => acc + p.items.length, 0),
      internalCount: 0,
      externalCount: 0
    },
    notifiedItems: notifiedIds.map((id) => {
      const itm = equipment.find((e) => e.id.toLowerCase() === id.toLowerCase());
      return {
        equipmentId: id,
        name: itm?.name || id,
        category: itm?.calibrationCategory || 'Internal Calibration',
        dueDate: itm?.calibrationDueDate || ''
      };
    }),
    status: 'sent',
    htmlPreview: preview.htmlBody
  };

  const logs = [log, ...getStoredEmailLogs()];
  saveLocalEmailLogs(logs);

  return {
    success: true,
    message: `Calibration reminder email successfully sent from ${sendRes.sentFrom} to ${recipientList.join(', ')} (${notifiedIds.length} items notified: 20-day notice).`,
    totalDue: preview.totalDue,
    totalOverdue: 0,
    notifiedIds
  };
}
