'use client'

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { signInWithClerkToken, signOutFromFirebase } from '../lib/clerk-firebase-auth';

type UseFirebaseAuthResult = {
  firebaseUser: FirebaseUser | null;
  isExchangingToken: boolean;
  error: string | null;
};

export function useFirebaseAuth(): UseFirebaseAuthResult {
  const { isLoaded: clerkLoaded, user: clerkUser } = useUser();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [isExchangingToken, setIsExchangingToken] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep local state in sync with Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setFirebaseUser);
    return unsubscribe;
  }, []);

  // Exchange Clerk token for Firebase token when Clerk user changes
  useEffect(() => {
    const handleTokenExchange = async () => {
      if (!clerkLoaded) return;

      try {
        if (clerkUser && !firebaseUser) {
          // Clerk user is signed in but Firebase user is not - exchange tokens
          setIsExchangingToken(true);
          setError(null);
          await signInWithClerkToken();
        } else if (!clerkUser && firebaseUser) {
          // Clerk user is signed out but Firebase user is still signed in - sign out from Firebase
          await signOutFromFirebase();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error during token exchange';
        setError(message);
      } finally {
        setIsExchangingToken(false);
      }
    };

    void handleTokenExchange();
  }, [clerkLoaded, clerkUser, firebaseUser]);

  return { firebaseUser, isExchangingToken, error };
}


