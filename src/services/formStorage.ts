import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  getDocs
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured, handleFirestoreError, OperationType } from '../firebase';
import { GoogleFormItem, INITIAL_DEFAULT_FORMS, DEFAULT_CATEGORIES } from '../types';

const LOCAL_STORAGE_KEY = 'my_notes_hub_forms_v3';
const CATEGORIES_KEY = 'my_notes_hub_categories_v3';

// In-memory subscribers to keep all components in the active window synchronized immediately
const formSubscribers = new Set<(forms: GoogleFormItem[]) => void>();

function notifyFormSubscribers(forms: GoogleFormItem[]) {
  formSubscribers.forEach((fn) => {
    try {
      fn(forms);
    } catch (err) {
      console.error('Error notifying form subscriber:', err);
    }
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('my_notes_hub_forms_change', { detail: forms }));
  }
}

/**
 * Get initial local forms from localStorage or fallback to defaults
 */
export function getLocalForms(): GoogleFormItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      // Check if previous version had custom user-added forms
      const prevRaw = localStorage.getItem('my_notes_hub_forms_v2');
      if (prevRaw) {
        try {
          const prevParsed = JSON.parse(prevRaw);
          if (Array.isArray(prevParsed)) {
            const customForms = prevParsed.filter(
              (f) => !f.id.startsWith('default-form-') && f.url !== INITIAL_DEFAULT_FORMS[0].url && f.url !== INITIAL_DEFAULT_FORMS[1].url
            );
            const combined = [...INITIAL_DEFAULT_FORMS, ...customForms];
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(combined));
            return combined;
          }
        } catch {
          // Ignore
        }
      }

      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_DEFAULT_FORMS));
      return INITIAL_DEFAULT_FORMS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_DEFAULT_FORMS));
      return INITIAL_DEFAULT_FORMS;
    }
    return parsed;
  } catch (e) {
    console.error('Error reading forms from localStorage:', e);
    return INITIAL_DEFAULT_FORMS;
  }
}

/**
 * Save forms to local storage
 */
export function saveLocalForms(forms: GoogleFormItem[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(forms));
  } catch (e) {
    console.error('Error saving forms to localStorage:', e);
  }
}

/**
 * Get list of all known categories (default + custom)
 */
export function getStoredCategories(): string[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    if (!raw) {
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES));
      return DEFAULT_CATEGORIES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_CATEGORIES;
    // Ensure all default categories are always present
    const combined = Array.from(new Set([...DEFAULT_CATEGORIES, ...parsed]));
    return combined;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export function saveCategory(newCategory: string): string[] {
  const trimmed = newCategory.trim();
  if (!trimmed) return getStoredCategories();
  const current = getStoredCategories();
  if (!current.includes(trimmed)) {
    const updated = [...current, trimmed];
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(updated));
    return updated;
  }
  return current;
}

/**
 * Subscribe to forms. Provides immediate local data, updates on local changes in same tab,
 * and syncs with Firestore when available without hanging.
 */
export function subscribeToForms(
  onUpdate: (forms: GoogleFormItem[]) => void,
  onError?: (err: Error) => void
): () => void {
  // Always register in-memory listener so local creations/edits update UI immediately
  formSubscribers.add(onUpdate);

  const currentUser = auth?.currentUser;

  // Custom event listener for same-window updates
  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent<GoogleFormItem[]>;
    if (custom.detail) {
      onUpdate(custom.detail);
    } else {
      onUpdate(getLocalForms());
    }
  };

  // Cross-tab storage change listener
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === LOCAL_STORAGE_KEY) {
      onUpdate(getLocalForms());
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('my_notes_hub_forms_change', handleCustomEvent);
    window.addEventListener('storage', handleStorageChange);
  }

  // Provide initial data immediately from local storage
  const initialLocal = getLocalForms();
  onUpdate(initialLocal);

  let unsubscribeFirestore: (() => void) | null = null;

  // Use Firestore only if configured, db ready, and user is signed in
  if (isFirebaseConfigured && db && currentUser) {
    const formsCol = collection(db, 'forms');
    const q = query(formsCol, where('ownerId', '==', currentUser.uid));

    try {
      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          if (snapshot.empty) {
            // If Firestore is empty for this user, seed with initial default forms in background
            seedInitialFirestoreForms(currentUser.uid).catch(() => {});
            onUpdate(getLocalForms());
            return;
          }

          const items: GoogleFormItem[] = [];
          snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            items.push({
              id: d.id || docSnap.id,
              title: d.title || 'Untitled Form',
              url: d.url || '',
              category: d.category || 'Other',
              description: d.description || '',
              color: d.color || 'blue',
              createdAt: typeof d.createdAt === 'number' ? d.createdAt : Date.now(),
              updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : Date.now(),
              lastOpenedAt: d.lastOpenedAt || null,
              openCount: d.openCount || 0,
              isStarred: Boolean(d.isStarred),
              userId: d.ownerId
            });
          });

          // Sort by updatedAt descending
          items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          saveLocalForms(items);
          onUpdate(items);
        },
        (error) => {
          console.warn('Firestore forms subscription notice (operating locally):', error?.message || error);
          if (onError) {
            onError(error);
          }
          onUpdate(getLocalForms());
        }
      );
    } catch (err) {
      console.warn('Error setting up forms Firestore subscription:', err);
    }
  }

  return () => {
    formSubscribers.delete(onUpdate);
    if (typeof window !== 'undefined') {
      window.removeEventListener('my_notes_hub_forms_change', handleCustomEvent);
      window.removeEventListener('storage', handleStorageChange);
    }
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
    }
  };
}

/**
 * Seed initial forms in Firestore for new users (migrating local forms if present)
 */
async function seedInitialFirestoreForms(uid: string): Promise<void> {
  if (!db) return;
  const localForms = getLocalForms();
  const formsToSeed = localForms.length > 0 ? localForms : INITIAL_DEFAULT_FORMS;

  for (const item of formsToSeed) {
    try {
      await Promise.race([
        setDoc(doc(db, 'forms', item.id), {
          id: item.id,
          title: item.title,
          url: item.url,
          category: item.category,
          description: item.description || '',
          color: item.color || 'blue',
          ownerId: uid,
          createdAt: item.createdAt || Date.now(),
          updatedAt: item.updatedAt || Date.now(),
          lastOpenedAt: item.lastOpenedAt || null,
          openCount: item.openCount || 0,
          isStarred: Boolean(item.isStarred)
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
      ]);
    } catch {
      // Continue background seeding
    }
  }
}

/**
 * Add or create a new form
 * Saves locally and notifies listeners immediately so the UI never gets stuck
 */
export async function createForm(form: Omit<GoogleFormItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<GoogleFormItem> {
  const currentUser = auth?.currentUser;
  const newId = 'form_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  const now = Date.now();

  const newForm: GoogleFormItem = {
    ...form,
    id: newId,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: null,
    openCount: 0,
    isStarred: Boolean(form.isStarred),
    userId: currentUser?.uid
  };

  // 1. Immediately save to local storage and notify all subscribers
  const current = getLocalForms();
  const updated = [newForm, ...current];
  saveLocalForms(updated);
  notifyFormSubscribers(updated);

  // 2. Non-blocking Firestore background sync with timeout
  if (isFirebaseConfigured && db && currentUser) {
    Promise.race([
      setDoc(doc(db, 'forms', newId), {
        id: newForm.id,
        title: newForm.title,
        url: newForm.url,
        category: newForm.category,
        description: newForm.description || '',
        color: newForm.color || 'blue',
        ownerId: currentUser.uid,
        createdAt: newForm.createdAt,
        updatedAt: newForm.updatedAt,
        lastOpenedAt: null,
        openCount: 0,
        isStarred: newForm.isStarred
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 2500))
    ]).catch((err) => {
      console.warn('Background sync notice for form to Firestore:', err?.message || err);
    });
  }

  return newForm;
}

/**
 * Update an existing form
 * Updates locally and notifies listeners immediately so the UI never gets stuck
 */
export async function updateForm(id: string, updates: Partial<GoogleFormItem>): Promise<void> {
  const currentUser = auth?.currentUser;
  const now = Date.now();

  // 1. Immediately update local storage and notify subscribers
  const current = getLocalForms();
  const updatedList = current.map((item) => {
    if (item.id === id) {
      return {
        ...item,
        ...updates,
        updatedAt: now
      };
    }
    return item;
  });
  saveLocalForms(updatedList);
  notifyFormSubscribers(updatedList);

  // 2. Non-blocking Firestore background sync with timeout
  if (isFirebaseConfigured && db && currentUser) {
    const payload: Record<string, any> = {
      updatedAt: now
    };
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.url !== undefined) payload.url = updates.url;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.color !== undefined) payload.color = updates.color;
    if (updates.lastOpenedAt !== undefined) payload.lastOpenedAt = updates.lastOpenedAt;
    if (updates.openCount !== undefined) payload.openCount = updates.openCount;
    if (updates.isStarred !== undefined) payload.isStarred = updates.isStarred;

    Promise.race([
      updateDoc(doc(db, 'forms', id), payload),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 2500))
    ]).catch((err) => {
      console.warn('Background update notice for form to Firestore:', err?.message || err);
    });
  }
}

/**
 * Delete a form
 * Deletes locally and notifies listeners immediately
 */
export async function deleteForm(id: string): Promise<void> {
  const currentUser = auth?.currentUser;

  // 1. Immediately remove from local storage and notify subscribers
  const current = getLocalForms();
  const filtered = current.filter((item) => item.id !== id);
  saveLocalForms(filtered);
  notifyFormSubscribers(filtered);

  // 2. Non-blocking Firestore delete with timeout
  if (isFirebaseConfigured && db && currentUser) {
    Promise.race([
      deleteDoc(doc(db, 'forms', id)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 2500))
    ]).catch((err) => {
      console.warn('Background delete notice for form from Firestore:', err?.message || err);
    });
  }
}

/**
 * Record an open action (increments open count and updates lastOpenedAt)
 */
export async function recordFormOpen(id: string, currentCount: number = 0): Promise<void> {
  const now = Date.now();
  await updateForm(id, {
    lastOpenedAt: now,
    openCount: (currentCount || 0) + 1
  });
}
