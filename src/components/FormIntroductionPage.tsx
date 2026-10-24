import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ExternalLink, 
  Copy, 
  Check, 
  FileSpreadsheet, 
  Folder, 
  Star, 
  Edit3, 
  Clock, 
  BarChart2, 
  ShieldCheck, 
  AlertTriangle,
  RotateCw,
  Eye,
  Link as LinkIcon
} from 'lucide-react';
import { GoogleFormItem, CATEGORY_COLORS } from '../types';
import { getEmbeddableFormUrl, formatTimeAgo } from '../utils/urlHelper';

interface FormIntroductionPageProps {
  form: GoogleFormItem;
  onBack: () => void;
  onFindForm: (form: GoogleFormItem) => void;
  onEdit: (form: GoogleFormItem) => void;
  onToggleStar: (form: GoogleFormItem) => void;
}

export const FormIntroductionPage: React.FC<FormIntroductionPageProps> = ({
  form,
  onBack,
  onFindForm,
  onEdit,
  onToggleStar,
}) => {
  const [copied, setCopied] = useState(false);
  const [showEmbeddedView, setShowEmbeddedView] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(form.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const categoryStyle = CATEGORY_COLORS[form.category] || CATEGORY_COLORS['Other'];
  const { embedUrl } = getEmbeddableFormUrl(form.url);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Breadcrumb & Return Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleStar(form)}
            className={`p-2 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer ${
              form.isStarred 
                ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800' 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-white dark:bg-slate-900'
            }`}
            title={form.isStarred ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={`w-4 h-4 ${form.isStarred ? 'fill-amber-400 text-amber-500' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => onEdit(form)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            title="Edit form details, title, or category"
          >
            <Edit3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Edit Details</span>
          </button>
        </div>
      </div>

      {/* Main Form Introduction Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8">
          
          {/* Category & Badge */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span 
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border ${categoryStyle.bg} ${categoryStyle.text} ${categoryStyle.border}`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>{form.category}</span>
            </span>

            <span className="text-xs text-slate-400 dark:text-slate-500">
              • Registered Google Form
            </span>
          </div>

          {/* Form Title */}
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 mb-4 leading-tight">
            {form.title}
          </h1>

          {/* Form Purpose / Description */}
          <div className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Purpose & Description</span>
            </h3>
            <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {form.description || 'Record notes, observations, and relevant data directly in your official Google Form.'}
            </p>
          </div>

          {/* Original Form URL Display */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 mb-6">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Original Google Forms URL</span>
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                Direct Link
              </span>
            </div>
            <div className="font-mono text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate select-all">
              {form.url}
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            {/* Find Form Button (Prominent, opens original URL directly in new tab) */}
            <button
              type="button"
              onClick={() => onFindForm(form)}
              className="flex-1 inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-sm shadow-indigo-500/20 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
            >
              <ExternalLink className="w-4 h-4 stroke-2" />
              <span>Find Form (Open in New Tab)</span>
            </button>

            {/* Copy Link Button */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied Link</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            {/* Toggle Embedded View Button */}
            <button
              type="button"
              onClick={() => setShowEmbeddedView((prev) => !prev)}
              className="inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Attempt to view inside the app"
            >
              <Eye className="w-4 h-4 text-slate-400" />
              <span>{showEmbeddedView ? 'Hide In-App Viewer' : 'Open Inside App'}</span>
            </button>
          </div>

        </div>

        {/* Form Metadata Footer Bar */}
        <div className="px-6 sm:px-8 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Last opened: <strong className="text-slate-700 dark:text-slate-300">{formatTimeAgo(form.lastOpenedAt)}</strong></span>
            </span>

            <span className="flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Launches: <strong className="text-slate-700 dark:text-slate-300">{form.openCount || 0}</strong></span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Opens original form securely</span>
          </div>
        </div>
      </div>

      {/* Optional Embedded Viewer Section */}
      {showEmbeddedView && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden animate-in fade-in duration-200">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                In-App Embedding Preview
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIframeKey((k) => k + 1)}
                className="p-1.5 text-xs rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title="Reload frame"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onFindForm(form)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                <span>Open in Tab</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Iframe Notice & Container */}
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/50 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <p>
              Note: If Google displays <strong>"docs.google.com refused to connect"</strong>, this is due to Google Forms framing security restrictions. Click <strong>Find Form</strong> above to open and complete your form directly in Google Forms without restriction.
            </p>
          </div>

          <div className="relative min-h-[550px] w-full bg-white">
            <iframe
              key={iframeKey}
              src={embedUrl}
              title={form.title}
              className="w-full min-h-[550px] border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
            />
          </div>
        </div>
      )}
    </div>
  );
};
