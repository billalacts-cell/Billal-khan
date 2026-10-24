import React, { useState } from 'react';
import { X, ArrowRightLeft, Calendar, User, MapPin, Building, FileText } from 'lucide-react';
import { EquipmentItem } from '../../types';

interface MovementModalProps {
  equipment: EquipmentItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (movementData: {
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
  }) => Promise<void>;
  currentUserEmail?: string | null;
}

export const MovementModal: React.FC<MovementModalProps> = ({
  equipment,
  isOpen,
  onClose,
  onConfirm,
  currentUserEmail,
}) => {
  if (!isOpen || !equipment) return null;

  const today = new Date().toISOString().split('T')[0];

  const [toProject, setToProject] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [transferDate, setTransferDate] = useState(today);
  const [issuedBy, setIssuedBy] = useState(currentUserEmail || '');
  const [receivedBy, setReceivedBy] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toProject.trim()) {
      setError('Please specify the destination project or department (e.g. CRCC or Stock).');
      return;
    }
    if (!toLocation.trim()) {
      setError('Please specify the destination location.');
      return;
    }
    if (!receivedBy.trim()) {
      setError('Please specify the recipient or person receiving the equipment.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm({
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        fromProject: equipment.currentProject || 'Stock',
        toProject: toProject.trim(),
        fromLocation: equipment.currentLocation || 'Main Store',
        toLocation: toLocation.trim(),
        transferDate,
        issuedBy: issuedBy.trim() || 'Store Keeper',
        receivedBy: receivedBy.trim(),
        remarks: remarks.trim()
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record equipment movement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all my-8"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Record Equipment Movement
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Transfer {equipment.id} between projects or locations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Current Assignment Summary */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-750 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-400 block mb-0.5">Current Project:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{equipment.currentProject || 'Stock'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Current Location:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{equipment.currentLocation || 'Main Store'}</span>
              </div>
            </div>
          </div>

          {/* Destination Project & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                Destination Project <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={toProject}
                  onChange={(e) => setToProject(e.target.value)}
                  placeholder="e.g. CRCC or Stock"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                Destination Location <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={toLocation}
                  onChange={(e) => setToLocation(e.target.value)}
                  placeholder="e.g. Site Lab 2"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>
            </div>
          </div>

          {/* Transfer Date */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
              Transfer Date <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>
          </div>

          {/* Issued By & Received By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                Issued By
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={issuedBy}
                  onChange={(e) => setIssuedBy(e.target.value)}
                  placeholder="Officer name"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                Received By <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  placeholder="e.g. John Doe (Site Eng)"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
              Remarks & Transfer Notes
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Issued for Phase 2 foundation testing"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Recording...' : 'Record Transfer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
