import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  FileText, 
  HelpCircle
} from 'lucide-react';
import { GoogleFormItem, DEFAULT_CATEGORIES } from '../types';
import { validateAndNormalizeFormUrl } from '../utils/urlHelper';

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: {
    title: string;
    url: string;
    category: string;
    description: string;
    color: string;
  }) => Promise<void>;
  initialData?: GoogleFormItem | null;
  existingCategories: string[];
  onAddNewCategory: (category: string) => void;
}

const COLOR_OPTIONS = [
  { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-500' },
  { id: 'blue', label: 'Blue', bg: 'bg-blue-500' },
  { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-500' },
  { id: 'amber', label: 'Amber', bg: 'bg-amber-500' },
  { id: 'violet', label: 'Violet', bg: 'bg-violet-500' },
  { id: 'rose', label: 'Rose', bg: 'bg-rose-500' },
  { id: 'slate', label: 'Slate', bg: 'bg-slate-500' },
];

export const FormModal: React.FC<FormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  existingCategories,
  onAddNewCategory,
}) => {
  const isEditing = Boolean(initialData);

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<string>('Calibration');
  const [customCategory, setCustomCategory] = useState('');
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('indigo');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState({ title: false, url: false });
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Sync state when opening for edit or new
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setUrl(initialData.url);
      setCategory(initialData.category || 'Other');
      setDescription(initialData.description || '');
      setColor(initialData.color || 'indigo');
      setIsAddingCustomCategory(false);
      setCustomCategory('');
    } else {
      setTitle('');
      setUrl('');
      setCategory(existingCategories[0] || 'Calibration');
      setDescription('');
      setColor('indigo');
      setIsAddingCustomCategory(false);
      setCustomCategory('');
    }
    setTouched({ title: false, url: false });
    setErrorBanner(null);
  }, [initialData, isOpen, existingCategories]);

  if (!isOpen) return null;

  // Validation
  const urlValidation = validateAndNormalizeFormUrl(url);
  const isTitleValid = title.trim().length > 0 && title.trim().length <= 120;
  const isFormValid = isTitleValid && urlValidation.isValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ title: true, url: true });

    if (!isTitleValid) {
      setErrorBanner('Please provide a descriptive form name (up to 120 characters).');
      return;
    }

    if (!urlValidation.isValid) {
      setErrorBanner(urlValidation.errorMessage || 'Please provide a valid Google Forms URL.');
      return;
    }

    let finalCategory = category;
    if (isAddingCustomCategory) {
      const cleanCustom = customCategory.trim();
      if (!cleanCustom) {
        setErrorBanner('Please enter a name for the new category.');
        return;
      }
      finalCategory = cleanCustom;
      onAddNewCategory(cleanCustom);
    }

    try {
      setIsSubmitting(true);
      setErrorBanner(null);
      await onSave({
        title: title.trim(),
        url: urlValidation.normalizedUrl,
        category: finalCategory,
        description: description.trim(),
        color,
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to save form:', err);
      setErrorBanner(err?.message || 'Failed to save form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const allAvailableCategories = Array.from(
    new Set([...DEFAULT_CATEGORIES, ...existingCategories])
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all my-8"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {isEditing ? 'Edit Registered Form' : 'Register New Google Form'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Add to your dashboard for quick access and central organization
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Banner */}
        {errorBanner && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <span>{errorBanner}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Form Name */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="form-title" className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                Form Name <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {title.length}/120
              </span>
            </div>
            <input
              id="form-title"
              type="text"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, title: true }))}
              placeholder="e.g. Daily Equipment Calibration Log"
              className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                touched.title && !isTitleValid
                  ? 'border-rose-400 focus:ring-rose-500/30'
                  : 'border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20'
              }`}
              required
            />
            {touched.title && !isTitleValid && (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                Please enter a form title (max 120 characters).
              </p>
            )}
          </div>

          {/* Google Forms URL */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="form-url" className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                Google Forms URL <span className="text-rose-500">*</span>
              </label>
              {url.trim() && (
                <div className="flex items-center gap-1 text-[11px]">
                  {urlValidation.isValid ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Valid link
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Invalid Google Form URL
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="relative">
              <input
                id="form-url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, url: true }))}
                placeholder="https://forms.gle/... or https://docs.google.com/forms/d/..."
                className={`w-full px-3.5 py-2.5 text-sm rounded-xl border font-mono text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                  touched.url && !urlValidation.isValid
                    ? 'border-rose-400 focus:ring-rose-500/30'
                    : urlValidation.isValid && url.trim()
                    ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
                required
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <HelpCircle className="w-3 h-3 text-slate-400 shrink-0" />
              Accepts both short <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-600 dark:text-indigo-400">forms.gle/...</code> and full <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">docs.google.com/forms/...</code> URLs.
            </p>
          </div>

          {/* Category selection */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between mb-1.5">
              <span>Category</span>
              {!isAddingCustomCategory ? (
                <button
                  type="button"
                  onClick={() => setIsAddingCustomCategory(true)}
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> + New Category
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingCustomCategory(false)}
                  className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium text-[11px] cursor-pointer"
                >
                  Choose existing
                </button>
              )}
            </label>

            {!isAddingCustomCategory ? (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
              >
                {allAvailableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="e.g. Quality Assurance, Site Safety"
                  className="flex-1 px-3.5 py-2.5 text-sm rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* Description & Notes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="form-desc" className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Notes / Instructions <span className="text-slate-400 text-[11px] font-normal">(Optional)</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {description.length}/500
              </span>
            </div>
            <textarea
              id="form-desc"
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Record notes, observations, equipment calibrations, or maintenance requirements..."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-sm shadow-indigo-500/20 cursor-pointer"
            >
              {isSubmitting ? (
                <>Saving Form...</>
              ) : isEditing ? (
                <>Save Changes</>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Add to Dashboard
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
