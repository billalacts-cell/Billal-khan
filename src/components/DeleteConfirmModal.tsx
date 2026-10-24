import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { GoogleFormItem } from '../types';

interface DeleteConfirmModalProps {
  form: GoogleFormItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  form,
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false
}) => {
  if (!isOpen || !form) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all scale-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
      >
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 id="delete-modal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Remove Form from Dashboard?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This will not delete your original Google Form or its submitted responses.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-750">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Form Name
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {form.title}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-300">Category:</span> {form.category}
            </div>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 truncate font-mono">
              {form.url}
            </p>
          </div>

          <p className="mt-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Are you sure you want to remove <span className="font-semibold text-slate-900 dark:text-slate-100">"{form.title}"</span> from your dashboard? You can always re-add it whenever needed.
          </p>
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? 'Removing...' : 'Yes, Remove Form'}
          </button>
        </div>
      </div>
    </div>
  );
};
