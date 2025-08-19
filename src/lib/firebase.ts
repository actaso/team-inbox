import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Connect to emulators in development (browser only)
let emulatorsConnected = false;
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  if (!emulatorsConnected) {
    console.log('🔥 Firebase Client SDK: Connecting to emulators...');

    try {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      console.log('   ✅ Auth emulator connected: http://localhost:9099');
    } catch {
      console.log('   ⚠️ Auth emulator connection skipped (likely already connected)');
    }

    try {
      connectFirestoreEmulator(db, 'localhost', 8080);
      console.log('   ✅ Firestore emulator connected: localhost:8080');
    } catch {
      console.log('   ⚠️ Firestore emulator connection skipped (likely already connected)');
    }

    try {
      connectStorageEmulator(storage, 'localhost', 9199);
      console.log('   ✅ Storage emulator connected: localhost:9199');
    } catch {
      console.log('   ⚠️ Storage emulator connection skipped (likely already connected)');
    }

    emulatorsConnected = true;
  }
}

export { app };