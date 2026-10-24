import React, { useState } from 'react';
import { X, Calendar, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { EquipmentItem } from '../../types';
import { batchUpdateEquipmentDueDates, getRiyadhDateString } from '../../services/calibrationService';

interface BatchDueDateModalProps {
  isOpen: boolean;
  selectedItems: EquipmentItem[];
  onClose: () => void;
  onSuccess: (updatedCount: number) => void;
}

export const BatchDueDateModal: React.FC<BatchDueDateModalProps> = ({
  isOpen,
  selectedItems,
  onClose,
  onSuccess
}) => {
  const [newDueDate, setNewDueDate] = useState('');
  const [newCategory, setNewCategory] = useState<string>('keep');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || selectedItems.length === 0) return null;

  const handleApplyQuickOffset = (months: number) => {
    const today = new Date();
    today.setMonth(today.getMonth() + months);
    setNewDueDate(today.toISOString().split('T')[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDueDate) {
      setError('Please select a valid calibration due date.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const ids = selectedItems.map((item) => item.id);
      const categoryParam = newCategory !== 'keep' ? (newCategory as any) : undefined;
      const count = await batchUpdateEquipmentDueDates(ids, newDueDate, categoryParam);
      onSuccess(count);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update calibration due dates.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Batch Update Due Dates
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Updating <strong className="text-slate-800 dark:text-slate-200">{selectedItems.length}</strong> selected records
              </p>
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

        {error && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
              New Calibration Due Date *
            </label>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
              Calibration Option (Optional)
            </label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="keep">Keep Current Category</option>
              <option value="Internal Calibration">Internal Calibration</option>
              <option value="External Calibration">External Calibration</option>
              <option value="Projects">Projects</option>
            </select>
          </div>

          {/* Quick Shortcuts */}
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
              Quick presets:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleApplyQuickOffset(3)}
                className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                +3 Months
              </button>
              <button
                type="button"
                onClick={() => handleApplyQuickOffset(6)}
                className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                +6 Months
              </button>
              <button
                type="button"
                onClick={() => handleApplyQuickOffset(12)}
                className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                +1 Year
              </button>
            </div>
          </div>

          {/* Selected Preview Snippet */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 block mb-1">
              Selected Equipment ({selectedItems.length}):
            </span>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {selectedItems.map((item) => (
                <span
                  key={item.id}
                  className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-mono border border-slate-200 dark:border-slate-600"
                >
                  {item.id}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newDueDate}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Updating...' : 'Apply to All Selected'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
