import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  AlertCircle, 
  ClipboardPaste, 
  RotateCcw,
  Save,
  FileSpreadsheet
} from 'lucide-react';
import { BulkCalibrationRow, CalibrationCategory } from '../../types';
import { saveBulkCalibrationRows } from '../../services/calibrationService';

interface BulkCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedCount: number) => void;
  currentUserEmail?: string;
  existingIds?: string[];
}

function createEmptyRow(category: CalibrationCategory = 'Internal Calibration'): BulkCalibrationRow {
  return {
    tempId: `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    equipmentId: '',
    name: '',
    serialNumber: '',
    calibrationCategory: category,
    projectName: '',
    remarks: '',
    dueDate: ''
  };
}

// Normalizes date formats (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY)
function parseDateString(val: string): string {
  if (!val) return '';
  const clean = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  
  const parts = clean.split(/[/.-]/);
  if (parts.length === 3) {
    const [p1, p2, p3] = parts;
    if (p1.length === 4) {
      return `${p1}-${p2.padStart(2, '0')}-${p3.padStart(2, '0')}`;
    }
    if (p3.length === 4) {
      const n1 = parseInt(p1, 10);
      if (n1 > 12) {
        // DD/MM/YYYY
        return `${p3}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
      } else {
        // MM/DD/YYYY
        return `${p3}-${p1.padStart(2, '0')}-${p2.padStart(2, '0')}`;
      }
    }
  }
  return clean;
}

function isDateLike(val: string): boolean {
  if (!val) return false;
  const clean = val.trim();
  return /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(clean) || /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(clean);
}

export const BulkCalibrationModal: React.FC<BulkCalibrationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentUserEmail
}) => {
  // Start with ONE row only as requested
  const [rows, setRows] = useState<BulkCalibrationRow[]>([
    createEmptyRow('Internal Calibration')
  ]);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [rawPasteText, setRawPasteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Default to exactly one row upon opening
      setRows([createEmptyRow('Internal Calibration')]);
      setShowPasteBox(false);
      setRawPasteText('');
      setGeneralError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddRow = () => {
    setRows((prev) => [...prev, createEmptyRow('Internal Calibration')]);
  };

  const handleClearTable = () => {
    setRows([createEmptyRow('Internal Calibration')]);
    setGeneralError(null);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length <= 1) {
      setRows([createEmptyRow('Internal Calibration')]);
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: keyof BulkCalibrationRow, value: any) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value, error: undefined };
      return next;
    });
  };

  // Parse Excel / Google Sheets pasted rows
  const handleParsePastedData = () => {
    if (!rawPasteText.trim()) {
      setGeneralError('Please paste some text data from Excel.');
      return;
    }

    const lines = rawPasteText.trim().split(/\r?\n/);
    const parsedRows: BulkCalibrationRow[] = [];

    lines.forEach((line) => {
      if (!line.trim()) return;
      
      let cols = line.split('\t');
      if (cols.length === 1 && line.includes(',')) {
        cols = line.split(',');
      } else if (cols.length === 1 && line.includes(';')) {
        cols = line.split(';');
      }

      cols = cols.map(c => c.trim());

      let equipmentId = '';
      let name = '';
      let serialNumber = '';
      let category: CalibrationCategory = 'Internal Calibration';
      let projName = '';
      let stationRemark = '';
      let dueDateRaw = '';

      if (cols.length >= 4) {
        // Find due date first
        const dateIdx = cols.findIndex(c => isDateLike(c));
        if (dateIdx !== -1) {
          dueDateRaw = cols[dateIdx];
          cols.splice(dateIdx, 1);
        }

        // Find category if present
        const catIdx = cols.findIndex(c => c.toLowerCase().includes('external') || c.toLowerCase().includes('internal'));
        if (catIdx !== -1) {
          if (cols[catIdx].toLowerCase().includes('external')) {
            category = 'External Calibration';
          }
          cols.splice(catIdx, 1);
        }

        if (cols.length > 0) equipmentId = cols[0];
        if (cols.length > 1) name = cols[1];
        if (cols.length > 2) serialNumber = cols[2];
        if (cols.length > 3) projName = cols[3];
        if (cols.length > 4) stationRemark = cols.slice(4).join(' - ');
      } else {
        for (const col of cols) {
          const lower = col.toLowerCase();
          if (lower.includes('external')) {
            category = 'External Calibration';
          } else if (lower.includes('internal')) {
            category = 'Internal Calibration';
          } else if (isDateLike(col) && !dueDateRaw) {
            dueDateRaw = col;
          } else if (!equipmentId) {
            equipmentId = col;
          } else if (!name) {
            name = col;
          } else if (!serialNumber) {
            serialNumber = col;
          } else {
            stationRemark = stationRemark ? `${stationRemark} - ${col}` : col;
          }
        }
      }

      const formattedDueDate = parseDateString(dueDateRaw);

      parsedRows.push({
        tempId: `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        equipmentId,
        name,
        serialNumber,
        calibrationCategory: category,
        projectName: projName,
        remarks: stationRemark,
        dueDate: formattedDueDate
      });
    });

    if (parsedRows.length > 0) {
      setRows(parsedRows);
      setShowPasteBox(false);
      setRawPasteText('');
      setGeneralError(null);
    } else {
      setGeneralError('No valid rows could be parsed. Ensure data includes a Calibration Due Date.');
    }
  };

  // Validate required fields
  const validateRows = (): boolean => {
    let hasError = false;

    const validated = rows.map((row) => {
      const cleanDate = (row.dueDate || '').trim();

      if (!cleanDate) {
        hasError = true;
        return { ...row, error: 'Calibration Due Date is required.' };
      }

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(cleanDate)) {
        hasError = true;
        return { ...row, error: 'Due Date must be formatted as YYYY-MM-DD.' };
      }

      return { ...row, error: undefined };
    });

    setRows(validated);
    return !hasError;
  };

  const handleSaveAll = async () => {
    setGeneralError(null);
    if (!validateRows()) {
      setGeneralError('Please resolve the row-level errors highlighted in red before saving.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await saveBulkCalibrationRows(rows, currentUserEmail);
      onSuccess(result.savedCount);
      onClose();
    } catch (err: any) {
      console.error('Calibration entry save error:', err);
      setGeneralError(err.message || 'Failed to save calibration records.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-6xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[96vh] sm:max-h-[92vh] overflow-hidden">
        
        {/* Modal Header: Renamed to "Entry" */}
        <div className="p-3.5 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Entry</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
                  {rows.length} row{rows.length === 1 ? '' : 's'}
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                Asset ID, Name, Serial Number, and Due Date
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowPasteBox(!showPasteBox)}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center gap-1.5 cursor-pointer"
            >
              <ClipboardPaste className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Paste from Excel</span>
              <span className="sm:hidden">Paste</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Excel Paste Drawer */}
        {showPasteBox && (
          <div className="p-3 sm:p-4 bg-indigo-50/70 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                <ClipboardPaste className="w-4 h-4 text-indigo-600" />
                <span>Paste Table Columns</span>
              </div>
              <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                Asset ID | Name | Serial | Option | Project | Remarks | Due Date
              </span>
            </div>
            <textarea
              rows={3}
              value={rawPasteText}
              onChange={(e) => setRawPasteText(e.target.value)}
              placeholder={`C3332\tDigital Thermometer\tSN-9921\tInternal Calibration\tSite Lab\tStation 1\t2026-11-20\nC3333\tPressure Gauge\tPG-440\tExternal Calibration\tCRCC\tExternal Lab\t2026-11-25`}
              className="w-full p-2.5 text-xs font-mono rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPasteBox(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-white/50 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleParsePastedData}
                className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer shadow-xs"
              >
                Populate
              </button>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {generalError && (
          <div className="mx-3 sm:mx-4 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        {/* Body Content: Fully Mobile-Optimized (<md Cards) & Desktop Table (>=md) */}
        <div className="flex-1 overflow-auto p-3 sm:p-4">
          
          {/* ========================================================= */}
          {/* MOBILE RESPONSIVE CARDS VIEW (Displayed on screens < md)   */}
          {/* ========================================================= */}
          <div className="space-y-3.5 md:hidden">
            {rows.map((row, index) => {
              const currentCategory = row.calibrationCategory || 'Internal Calibration';

              return (
                <div 
                  key={row.tempId}
                  className={`p-3.5 rounded-xl border transition-all ${
                    row.error 
                      ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800' 
                      : 'bg-slate-50/90 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-slate-700/60">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded-md">
                        #{index + 1}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        currentCategory === 'Internal Calibration'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                      }`}>
                        {currentCategory}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveRow(index)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg cursor-pointer"
                      title="Remove this row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Card Inputs */}
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Asset ID / Tag No
                      </label>
                      <input
                        type="text"
                        value={row.equipmentId || ''}
                        onChange={(e) => handleRowChange(index, 'equipmentId', e.target.value)}
                        placeholder="e.g. C3332 (or leave empty to auto-assign)"
                        className="w-full px-3 py-2 text-xs font-mono font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Equipment Name
                      </label>
                      <input
                        type="text"
                        value={row.name || ''}
                        onChange={(e) => handleRowChange(index, 'name', e.target.value)}
                        placeholder="e.g. Digital Thermometer, Caliper"
                        className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Serial Number
                        </label>
                        <input
                          type="text"
                          value={row.serialNumber || ''}
                          onChange={(e) => handleRowChange(index, 'serialNumber', e.target.value)}
                          placeholder="e.g. SN-88310"
                          className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Option *
                        </label>
                        <select
                          value={currentCategory}
                          onChange={(e) => handleRowChange(index, 'calibrationCategory', e.target.value as CalibrationCategory)}
                          className={`w-full px-2 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                            currentCategory === 'Internal Calibration'
                              ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                              : 'text-purple-700 dark:text-purple-400 font-bold'
                          }`}
                        >
                          <option value="Internal Calibration">Internal</option>
                          <option value="External Calibration">External</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Project Name
                        </label>
                        <input
                          type="text"
                          value={row.projectName || ''}
                          onChange={(e) => handleRowChange(index, 'projectName', e.target.value)}
                          placeholder="e.g. CRCC"
                          className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Station / Remark
                        </label>
                        <input
                          type="text"
                          value={row.remarks || ''}
                          onChange={(e) => handleRowChange(index, 'remarks', e.target.value)}
                          placeholder="Station 1, Lab"
                          className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Calibration Due Date * <span className="text-rose-500 font-normal">(Required)</span>
                      </label>
                      <input
                        type="date"
                        value={row.dueDate || ''}
                        onChange={(e) => handleRowChange(index, 'dueDate', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    {row.error && (
                      <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-[11px] text-rose-600 dark:text-rose-300 font-medium flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{row.error}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ========================================================= */}
          {/* DESKTOP TABLE VIEW (Displayed on screens >= md)            */}
          {/* ========================================================= */}
          <div className="hidden md:block rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto shadow-xs">
            <table className="w-full border-collapse text-left text-xs min-w-[950px]">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 w-36">Asset ID / Tag</th>
                  <th className="py-2.5 px-3 w-44">Equipment Name</th>
                  <th className="py-2.5 px-3 w-36">Serial Number</th>
                  <th className="py-2.5 px-3 w-44">Calibration Option *</th>
                  <th className="py-2.5 px-3 w-36">Project Name</th>
                  <th className="py-2.5 px-3 min-w-[140px]">Station / Remark</th>
                  <th className="py-2.5 px-3 w-40">Due Date *</th>
                  <th className="py-2.5 px-3 w-12 text-center">Del</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {rows.map((row, index) => {
                  const currentCategory = row.calibrationCategory || 'Internal Calibration';

                  return (
                    <React.Fragment key={row.tempId}>
                      <tr className={`group transition-colors ${row.error ? 'bg-rose-50/60 dark:bg-rose-950/30' : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'}`}>
                        {/* Row index */}
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {index + 1}
                        </td>

                        {/* Asset ID */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.equipmentId || ''}
                            onChange={(e) => handleRowChange(index, 'equipmentId', e.target.value)}
                            placeholder="e.g. C3332 (or auto)"
                            className="w-full px-2.5 py-1.5 text-xs font-mono font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>

                        {/* Equipment Name */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.name || ''}
                            onChange={(e) => handleRowChange(index, 'name', e.target.value)}
                            placeholder="e.g. Thermometer"
                            className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>

                        {/* Serial Number */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.serialNumber || ''}
                            onChange={(e) => handleRowChange(index, 'serialNumber', e.target.value)}
                            placeholder="e.g. SN-88310"
                            className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>

                        {/* Calibration Option */}
                        <td className="py-2 px-3">
                          <select
                            value={currentCategory}
                            onChange={(e) => {
                              const newCat = e.target.value as CalibrationCategory;
                              handleRowChange(index, 'calibrationCategory', newCat);
                            }}
                            className={`w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                              currentCategory === 'Internal Calibration'
                                ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                                : 'text-purple-700 dark:text-purple-400 font-bold'
                            }`}
                          >
                            <option value="Internal Calibration">Internal Calibration</option>
                            <option value="External Calibration">External Calibration</option>
                          </select>
                        </td>

                        {/* Project Name */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.projectName || ''}
                            onChange={(e) => handleRowChange(index, 'projectName', e.target.value)}
                            placeholder="Optional project"
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>

                        {/* Calibration Station / Remark */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.remarks || ''}
                            onChange={(e) => handleRowChange(index, 'remarks', e.target.value)}
                            placeholder={
                              currentCategory === 'External Calibration'
                                ? 'Provider / Station remark'
                                : 'Station 1, Lab remark'
                            }
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>

                        {/* Due Date */}
                        <td className="py-2 px-3">
                          <input
                            type="date"
                            value={row.dueDate || ''}
                            onChange={(e) => handleRowChange(index, 'dueDate', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>

                        {/* Remove */}
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(index)}
                            title="Remove row"
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>

                      {/* Row-level error indicator */}
                      {row.error && (
                        <tr className="bg-rose-50 dark:bg-rose-950/40">
                          <td colSpan={9} className="py-1 px-4 text-[11px] text-rose-600 dark:text-rose-300 font-medium">
                            <span className="flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              Row {index + 1}: {row.error}
                            </span>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 mt-3.5 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddRow}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Row</span>
              </button>

              <button
                type="button"
                onClick={handleClearTable}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to 1 Row</span>
              </button>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Total {rows.length} record{rows.length === 1 ? '' : 's'} ready
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 cursor-pointer text-center"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSubmitting}
            className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
            <span>{isSubmitting ? 'Saving...' : 'Save Records'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
