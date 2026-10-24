import React from 'react';
import { 
  ArrowUpDown, 
  Star, 
  Plus
} from 'lucide-react';
import { GoogleFormItem } from '../types';

export type SortOption = 'recent' | 'alphabetical' | 'opens' | 'category';

interface CategoryFilterBarProps {
  categories: string[];
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  forms: GoogleFormItem[];
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  showOnlyStarred: boolean;
  onToggleShowStarred: () => void;
  onOpenAddModal?: () => void;
}

export const CategoryFilterBar: React.FC<CategoryFilterBarProps> = ({
  categories,
  activeCategory,
  onSelectCategory,
  forms,
  sortBy,
  onSortChange,
  showOnlyStarred,
  onToggleShowStarred,
  onOpenAddModal,
}) => {
  // Count items per category
  const categoryCounts: Record<string, number> = {};
  forms.forEach((f) => {
    categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1;
  });

  const allCategories = ['All', ...categories];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 shadow-xs mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
      {/* Category Pills (Scrollable on small screens) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
        {allCategories.map((cat) => {
          const isSelected = activeCategory === cat;
          const count = cat === 'All' ? forms.length : categoryCounts[cat] || 0;

          return (
            <button
              key={cat}
              type="button"
              onClick={() => onSelectCategory(cat)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750'
              }`}
            >
              <span>{cat}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                  isSelected
                    ? 'bg-indigo-700 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right Controls: Favorites filter + Sort By */}
      <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
        {/* Starred Toggle */}
        <button
          type="button"
          onClick={onToggleShowStarred}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
            showOnlyStarred
              ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300 dark:border-amber-800'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-750'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${showOnlyStarred ? 'fill-amber-400 text-amber-500' : ''}`} />
          <span>Favorites</span>
        </button>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] text-slate-400 hidden sm:inline">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="recent">Recently Updated</option>
            <option value="alphabetical">Form Name (A-Z)</option>
            <option value="opens">Most Opened</option>
            <option value="category">Category</option>
          </select>
        </div>

        {/* Add Form Action Button */}
        {onOpenAddModal && (
          <button
            type="button"
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all cursor-pointer shrink-0 active:scale-95"
            title="Add New Form"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Form</span>
          </button>
        )}
      </div>
    </div>
  );
};
