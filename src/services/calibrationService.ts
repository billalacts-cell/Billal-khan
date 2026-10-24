import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../firebase';
import { 
  EquipmentItem, 
  BulkCalibrationRow, 
  BulkCalibrationBatch, 
  CalibrationEmailLog, 
  CalibrationEmailPreview,
  CalibrationCategory,
  CalibrationRecipient
} from '../types';
import { getLocalEquipment, saveLocalEquipment, saveEquipmentItem, notifyEquipmentSubscribers } from './equipmentStorage';
import { calculateCalibrationStatus } from './googleSheetsService';

const EMAIL_LOGS_STORAGE_KEY = 'my_notes_hub_calibration_email_logs_v1';
const BATCHES_STORAGE_KEY = 'my_notes_hub_bulk_batches_v1';
const RECIPIENTS_STORAGE_KEY = 'my_notes_hub_calibration_recipients_v1';
export const DEFAULT_CONFIGURED_EMAIL = 'billal.acts@gmail.com';

/**
 * Returns the current date in Asia/Riyadh timezone formatted as YYYY-MM-DD
 */
export function getRiyadhDateString(d: Date = new Date()): string {
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
 * Calculates the reminder date (exactly 20 calendar days before due date)
 */
export function calculateReminderDate(dueDateStr: string): string | null {
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
 * Calculates number of calendar days between today in Riyadh and due date
 */
export function getDaysUntilDue(dueDateStr: string, referenceDateStr?: string): number | null {
  if (!dueDateStr) return null;
  const todayStr = referenceDateStr || getRiyadhDateString();
  const d1 = new Date(todayStr + 'T00:00:00Z');
  const d2 = new Date(dueDateStr + 'T00:00:00Z');
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Checks if equipment record is due for 20-day reminder today in Riyadh
 */
export function isDueFor20DayReminder(dueDateStr: string | null, todayRiyadhStr?: string): boolean {
  if (!dueDateStr) return false;
  const today = todayRiyadhStr || getRiyadhDateString();
  const reminderDate = calculateReminderDate(dueDateStr);
  return reminderDate === today;
}

/**
 * Read email logs from localStorage
 */
export function getStoredEmailLogs(): CalibrationEmailLog[] {
  try {
    const raw = localStorage.getItem(EMAIL_LOGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading email logs:', err);
    return [];
  }
}

/**
 * Save email logs to localStorage
 */
export function saveLocalEmailLogs(logs: CalibrationEmailLog[]): void {
  try {
    localStorage.setItem(EMAIL_LOGS_STORAGE_KEY, JSON.stringify(logs));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('my_notes_hub_email_logs_change', { detail: logs }));
    }
  } catch (err) {
    console.error('Error writing email logs:', err);
  }
}

/**
 * Read bulk batches from localStorage
 */
export function getStoredBulkBatches(): BulkCalibrationBatch[] {
  try {
    const raw = localStorage.getItem(BATCHES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading bulk batches:', err);
    return [];
  }
}

export function saveLocalBulkBatches(batches: BulkCalibrationBatch[]): void {
  try {
    localStorage.setItem(BATCHES_STORAGE_KEY, JSON.stringify(batches));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('my_notes_hub_batches_change', { detail: batches }));
    }
  } catch (err) {
    console.error('Error writing bulk batches:', err);
  }
}

/**
 * Read recipients from localStorage (or fallback to default)
 */
export function getStoredRecipients(): CalibrationRecipient[] {
  try {
    const raw = localStorage.getItem(RECIPIENTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const defaultRecipients: CalibrationRecipient[] = [
      {
        id: 'rec_default_1',
        name: 'Primary Recipient',
        email: DEFAULT_CONFIGURED_EMAIL,
        selected: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];
    localStorage.setItem(RECIPIENTS_STORAGE_KEY, JSON.stringify(defaultRecipients));
    return defaultRecipients;
  } catch (err) {
    console.error('Error reading recipients:', err);
    return [];
  }
}

export function saveLocalRecipients(recipients: CalibrationRecipient[]): void {
  try {
    localStorage.setItem(RECIPIENTS_STORAGE_KEY, JSON.stringify(recipients));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('my_notes_hub_recipients_change', { detail: recipients }));
    }
  } catch (err) {
    console.error('Error writing recipients:', err);
  }
}

export function getSelectedRecipientEmails(): string[] {
  const all = getStoredRecipients();
  const selected = all.filter((r) => r.selected).map((r) => r.email.trim());
  if (selected.length > 0) return selected;
  return all.length > 0 ? [all[0].email.trim()] : [DEFAULT_CONFIGURED_EMAIL];
}

export async function addRecipient(item: { name: string; email: string }): Promise<CalibrationRecipient> {
  const cleanName = item.name.trim();
  const cleanEmail = item.email.trim().toLowerCase();
  const now = Date.now();
  const id = `rec_${now}_${Math.random().toString(36).substring(2, 6)}`;
  const newRecipient: CalibrationRecipient = {
    id,
    name: cleanName,
    email: cleanEmail,
    selected: true,
    createdAt: now,
    updatedAt: now
  };

  const list = [newRecipient, ...getStoredRecipients().filter((r) => r.email.toLowerCase() !== cleanEmail)];
  saveLocalRecipients(list);

  const currentUser = auth?.currentUser;
  if (isFirebaseConfigured && db && currentUser) {
    try {
      await setDoc(doc(db, 'calibration_recipients', id), newRecipient, { merge: true });
    } catch (e) {
      console.warn('Firebase recipient save notice:', e);
    }
  }

  return newRecipient;
}

export async function updateRecipient(id: string, updates: Partial<CalibrationRecipient>): Promise<CalibrationRecipient | null> {
  const list = getStoredRecipients();
  let updatedItem: CalibrationRecipient | null = null;
  const next = list.map((r) => {
    if (r.id === id) {
      updatedItem = { ...r, ...updates, updatedAt: Date.now() };
      return updatedItem;
    }
    return r;
  });

  saveLocalRecipients(next);

  const currentUser = auth?.currentUser;
  if (isFirebaseConfigured && db && currentUser && updatedItem) {
    try {
      await setDoc(doc(db, 'calibration_recipients', id), updatedItem, { merge: true });
    } catch (e) {
      console.warn('Firebase recipient update notice:', e);
    }
  }

  return updatedItem;
}

export async function deleteRecipient(id: string): Promise<boolean> {
  const list = getStoredRecipients();
  const next = list.filter((r) => r.id !== id);
  saveLocalRecipients(next);

  const currentUser = auth?.currentUser;
  if (isFirebaseConfigured && db && currentUser) {
    try {
      await deleteDoc(doc(db, 'calibration_recipients', id));
    } catch (e) {
      console.warn('Firebase recipient delete notice:', e);
    }
  }

  return true;
}

export function toggleRecipientSelection(id: string, selected: boolean): void {
  updateRecipient(id, { selected });
}

export function selectAllRecipients(selected: boolean): void {
  const list = getStoredRecipients();
  const next = list.map((r) => ({ ...r, selected, updatedAt: Date.now() }));
  saveLocalRecipients(next);
}

export function subscribeToRecipients(onUpdate: (recipients: CalibrationRecipient[]) => void): () => void {
  onUpdate(getStoredRecipients());

  const handleCustom = (e: Event) => {
    const custom = e as CustomEvent<CalibrationRecipient[]>;
    if (custom.detail) onUpdate(custom.detail);
    else onUpdate(getStoredRecipients());
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === RECIPIENTS_STORAGE_KEY) {
      onUpdate(getStoredRecipients());
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('my_notes_hub_recipients_change', handleCustom);
    window.addEventListener('storage', handleStorage);
  }

  let unsubFirestore: (() => void) | null = null;
  const currentUser = auth?.currentUser;
  if (isFirebaseConfigured && db && currentUser) {
    try {
      const colRef = collection(db, 'calibration_recipients');
      unsubFirestore = onSnapshot(colRef, (snapshot) => {
        if (!snapshot.empty) {
          const remote: CalibrationRecipient[] = [];
          snapshot.forEach((snap) => {
            remote.push(snap.data() as CalibrationRecipient);
          });
          remote.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          saveLocalRecipients(remote);
          onUpdate(remote);
        }
      }, (err) => {
        console.warn('Firestore recipients notice:', err.message);
      });
    } catch (err) {
      console.warn('Error subscribing to remote recipients:', err);
    }
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('my_notes_hub_recipients_change', handleCustom);
      window.removeEventListener('storage', handleStorage);
    }
    if (unsubFirestore) unsubFirestore();
  };
}

/**
 * Subscribe to email notification logs
 */
export function subscribeToEmailLogs(onUpdate: (logs: CalibrationEmailLog[]) => void): () => void {
  onUpdate(getStoredEmailLogs());

  const handleCustom = (e: Event) => {
    const custom = e as CustomEvent<CalibrationEmailLog[]>;
    if (custom.detail) onUpdate(custom.detail);
    else onUpdate(getStoredEmailLogs());
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === EMAIL_LOGS_STORAGE_KEY) {
      onUpdate(getStoredEmailLogs());
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('my_notes_hub_email_logs_change', handleCustom);
    window.addEventListener('storage', handleStorage);
  }

  let unsubFirestore: (() => void) | null = null;
  const currentUser = auth?.currentUser;
  if (isFirebaseConfigured && db && currentUser) {
    try {
      const colRef = collection(db, 'calibration_email_logs');
      unsubFirestore = onSnapshot(colRef, (snapshot) => {
        if (!snapshot.empty) {
          const remote: CalibrationEmailLog[] = [];
          snapshot.forEach((snap) => {
            remote.push(snap.data() as CalibrationEmailLog);
          });
          remote.sort((a, b) => b.sentAt - a.sentAt);
          saveLocalEmailLogs(remote);
          onUpdate(remote);
        }
      }, (err) => {
        console.warn('Firestore email logs subscription notice:', err.message);
      });
    } catch (err) {
      console.warn('Error subscribing to remote email logs:', err);
    }
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('my_notes_hub_email_logs_change', handleCustom);
      window.removeEventListener('storage', handleStorage);
    }
    if (unsubFirestore) unsubFirestore();
  };
}

/**
 * Ingests multiple table rows in one atomic session
 * Validates, saves all valid records together in Firestore & localStorage, and records the batch
 */
export async function saveBulkCalibrationRows(
  rows: BulkCalibrationRow[],
  recordedByEmail?: string
): Promise<{ savedCount: number; batch: BulkCalibrationBatch }> {
  const currentList = getLocalEquipment();
  const currentMap = new Map<string, EquipmentItem>();
  currentList.forEach((e) => currentMap.set(e.id.toLowerCase(), e));

  const now = Date.now();
  const batchId = `batch_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const savedItems: EquipmentItem[] = [];

  for (const row of rows) {
    const cleanDueDate = (row.dueDate || '').trim();
    if (!cleanDueDate) continue;

    let cleanId = (row.equipmentId || '').trim().toUpperCase();
    if (!cleanId) {
      cleanId = `CAL-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-4)}`;
    }

    const existing = currentMap.get(cleanId.toLowerCase());
    const cleanName = (row.name && row.name.trim()) 
      ? row.name.trim() 
      : (existing?.name || `Calibration Item ${cleanId}`);

    const stationRemark = (row.remarks || '').trim();
    const cleanProject = (row.projectName || '').trim();

    // In Calibration Option dropdown, keep only two options: Internal Calibration or External Calibration
    const category: CalibrationCategory = row.calibrationCategory === 'External Calibration'
      ? 'External Calibration'
      : 'Internal Calibration';

    const dueDateChanged = existing ? existing.calibrationDueDate !== cleanDueDate : true;

    const item: EquipmentItem = {
      id: cleanId,
      name: cleanName,
      category: existing?.category || 'Calibration',
      manufacturer: existing?.manufacturer || 'Not recorded',
      model: existing?.model || 'Not recorded',
      serialNumber: (row.serialNumber && row.serialNumber.trim()) || existing?.serialNumber || 'Not recorded',
      currentProject: cleanProject || existing?.currentProject || 'In Stock',
      currentLocation: category === 'Internal Calibration' 
        ? (stationRemark || existing?.currentLocation || 'Internal Calibration Station') 
        : (stationRemark || existing?.currentLocation || 'Main Store'),
      status: 'In Stock',
      dateIssued: existing?.dateIssued || null,
      dateReturned: existing?.dateReturned || null,
      calibrationDueDate: cleanDueDate,
      calibrationStatus: calculateCalibrationStatus(cleanDueDate),
      calibrationCategory: category,
      externalProvider: category === 'External Calibration' 
        ? (row.externalProvider?.trim() || stationRemark || existing?.externalProvider || 'External Laboratory') 
        : (existing?.externalProvider || ''),
      // Reset notified cycle if due date is updated
      lastNotifiedDueDate: dueDateChanged ? null : (existing?.lastNotifiedDueDate || null),
      lastNotifiedAt: dueDateChanged ? null : (existing?.lastNotifiedAt || null),
      notes: stationRemark || existing?.notes || '',
      photos: existing?.photos || [],
      certificates: existing?.certificates || [],
      maintenanceHistory: [
        ...(existing?.maintenanceHistory || []),
        {
          id: `maint_bulk_${now}_${cleanId}`,
          date: new Date().toISOString().split('T')[0],
          type: 'Calibration',
          performedBy: recordedByEmail || 'Bulk Calibration Entry',
          details: `Calibration cycle scheduled for ${cleanDueDate} (${category}${stationRemark ? ' - ' + stationRemark : ''})`
        }
      ],
      movementHistory: existing?.movementHistory || [
        {
          id: `mov_init_${cleanId}`,
          equipmentId: cleanId,
          equipmentName: cleanName,
          fromLocation: 'Origin',
          toLocation: category === 'Internal Calibration' ? (stationRemark || 'Internal Station') : 'Main Store',
          fromProject: 'Stock',
          toProject: cleanProject || 'Stock',
          transferDate: new Date().toISOString().split('T')[0],
          issuedBy: recordedByEmail || 'Bulk Entry',
          receivedBy: cleanProject || (category === 'Internal Calibration' ? 'Internal Station' : 'Store'),
          remarks: stationRemark || 'Bulk calibration registration',
          timestamp: now
        }
      ],
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      source: 'manual'
    };

    savedItems.push(item);
    currentMap.set(cleanId.toLowerCase(), item);
  }

  // Update local equipment storage and notify subscribers immediately
  const updatedAll = Array.from(currentMap.values());
  saveLocalEquipment(updatedAll);
  notifyEquipmentSubscribers(updatedAll);

  // Background sync to Firestore with timeout
  const currentUser = auth?.currentUser;
  if (isFirebaseConfigured && db && currentUser) {
    (async () => {
      for (const item of savedItems) {
        try {
          await Promise.race([
            setDoc(doc(db, 'equipment', item.id), item, { merge: true }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
          ]);
        } catch (e) {
          // Keep local
        }
      }
    })();
  }

  // Record Bulk Batch
  const batchRecord: BulkCalibrationBatch = {
    id: batchId,
    timestamp: now,
    totalCount: savedItems.length,
    recordedBy: recordedByEmail || 'Authorized User',
    records: savedItems.map((item) => ({
      equipmentId: item.id,
      name: item.name,
      calibrationCategory: (item.calibrationCategory === 'External Calibration' ? 'External Calibration' : 'Internal Calibration') as CalibrationCategory,
      projectName: item.currentProject || '',
      dueDate: item.calibrationDueDate || '',
      serialNumber: item.serialNumber || '',
      externalProvider: item.externalProvider || '',
      remarks: item.notes || ''
    }))
  };

  const batches = [batchRecord, ...getStoredBulkBatches()];
  saveLocalBulkBatches(batches);

  if (isFirebaseConfigured && db && currentUser) {
    setDoc(doc(db, 'calibration_batches', batchId), batchRecord, { merge: true }).catch(() => {});
  }

  return { savedCount: savedItems.length, batch: batchRecord };
}

/**
 * Batch updates multiple equipment records with a new calibration due date
 */
export async function batchUpdateEquipmentDueDates(
  equipmentIds: string[],
  newDueDate: string,
  newCategory?: CalibrationCategory
): Promise<number> {
  if (!equipmentIds.length || !newDueDate) return 0;
  const current = getLocalEquipment();
  const idSet = new Set(equipmentIds.map((id) => id.toLowerCase()));
  const now = Date.now();
  let updatedCount = 0;

  const next = current.map((item) => {
    if (idSet.has(item.id.toLowerCase())) {
      updatedCount++;
      return {
        ...item,
        calibrationDueDate: newDueDate,
        calibrationStatus: calculateCalibrationStatus(newDueDate),
        ...(newCategory ? { calibrationCategory: newCategory } : {}),
        lastNotifiedDueDate: null, // Reset notification for the new cycle
        lastNotifiedAt: null,
        updatedAt: now,
        maintenanceHistory: [
          ...(item.maintenanceHistory || []),
          {
            id: `maint_batch_${now}_${item.id}`,
            date: new Date().toISOString().split('T')[0],
            type: 'Calibration' as const,
            performedBy: 'Batch Due Date Update',
            details: `Calibration due date updated to ${newDueDate}`
          }
        ]
      };
    }
    return item;
  });

  saveLocalEquipment(next);
  notifyEquipmentSubscribers(next);

  // Background sync updated records
  const currentUser = auth?.currentUser;
  if (isFirebaseConfigured && db && currentUser) {
    (async () => {
      for (const item of next) {
        if (idSet.has(item.id.toLowerCase())) {
          try {
            await setDoc(doc(db, 'equipment', item.id), item, { merge: true });
          } catch {}
        }
      }
    })();
  }

  return updatedCount;
}

/**
 * Generates the consolidated email data and HTML representation
 * Grouped strictly into:
 * 1. Projects (grouped by project name)
 * 2. Internal Calibration
 * 3. External Calibration
 */
export function generateConsolidatedEmailPreview(
  items: EquipmentItem[],
  recipientEmails?: string[] | string,
  referenceDateStr?: string
): CalibrationEmailPreview {
  const riyadhDate = referenceDateStr || getRiyadhDateString();

  let recipientList: string[] = [];
  if (Array.isArray(recipientEmails) && recipientEmails.length > 0) {
    recipientList = recipientEmails;
  } else if (typeof recipientEmails === 'string' && recipientEmails.trim()) {
    recipientList = recipientEmails.split(',').map((s) => s.trim()).filter(Boolean);
  } else {
    recipientList = getSelectedRecipientEmails();
  }
  const primaryRecipient = recipientList.join(', ');

  // Filter only items due for calibration in 20 calendar days (strictly upcoming, excluding overdue)
  const dueItems = items.filter((item) => {
    if (!item.calibrationDueDate) return false;
    const days = getDaysUntilDue(item.calibrationDueDate, riyadhDate);
    return days !== null && days >= 0 && (days <= 20 || isDueFor20DayReminder(item.calibrationDueDate, riyadhDate));
  });

  const subject = `Calibration 20-Day Reminder Notice – ${riyadhDate}`;

  // Group all equipment by Project Name (e.g. FFF, CRCC, General, etc.)
  const projectMap = new Map<string, EquipmentItem[]>();

  dueItems.forEach((item) => {
    const projName = (item.currentProject && item.currentProject.trim() && item.currentProject.toLowerCase() !== 'in stock')
      ? item.currentProject.trim()
      : (item.currentProject || 'General / In Stock');
    const list = projectMap.get(projName) || [];
    list.push(item);
    projectMap.set(projName, list);
  });

  const projectsItems = Array.from(projectMap.entries()).map(([projectName, list]) => ({
    projectName,
    items: list.map((i) => ({
      equipmentId: i.id,
      name: i.name,
      serialNumber: i.serialNumber && i.serialNumber !== 'Not recorded' ? i.serialNumber : '—',
      dueDate: i.calibrationDueDate || '',
      calibrationCategory: i.calibrationCategory || 'Internal Calibration',
      remarks: i.notes || i.currentLocation || i.externalProvider || ''
    }))
  }));

  // Build clean, modern HTML email content focusing strictly on 20-Day Reminder
  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; line-height: 1.5; }
    .container { max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #0f172a; color: #ffffff; padding: 24px 28px; }
    .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 700; }
    .header p { margin: 0; font-size: 13px; color: #94a3b8; }
    .body-content { padding: 24px 28px; }
    .notice { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 14px 18px; border-radius: 8px; font-size: 13px; margin-bottom: 24px; }
    .project-card { margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #ffffff; }
    .project-card-header { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; }
    .project-title { font-size: 13px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; }
    .project-count { font-size: 11px; color: #64748b; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #ffffff; color: #475569; font-weight: 700; text-align: left; padding: 9px 14px; border-bottom: 2px solid #e2e8f0; font-size: 12px; }
    td { padding: 11px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .tag { display: inline-block; padding: 3px 7px; border-radius: 4px; font-size: 11px; font-weight: 700; font-family: monospace; background: #eff6ff; color: #1d4ed8; }
    .due-date { font-weight: 700; color: #b45309; }
    .badge-internal { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
    .badge-external { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; background: #ede9fe; color: #5b21b6; border: 1px solid #ddd6fe; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; text-align: center; font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Calibration 20-Day Reminder Notice</h1>
      <p>Automated reminder for <strong>Asia/Riyadh</strong> • Date: <strong>${riyadhDate}</strong></p>
    </div>
    <div class="body-content">
      <div class="notice">
        <strong>20-Day Calibration Notice:</strong> The following <strong>${dueItems.length}</strong> equipment record(s) are due for calibration within <strong>20 calendar days</strong>. Please arrange for calibration certification or service as needed.
      </div>
  `;

  // Focus directly on Project Name (No section 2 and 3)
  if (projectsItems.length === 0) {
    html += `<p style="font-size: 13px; color: #94a3b8; font-style: italic; text-align: center; padding: 20px 0;">No equipment records due for calibration.</p>`;
  } else {
    projectsItems.forEach((group) => {
      html += `
      <div class="project-card">
        <div class="project-card-header">
          <span class="project-title">PROJECT: ${group.projectName}</span>
          <span class="project-count">${group.items.length} item${group.items.length === 1 ? '' : 's'}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 120px;">Asset ID</th>
              <th>Item Description</th>
              <th style="width: 130px;">Serial Number</th>
              <th style="width: 110px;">Due Date</th>
            </tr>
          </thead>
          <tbody>
      `;

      group.items.forEach((item) => {
        const isExternal = item.calibrationCategory === 'External Calibration';
        html += `
            <tr>
              <td>
                <span class="tag">${item.equipmentId}</span>
              </td>
              <td>
                <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${item.name}</div>
                <div style="margin-top: 4px;">
                  <span class="${isExternal ? 'badge-external' : 'badge-internal'}">
                    ${isExternal ? 'External Calibration' : 'Internal Calibration'}
                  </span>
                  ${item.remarks ? `<span style="font-size: 11px; color: #64748b; margin-left: 6px;">• ${item.remarks}</span>` : ''}
                </div>
              </td>
              <td style="font-family: monospace; color: #475569;">
                ${item.serialNumber}
              </td>
              <td class="due-date">
                ${item.dueDate}
              </td>
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
      This is a consolidated daily reminder dispatched by My Notes Hub. Notifications are sent exactly 20 calendar days prior to calibration due dates.
    </div>
  </div>
</body>
</html>
  `;

  return {
    subject,
    recipientEmail: primaryRecipient,
    recipientEmails: recipientList,
    dateString: riyadhDate,
    totalDue: dueItems.length,
    totalOverdue: 0,
    overdueItems: [],
    projectsItems,
    internalItems: [],
    externalItems: [],
    htmlBody: html
  };
}

/**
 * Triggers the server daily calibration check
 */
export async function triggerServerDailyCheck(options?: {
  force?: boolean;
  equipmentData?: EquipmentItem[];
  recipients?: string[];
}): Promise<{
  success: boolean;
  status?: string;
  message: string;
  log?: CalibrationEmailLog;
  preview?: CalibrationEmailPreview;
  notifiedIds?: string[];
}> {
  try {
    const equipment = options?.equipmentData || getLocalEquipment();
    const recipients = options?.recipients && options.recipients.length > 0
      ? options.recipients
      : getSelectedRecipientEmails();

    const res = await fetch('/api/calibration/check-and-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        force: Boolean(options?.force),
        equipment,
        recipients,
        recipientEmail: recipients.join(', ')
      })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Server responded with ${res.status}`);
    }

    const data = await res.json();

    // If check succeeded and log was created, record locally
    if (data.log) {
      const logs = [data.log, ...getStoredEmailLogs().filter((l) => l.id !== data.log.id)];
      saveLocalEmailLogs(logs);

      // ONLY set lastNotifiedDueDate if it was an actual delivery via SMTP!
      const isRealSend = data.isRealSend || data.status === 'sent';
      const current = getLocalEquipment();
      const next = current.map((item) => {
        if (Array.isArray(data.notifiedIds) && data.notifiedIds.some((id: string) => id.toLowerCase() === item.id.toLowerCase())) {
          return {
            ...item,
            lastNotifiedDueDate: isRealSend ? item.calibrationDueDate : null,
            lastNotifiedAt: isRealSend ? Date.now() : null,
            lastNotificationStatus: (data.status === 'sent' ? 'sent' : 'simulated') as any
          };
        }
        return item;
      });
      saveLocalEquipment(next);
      notifyEquipmentSubscribers(next);
    }

    return data;
  } catch (err: any) {
    console.error('Error calling /api/calibration/check-and-send:', err);
    return {
      success: false,
      message: err.message || 'Failed to trigger server calibration check'
    };
  }
}

/**
 * Resets notification status for an equipment item or all items
 */
export function resetEquipmentNotificationStatus(equipmentId?: string): void {
  const current = getLocalEquipment();
  const next = current.map((item) => {
    if (!equipmentId || item.id.toLowerCase() === equipmentId.toLowerCase()) {
      return {
        ...item,
        lastNotifiedDueDate: null,
        lastNotifiedAt: null,
        lastNotificationStatus: null
      };
    }
    return item;
  });
  saveLocalEquipment(next);
  notifyEquipmentSubscribers(next);
}

/**
 * Fetch server SMTP configuration status
 */
export async function getSmtpConfig(): Promise<{
  configured: boolean;
  host: string;
  port: number;
  user: string;
  from: string;
  hasPassword?: boolean;
}> {
  try {
    const res = await fetch('/api/calibration/smtp-config');
    if (!res.ok) throw new Error('Failed to fetch SMTP config');
    return await res.json();
  } catch (err) {
    return { configured: false, host: 'smtp.gmail.com', port: 587, user: '', from: '' };
  }
}

/**
 * Save and verify SMTP credentials on the backend
 */
export async function saveSmtpConfig(config: {
  host: string;
  port: number;
  user: string;
  pass?: string;
  from?: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/calibration/smtp-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save SMTP config');
    return data;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Send a live test email through configured SMTP
 */
export async function testSmtpDelivery(recipient?: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/calibration/test-smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to test SMTP connection');
    return data;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch Google Apps Script configuration from backend
 */
export async function getAppsScriptConfig(): Promise<{
  configured: boolean;
  webAppUrl: string;
  spreadsheetId: string;
  hasSecret: boolean;
}> {
  try {
    const res = await fetch('/api/apps-script/config');
    if (!res.ok) throw new Error('Failed to fetch Apps Script config');
    return await res.json();
  } catch {
    return {
      configured: false,
      webAppUrl: '',
      spreadsheetId: '1-zp0508H-nlZNPql2JQlQClK1aRYF1vFqn7y9U3L6kk',
      hasSecret: false
    };
  }
}

/**
 * Save Google Apps Script Web App URL and settings
 */
export async function saveAppsScriptConfig(config: {
  webAppUrl: string;
  secret?: string;
  spreadsheetId?: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/apps-script/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save Apps Script config');
    return data;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Test connectivity to Google Apps Script Web App
 */
export async function testAppsScriptConnection(
  webAppUrl?: string,
  secret?: string
): Promise<{ success: boolean; message?: string; data?: any; error?: string }> {
  try {
    const res = await fetch('/api/apps-script/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webAppUrl, secret })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Connection test failed');
    return data;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Send a live test email directly using Google Apps Script MailApp
 */
export async function testAppsScriptDelivery(
  recipient?: string,
  webAppUrl?: string,
  secret?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/apps-script/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, webAppUrl, secret })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send test email via Apps Script');
    return data;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Trigger daily calibration check directly via Google Apps Script MailApp
 */
export async function triggerAppsScriptCheck(options?: {
  force?: boolean;
  recipients?: string[];
}): Promise<any> {
  try {
    const res = await fetch('/api/apps-script/check-and-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        force: options?.force,
        recipients: options?.recipients || getSelectedRecipientEmails()
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to trigger Apps Script check');
    return data;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Sync equipment array to backend disk cache for background scheduler
 */
export async function syncEquipmentToServer(equipment: EquipmentItem[]): Promise<void> {
  if (!Array.isArray(equipment) || equipment.length === 0) return;
  try {
    await fetch('/api/calibration/sync-equipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipment })
    });
  } catch (err) {
    // Silent fail in offline/mock
  }
}

/**
 * Fetch automatic scheduler status
 */
export async function getSchedulerStatus(): Promise<{
  active: boolean;
  timezone: string;
  targetHour: number;
  targetHourDisplay: string;
  currentRiyadhDate: string;
  alreadySentToday: boolean;
  cachedEquipmentCount: number;
  lastLog: any;
}> {
  try {
    const res = await fetch('/api/calibration/scheduler-status');
    if (!res.ok) throw new Error('Failed to fetch status');
    return await res.json();
  } catch (err) {
    return {
      active: true,
      timezone: 'Asia/Riyadh',
      targetHour: 8,
      targetHourDisplay: '08:00 AM (Asia/Riyadh)',
      currentRiyadhDate: getRiyadhDateString(),
      alreadySentToday: false,
      cachedEquipmentCount: 0,
      lastLog: null
    };
  }
}

/**
 * Sets up 08:00 AM daily trigger in Google Apps Script Cloud
 */
export async function setupAppsScriptTrigger(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const cfg = await getAppsScriptConfig();
    if (!cfg || !cfg.webAppUrl) {
      throw new Error('Google Apps Script Web App URL is not configured yet.');
    }
    const targetUrl = new URL(cfg.webAppUrl);
    const res = await fetch(targetUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setupTrigger' })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Failed to install trigger');
    return { success: true, message: data.message || 'Daily 8:00 AM time-driven trigger created in Google Cloud!' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
