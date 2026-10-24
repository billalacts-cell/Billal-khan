import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../firebase';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'my_notes_hub_theme_mode';

/**
 * Returns stored theme mode or 'system' by default
 */
export function getInitialThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch (err) {
    console.error('Error reading theme from localStorage:', err);
  }
  return 'system';
}

/**
 * Determines whether dark mode is currently active given the mode
 */
export function resolveIsDark(mode: ThemeMode): boolean {
  if (typeof window === 'undefined') return false;
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Applies the dark class to document.documentElement
 */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const isDark = resolveIsDark(mode);
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Save theme preference to localStorage and Firestore if user is logged in
 */
export async function saveThemePreference(mode: ThemeMode): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (e) {
      console.error('Failed to save theme to localStorage:', e);
    }
  }

  // Non-blocking background save to Firestore for logged-in user if available
  const currentUser = auth?.currentUser;
  if (isFirebaseConfigured && db && currentUser) {
    Promise.race([
      setDoc(
        doc(db, 'userPreferences', currentUser.uid),
        { theme: mode, updatedAt: Date.now() },
        { merge: true }
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
    ]).catch(() => {
      // Gracefully ignore
    });
  }
}

/**
 * Fetch theme preference from Firestore for logged-in user
 */
export async function fetchUserThemePreference(userId: string): Promise<ThemeMode | null> {
  if (!isFirebaseConfigured || !db) return null;
  try {
    const snap = await getDoc(doc(db, 'userPreferences', userId));
    if (snap.exists()) {
      const data = snap.data();
      if (data?.theme === 'light' || data?.theme === 'dark' || data?.theme === 'system') {
        return data.theme as ThemeMode;
      }
    }
  } catch {
    // Graceful fallback
  }
  return null;
}
