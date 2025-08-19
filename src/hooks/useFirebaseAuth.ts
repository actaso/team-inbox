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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('🔥 Firebase Auth State Changed:', {
        uid: user?.uid,
        email: user?.email,
        isAnonymous: user?.isAnonymous,
        hasCustomClaims: !!user?.getIdTokenResult,
      });
      
      if (user) {
        // Log token claims for debugging
        user.getIdTokenResult().then((idTokenResult) => {
          console.log('🔥 Firebase Token Claims:', {
            clerk_user_id: idTokenResult.claims.clerk_user_id,
            uid: idTokenResult.claims.sub,
            aud: idTokenResult.claims.aud,
            iss: idTokenResult.claims.iss,
          });
        }).catch((err) => {
          console.error('❌ Failed to get Firebase token claims:', err);
        });
      }
      
      setFirebaseUser(user);
    });
    return unsubscribe;
  }, []);

  // Exchange Clerk token for Firebase token when Clerk user changes
  useEffect(() => {
    const handleTokenExchange = async () => {
      if (!clerkLoaded) {
        console.log('⏳ Clerk not loaded yet...');
        return;
      }

      console.log('🔄 Token Exchange Check:', {
        clerkUser: !!clerkUser,
        clerkUserId: clerkUser?.id,
        firebaseUser: !!firebaseUser,
        firebaseUid: firebaseUser?.uid,
      });

      try {
        if (clerkUser && !firebaseUser) {
          console.log('🔄 Starting token exchange: Clerk user exists but no Firebase user');
          setIsExchangingToken(true);
          setError(null);
          await signInWithClerkToken();
          console.log('✅ Token exchange completed successfully');
        } else if (!clerkUser && firebaseUser) {
          console.log('🔄 Signing out from Firebase: No Clerk user but Firebase user exists');
          await signOutFromFirebase();
          console.log('✅ Firebase sign-out completed');
        } else if (clerkUser && firebaseUser) {
          console.log('✅ Both Clerk and Firebase users exist - no action needed');
        } else {
          console.log('ℹ️ No Clerk or Firebase users - no action needed');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error during token exchange';
        console.error('❌ Token exchange failed:', err);
        setError(message);
      } finally {
        setIsExchangingToken(false);
      }
    };

    void handleTokenExchange();
  }, [clerkLoaded, clerkUser, firebaseUser]);

  return { firebaseUser, isExchangingToken, error };
}


