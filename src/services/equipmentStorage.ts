import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  onSnapshot
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured, handleFirestoreError, OperationType } from '../firebase';
import { EquipmentItem, MovementRecord, MaintenanceRecord, EquipmentPhoto } from '../types';

const EQUIPMENT_STORAGE_KEY = 'my_notes_hub_equipment_v1';
const SHEET_META_KEY = 'my_notes_hub_sheet_sync_meta_v1';

// In-memory subscribers to keep all components in the active window synchronized immediately
export const equipmentSubscribers = new Set<(items: EquipmentItem[]) => void>();

export function notifyEquipmentSubscribers(items: EquipmentItem[]) {
  equipmentSubscribers.forEach((fn) => {
    try {
      fn(items);
    } catch (err) {
      console.error('Error notifying equipment subscriber:', err);
    }
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('my_notes_hub_equipment_change', { detail: items }));
  }
}

/**
 * Reads local equipment records
 */
export function getLocalEquipment(): EquipmentItem[] {
  try {
    const raw = localStorage.getItem(EQUIPMENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      const opt = item.calibrationCategory === 'External Calibration' ? 'External Calibration' : 'Internal Calibration';
      return {
        ...item,
        calibrationCategory: opt
      };
    });
  } catch (err) {
    console.error('Error reading equipment from localStorage:', err);
    return [];
  }
}

/**
 * Saves equipment records to localStorage
 */
export function saveLocalEquipment(items: EquipmentItem[]): void {
  try {
    localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Error writing equipment to localStorage:', err);
  }
}

/**
 * Subscribes to equipment records
 */
export function subscribeToEquipment(
  onUpdate: (items: EquipmentItem[]) => void,
  onError?: (err: Error) => void
): () => void {
  // Always register in-memory listener so local modifications trigger immediate updates
  equipmentSubscribers.add(onUpdate);

  const currentUser = auth?.currentUser;

  // Custom event listener for same-window updates
  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent<EquipmentItem[]>;
    if (custom.detail) {
      onUpdate(custom.detail);
    } else {
      onUpdate(getLocalEquipment());
    }
  };

  // Cross-tab storage change listener
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === EQUIPMENT_STORAGE_KEY) {
      onUpdate(getLocalEquipment());
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('my_notes_hub_equipment_change', handleCustomEvent);
    window.addEventListener('storage', handleStorageChange);
  }

  // Provide initial data immediately from local storage
  const initialLocal = getLocalEquipment();
  onUpdate(initialLocal);

  let unsubscribeFirestore: (() => void) | null = null;

  if (isFirebaseConfigured && db && currentUser) {
    const colRef = collection(db, 'equipment');
    const q = query(colRef);

    try {
      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          if (snapshot.empty) {
            // Keep local equipment if Firestore is empty
            const local = getLocalEquipment();
            onUpdate(local);
            return;
          }

          const items: EquipmentItem[] = [];
          snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            items.push({
              id: d.id || docSnap.id,
              name: d.name || 'Unnamed Equipment',
              category: d.category || 'General Equipment',
              manufacturer: d.manufacturer || 'Not recorded',
              model: d.model || 'Not recorded',
              serialNumber: d.serialNumber || 'Not recorded',
              currentProject: d.currentProject || 'In Stock',
              currentLocation: d.currentLocation || 'Main Store',
              status: d.status || 'In Stock',
              dateIssued: d.dateIssued || null,
              dateReturned: d.dateReturned || null,
              calibrationDueDate: d.calibrationDueDate || null,
              calibrationStatus: d.calibrationStatus || 'Not Applicable',
              notes: d.notes || '',
              photos: Array.isArray(d.photos) ? d.photos : [],
              certificates: Array.isArray(d.certificates) ? d.certificates : [],
              maintenanceHistory: Array.isArray(d.maintenanceHistory) ? d.maintenanceHistory : [],
              movementHistory: Array.isArray(d.movementHistory) ? d.movementHistory : [],
              createdAt: typeof d.createdAt === 'number' ? d.createdAt : Date.now(),
              updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : Date.now(),
              source: d.source || 'manual'
            });
          });

          items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          // Update local cache and state
          saveLocalEquipment(items);
          onUpdate(items);
        },
        (error) => {
          console.warn('Firestore equipment subscription notice (operating locally):', error?.message || error);
          if (onError) onError(error);
          onUpdate(getLocalEquipment());
        }
      );
    } catch (err) {
      console.warn('Error establishing Firestore onSnapshot:', err);
    }
  }

  return () => {
    equipmentSubscribers.delete(onUpdate);
    if (typeof window !== 'undefined') {
      window.removeEventListener('my_notes_hub_equipment_change', handleCustomEvent);
      window.removeEventListener('storage', handleStorageChange);
    }
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
    }
  };
}

/**
 * Creates or updates an equipment record
 * Writes to local storage and dispatches update immediately so UI never hangs
 */
export async function saveEquipmentItem(item: EquipmentItem): Promise<EquipmentItem> {
  const currentUser = auth?.currentUser;
  const now = Date.now();
  const updatedItem: EquipmentItem = {
    ...item,
    updatedAt: now,
    createdAt: item.createdAt || now
  };

  // 1. Immediately update localStorage and notify all subscribers
  const current = getLocalEquipment();
  const existingIdx = current.findIndex((e) => e.id.toLowerCase() === updatedItem.id.toLowerCase());
  let nextList: EquipmentItem[];
  if (existingIdx >= 0) {
    nextList = [...current];
    nextList[existingIdx] = updatedItem;
  } else {
    nextList = [updatedItem, ...current];
  }
  saveLocalEquipment(nextList);
  notifyEquipmentSubscribers(nextList);

  // 2. Non-blocking Firestore background sync with timeout
  if (isFirebaseConfigured && db && currentUser) {
    Promise.race([
      setDoc(doc(db, 'equipment', updatedItem.id), updatedItem, { merge: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 2500))
    ]).catch((err) => {
      console.warn('Background sync equipment notice:', err?.message || err);
    });
  }

  return updatedItem;
}

/**
 * Merges a batch of equipment items (from Google Sheets or CSV) using equipment ID as unique key
 */
export async function mergeEquipmentBatch(newItems: EquipmentItem[]): Promise<EquipmentItem[]> {
  const current = getLocalEquipment();
  const itemMap = new Map<string, EquipmentItem>();

  // Insert current items
  current.forEach((item) => itemMap.set(item.id.toLowerCase(), item));

  // Merge new items
  newItems.forEach((incoming) => {
    const key = incoming.id.toLowerCase();
    const existing = itemMap.get(key);
    if (existing) {
      // Merge while preserving existing custom photos and movement history
      itemMap.set(key, {
        ...incoming,
        photos: existing.photos.length > 0 ? existing.photos : incoming.photos,
        certificates: existing.certificates.length > 0 ? existing.certificates : incoming.certificates,
        movementHistory: [
          ...(incoming.movementHistory || []),
          ...(existing.movementHistory || [])
        ],
        maintenanceHistory: [
          ...(incoming.maintenanceHistory || []),
          ...(existing.maintenanceHistory || [])
        ],
        updatedAt: Date.now()
      });
    } else {
      itemMap.set(key, incoming);
    }
  });

  const merged = Array.from(itemMap.values());
  saveLocalEquipment(merged);
  notifyEquipmentSubscribers(merged);

  // Non-blocking background sync to Firestore if signed in
  const currentUser = auth?.currentUser;
  if (isFirebaseConfigured && db && currentUser) {
    (async () => {
      for (const item of newItems) {
        try {
          await Promise.race([
            setDoc(doc(db, 'equipment', item.id), item, { merge: true }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
          ]);
        } catch {
          // Continue background batch
        }
      }
    })();
  }

  return merged;
}

/**
 * Record equipment transfer/movement
 * Updates currentProject and currentLocation, and appends to movementHistory audit trail
 */
export async function recordEquipmentMovement(
  equipmentId: string,
  movement: Omit<MovementRecord, 'id' | 'timestamp'>
): Promise<void> {
  const current = getLocalEquipment();
  const target = current.find((e) => e.id.toLowerCase() === equipmentId.toLowerCase());
  if (!target) return;

  const now = Date.now();
  const newMovementRecord: MovementRecord = {
    ...movement,
    id: `mov_${now}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: now
  };

  const updatedTarget: EquipmentItem = {
    ...target,
    currentProject: movement.toProject,
    currentLocation: movement.toLocation,
    status: movement.toProject.toLowerCase().includes('stock') ? 'In Stock' : 'Assigned',
    dateIssued: movement.toProject.toLowerCase().includes('stock') ? target.dateIssued : movement.transferDate,
    dateReturned: movement.toProject.toLowerCase().includes('stock') ? movement.transferDate : target.dateReturned,
    movementHistory: [newMovementRecord, ...(target.movementHistory || [])],
    updatedAt: now
  };

  await saveEquipmentItem(updatedTarget);
}

/**
 * Add a maintenance record
 */
export async function addMaintenanceRecord(
  equipmentId: string,
  record: Omit<MaintenanceRecord, 'id'>
): Promise<void> {
  const current = getLocalEquipment();
  const target = current.find((e) => e.id.toLowerCase() === equipmentId.toLowerCase());
  if (!target) return;

  const newLog: MaintenanceRecord = {
    ...record,
    id: `maint_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  };

  const updatedTarget: EquipmentItem = {
    ...target,
    maintenanceHistory: [newLog, ...(target.maintenanceHistory || [])],
    updatedAt: Date.now()
  };

  await saveEquipmentItem(updatedTarget);
}

/**
 * Add a photo to equipment record
 */
export async function addEquipmentPhoto(
  equipmentId: string,
  photo: Omit<EquipmentPhoto, 'id' | 'uploadedAt'>
): Promise<void> {
  const current = getLocalEquipment();
  const target = current.find((e) => e.id.toLowerCase() === equipmentId.toLowerCase());
  if (!target) return;

  const newPhoto: EquipmentPhoto = {
    ...photo,
    id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    uploadedAt: Date.now()
  };

  const updatedTarget: EquipmentItem = {
    ...target,
    photos: [newPhoto, ...(target.photos || [])],
    updatedAt: Date.now()
  };

  await saveEquipmentItem(updatedTarget);
}

/**
 * Delete equipment item
 */
export async function deleteEquipmentItem(id: string): Promise<void> {
  const currentUser = auth?.currentUser;

  // 1. Immediately update local storage and notify subscribers
  const current = getLocalEquipment();
  const filtered = current.filter((e) => e.id.toLowerCase() !== id.toLowerCase());
  saveLocalEquipment(filtered);
  notifyEquipmentSubscribers(filtered);

  // 2. Non-blocking Firestore delete with timeout
  if (isFirebaseConfigured && db && currentUser) {
    Promise.race([
      deleteDoc(doc(db, 'equipment', id)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 2500))
    ]).catch((err) => {
      console.warn('Notice deleting equipment from Firestore:', err);
    });
  }
}

/**
 * Delete multiple equipment items in batch
 */
export async function deleteEquipmentBatch(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  const currentUser = auth?.currentUser;
  const idSet = new Set(ids.map((i) => i.toLowerCase()));

  // 1. Immediately update local storage and notify subscribers
  const current = getLocalEquipment();
  const filtered = current.filter((e) => !idSet.has(e.id.toLowerCase()));
  saveLocalEquipment(filtered);
  notifyEquipmentSubscribers(filtered);

  // 2. Non-blocking Firestore delete
  if (isFirebaseConfigured && db && currentUser) {
    const firestoreDb = db;
    Promise.allSettled(
      ids.map((id) =>
        Promise.race([
          deleteDoc(doc(firestoreDb, 'equipment', id)),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 2500))
        ])
      )
    ).catch((err) => {
      console.warn('Notice batch deleting equipment from Firestore:', err);
    });
  }
}

