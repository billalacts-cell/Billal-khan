import React from 'react';
import { X, Sun, Moon, Monitor, Check, Palette } from 'lucide-react';
import { ThemeMode, resolveIsDark } from '../utils/theme';

interface ThemeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: ThemeMode;
  onSelectTheme: (theme: ThemeMode) => void;
}

export const ThemeSettingsModal: React.FC<ThemeSettingsModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onSelectTheme,
}) => {
  if (!isOpen) return null;

  const isSystemCurrentlyDark = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-color-scheme: dark)').matches 
    : false;

  const options: {
    id: ThemeMode;
    title: string;
    description: string;
    icon: React.ReactNode;
    detail: string;
  }[] = [
    {
      id: 'light',
      title: 'Light Mode',
      description: 'Clean light canvas with white cards and crisp purple accents',
      icon: <Sun className="w-5 h-5 text-amber-500" />,
      detail: 'Always light theme'
    },
    {
      id: 'dark',
      title: 'Dark Mode',
      description: 'High-contrast dark theme optimized for low-light environments',
      icon: <Moon className="w-5 h-5 text-indigo-400" />,
      detail: 'Always dark theme'
    },
    {
      id: 'system',
      title: 'System Default',
      description: 'Automatically synchronizes with your device operating system appearance',
      icon: <Monitor className="w-5 h-5 text-slate-500 dark:text-slate-400" />,
      detail: `Currently: ${isSystemCurrentlyDark ? 'Dark' : 'Light'}`
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h2 id="theme-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                Appearance Settings
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose how My Notes Hub looks for you
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options List */}
        <div className="p-6 space-y-3">
          {options.map((opt) => {
            const isSelected = currentTheme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onSelectTheme(opt.id);
                }}
                className={`w-full p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 cursor-pointer ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 dark:border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                  {opt.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {opt.title}
                    </span>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 stroke-3" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {opt.description}
                  </p>
                  <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 mt-1">
                    {opt.detail}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Preferences are automatically saved.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-semibold text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
