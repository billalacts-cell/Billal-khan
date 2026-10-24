import React, { useState } from 'react';
import { 
  Cloud, 
  ShieldCheck, 
  X, 
} from 'lucide-react';
import { isFirebaseConfigured, User } from '../firebase';

interface FirebaseSyncNoticeProps {
  user: User | null;
  onConnectFirebase?: () => void;
  isConnecting?: boolean;
}

export const FirebaseSyncNotice: React.FC<FirebaseSyncNoticeProps> = ({
  user,
  onConnectFirebase,
  isConnecting = false,
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="mb-6 rounded-2xl border p-4 transition-all bg-gradient-to-r from-slate-50 to-indigo-50/30 dark:from-slate-900 dark:to-indigo-950/20 border-slate-200 dark:border-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
            {isFirebaseConfigured ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Cloud className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                {isFirebaseConfigured
                  ? user
                    ? 'Cloud Firestore & Google Auth Synchronized'
                    : 'Firebase Configured – Sign in with Google to sync across devices'
                  : 'Local Storage Active – Forms are safely preserved'}
              </h4>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                isFirebaseConfigured
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'
              }`}>
                {isFirebaseConfigured ? 'Cloud Live' : 'Persistent Local'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Google Forms are opened directly in your browser. Original form questions and spreadsheet response destinations remain 100% unaltered.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {!isFirebaseConfigured && onConnectFirebase && (
            <button
              type="button"
              onClick={onConnectFirebase}
              disabled={isConnecting}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>{isConnecting ? 'Setting up...' : 'Setup Firebase Cloud'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors cursor-pointer"
            title="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
