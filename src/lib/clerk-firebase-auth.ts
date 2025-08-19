import { signInWithCustomToken, signOut } from 'firebase/auth';
import { auth } from './firebase';

type TokenExchangeResponse = {
  token: string;
  uid: string;
};

export const exchangeClerkTokenForFirebase = async (): Promise<TokenExchangeResponse> => {
  try {
    console.log('🔄 Requesting Firebase token from API...');
    const response = await fetch('/api/auth/firebase-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('📡 Token exchange API response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('❌ Token exchange API failed:', text);
      throw new Error(text || 'Failed to exchange Clerk token for Firebase token');
    }

    const data = (await response.json()) as TokenExchangeResponse;
    console.log('✅ Token exchange API success:', {
      hasToken: !!data.token,
      uid: data.uid,
      tokenLength: data.token?.length,
    });
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during token exchange';
    console.error('❌ Token exchange error:', error);
    throw new Error(message);
  }
};

export const signInWithClerkToken = async (): Promise<void> => {
  try {
    console.log('🔄 Starting Firebase sign-in with Clerk token...');
    
    // Exchange Clerk token for Firebase custom token
    const { token } = await exchangeClerkTokenForFirebase();
    
    console.log('🔄 Signing into Firebase with custom token...');
    // Sign in to Firebase with the custom token
    const userCredential = await signInWithCustomToken(auth, token);
    
    console.log('✅ Firebase sign-in successful:', {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during Firebase sign-in';
    console.error('❌ Firebase sign-in failed:', error);
    throw new Error(message);
  }
};

export const signOutFromFirebase = async (): Promise<void> => {
  await signOut(auth);
};


