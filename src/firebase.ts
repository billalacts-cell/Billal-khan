import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User,
  Auth 
} from 'firebase/auth';
import { 
  getFirestore, 
  Firestore, 
  doc, 
  getDocFromServer 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export const isFirebaseConfigured: boolean = Boolean(
  firebaseConfig && 
  firebaseConfig.apiKey && 
  firebaseConfig.projectId && 
  firebaseConfig.projectId !== 'remixed-project-id'
);

let app: any = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

// In-memory cache for OAuth access token per Workspace Integration Skill
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const googleProvider = new GoogleAuthProvider();
// Add Google Sheets and Gmail scopes
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.send');

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    authInstance = getAuth(app);
    const dbId = (firebaseConfig as any).firestoreDatabaseId;
    dbInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);
  } catch (err) {
    console.warn('Firebase initialization notice:', err);
  }
}

export const auth = authInstance;
export const db = dbInstance;

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  if (!db) return false;
  try {
    await Promise.race([
      getDocFromServer(doc(db, 'test', 'connection')),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('connection timeout')), 2500))
    ]);
    return true;
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes('has not been used in project') ||
        error.message.includes('disabled') ||
        error.message.includes('offline') ||
        error.message.includes('timeout')
      ) {
        return false;
      }
      // If genuine permission-denied from existing active database rules or not-found, Firestore is online
      if (error.message.includes('permission') || error.message.includes('not-found')) {
        return true;
      }
    }
    return false;
  }
}

/**
 * Sign in with Google using popup and cache OAuth access token in-memory
 */
export async function signInWithGoogle(): Promise<{ user: User; accessToken: string | null }> {
  if (!auth) {
    throw new Error('Firebase Auth is not configured yet.');
  }
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

/**
 * Returns currently cached OAuth access token in-memory
 */
export async function getAccessToken(): Promise<string | null> {
  return cachedAccessToken;
}

/**
 * Set or refresh in-memory access token
 */
export function setCachedAccessToken(token: string | null): void {
  cachedAccessToken = token;
}

export async function logoutUser(): Promise<void> {
  if (auth) {
    await signOut(auth);
  }
  cachedAccessToken = null;
}

export { onAuthStateChanged };
export type { User };
