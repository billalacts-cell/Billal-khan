import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  RotateCw, 
  ExternalLink, 
  Copy, 
  Check, 
  AlertTriangle, 
  Folder, 
  Info,
  Maximize2,
  Clock,
  BarChart2,
  Lock,
  Sparkles,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { GoogleFormItem, CATEGORY_COLORS } from '../types';
import { getEmbeddableFormUrl, formatTimeAgo } from '../utils/urlHelper';

interface EmbeddedFormViewerProps {
  form: GoogleFormItem;
  onBack: () => void;
  onOpenInNewTab: (form: GoogleFormItem) => void;
  onEdit?: (form: GoogleFormItem) => void;
}

export const EmbeddedFormViewer: React.FC<EmbeddedFormViewerProps> = ({
  form,
  onBack,
  onOpenInNewTab,
  onEdit,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [showEmbeddingTip, setShowEmbeddingTip] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Compute embed URL
  const { embedUrl, isShortUrl, isConverted } = getEmbeddableFormUrl(form.url);

  // Reset loading state whenever form or iframeKey changes
  useEffect(() => {
    setIsLoading(true);
    setLoadError(false);

    // Set a safety timeout in case the iframe gets blocked by CSP/X-Frame-Options
    // (Browsers don't always fire onError on iframes for HTTP security blocks)
    const timeout = setTimeout(() => {
      // If still "loading" after 8 seconds, we keep showing fallback info without hiding the iframe
    }, 8000);

    return () => clearTimeout(timeout);
  }, [form.id, iframeKey]);

  const handleRefresh = () => {
    setIsLoading(true);
    setLoadError(false);
    setIframeKey((prev) => prev + 1);
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setLoadError(true);
  };

  const handleCopy = async () => {
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
    <div className="flex flex-col min-h-[calc(100vh-14rem)] w-full">
      {/* Top Navigation & Controls Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left: Back button & Form Identity */}
          <div className="flex items-start sm:items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0"
              title="Return to forms dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span 
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium border ${categoryStyle.bg} ${categoryStyle.text} ${categoryStyle.border}`}
                >
                  <Folder className="w-3 h-3 shrink-0" />
                  <span>{form.category}</span>
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  {form.openCount || 0} {form.openCount === 1 ? 'launch' : 'launches'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                {form.title}
              </h2>
            </div>
          </div>

          {/* Right: Actions (Refresh, Open in New Tab, Copy Link) */}
          <div className="flex items-center gap-2 flex-wrap self-end lg:self-auto">
            {/* Refresh button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 rounded-xl transition-colors cursor-pointer"
              title="Reload the embedded form"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
              <span className="hidden sm:inline">Refresh Form</span>
            </button>

            {/* Copy Link */}
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 rounded-xl transition-colors cursor-pointer"
              title="Copy form URL to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Copy Link</span>
                </>
              )}
            </button>

            {/* Primary Fallback: Open in New Tab */}
            <button
              type="button"
              onClick={() => onOpenInNewTab(form)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-xs transition-colors cursor-pointer"
              title="Open directly in a new browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in New Tab</span>
            </button>
          </div>

        </div>

        {/* Optional Description / Notes */}
        {form.description && (
          <p className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            {form.description}
          </p>
        )}
      </div>

      {/* Embedding Guidance / Fallback Notice */}
      {showEmbeddingTip && (
        <div className="mb-4 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 rounded-xl p-3.5 text-xs text-indigo-900 dark:text-indigo-200 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                Viewing inside My Notes Hub
              </p>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Google Forms are displayed below using secure embedding (<code className="bg-white/80 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px] font-mono">?embedded=true</code>). If Google prevents embedding for this specific form (such as organization-restricted accounts or shortened links), click <strong>Open in New Tab</strong> above to fill out your form directly.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowEmbeddingTip(false)}
            className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200 text-[11px] font-medium shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Iframe Viewer Container */}
      <div className="relative flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[640px] flex flex-col">
        
        {/* Loading Spinner Indicator */}
        {isLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs transition-opacity">
            <Loader2 className="w-9 h-9 text-indigo-600 dark:text-indigo-400 animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Loading Google Form...
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Connecting securely to Google Forms responder interface
            </p>
          </div>
        )}

        {/* Embed Error / Fallback Card (shown if iframe errors or fails) */}
        {loadError ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto my-auto">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
              Embedding Restricted by Google
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              Google Forms security policies may block this form from rendering inside an iframe (common with domain-restricted Google Workspace forms or shortened redirect links).
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={() => onOpenInNewTab(form)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Form in New Tab</span>
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          /* Actual Google Forms Iframe */
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={embedUrl}
            title={form.title}
            className="w-full flex-1 min-h-[640px] border-0 bg-white"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
          />
        )}

        {/* Bottom Help Tray (Always available so user is never stuck) */}
        <div className="bg-slate-50 dark:bg-slate-850 px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2 truncate max-w-full">
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">Source: <span className="font-mono text-[11px]">{form.url}</span></span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span>Form not showing?</span>
            <button
              type="button"
              onClick={() => onOpenInNewTab(form)}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Open in New Tab</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
