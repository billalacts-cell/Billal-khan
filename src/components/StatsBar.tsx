import React from 'react';
import { FileText, FolderKanban, BarChart3, Star } from 'lucide-react';
import { GoogleFormItem } from '../types';

interface StatsBarProps {
  forms: GoogleFormItem[];
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  categories: string[];
}

export const StatsBar: React.FC<StatsBarProps> = ({
  forms,
}) => {
  const totalForms = forms.length;
  const totalOpens = forms.reduce((acc, f) => acc + (f.openCount || 0), 0);
  const starredCount = forms.filter((f) => f.isStarred).length;
  const usedCategories = new Set(forms.map((f) => f.category));

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
      {/* Total Forms */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Registered Forms
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              {totalForms}
            </span>
            <span className="text-xs text-slate-400">total in hub</span>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
          <FolderKanban className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Categories
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              {usedCategories.size}
            </span>
            <span className="text-xs text-slate-400">active types</span>
          </div>
        </div>
      </div>

      {/* Total Form Opens */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
          <BarChart3 className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Launches
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              {totalOpens}
            </span>
            <span className="text-xs text-slate-400">form visits</span>
          </div>
        </div>
      </div>

      {/* Pinned / Favorites */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-500 dark:text-amber-400 shrink-0">
          <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Favorites
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              {starredCount}
            </span>
            <span className="text-xs text-slate-400">pinned cards</span>
          </div>
        </div>
      </div>
    </div>
  );
};
