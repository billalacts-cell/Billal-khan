export interface GoogleFormItem {
  id: string;
  title: string;
  url: string;
  category: string;
  description?: string;
  color?: string;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number | null;
  openCount?: number;
  isStarred?: boolean;
  userId?: string;
}

export type Category = 
  | 'Calibration'
  | 'Equipment'
  | 'Site Notes'
  | 'Maintenance'
  | 'Other'
  | string;

export const DEFAULT_CATEGORIES: string[] = [
  'Calibration',
  'Equipment',
  'Site Notes',
  'Maintenance',
  'Other'
];

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; badge: string; dot: string }> = {
  'Calibration': {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800/50',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
    dot: 'bg-emerald-500'
  },
  'Equipment': {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800/50',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
    dot: 'bg-blue-500'
  },
  'Site Notes': {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800/50',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
    dot: 'bg-amber-500'
  },
  'Maintenance': {
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-200 dark:border-violet-800/50',
    badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200',
    dot: 'bg-violet-500'
  },
  'Other': {
    bg: 'bg-slate-50 dark:bg-slate-900/40',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
    badge: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    dot: 'bg-slate-500'
  }
};

/**
 * Initial 2 Default Forms:
 * Form 1: Equipment Calibration & Maintenance Form (https://forms.gle/Wr6ABCb6W4C5JJiP9)
 * Form 2: Site Notes & Log Form (https://forms.gle/jRYgheFETBLZrcbZA)
 */
export const INITIAL_DEFAULT_FORMS: GoogleFormItem[] = [
  {
    id: 'default-form-calibration',
    title: 'Equipment Calibration & Maintenance Form',
    url: 'https://forms.gle/Wr6ABCb6W4C5JJiP9',
    category: 'Calibration',
    description: 'Record instrument calibration details, periodic equipment checks, calibration certificates, and maintenance requirements.',
    color: 'emerald',
    createdAt: 1729400000000,
    updatedAt: 1729400000000,
    lastOpenedAt: null,
    openCount: 0,
    isStarred: true,
  },
  {
    id: 'default-form-site-notes',
    title: 'Site Notes & Log Form',
    url: 'https://forms.gle/jRYgheFETBLZrcbZA',
    category: 'Site Notes',
    description: 'Record site activities, daily notes, observations, safety matters, and project updates.',
    color: 'amber',
    createdAt: 1729401000000,
    updatedAt: 1729401000000,
    lastOpenedAt: null,
    openCount: 0,
    isStarred: true,
  }
];

// ==========================================
// EQUIPMENT TRACKING TYPES & DATA MODELS
// ==========================================

export type EquipmentStatus = 
  | 'In Stock'
  | 'Assigned'
  | 'Under Maintenance'
  | 'Calibration Due'
  | 'Decommissioned';

export type CalibrationStatus = 
  | 'Valid'
  | 'Upcoming'
  | 'Expired'
  | 'Not Applicable';

export interface EquipmentPhoto {
  id: string;
  url: string;
  caption: string;
  type: 'main' | 'additional' | 'label';
  uploadedAt: number;
}

export interface EquipmentCertificate {
  id: string;
  title: string;
  url: string;
  issueDate?: string;
  expiryDate?: string;
}

export interface MovementRecord {
  id: string;
  equipmentId: string;
  equipmentName: string;
  fromLocation: string;
  toLocation: string;
  fromProject: string;
  toProject: string;
  transferDate: string;
  issuedBy: string;
  receivedBy: string;
  remarks?: string;
  timestamp: number;
}

export interface MaintenanceRecord {
  id: string;
  date: string;
  type: 'Inspection' | 'Repair' | 'Routine Maintenance' | 'Calibration';
  performedBy: string;
  details: string;
  cost?: string;
}

export interface EquipmentItem {
  id: string; // Equipment ID / Asset Number (e.g. C3332)
  name: string; // Equipment name (e.g. Thermometer)
  category: string; // Equipment category
  manufacturer: string;
  model: string;
  serialNumber: string;
  currentProject: string; // e.g. CRCC, In Stock
  currentLocation: string; // e.g. Store Room 3, Site Lab
  status: EquipmentStatus;
  dateIssued: string | null;
  dateReturned: string | null;
  calibrationDueDate: string | null;
  calibrationStatus: CalibrationStatus;
  calibrationCategory?: CalibrationCategory;
  externalProvider?: string;
  lastNotifiedDueDate?: string | null;
  lastNotifiedAt?: number | null;
  lastNotificationStatus?: 'sent' | 'simulated' | 'failed' | null;
  notes: string;
  photos: EquipmentPhoto[];
  certificates: EquipmentCertificate[];
  maintenanceHistory: MaintenanceRecord[];
  movementHistory: MovementRecord[];
  createdAt: number;
  updatedAt: number;
  source: 'google_sheets' | 'manual' | 'csv_import';
}

export type CalibrationCategory = 
  | 'Projects'
  | 'Internal Calibration'
  | 'External Calibration';

export const CALIBRATION_CATEGORIES: CalibrationCategory[] = [
  'Projects',
  'Internal Calibration',
  'External Calibration'
];

export interface BulkCalibrationRow {
  tempId: string;
  equipmentId?: string; // Optional (auto-generated CAL-XXXX-XXXX when omitted)
  projectName: string; // Project Name (e.g. CRCC)
  remarks: string; // Calibration Station Remark (station, lab, or calibration notes)
  dueDate: string; // Calibration Due Date (YYYY-MM-DD)
  name?: string; // Optional equipment name (defaults to ID or existing name)
  serialNumber?: string;
  calibrationCategory?: CalibrationCategory;
  externalProvider?: string;
  error?: string;
}

export interface BulkCalibrationBatch {
  id: string;
  timestamp: number;
  totalCount: number;
  recordedBy?: string;
  records: {
    equipmentId: string;
    name: string;
    calibrationCategory: CalibrationCategory;
    projectName?: string;
    dueDate: string;
    serialNumber?: string;
    externalProvider?: string;
    remarks?: string;
  }[];
}

export interface CalibrationEmailLog {
  id: string;
  dateString: string; // YYYY-MM-DD in Asia/Riyadh
  sentAt: number;
  recipientEmail: string;
  subject: string;
  totalEquipmentNotified: number;
  groupedSummary: {
    overdueCount?: number;
    projectsCount: number;
    internalCount: number;
    externalCount: number;
  };
  notifiedItems: {
    equipmentId: string;
    name: string;
    category: CalibrationCategory;
    projectName?: string;
    dueDate: string;
    serialNumber?: string;
    externalProvider?: string;
  }[];
  status: 'sent' | 'skipped_no_items' | 'already_sent_today' | 'failed' | 'simulated';
  errorDetails?: string;
  htmlPreview?: string;
}

export interface CalibrationRecipient {
  id: string;
  name: string;
  email: string;
  selected: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CalibrationEmailPreview {
  subject: string;
  recipientEmail: string;
  recipientEmails?: string[];
  dateString: string;
  totalDue: number;
  totalOverdue?: number;
  overdueItems?: {
    equipmentId: string;
    name: string;
    serialNumber: string;
    daysOverdue: number;
    dueDate: string;
    category: string;
    locationOrProject: string;
  }[];
  projectsItems: {
    projectName: string;
    items: {
      equipmentId: string;
      name: string;
      serialNumber: string;
      dueDate: string;
    }[];
  }[];
  internalItems: {
    equipmentId: string;
    name: string;
    serialNumber: string;
    location: string;
    dueDate: string;
  }[];
  externalItems: {
    equipmentId: string;
    name: string;
    serialNumber: string;
    externalProvider: string;
    dueDate: string;
  }[];
  htmlBody: string;
}

export interface SheetInspectionResult {
  spreadsheetId: string;
  title?: string;
  sheets: string[];
  activeSheet: string;
  headers: string[];
  mappedColumns: Record<string, string>;
  missingFields: string[];
  sampleRowsCount: number;
  records: EquipmentItem[];
  lastSyncedAt: number;
  error?: string;
}
