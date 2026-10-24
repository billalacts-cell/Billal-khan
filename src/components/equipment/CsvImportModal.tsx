import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { EquipmentItem } from '../../types';
import { parseEquipmentCsv } from '../../services/googleSheetsService';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: EquipmentItem[]) => Promise<void>;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [csvText, setCsvText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<EquipmentItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      const parsed = parseEquipmentCsv(text);
      setParsedPreview(parsed);
      setError(parsed.length === 0 ? 'Could not parse any valid rows. Please check headers.' : null);
    };
    reader.readAsText(file);
  };

  const handleTextChange = (text: string) => {
    setCsvText(text);
    if (text.trim().length > 10) {
      const parsed = parseEquipmentCsv(text);
      setParsedPreview(parsed);
    } else {
      setParsedPreview([]);
    }
  };

  const handleConfirmImport = async () => {
    if (parsedPreview.length === 0) {
      setError('No parsed equipment records to import.');
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      await onImport(parsedPreview);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to import CSV records.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all my-8"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Import Equipment Records (CSV Fallback)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload or paste CSV if Google Sheet is not directly accessible
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-6 space-y-4">
          {/* File input */}
          <div className="p-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-center bg-slate-50/50 dark:bg-slate-800/40">
            <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select a .CSV file from your computer
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-950 dark:file:text-indigo-300 cursor-pointer"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
              Or Paste CSV Data Below
            </label>
            <textarea
              rows={4}
              value={csvText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Equipment ID, Equipment Name, Category, Manufacturer, Model, Project, Location&#10;C3332, Digital Thermometer, Calibration, Fluke, 52 II, CRCC, Site Lab"
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Parsed Preview Table */}
          {parsedPreview.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Preview: {parsedPreview.length} records ready to import
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Valid structure
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 sticky top-0">
                    <tr>
                      <th className="p-2 font-semibold">ID</th>
                      <th className="p-2 font-semibold">Name</th>
                      <th className="p-2 font-semibold">Project</th>
                      <th className="p-2 font-semibold">Location</th>
                      <th className="p-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {parsedPreview.slice(0, 10).map((row) => (
                      <tr key={row.id}>
                        <td className="p-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">{row.id}</td>
                        <td className="p-2 truncate max-w-[140px]">{row.name}</td>
                        <td className="p-2">{row.currentProject}</td>
                        <td className="p-2">{row.currentLocation}</td>
                        <td className="p-2">{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isSubmitting || parsedPreview.length === 0}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Importing...' : `Import ${parsedPreview.length} Records`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
