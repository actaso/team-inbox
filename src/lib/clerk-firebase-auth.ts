import { signInWithCustomToken, signOut } from 'firebase/auth';
import { auth } from './firebase';

type TokenExchangeResponse = {
  token: string;
  uid: string;
};

export const exchangeClerkTokenForFirebase = async (): Promise<TokenExchangeResponse> => {
  try {
    const response = await fetch('/api/auth/firebase-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Failed to exchange Clerk token for Firebase token');
    }

    const data = (await response.json()) as TokenExchangeResponse;
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during token exchange';
    throw new Error(message);
  }
};

export const signInWithClerkToken = async (): Promise<void> => {
  try {
    // Exchange Clerk token for Firebase custom token
    const { token } = await exchangeClerkTokenForFirebase();

    // Sign in to Firebase with the custom token
    await signInWithCustomToken(auth, token);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during Firebase sign-in';
    throw new Error(message);
  }
};

export const signOutFromFirebase = async (): Promise<void> => {
  await signOut(auth);
};


