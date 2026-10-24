import { EquipmentItem, SheetInspectionResult, CalibrationStatus, EquipmentStatus } from '../types';
import { getAccessToken } from '../firebase';

export const TARGET_SPREADSHEET_ID = '1-zp0508H-nlZNPql2JQlQClK1aRYF1vFqn7y9U3L6kk';

/**
 * Normalizes header string for mapping
 */
function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[\s_\-]+/g, ' ');
}

/**
 * Determine calibration status based on date string
 */
export function calculateCalibrationStatus(dateStr?: string | null): CalibrationStatus {
  if (!dateStr || dateStr.trim() === '' || dateStr.toLowerCase() === 'not recorded') {
    return 'Not Applicable';
  }

  const parsed = Date.parse(dateStr);
  if (isNaN(parsed)) {
    return 'Not Applicable';
  }

  const now = Date.now();
  const diffDays = Math.ceil((parsed - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Expired';
  if (diffDays <= 30) return 'Upcoming';
  return 'Valid';
}

/**
 * Normalizes equipment status
 */
function normalizeStatus(rawStatus?: string | null, project?: string | null): EquipmentStatus {
  if (!rawStatus || rawStatus.trim() === '') {
    if (project && project !== 'Not recorded' && project.toLowerCase() !== 'stock' && project.toLowerCase() !== 'warehouse') {
      return 'Assigned';
    }
    return 'In Stock';
  }

  const s = rawStatus.toLowerCase();
  if (s.includes('maint') || s.includes('repair')) return 'Under Maintenance';
  if (s.includes('calibr') && (s.includes('due') || s.includes('expir'))) return 'Calibration Due';
  if (s.includes('decom') || s.includes('scrap') || s.includes('lost')) return 'Decommissioned';
  if (s.includes('assign') || s.includes('site') || s.includes('issued')) return 'Assigned';
  if (s.includes('stock') || s.includes('avail') || s.includes('store')) return 'In Stock';

  return 'In Stock';
}

/**
 * Inspects Google Spreadsheet tabs, column headers, and records using Google Sheets API v4
 */
export async function inspectAndFetchEquipmentSheet(
  spreadsheetId: string = TARGET_SPREADSHEET_ID,
  overrideToken?: string | null
): Promise<SheetInspectionResult> {
  const token = overrideToken || (await getAccessToken());

  if (!token) {
    return {
      spreadsheetId,
      title: 'Google Spreadsheet',
      sheets: [],
      activeSheet: 'Authorization Required',
      headers: [],
      mappedColumns: {},
      missingFields: [],
      sampleRowsCount: 0,
      records: [],
      lastSyncedAt: Date.now(),
      error: 'Google authorization token not found. Please sign in with your Google account to access this spreadsheet.'
    };
  }

  // 1. Fetch spreadsheet metadata (tabs and title)
  try {
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`;
    const metaRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!metaRes.ok) {
      const errorBody = await metaRes.text();
      let errorMsg = `Google Sheets API Error (${metaRes.status})`;
      if (metaRes.status === 403 || metaRes.status === 401) {
        errorMsg = `Permission denied: Please ensure your signed-in Google account has access to spreadsheet "${spreadsheetId}". You can also use CSV Import.`;
      } else if (metaRes.status === 404) {
        errorMsg = `Spreadsheet "${spreadsheetId}" was not found. Please check the spreadsheet ID.`;
      }
      return {
        spreadsheetId,
        title: 'Google Spreadsheet',
        sheets: [],
        activeSheet: 'Sync Unavailable',
        headers: [],
        mappedColumns: {},
        missingFields: [],
        sampleRowsCount: 0,
        records: [],
        lastSyncedAt: Date.now(),
        error: errorMsg
      };
    }

    const metaData = await metaRes.json();
    const sheetTitle = metaData.properties?.title || 'Equipment Spreadsheet';
    const sheetTabs: string[] = (metaData.sheets || []).map((s: any) => s.properties?.title).filter(Boolean);

    if (sheetTabs.length === 0) {
      return {
        spreadsheetId,
        title: sheetTitle,
        sheets: [],
        activeSheet: 'Empty Spreadsheet',
        headers: [],
        mappedColumns: {},
        missingFields: [],
        sampleRowsCount: 0,
        records: [],
        lastSyncedAt: Date.now(),
        error: 'The spreadsheet does not contain any sheets or tabs.'
      };
    }

    // Choose the best sheet tab
    const chosenTab = sheetTabs.find((t: string) => /equipment|asset|inventory|tool|calibration/i.test(t)) || sheetTabs[0];

    // 2. Fetch sheet values
    const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(chosenTab)}`;
    const valuesRes = await fetch(valuesUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!valuesRes.ok) {
      return {
        spreadsheetId,
        title: sheetTitle,
        sheets: sheetTabs,
        activeSheet: chosenTab,
        headers: [],
        mappedColumns: {},
        missingFields: [],
        sampleRowsCount: 0,
        records: [],
        lastSyncedAt: Date.now(),
        error: `Failed to read data from sheet tab "${chosenTab}" (${valuesRes.status}).`
      };
    }

  const valuesData = await valuesRes.json();
  const rawRows: string[][] = valuesData.values || [];

  if (rawRows.length === 0) {
    return {
      spreadsheetId,
      title: sheetTitle,
      sheets: sheetTabs,
      activeSheet: chosenTab,
      headers: [],
      mappedColumns: {},
      missingFields: ['All fields empty'],
      sampleRowsCount: 0,
      records: [],
      lastSyncedAt: Date.now()
    };
  }

  const headers = rawRows[0].map((h) => String(h || '').trim());
  const normalizedHeaders = headers.map(normalizeHeader);

  // Map header index to equipment field
  const fieldMapping: Record<string, number> = {};

  const searchIndex = (patterns: RegExp[]) => {
    for (const pat of patterns) {
      const idx = normalizedHeaders.findIndex((h) => pat.test(h));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  fieldMapping['id'] = searchIndex([/^asset\s*(no|id|code|tag)/i, /^equipment\s*(id|no|code)/i, /^tag\s*no/i, /^id$/i, /^code$/i, /asset/i, /equipment/i]);
  fieldMapping['name'] = searchIndex([/^equipment\s*name/i, /^item\s*name/i, /^description/i, /^instrument/i, /^tool/i, /^name$/i]);
  fieldMapping['category'] = searchIndex([/^category/i, /^type/i, /^class/i, /^group/i]);
  fieldMapping['manufacturer'] = searchIndex([/^manufacturer/i, /^make/i, /^brand/i]);
  fieldMapping['model'] = searchIndex([/^model/i, /^model\s*no/i]);
  fieldMapping['serialNumber'] = searchIndex([/^serial\s*(no|number)/i, /^s\/n/i, /^sn/i]);
  fieldMapping['currentProject'] = searchIndex([/^current\s*project/i, /^project/i, /^assigned\s*to/i, /^department/i, /^dept/i]);
  fieldMapping['currentLocation'] = searchIndex([/^current\s*location/i, /^location/i, /^store/i, /^site/i, /^place/i]);
  fieldMapping['status'] = searchIndex([/^status/i, /^condition/i, /^state/i]);
  fieldMapping['dateIssued'] = searchIndex([/^date\s*issued/i, /^issued\s*date/i, /^issue\s*date/i]);
  fieldMapping['dateReturned'] = searchIndex([/^date\s*returned/i, /^returned\s*date/i, /^return\s*date/i]);
  fieldMapping['calibrationDueDate'] = searchIndex([/^calibration\s*due/i, /^next\s*calibration/i, /^calibr.*date/i, /^due\s*date/i, /^expiry\s*date/i]);
  fieldMapping['notes'] = searchIndex([/^remarks/i, /^notes/i, /^comments/i]);
  fieldMapping['photo'] = searchIndex([/^photo/i, /^image/i, /^picture/i, /^url/i]);

  const mappedColumns: Record<string, string> = {};
  const missingFields: string[] = [];

  const checkField = (fieldKey: string, displayName: string) => {
    const idx = fieldMapping[fieldKey];
    if (idx !== -1 && idx < headers.length) {
      mappedColumns[displayName] = headers[idx];
    } else {
      missingFields.push(displayName);
    }
  };

  checkField('id', 'Equipment ID / Asset No');
  checkField('name', 'Equipment Name');
  checkField('category', 'Category');
  checkField('manufacturer', 'Manufacturer');
  checkField('model', 'Model');
  checkField('serialNumber', 'Serial Number');
  checkField('currentProject', 'Current Project');
  checkField('currentLocation', 'Current Location');
  checkField('status', 'Status');
  checkField('dateIssued', 'Date Issued');
  checkField('dateReturned', 'Date Returned');
  checkField('calibrationDueDate', 'Calibration Due Date');
  checkField('notes', 'Notes / Remarks');
  checkField('photo', 'Equipment Photo');

  // Convert rows into EquipmentItem records
  const records: EquipmentItem[] = [];
  const now = Date.now();

  for (let r = 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.every((c) => !c || String(c).trim() === '')) continue;

    const getValue = (fieldKey: string): string => {
      const idx = fieldMapping[fieldKey];
      if (idx !== -1 && idx < row.length) {
        const val = String(row[idx] || '').trim();
        return val || 'Not recorded';
      }
      return 'Not recorded';
    };

    let id = getValue('id');
    if (!id || id === 'Not recorded') {
      id = `EQ-${r}`;
    }

    const name = getValue('name');
    const category = getValue('category');
    const manufacturer = getValue('manufacturer');
    const model = getValue('model');
    const serialNumber = getValue('serialNumber');
    const project = getValue('currentProject');
    const location = getValue('currentLocation');
    const rawStatus = getValue('status');
    const dateIssued = getValue('dateIssued');
    const dateReturned = getValue('dateReturned');
    const calibDueDate = getValue('calibrationDueDate');
    const notes = getValue('notes');
    const photoUrl = getValue('photo');

    const status = normalizeStatus(rawStatus === 'Not recorded' ? null : rawStatus, project);
    const calibrationStatus = calculateCalibrationStatus(calibDueDate === 'Not recorded' ? null : calibDueDate);

    const photos: any[] = [];
    if (photoUrl && photoUrl !== 'Not recorded' && /^https?:\/\//i.test(photoUrl)) {
      photos.push({
        id: `photo_${id}_1`,
        url: photoUrl,
        caption: 'Imported photo from sheet',
        type: 'main',
        uploadedAt: now
      });
    }

    records.push({
      id,
      name: name === 'Not recorded' ? `Equipment ${id}` : name,
      category: category === 'Not recorded' ? 'General Equipment' : category,
      manufacturer: manufacturer,
      model: model,
      serialNumber: serialNumber,
      currentProject: project === 'Not recorded' ? 'In Stock / Warehouse' : project,
      currentLocation: location === 'Not recorded' ? 'Main Equipment Store' : location,
      status,
      dateIssued: dateIssued === 'Not recorded' ? null : dateIssued,
      dateReturned: dateReturned === 'Not recorded' ? null : dateReturned,
      calibrationDueDate: calibDueDate === 'Not recorded' ? null : calibDueDate,
      calibrationStatus,
      notes: notes === 'Not recorded' ? '' : notes,
      photos,
      certificates: [],
      maintenanceHistory: [],
      movementHistory: [
        {
          id: `mov_init_${id}`,
          equipmentId: id,
          equipmentName: name === 'Not recorded' ? id : name,
          fromLocation: 'Initial Import',
          toLocation: location === 'Not recorded' ? 'Main Equipment Store' : location,
          fromProject: 'Stock',
          toProject: project === 'Not recorded' ? 'Stock' : project,
          transferDate: new Date().toISOString().split('T')[0],
          issuedBy: 'System Import',
          receivedBy: project === 'Not recorded' ? 'Warehouse Keeper' : project,
          remarks: 'Initial record imported from Google Sheet',
          timestamp: now
        }
      ],
      createdAt: now,
      updatedAt: now,
      source: 'google_sheets'
    });
  }

    return {
      spreadsheetId,
      title: sheetTitle,
      sheets: sheetTabs,
      activeSheet: chosenTab,
      headers,
      mappedColumns,
      missingFields,
      sampleRowsCount: rawRows.length - 1,
      records,
      lastSyncedAt: now
    };
  } catch (err: any) {
    return {
      spreadsheetId,
      title: 'Google Spreadsheet',
      sheets: [],
      activeSheet: 'Error',
      headers: [],
      mappedColumns: {},
      missingFields: [],
      sampleRowsCount: 0,
      records: [],
      lastSyncedAt: Date.now(),
      error: err?.message || 'Failed to connect to Google Sheets API'
    };
  }
}

/**
 * Parses user-uploaded CSV text into EquipmentItem records
 */
export function parseEquipmentCsv(csvText: string): EquipmentItem[] {
  const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Simple CSV parser supporting quotes
  const parseLine = (text: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"' && (i === 0 || text[i - 1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim().replace(/^"|"$/g, ''));
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim().replace(/^"|"$/g, ''));
    return result;
  };

  const rawHeaders = parseLine(lines[0]);
  const normHeaders = rawHeaders.map(normalizeHeader);

  const findIdx = (pats: RegExp[]) => {
    for (const pat of pats) {
      const idx = normHeaders.findIndex((h) => pat.test(h));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idIdx = findIdx([/id|asset|tag|code/i]);
  const nameIdx = findIdx([/name|description|item|tool/i]);
  const catIdx = findIdx([/category|type|class/i]);
  const mfgIdx = findIdx([/manufacturer|make|brand/i]);
  const modelIdx = findIdx([/model/i]);
  const snIdx = findIdx([/serial|s\/n|sn/i]);
  const projIdx = findIdx([/project|dept|assigned/i]);
  const locIdx = findIdx([/location|store|site/i]);
  const statIdx = findIdx([/status|condition/i]);
  const calibIdx = findIdx([/calibr|expiry|due/i]);

  const items: EquipmentItem[] = [];
  const now = Date.now();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length === 0 || cols.every((c) => !c)) continue;

    const id = (idIdx !== -1 ? cols[idIdx] : '') || `CSV-EQ-${i}`;
    const name = (nameIdx !== -1 ? cols[nameIdx] : '') || `Equipment ${id}`;
    const category = (catIdx !== -1 ? cols[catIdx] : '') || 'General Equipment';
    const manufacturer = (mfgIdx !== -1 ? cols[mfgIdx] : '') || 'Not recorded';
    const model = (modelIdx !== -1 ? cols[modelIdx] : '') || 'Not recorded';
    const serialNumber = (snIdx !== -1 ? cols[snIdx] : '') || 'Not recorded';
    const currentProject = (projIdx !== -1 ? cols[projIdx] : '') || 'In Stock';
    const currentLocation = (locIdx !== -1 ? cols[locIdx] : '') || 'Main Store';
    const rawStatus = statIdx !== -1 ? cols[statIdx] : '';
    const calibDue = calibIdx !== -1 ? cols[calibIdx] : null;

    items.push({
      id,
      name,
      category,
      manufacturer,
      model,
      serialNumber,
      currentProject,
      currentLocation,
      status: normalizeStatus(rawStatus, currentProject),
      dateIssued: null,
      dateReturned: null,
      calibrationDueDate: calibDue || null,
      calibrationStatus: calculateCalibrationStatus(calibDue),
      notes: '',
      photos: [],
      certificates: [],
      maintenanceHistory: [],
      movementHistory: [
        {
          id: `mov_csv_${id}`,
          equipmentId: id,
          equipmentName: name,
          fromLocation: 'CSV File',
          toLocation: currentLocation,
          fromProject: 'Stock',
          toProject: currentProject,
          transferDate: new Date().toISOString().split('T')[0],
          issuedBy: 'CSV Import',
          receivedBy: currentProject,
          remarks: 'Imported from CSV document',
          timestamp: now
        }
      ],
      createdAt: now,
      updatedAt: now,
      source: 'csv_import'
    });
  }

  return items;
}

/**
 * Exports equipment list to CSV format
 */
export function exportEquipmentToCsv(items: EquipmentItem[]): string {
  const headers = [
    'Equipment ID',
    'Equipment Name',
    'Category',
    'Manufacturer',
    'Model',
    'Serial Number',
    'Current Project',
    'Current Location',
    'Status',
    'Date Issued',
    'Date Returned',
    'Calibration Due Date',
    'Calibration Status',
    'Notes'
  ];

  const escapeCell = (val: any) => {
    const s = String(val === null || val === undefined ? '' : val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = items.map((item) => [
    escapeCell(item.id),
    escapeCell(item.name),
    escapeCell(item.category),
    escapeCell(item.manufacturer),
    escapeCell(item.model),
    escapeCell(item.serialNumber),
    escapeCell(item.currentProject),
    escapeCell(item.currentLocation),
    escapeCell(item.status),
    escapeCell(item.dateIssued || 'Not recorded'),
    escapeCell(item.dateReturned || 'Not recorded'),
    escapeCell(item.calibrationDueDate || 'Not recorded'),
    escapeCell(item.calibrationStatus),
    escapeCell(item.notes)
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
