export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createCustomToken } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    // Use auth.protect() for robust authentication check
    const { userId } = await auth.protect();

    // Extract any additional claims from the request body
    const body = await request.json().catch(() => ({}));
    const additionalClaims = body.claims || {};

    // Add user ID to claims for Firestore security rules
    const claims = {
      ...additionalClaims,
      clerk_user_id: userId,
    } as Record<string, unknown>;

    // Create Firebase custom token using the Clerk user ID
    const customToken = await createCustomToken(userId, claims);

    return NextResponse.json({
      token: customToken,
      uid: userId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


