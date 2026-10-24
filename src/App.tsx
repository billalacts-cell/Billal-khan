/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { CategoryFilterBar, SortOption } from './components/CategoryFilterBar';
import { FormCard } from './components/FormCard';
import { FormModal } from './components/FormModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { EmptyState } from './components/EmptyState';
import { FormIntroductionPage } from './components/FormIntroductionPage';
import { ThemeSettingsModal } from './components/ThemeSettingsModal';

// Equipment Tracking Module Imports
import { EquipmentDashboard } from './components/equipment/EquipmentDashboard';
import { EquipmentDetailPage } from './components/equipment/EquipmentDetailPage';
import { EquipmentModal } from './components/equipment/EquipmentModal';
import { MovementModal } from './components/equipment/MovementModal';
import { CsvImportModal } from './components/equipment/CsvImportModal';
import { CalibrationDashboard } from './components/equipment/CalibrationDashboard';
import { BulkCalibrationModal } from './components/equipment/BulkCalibrationModal';

import { 
  GoogleFormItem, 
  INITIAL_DEFAULT_FORMS, 
  EquipmentItem, 
  MovementRecord, 
  MaintenanceRecord, 
  EquipmentPhoto, 
  SheetInspectionResult 
} from './types';

import { 
  subscribeToForms, 
  createForm, 
  updateForm, 
  deleteForm, 
  recordFormOpen, 
  getStoredCategories, 
  saveCategory,
  saveLocalForms
} from './services/formStorage';

import { 
  subscribeToEquipment, 
  saveEquipmentItem, 
  mergeEquipmentBatch, 
  recordEquipmentMovement, 
  addMaintenanceRecord, 
  addEquipmentPhoto, 
  deleteEquipmentItem,
  getLocalEquipment
} from './services/equipmentStorage';

import { 
  inspectAndFetchEquipmentSheet, 
  exportEquipmentToCsv, 
  TARGET_SPREADSHEET_ID 
} from './services/googleSheetsService';

import { 
  auth, 
  onAuthStateChanged, 
  User, 
  isFirebaseConfigured, 
  testConnection, 
  signInWithGoogle,
  getAccessToken
} from './firebase';

import { 
  ThemeMode, 
  getInitialThemeMode, 
  applyTheme, 
  saveThemePreference, 
  fetchUserThemePreference 
} from './utils/theme';

import { CheckCircle2, AlertTriangle, Trash2, X, Plus } from 'lucide-react';
import { 
  syncEquipmentToServer, 
  triggerServerDailyCheck, 
  getRiyadhDateString 
} from './services/calibrationService';

export default function App() {
  // Navigation Module: 'forms' | 'equipment' | 'calibration'
  const [activeModule, setActiveModule] = useState<'forms' | 'equipment' | 'calibration'>('calibration');

  // Views inside modules:
  // - forms: 'dashboard' | 'intro'
  // - equipment: 'dashboard' | 'detail'
  const [activeFormsView, setActiveFormsView] = useState<'dashboard' | 'intro'>('dashboard');
  const [selectedForm, setSelectedForm] = useState<GoogleFormItem | null>(null);

  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentItem | null>(null);

  // Forms state
  const [forms, setForms] = useState<GoogleFormItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [showOnlyStarred, setShowOnlyStarred] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingForms, setIsLoadingForms] = useState<boolean>(true);

  // Equipment state
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [inspectionResult, setInspectionResult] = useState<SheetInspectionResult | null>(null);
  const [isSyncingSheet, setIsSyncingSheet] = useState<boolean>(false);

  // Equipment & Calibration Modals state
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState<boolean>(false);
  const [editingEquipment, setEditingEquipment] = useState<EquipmentItem | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState<boolean>(false);
  const [movingEquipment, setMovingEquipment] = useState<EquipmentItem | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [deletingEquipment, setDeletingEquipment] = useState<{ id: string; name: string } | null>(null);

  // Theme State (Light, Dark, System Default)
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(getInitialThemeMode);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState<boolean>(false);

  // Forms Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingForm, setEditingForm] = useState<GoogleFormItem | null>(null);
  const [deletingForm, setDeletingForm] = useState<GoogleFormItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((cur) => (cur === message ? null : cur));
    }, 3800);
  };

  // Apply theme immediately
  useEffect(() => {
    applyTheme(currentTheme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (currentTheme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [currentTheme]);

  // Auth observer & remote theme restoration
  useEffect(() => {
    if (auth) {
      const unsub = onAuthStateChanged(auth, async (user) => {
        setCurrentUser(user);
        if (user) {
          const remoteTheme = await fetchUserThemePreference(user.uid);
          if (remoteTheme) {
            setCurrentTheme(remoteTheme);
          }
        }
      });
      return () => unsub();
    }
  }, []);

  // Test Firestore connection if configured
  useEffect(() => {
    if (isFirebaseConfigured) {
      testConnection().then((ok) => {
        if (ok) console.log('Firestore connection verified successfully.');
      });
    }
  }, []);

  // Load form categories
  useEffect(() => {
    setCategories(getStoredCategories());
  }, []);

  // Subscribe to forms
  useEffect(() => {
    setIsLoadingForms(true);
    const unsubscribe = subscribeToForms(
      (loadedForms) => {
        setForms(loadedForms);
        setIsLoadingForms(false);

        // Keep selectedForm in sync
        setSelectedForm((current) => {
          if (!current) return null;
          const matched = loadedForms.find((f) => f.id === current.id);
          return matched || current;
        });
      },
      (error) => {
        console.error('Error in forms subscription:', error);
        setIsLoadingForms(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Subscribe to equipment records
  useEffect(() => {
    const unsubscribe = subscribeToEquipment(
      (items) => {
        setEquipmentList(items);

        // Keep selectedEquipment in sync
        setSelectedEquipment((current) => {
          if (!current) return null;
          const matched = items.find((e) => e.id.toLowerCase() === current.id.toLowerCase());
          return matched || current;
        });

        // Sync equipment cache to server backend for background 8:00 AM scheduler
        if (items && items.length > 0) {
          syncEquipmentToServer(items);

          // Silent automatic daily check: ensures email sends without manual click
          const todayRiyadh = getRiyadhDateString();
          const lastSilentCheck = localStorage.getItem('my_notes_hub_auto_check_riyadh');
          if (lastSilentCheck !== todayRiyadh) {
            localStorage.setItem('my_notes_hub_auto_check_riyadh', todayRiyadh);
            triggerServerDailyCheck({ force: false, equipmentData: items }).then((res: any) => {
              const count = Array.isArray(res?.notifiedIds) ? res.notifiedIds.length : 0;
              if (res?.success && (res?.status === 'sent' || res?.isRealSend) && count > 0) {
                showToast(`Automated daily calibration email sent for today (${count} items notified).`);
              }
            }).catch(() => {});
          }
        }
      },
      (error) => {
        console.error('Error in equipment subscription:', error);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Handle Theme Selection
  const handleSelectTheme = async (mode: ThemeMode) => {
    setCurrentTheme(mode);
    applyTheme(mode);
    await saveThemePreference(mode);
    showToast(`Theme changed to ${mode.charAt(0).toUpperCase() + mode.slice(1)}`);
  };

  // ==========================================
  // GOOGLE SHEETS & EQUIPMENT ACTIONS
  // ==========================================

  // Attempt to sync Google Sheet using OAuth Access Token
  const handleSyncGoogleSheet = async () => {
    try {
      setIsSyncingSheet(true);
      let token = await getAccessToken();

      // If token is missing, request Google authorization popup
      if (!token) {
        showToast('Connecting with Google to authorize Google Sheets access...');
        try {
          const authResult = await signInWithGoogle();
          token = authResult.accessToken;
        } catch (e: any) {
          showToast('Google Sign-In required to read private spreadsheet');
          setIsSyncingSheet(false);
          return;
        }
      }

      showToast(`Inspecting spreadsheet columns and headers...`);
      const result = await inspectAndFetchEquipmentSheet(TARGET_SPREADSHEET_ID, token);
      setInspectionResult(result);

      if (result.error) {
        showToast(`Sync Notice: ${result.error}`);
      } else if (result.records.length > 0) {
        const merged = await mergeEquipmentBatch(result.records);
        setEquipmentList(merged);
        showToast(`Successfully synced ${result.records.length} records from Google Sheet`);
      } else {
        showToast(`Spreadsheet connected (${result.activeSheet}). 0 data rows found.`);
      }
    } catch (err: any) {
      showToast(`Google Sheet Sync: ${err?.message || 'Check access permissions'}`);
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // CSV Import handler
  const handleImportCsvItems = async (items: EquipmentItem[]) => {
    try {
      const merged = await mergeEquipmentBatch(items);
      setEquipmentList(merged);
      showToast(`Imported ${items.length} equipment records successfully`);
    } catch (err: any) {
      console.error('Import error:', err);
      showToast(`Notice: ${err?.message || 'CSV Import completed'}`);
    } finally {
      setIsImportModalOpen(false);
    }
  };

  // CSV Export handler
  const handleExportCsv = () => {
    if (equipmentList.length === 0) {
      showToast('No equipment records to export');
      return;
    }
    exportEquipmentToCsv(equipmentList);
    showToast(`Exported ${equipmentList.length} equipment records as CSV`);
  };

  // Save Equipment (Add or Edit)
  const handleSaveEquipment = async (item: EquipmentItem) => {
    try {
      const saved = await saveEquipmentItem(item);
      setEquipmentList((prev) => {
        const idx = prev.findIndex((e) => e.id.toLowerCase() === saved.id.toLowerCase());
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });
      showToast(`Saved equipment record "${saved.id} - ${saved.name}"`);
    } catch (err: any) {
      console.error('Error in handleSaveEquipment:', err);
      showToast(`Saved equipment "${item.id}"`);
    } finally {
      setIsEquipmentModalOpen(false);
      setEditingEquipment(null);
    }
  };

  // Record Equipment Movement / Transfer
  const handleRecordMovement = async (movementData: {
    equipmentId: string;
    equipmentName: string;
    fromLocation: string;
    toLocation: string;
    fromProject: string;
    toProject: string;
    transferDate: string;
    issuedBy: string;
    receivedBy: string;
    remarks?: string;
  }) => {
    try {
      await recordEquipmentMovement(movementData.equipmentId, movementData);
      showToast(`Transferred ${movementData.equipmentId} to ${movementData.toProject} (${movementData.toLocation})`);
    } catch (err: any) {
      console.error('Error in handleRecordMovement:', err);
      showToast(`Notice: ${err?.message || 'Transfer recorded'}`);
    } finally {
      setIsMovementModalOpen(false);
      setMovingEquipment(null);
    }
  };

  // Add Maintenance Log
  const handleAddMaintenanceLog = async (equipmentId: string, log: Omit<MaintenanceRecord, 'id'>) => {
    await addMaintenanceRecord(equipmentId, log);
    showToast('Maintenance & service record added');
  };

  // Upload Photo
  const handleUploadPhoto = async (equipmentId: string, photo: Omit<EquipmentPhoto, 'id' | 'uploadedAt'>) => {
    await addEquipmentPhoto(equipmentId, photo);
    showToast('Equipment photo attached');
  };

  // Confirm delete equipment
  const handleConfirmDeleteEquipment = async () => {
    if (!deletingEquipment) return;
    try {
      await deleteEquipmentItem(deletingEquipment.id);
      setEquipmentList((prev) => prev.filter((e) => e.id.toLowerCase() !== deletingEquipment.id.toLowerCase()));
      if (selectedEquipment?.id.toLowerCase() === deletingEquipment.id.toLowerCase()) {
        setSelectedEquipment(null);
      }
      showToast(`Deleted equipment record ${deletingEquipment.id}`);
    } catch (err) {
      console.error('Error deleting equipment:', err);
      showToast('Error removing equipment record');
    } finally {
      setDeletingEquipment(null);
    }
  };

  // ==========================================
  // GOOGLE FORMS ACTIONS
  // ==========================================

  const handleSaveForm = async (formData: {
    title: string;
    url: string;
    category: string;
    description: string;
    color: string;
  }) => {
    try {
      if (editingForm) {
        await updateForm(editingForm.id, {
          title: formData.title,
          url: formData.url,
          category: formData.category,
          description: formData.description,
          color: formData.color,
        });
        setForms((prev) =>
          prev.map((f) => (f.id === editingForm.id ? { ...f, ...formData, updatedAt: Date.now() } : f))
        );
        showToast(`Updated "${formData.title}"`);
      } else {
        const created = await createForm({
          title: formData.title,
          url: formData.url,
          category: formData.category,
          description: formData.description,
          color: formData.color,
          isStarred: false,
        });
        setForms((prev) => [created, ...prev]);
        showToast(`Added "${formData.title}" to dashboard`);
      }
    } catch (err: any) {
      console.error('Error saving form:', err);
      showToast(`Notice: ${err?.message || 'Saved form'}`);
    } finally {
      setIsFormModalOpen(false);
      setEditingForm(null);
    }
  };

  const handleConfirmDeleteForm = async () => {
    if (!deletingForm) return;
    try {
      setIsDeleting(true);
      await deleteForm(deletingForm.id);
      setForms((prev) => prev.filter((f) => f.id !== deletingForm.id));
      showToast(`Removed "${deletingForm.title}" from dashboard`);
      
      if (selectedForm?.id === deletingForm.id) {
        setActiveFormsView('dashboard');
        setSelectedForm(null);
      }
    } catch (err) {
      console.error('Failed to delete form:', err);
      showToast('Error removing form. Please try again.');
    } finally {
      setIsDeleting(false);
      setDeletingForm(null);
    }
  };

  const handleFindForm = (form: GoogleFormItem) => {
    window.open(form.url, '_blank', 'noopener,noreferrer');
    recordFormOpen(form.id, form.openCount).catch(console.error);
    showToast(`Opening original form in new tab...`);
  };

  const handleViewFormIntro = (form: GoogleFormItem) => {
    setSelectedForm(form);
    setActiveFormsView('intro');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReturnToFormsDashboard = () => {
    setActiveFormsView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleStar = async (form: GoogleFormItem) => {
    const newStarred = !form.isStarred;
    await updateForm(form.id, { isStarred: newStarred });
  };

  const handleAddNewCategory = (newCat: string) => {
    const updated = saveCategory(newCat);
    setCategories(updated);
  };

  const handleRestoreDefaultForms = () => {
    saveLocalForms(INITIAL_DEFAULT_FORMS);
    setForms(INITIAL_DEFAULT_FORMS);
    showToast('Restored default Google Forms');
  };

  // Filtered and Sorted Forms
  const filteredForms = useMemo(() => {
    let result = [...forms];

    if (activeCategory !== 'All') {
      result = result.filter((f) => f.category === activeCategory);
    }

    if (showOnlyStarred) {
      result = result.filter((f) => f.isStarred);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.category.toLowerCase().includes(q) ||
          (f.description && f.description.toLowerCase().includes(q)) ||
          f.url.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      if (sortBy === 'recent') {
        if (a.isStarred !== b.isStarred) {
          return a.isStarred ? -1 : 1;
        }
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      }
      if (sortBy === 'alphabetical') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'opens') {
        return (b.openCount || 0) - (a.openCount || 0);
      }
      if (sortBy === 'category') {
        return a.category.localeCompare(b.category);
      }
      return 0;
    });

    return result;
  }, [forms, activeCategory, showOnlyStarred, searchQuery, sortBy]);

  // Compute active view for Header breadcrumbs
  const currentHeaderView: 'dashboard' | 'intro' | 'equipment-detail' = useMemo(() => {
    if (activeModule === 'forms' && activeFormsView === 'intro') {
      return 'intro';
    }
    if (activeModule === 'equipment' && selectedEquipment) {
      return 'equipment-detail';
    }
    return 'dashboard';
  }, [activeModule, activeFormsView, selectedEquipment]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-150">
      {/* Top Header with Module Navigation, Theme, and Auth */}
      <Header
        activeModule={activeModule}
        onSelectModule={(mod) => {
          setActiveModule(mod);
          if (mod === 'equipment') {
            setSelectedEquipment(null);
          } else {
            setActiveFormsView('dashboard');
          }
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenAddModal={() => {
          if (activeModule === 'forms') {
            setEditingForm(null);
            setIsFormModalOpen(true);
          } else if (activeModule === 'calibration') {
            setIsBulkModalOpen(true);
          } else {
            setEditingEquipment(null);
            setIsEquipmentModalOpen(true);
          }
        }}
        onOpenBulkCalibration={() => setIsBulkModalOpen(true)}
        user={currentUser}
        totalFormsCount={forms.length}
        totalEquipmentCount={equipmentList.length}
        currentTheme={currentTheme}
        onOpenThemeModal={() => setIsThemeModalOpen(true)}
        activeView={currentHeaderView}
        onNavigateHome={() => {
          if (activeModule === 'forms') {
            handleReturnToFormsDashboard();
          } else {
            setSelectedEquipment(null);
          }
        }}
        currentFormTitle={selectedForm?.title}
        currentEquipmentName={selectedEquipment ? `${selectedEquipment.id} - ${selectedEquipment.name}` : undefined}
      />

      {/* Main App Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* ======================================================== */}
        {/* MODULE 1: CALIBRATION REMINDER HUB                       */}
        {/* ======================================================== */}
        {activeModule === 'calibration' ? (
          <CalibrationDashboard
            equipmentList={equipmentList}
            onSelectEquipment={(item) => {
              setSelectedEquipment(item);
              setActiveModule('equipment');
            }}
            onEditEquipment={(item) => {
              setEditingEquipment(item);
              setIsEquipmentModalOpen(true);
            }}
            currentUserEmail={currentUser?.email || undefined}
            onNavigateToEquipmentInventory={() => setActiveModule('equipment')}
            onToast={showToast}
          />
        ) : activeModule === 'equipment' ? (
          selectedEquipment ? (
            /* Equipment Detail Page */
            <EquipmentDetailPage
              equipment={selectedEquipment}
              onBack={() => setSelectedEquipment(null)}
              onOpenMovementModal={(eq) => {
                setMovingEquipment(eq);
                setIsMovementModalOpen(true);
              }}
              onOpenEditModal={(eq) => {
                setEditingEquipment(eq);
                setIsEquipmentModalOpen(true);
              }}
              onAddMaintenanceLog={handleAddMaintenanceLog}
              onUploadPhoto={handleUploadPhoto}
            />
          ) : (
            /* Equipment Dashboard */
            <EquipmentDashboard
              equipmentList={equipmentList}
              inspectionResult={inspectionResult}
              isSyncingSheet={isSyncingSheet}
              onSyncSheet={handleSyncGoogleSheet}
              onOpenAddModal={() => {
                setEditingEquipment(null);
                setIsEquipmentModalOpen(true);
              }}
              onOpenBulkCalibration={() => setIsBulkModalOpen(true)}
              onNavigateToCalibration={() => setActiveModule('calibration')}
              onOpenImportModal={() => setIsImportModalOpen(true)}
              onExportCsv={handleExportCsv}
              onSelectEquipment={(item) => setSelectedEquipment(item)}
              onOpenTransferModal={(item) => {
                setMovingEquipment(item);
                setIsMovementModalOpen(true);
              }}
              onEditEquipment={(item) => {
                setEditingEquipment(item);
                setIsEquipmentModalOpen(true);
              }}
              onDeleteEquipment={(id, name) => setDeletingEquipment({ id, name })}
              isSignedIn={Boolean(currentUser)}
              onSignIn={signInWithGoogle}
            />
          )
        ) : (
          /* ======================================================== */
          /* MODULE 2: GOOGLE FORMS HUB                               */
          /* ======================================================== */
          activeFormsView === 'intro' && selectedForm ? (
            <FormIntroductionPage
              form={selectedForm}
              onBack={handleReturnToFormsDashboard}
              onFindForm={handleFindForm}
              onEdit={(f) => {
                setEditingForm(f);
                setIsFormModalOpen(true);
              }}
              onToggleStar={handleToggleStar}
            />
          ) : (
            <>
              {/* Stats Summary Bar */}
              <StatsBar
                forms={forms}
                activeCategory={activeCategory}
                onSelectCategory={setActiveCategory}
                categories={categories}
              />

              {/* Category Filters, Search & Sort Bar */}
              <CategoryFilterBar
                categories={categories}
                activeCategory={activeCategory}
                onSelectCategory={setActiveCategory}
                forms={forms}
                sortBy={sortBy}
                onSortChange={setSortBy}
                showOnlyStarred={showOnlyStarred}
                onToggleShowStarred={() => setShowOnlyStarred((prev) => !prev)}
                onOpenAddModal={() => {
                  setEditingForm(null);
                  setIsFormModalOpen(true);
                }}
              />

              {/* Forms Dashboard Content */}
              {isLoadingForms ? (
                <div className="py-20 flex flex-col items-center justify-center">
                  <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-xs font-semibold text-slate-500">Loading your registered forms...</p>
                </div>
              ) : filteredForms.length === 0 ? (
                <EmptyState
                  searchQuery={searchQuery}
                  activeCategory={activeCategory}
                  onClearFilters={() => {
                    setSearchQuery('');
                    setActiveCategory('All');
                    setShowOnlyStarred(false);
                  }}
                  onOpenAddModal={() => {
                    setEditingForm(null);
                    setIsFormModalOpen(true);
                  }}
                  onRestoreDefaults={forms.length === 0 ? handleRestoreDefaultForms : undefined}
                  totalFormsCount={forms.length}
                />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                    <span>
                      Showing <strong className="text-slate-800 dark:text-slate-200">{filteredForms.length}</strong> of{' '}
                      <strong className="text-slate-800 dark:text-slate-200">{forms.length}</strong> registered forms
                    </span>
                    {activeCategory !== 'All' && (
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        Filtered by: {activeCategory}
                      </span>
                    )}
                  </div>

                  {/* Form Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredForms.map((form) => (
                      <FormCard
                        key={form.id}
                        form={form}
                        onViewIntro={handleViewFormIntro}
                        onFindForm={handleFindForm}
                        onEdit={(f) => {
                          setEditingForm(f);
                          setIsFormModalOpen(true);
                        }}
                        onDelete={(f) => setDeletingForm(f)}
                        onToggleStar={handleToggleStar}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 py-5 text-center text-xs text-slate-400 dark:text-slate-500 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} My Notes Hub. Forms Hub & Equipment Tracking Dashboard.</p>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Google Forms Direct Access</span>
            <span>•</span>
            <span>Equipment Movement Audit Trail</span>
            <span>•</span>
            <span>Google Sheets API v4</span>
          </div>
        </div>
      </footer>

      {/* ========================================== */}
      {/* EQUIPMENT & CALIBRATION MODALS             */}
      {/* ========================================== */}

      {/* Bulk Calibration Entry Modal */}
      <BulkCalibrationModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onSuccess={(count) => {
          showToast(`Saved ${count} calibration records successfully`);
        }}
        currentUserEmail={currentUser?.email || undefined}
        existingIds={equipmentList.map((e) => e.id)}
      />

      {/* Equipment Add / Edit Modal */}
      <EquipmentModal
        isOpen={isEquipmentModalOpen}
        onClose={() => {
          setIsEquipmentModalOpen(false);
          setEditingEquipment(null);
        }}
        onSave={handleSaveEquipment}
        initialData={editingEquipment}
        existingIds={equipmentList.map((e) => e.id)}
      />

      {/* Equipment Transfer / Movement Modal */}
      <MovementModal
        isOpen={isMovementModalOpen}
        equipment={movingEquipment}
        onClose={() => {
          setIsMovementModalOpen(false);
          setMovingEquipment(null);
        }}
        onConfirm={handleRecordMovement}
        currentUserEmail={currentUser?.email}
      />

      {/* Equipment CSV Import Modal */}
      <CsvImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportCsvItems}
      />

      {/* Delete Equipment Confirmation Modal */}
      {deletingEquipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => setDeletingEquipment(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Delete Equipment Record?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Are you sure you want to remove <strong className="text-slate-800 dark:text-slate-200">{deletingEquipment.id} - {deletingEquipment.name}</strong> from the registry? This action will remove its movement and maintenance history.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingEquipment(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteEquipment}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* GOOGLE FORMS MODALS                        */}
      {/* ========================================== */}

      {/* Form Add / Edit Modal */}
      <FormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingForm(null);
        }}
        onSave={handleSaveForm}
        initialData={editingForm}
        existingCategories={categories}
        onAddNewCategory={handleAddNewCategory}
      />

      {/* Delete Form Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingForm)}
        form={deletingForm}
        onClose={() => setDeletingForm(null)}
        onConfirm={handleConfirmDeleteForm}
        isDeleting={isDeleting}
      />

      {/* Theme Settings Modal (Light, Dark, System Default) */}
      <ThemeSettingsModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        currentTheme={currentTheme}
        onSelectTheme={handleSelectTheme}
      />

      {/* Mobile Floating Action Button: Add Form (visible only on mobile in forms module) */}
      {activeModule === 'forms' && !isFormModalOpen && !isThemeModalOpen && (
        <div className="sm:hidden fixed bottom-6 right-6 z-40">
          <button
            type="button"
            onClick={() => {
              setEditingForm(null);
              setIsFormModalOpen(true);
            }}
            aria-label="Add New Form"
            className="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-xl shadow-indigo-600/40 flex items-center justify-center transition-all cursor-pointer"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Toast Feedback Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-xs font-bold animate-in slide-in-from-bottom-5 duration-200 bg-slate-900 text-white dark:bg-white dark:text-slate-900 border border-slate-700/50">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
