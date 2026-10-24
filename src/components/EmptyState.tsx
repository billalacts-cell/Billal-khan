import React from 'react';
import { Search, FolderPlus, Plus, RefreshCw, FileQuestion } from 'lucide-react';

interface EmptyStateProps {
  searchQuery?: string;
  activeCategory?: string;
  onClearFilters: () => void;
  onOpenAddModal: () => void;
  onRestoreDefaults?: () => void;
  totalFormsCount: number;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  searchQuery,
  activeCategory,
  onClearFilters,
  onOpenAddModal,
  onRestoreDefaults,
  totalFormsCount,
}) => {
  const isSearchActive = Boolean(searchQuery && searchQuery.trim());

  if (totalFormsCount === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center mb-4">
          <FolderPlus className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
          No Google Forms Registered
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto leading-relaxed">
          Your dashboard is currently empty. Register your existing Google Forms or restore the two default forms to get started.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add New Form
          </button>
          {onRestoreDefaults && (
            <button
              type="button"
              onClick={onRestoreDefaults}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Restore 2 Default Forms
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center max-w-lg mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-4">
        {isSearchActive ? <Search className="w-7 h-7" /> : <FileQuestion className="w-7 h-7" />}
      </div>
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
        {isSearchActive ? 'No matching forms found' : `No forms in "${activeCategory}"`}
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto leading-relaxed">
        {isSearchActive
          ? `We couldn't find any forms matching "${searchQuery}". Check the spelling or clear your search term.`
          : `There are currently no forms registered under the "${activeCategory}" category.`}
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onClearFilters}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
        >
          Reset Filters
        </button>
        <button
          type="button"
          onClick={onOpenAddModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Register a Form
        </button>
      </div>
    </div>
  );
};
