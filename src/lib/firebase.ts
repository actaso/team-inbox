import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);

// Connect to Firestore emulator in development
if (process.env.NODE_ENV === 'development') {
  const isFirestoreConnected = (db as unknown as { _delegate?: { _databaseId?: { projectId?: string } } })._delegate?._databaseId?.projectId?.includes('demo-');
  
  if (!isFirestoreConnected) {
    try {
      connectFirestoreEmulator(db, 'localhost', 8080);
      console.log('🔥 Connected to Firestore emulator');
    } catch (error) {
      console.log('Firestore emulator connection failed - make sure emulators are running:', error);
    }
  }
}

export { app };