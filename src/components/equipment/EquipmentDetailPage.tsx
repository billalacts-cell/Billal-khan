import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, 
  ArrowRightLeft, 
  Wrench, 
  Camera, 
  Edit3, 
  Calendar, 
  MapPin, 
  Building, 
  Tag, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  FileText, 
  Upload, 
  Plus, 
  Image as ImageIcon,
  ShieldCheck,
  Hash
} from 'lucide-react';
import { EquipmentItem, MovementRecord, MaintenanceRecord, EquipmentPhoto } from '../../types';

interface EquipmentDetailPageProps {
  equipment: EquipmentItem;
  onBack: () => void;
  onOpenMovementModal: (equipment: EquipmentItem) => void;
  onOpenEditModal: (equipment: EquipmentItem) => void;
  onAddMaintenanceLog: (equipmentId: string, log: Omit<MaintenanceRecord, 'id'>) => Promise<void>;
  onUploadPhoto: (equipmentId: string, photo: Omit<EquipmentPhoto, 'id' | 'uploadedAt'>) => Promise<void>;
}

export const EquipmentDetailPage: React.FC<EquipmentDetailPageProps> = ({
  equipment,
  onBack,
  onOpenMovementModal,
  onOpenEditModal,
  onAddMaintenanceLog,
  onUploadPhoto,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'photos' | 'movements' | 'maintenance'>('details');
  const [isAddingMaint, setIsAddingMaint] = useState(false);
  const [maintType, setMaintType] = useState<'Inspection' | 'Repair' | 'Routine Maintenance' | 'Calibration'>('Calibration');
  const [maintPerformedBy, setMaintPerformedBy] = useState('');
  const [maintDetails, setMaintDetails] = useState('');
  const [maintCost, setMaintCost] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoType, setPhotoType] = useState<'main' | 'additional' | 'label'>('main');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUri = event.target?.result as string;
      if (dataUri) {
        await onUploadPhoto(equipment.id, {
          url: dataUri,
          caption: photoCaption.trim() || `${photoType} photo`,
          type: photoType
        });
        setPhotoCaption('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintDetails.trim()) return;
    await onAddMaintenanceLog(equipment.id, {
      date: new Date().toISOString().split('T')[0],
      type: maintType,
      performedBy: maintPerformedBy.trim() || 'Technician',
      details: maintDetails.trim(),
      cost: maintCost.trim() || undefined
    });
    setMaintDetails('');
    setMaintPerformedBy('');
    setMaintCost('');
    setIsAddingMaint(false);
  };

  const getStatusBadge = () => {
    switch (equipment.status) {
      case 'In Stock':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Assigned':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'Under Maintenance':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'Calibration Due':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getCalibrationBadge = () => {
    switch (equipment.calibrationStatus) {
      case 'Valid':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300';
      case 'Upcoming':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300';
      case 'Expired':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300';
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Navigation & Return */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition-all cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Equipment List</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenMovementModal(equipment)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Record Transfer</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenEditModal(equipment)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Record</span>
          </button>
        </div>
      </div>

      {/* Main Hero Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-sm font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                {equipment.id}
              </span>
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ${getStatusBadge()}`}>
                {equipment.status}
              </span>
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${getCalibrationBadge()}`}>
                Calibration: {equipment.calibrationStatus}
              </span>
              <span className="text-xs text-slate-400">
                Source: {equipment.source}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              {equipment.name}
            </h1>

            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap pt-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Building className="w-4 h-4 text-slate-400" />
                <span>Project: <strong className="text-slate-800 dark:text-slate-200">{equipment.currentProject}</strong></span>
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>Location: <strong className="text-slate-800 dark:text-slate-200">{equipment.currentLocation}</strong></span>
              </span>
            </div>
          </div>

          {/* Quick thumbnail if available */}
          {equipment.photos.length > 0 ? (
            <div className="w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shrink-0 bg-slate-100 dark:bg-slate-800">
              <img src={equipment.photos[0].url} alt={equipment.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 shrink-0 text-center p-2">
              <ImageIcon className="w-6 h-6 mb-1 text-slate-300" />
              <span className="text-[10px]">No photo</span>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 mt-8">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'details'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Technical Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('movements')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'movements'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>Movement History</span>
            <span className="px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px]">
              {equipment.movementHistory.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('photos')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'photos'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>Photographs</span>
            <span className="px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px]">
              {equipment.photos.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('maintenance')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'maintenance'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>Maintenance & Calibration</span>
            <span className="px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px]">
              {equipment.maintenanceHistory.length}
            </span>
          </button>
        </div>

        {/* Tab 1: Technical Details Grid */}
        {activeTab === 'details' && (
          <div className="pt-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
                <span className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">Equipment Category</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{equipment.category || 'Not recorded'}</span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
                <span className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">Manufacturer</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{equipment.manufacturer || 'Not recorded'}</span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
                <span className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">Model</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{equipment.model || 'Not recorded'}</span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
                <span className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">Serial Number</span>
                <span className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">{equipment.serialNumber || 'Not recorded'}</span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
                <span className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">Date Issued to Project</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{equipment.dateIssued || 'Not recorded'}</span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
                <span className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">Date Returned to Stock</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{equipment.dateReturned || 'Not recorded'}</span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
                <span className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">Calibration Due Date</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{equipment.calibrationDueDate || 'Not recorded'}</span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
                <span className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">Current Status</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{equipment.status}</span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
                <span className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">Registration Date</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {new Date(equipment.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Notes Section */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <span className="text-xs font-bold uppercase text-slate-400 block mb-1.5">Notes & Instructions</span>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                {equipment.notes || 'Not recorded.'}
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Movement History Audit Trail */}
        {activeTab === 'movements' && (
          <div className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Equipment Movement & Transfer Audit Trail
                </h3>
                <p className="text-xs text-slate-500">
                  Chronological record of project issuances, returns, and transfers
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenMovementModal(equipment)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Transfer Item</span>
              </button>
            </div>

            {equipment.movementHistory.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400">
                No transfer history recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {equipment.movementHistory.map((mov, i) => (
                  <div key={mov.id || i} className="p-4 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                          {mov.fromProject || 'Stock'} ({mov.fromLocation})
                        </span>
                        <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500" />
                        <span className="font-bold text-xs text-blue-600 dark:text-blue-400">
                          {mov.toProject} ({mov.toLocation})
                        </span>
                      </div>
                      {mov.remarks && (
                        <p className="text-xs text-slate-500 italic">
                          "{mov.remarks}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-slate-400 shrink-0">
                      <span>Date: <strong className="text-slate-700 dark:text-slate-300">{mov.transferDate}</strong></span>
                      <span>By: <strong className="text-slate-700 dark:text-slate-300">{mov.issuedBy}</strong></span>
                      <span>Recv: <strong className="text-slate-700 dark:text-slate-300">{mov.receivedBy}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Photographs */}
        {activeTab === 'photos' && (
          <div className="pt-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/40">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Upload Equipment Photograph
                </h4>
                <p className="text-[11px] text-slate-500">
                  Add main device photo, label/tag closeup, or condition photos
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={photoType}
                  onChange={(e) => setPhotoType(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <option value="main">Main Photo</option>
                  <option value="label">Asset Tag / Label</option>
                  <option value="additional">Additional Photo</option>
                </select>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Image</span>
                </button>
              </div>
            </div>

            {equipment.photos.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <Camera className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  No photographs uploaded yet
                </h4>
                <p className="text-[11px] text-slate-400">
                  Upload high-resolution equipment photos or asset tag labels for field reference.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {equipment.photos.map((p) => (
                  <div key={p.id} className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-800/40">
                    <div className="aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <img src={p.url} alt={p.caption} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-2.5 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{p.caption}</span>
                      <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                        {p.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Maintenance & Calibration */}
        {activeTab === 'maintenance' && (
          <div className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Maintenance & Calibration Records
                </h3>
                <p className="text-xs text-slate-500">
                  Inspection reports, routine maintenance, and certificates
                </p>
              </div>
              {!isAddingMaint && (
                <button
                  type="button"
                  onClick={() => setIsAddingMaint(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Service</span>
                </button>
              )}
            </div>

            {/* Add Maintenance Form Inline */}
            {isAddingMaint && (
              <form onSubmit={handleSaveMaintenance} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">Service Type</label>
                    <select
                      value={maintType}
                      onChange={(e) => setMaintType(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    >
                      <option value="Calibration">Calibration Verification</option>
                      <option value="Routine Maintenance">Routine Maintenance</option>
                      <option value="Repair">Repair / Overhaul</option>
                      <option value="Inspection">Safety Inspection</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">Performed By</label>
                    <input
                      type="text"
                      value={maintPerformedBy}
                      onChange={(e) => setMaintPerformedBy(e.target.value)}
                      placeholder="e.g. Lab Tech / Certified Vendor"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">Cost (Optional)</label>
                    <input
                      type="text"
                      value={maintCost}
                      onChange={(e) => setMaintCost(e.target.value)}
                      placeholder="e.g. $150.00"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Details & Certificate Number</label>
                  <textarea
                    rows={2}
                    value={maintDetails}
                    onChange={(e) => setMaintDetails(e.target.value)}
                    placeholder="Findings, calibration adjustments made, certificate ID, tolerance results..."
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingMaint(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
                  >
                    Save Service Record
                  </button>
                </div>
              </form>
            )}

            {/* List */}
            {equipment.maintenanceHistory.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400">
                No maintenance or calibration logs recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {equipment.maintenanceHistory.map((m) => (
                  <div key={m.id} className="p-4 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{m.type}</span>
                        <span className="text-[11px] text-slate-400">by {m.performedBy}</span>
                        {m.cost && <span className="text-[11px] text-emerald-600 font-semibold">{m.cost}</span>}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {m.details}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">{m.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
