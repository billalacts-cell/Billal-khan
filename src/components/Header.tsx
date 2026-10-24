import React, { useState, useEffect } from 'react';
import { 
  Menu,
  X,
  FileSpreadsheet, 
  Sun,
  Moon,
  Monitor,
  Calendar,
  LogIn,
  LogOut,
  User as UserIcon,
  Mail,
  Layers,
  Palette,
  ChevronRight
} from 'lucide-react';
import { User, signInWithGoogle, logoutUser } from '../firebase';
import { ThemeMode } from '../utils/theme';

interface HeaderProps {
  activeModule: 'forms' | 'equipment' | 'calibration';
  onSelectModule: (module: 'forms' | 'equipment' | 'calibration') => void;
  onOpenAddModal: () => void;
  onOpenBulkCalibration?: () => void;
  user: User | null;
  currentTheme: ThemeMode;
  onOpenThemeModal: () => void;
  onNavigateHome: () => void;
  // Optional props retained for compatibility
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  totalFormsCount?: number;
  totalEquipmentCount?: number;
  onConnectFirebase?: () => void;
  isConnectingFirebase?: boolean;
  activeView?: 'dashboard' | 'intro' | 'equipment-detail';
  currentFormTitle?: string;
  currentEquipmentName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeModule,
  onSelectModule,
  onOpenAddModal,
  onOpenBulkCalibration,
  user,
  currentTheme,
  onOpenThemeModal,
  onNavigateHome,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSidebarOpen(false);
      }
    };
    if (isSidebarOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Google Sign-in error:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const getThemeIcon = () => {
    switch (currentTheme) {
      case 'light':
        return <Sun className="w-4 h-4 text-amber-500" />;
      case 'dark':
        return <Moon className="w-4 h-4 text-indigo-400" />;
      case 'system':
      default:
        return <Monitor className="w-4 h-4 text-slate-500 dark:text-slate-400" />;
    }
  };

  const handleSelectNavOption = (module: 'forms' | 'calibration', tab?: string) => {
    onSelectModule(module);
    onNavigateHome();
    if (tab && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('navigate_calibration_tab', { detail: tab }));
    }
    setIsSidebarOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            
            {/* Left Side: Hamburger Menu Button + Headline */}
            <div className="flex items-center gap-3">
              {/* Hamburger Menu Button */}
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer flex items-center justify-center shrink-0"
                title="Open Menu"
                aria-label="Open Navigation Menu"
              >
                <Menu className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </button>

              {/* Main Headline */}
              <div 
                onClick={onNavigateHome}
                className="flex items-center gap-2.5 shrink-0 cursor-pointer group select-none"
                title="Calibration Reminder & Schedule Hub"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                  <Calendar className="w-5 h-5" />
                </div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  Calibration Reminder & Schedule Hub
                </h1>
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* Left Slide-out Sidebar Drawer Menu */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div 
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            aria-hidden="true"
          />

          {/* Left Drawer Container */}
          <aside className="fixed inset-y-0 left-0 max-w-xs w-full bg-white dark:bg-slate-900 shadow-2xl border-r border-slate-200 dark:border-slate-800 flex flex-col z-50 animate-in slide-in-from-left duration-200">
            
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Menu className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Menu
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                aria-label="Close Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Menu Options - Header Names Only */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              
              {/* Form Option */}
              <button
                type="button"
                onClick={() => handleSelectNavOption('forms')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeModule === 'forms'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className={`w-4 h-4 ${activeModule === 'forms' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`} />
                  <span>Form</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* Calibration Option */}
              <button
                type="button"
                onClick={() => handleSelectNavOption('calibration')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeModule === 'calibration'
                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Calendar className={`w-4 h-4 ${activeModule === 'calibration' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`} />
                  <span>Calibration</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <div className="my-2 border-t border-slate-100 dark:border-slate-800" />

              {/* Receiver Email Settings Option */}
              <button
                type="button"
                onClick={() => handleSelectNavOption('calibration', 'recipients')}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-indigo-500" />
                  <span>Receiver Email Settings</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* Theme Settings Option */}
              <button
                type="button"
                onClick={() => {
                  setIsSidebarOpen(false);
                  onOpenThemeModal();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 flex items-center justify-center text-purple-500">
                    {getThemeIcon()}
                  </div>
                  <span>Theme: {currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1)}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

            </nav>

            {/* Drawer Footer - User Session */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              {user ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {user.displayName ? user.displayName.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {user.displayName || 'Authorized User'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
                        {user.email}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    title="Sign out"
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg cursor-pointer transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full py-2 px-3 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In with Google</span>
                </button>
              )}
            </div>

          </aside>
        </div>
      )}
    </>
  );
};
