import React, { useState, useEffect } from 'react';
import { X, FileSpreadsheet, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { EquipmentItem, EquipmentStatus, CalibrationCategory } from '../../types';
import { calculateCalibrationStatus } from '../../services/googleSheetsService';

interface EquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (equipment: EquipmentItem) => Promise<void>;
  initialData?: EquipmentItem | null;
  existingIds: string[];
}

export const EquipmentModal: React.FC<EquipmentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  existingIds,
}) => {
  const isEditing = Boolean(initialData);

  // Core calibration fields matching the Entry Form
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [calibrationCategory, setCalibrationCategory] = useState<CalibrationCategory>('Internal Calibration');
  const [currentProject, setCurrentProject] = useState('');
  const [notes, setNotes] = useState('');
  const [calibrationDueDate, setCalibrationDueDate] = useState('');

  // Optional technical fields
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [status, setStatus] = useState<EquipmentStatus>('In Stock');
  const [showMore, setShowMore] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setId(initialData.id);
      setName(initialData.name);
      setSerialNumber(initialData.serialNumber && initialData.serialNumber !== 'Not recorded' ? initialData.serialNumber : '');
      setCalibrationCategory(
        initialData.calibrationCategory === 'External Calibration' 
          ? 'External Calibration' 
          : 'Internal Calibration'
      );
      setCurrentProject(initialData.currentProject || '');
      setNotes(initialData.notes || '');
      setCalibrationDueDate(initialData.calibrationDueDate || '');
      setManufacturer(initialData.manufacturer === 'Not recorded' ? '' : (initialData.manufacturer || ''));
      setModel(initialData.model === 'Not recorded' ? '' : (initialData.model || ''));
      setStatus(initialData.status || 'In Stock');
    } else {
      setId('');
      setName('');
      setSerialNumber('');
      setCalibrationCategory('Internal Calibration');
      setCurrentProject('In Stock');
      setNotes('');
      setCalibrationDueDate('');
      setManufacturer('');
      setModel('');
      setStatus('In Stock');
    }
    setError(null);
    setShowMore(false);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = id.trim().toUpperCase();
    const cleanName = name.trim();
    const cleanDueDate = calibrationDueDate.trim();

    if (!cleanId) {
      setError('Please provide an Asset ID / Tag Number.');
      return;
    }

    if (!cleanName) {
      setError('Please provide an Equipment Name.');
      return;
    }

    if (!cleanDueDate) {
      setError('Please provide a Calibration Due Date.');
      return;
    }

    // Check duplicate ID if new
    if (!isEditing && existingIds.some((existing) => existing.toLowerCase() === cleanId.toLowerCase())) {
      setError(`Asset ID "${cleanId}" already exists. Please use a unique identifier.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const calibStatus = calculateCalibrationStatus(cleanDueDate);
      const dueDateChanged = initialData ? initialData.calibrationDueDate !== cleanDueDate : false;
      const cleanProject = currentProject.trim() || 'In Stock';
      const cleanRemark = notes.trim();

      const newItem: EquipmentItem = {
        ...(initialData || {}),
        id: cleanId,
        name: cleanName,
        category: initialData?.category || 'Calibration',
        manufacturer: manufacturer.trim() || initialData?.manufacturer || 'Not recorded',
        model: model.trim() || initialData?.model || 'Not recorded',
        serialNumber: serialNumber.trim() || 'Not recorded',
        currentProject: cleanProject,
        currentLocation: calibrationCategory === 'Internal Calibration' 
          ? (cleanRemark || initialData?.currentLocation || 'Internal Calibration Station') 
          : (cleanRemark || initialData?.currentLocation || 'Main Store'),
        status: status || 'In Stock',
        dateIssued: initialData?.dateIssued || null,
        dateReturned: initialData?.dateReturned || null,
        calibrationDueDate: cleanDueDate,
        calibrationStatus: calibStatus,
        calibrationCategory,
        externalProvider: calibrationCategory === 'External Calibration' 
          ? (cleanRemark || initialData?.externalProvider || 'External Laboratory') 
          : '',
        notes: cleanRemark,
        lastNotifiedDueDate: dueDateChanged ? null : (initialData?.lastNotifiedDueDate || null),
        lastNotifiedAt: dueDateChanged ? null : (initialData?.lastNotifiedAt || null),
        lastNotificationStatus: dueDateChanged ? null : (initialData?.lastNotificationStatus || null),
        photos: initialData?.photos || [],
        certificates: initialData?.certificates || [],
        maintenanceHistory: initialData?.maintenanceHistory || [
          {
            id: `maint_init_${Date.now()}_${cleanId}`,
            date: new Date().toISOString().split('T')[0],
            type: 'Calibration',
            performedBy: 'Equipment Entry',
            details: `Calibration cycle scheduled for ${cleanDueDate} (${calibrationCategory})`
          }
        ],
        movementHistory: initialData?.movementHistory || [
          {
            id: `mov_init_${cleanId}`,
            equipmentId: cleanId,
            equipmentName: cleanName,
            fromLocation: 'Origin',
            toLocation: calibrationCategory === 'Internal Calibration' ? (cleanRemark || 'Internal Station') : 'Main Store',
            fromProject: 'Stock',
            toProject: cleanProject,
            transferDate: new Date().toISOString().split('T')[0],
            issuedBy: 'System Entry',
            receivedBy: cleanProject,
            remarks: cleanRemark || 'Equipment registered',
            timestamp: Date.now()
          }
        ],
        createdAt: initialData?.createdAt || Date.now(),
        updatedAt: Date.now(),
        source: initialData?.source || 'manual'
      };

      await onSave(newItem);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save calibration record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div 
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all my-6"
        role="dialog"
        aria-modal="true"
      >
        {/* Header matching Entry Form styling */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>{isEditing ? 'Edit Calibration Record' : 'New Calibration Entry'}</span>
                {isEditing && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 font-bold">
                    {id}
                  </span>
                )}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                Asset ID, Name, Serial Number, Calibration Option, Project, and Due Date
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body - Exactly same layout and fields as Entry Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {/* Row 1: Asset ID & Equipment Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Asset ID / Tag No <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="e.g. C3332"
                className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Equipment Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Digital Thermometer, Caliper"
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>
          </div>

          {/* Row 2: Serial Number & Calibration Option */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Serial Number
              </label>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="e.g. SN-88310"
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Calibration Option <span className="text-rose-500">*</span>
              </label>
              <select
                value={calibrationCategory}
                onChange={(e) => setCalibrationCategory(e.target.value as CalibrationCategory)}
                className={`w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer ${
                  calibrationCategory === 'Internal Calibration'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-purple-700 dark:text-purple-400'
                }`}
              >
                <option value="Internal Calibration">Internal Calibration (Internal)</option>
                <option value="External Calibration">External Calibration (External)</option>
              </select>
            </div>
          </div>

          {/* Row 3: Project Name & Station / Remark */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Project Name
              </label>
              <input
                type="text"
                value={currentProject}
                onChange={(e) => setCurrentProject(e.target.value)}
                placeholder="e.g. CRCC, In Stock"
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Station / Remark
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Station 1, Lab, notes..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Row 4: Calibration Due Date */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Calibration Due Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={calibrationDueDate}
              onChange={(e) => setCalibrationDueDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              required
            />
          </div>

          {/* Collapsible Additional Details (Optional) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowMore(!showMore)}
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              {showMore ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>{showMore ? 'Hide Optional Details' : 'Show Additional Details (Manufacturer, Model, Status)'}</span>
            </button>

            {showMore && (
              <div className="mt-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Manufacturer
                  </label>
                  <input
                    type="text"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    placeholder="e.g. Fluke, Mitutoyo"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. Series 500"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as EquipmentStatus)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="In Stock">In Stock</option>
                    <option value="Assigned">Assigned</option>
                    <option value="Under Maintenance">Under Maintenance</option>
                    <option value="Calibration Due">Calibration Due</option>
                    <option value="Decommissioned">Decommissioned</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Record'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
