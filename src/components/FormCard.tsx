import React, { useState } from 'react';
import { 
  ExternalLink, 
  Edit3, 
  Trash2, 
  Copy, 
  Check, 
  Star, 
  Clock, 
  BarChart2, 
  Folder,
  Info
} from 'lucide-react';
import { GoogleFormItem, CATEGORY_COLORS } from '../types';
import { formatTimeAgo } from '../utils/urlHelper';

interface FormCardProps {
  form: GoogleFormItem;
  onViewIntro: (form: GoogleFormItem) => void;
  onFindForm: (form: GoogleFormItem) => void;
  onEdit: (form: GoogleFormItem) => void;
  onDelete: (form: GoogleFormItem) => void;
  onToggleStar: (form: GoogleFormItem) => void;
}

export const FormCard: React.FC<FormCardProps> = ({
  form,
  onViewIntro,
  onFindForm,
  onEdit,
  onDelete,
  onToggleStar
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(form.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const categoryStyle = CATEGORY_COLORS[form.category] || CATEGORY_COLORS['Other'];

  return (
    <div 
      className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-lg transition-all duration-200 overflow-hidden"
    >
      {/* Top Category Accent Line */}
      <div className={`h-1.5 w-full ${categoryStyle.dot}`} />

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Header Row: Category Badge & Quick Card Actions */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span 
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${categoryStyle.bg} ${categoryStyle.text} ${categoryStyle.border}`}
            >
              <span className={`w-2 h-2 rounded-full ${categoryStyle.dot}`} />
              <span className="truncate max-w-[130px]">{form.category}</span>
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar(form);
                }}
                title={form.isStarred ? 'Remove from favorites' : 'Mark as favorite'}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  form.isStarred 
                    ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Star className={`w-4 h-4 ${form.isStarred ? 'fill-amber-400 text-amber-500' : ''}`} />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(form);
                }}
                title="Edit form details"
                className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(form);
                }}
                title="Delete form from dashboard"
                className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Form Title (Clickable to open introduction page) */}
          <h3 
            className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors cursor-pointer"
            onClick={() => onViewIntro(form)}
            title="Click to view introduction & instructions"
          >
            {form.title}
          </h3>

          {/* Short Introduction / Purpose */}
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
            {form.description || 'Record notes, observations, and relevant data directly in your official Google Form.'}
          </p>
        </div>

        {/* Footer Info & Action Row */}
        <div>
          {/* Metadata bar (Last Opened & Launch count) */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 py-2.5 mb-3 border-t border-slate-100 dark:border-slate-800/80">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTimeAgo(form.lastOpenedAt)}</span>
            </span>

            <span className="flex items-center gap-1.5 font-medium">
              <BarChart2 className="w-3.5 h-3.5" />
              <span>{form.openCount || 0} {form.openCount === 1 ? 'open' : 'opens'}</span>
            </span>
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-2">
            {/* Primary Find Form CTA (Opens original form in new tab) */}
            <button
              type="button"
              onClick={() => onFindForm(form)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-indigo-500/20 cursor-pointer"
              title="Open original Google Form directly in a new tab"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              <span>Find Form</span>
            </button>

            {/* Introduction / Details Button */}
            <button
              type="button"
              onClick={() => onViewIntro(form)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
              title="View full form introduction & instructions"
            >
              <Info className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Intro</span>
            </button>

            {/* Quick Copy Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              title={copied ? 'Copied URL!' : 'Copy Form Link'}
              className="px-2.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 transition-colors text-xs font-medium flex items-center justify-center cursor-pointer"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
