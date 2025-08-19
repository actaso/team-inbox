import { addPerson } from './firestore';

// Initialize current user as a team member if they don't exist
export const initializeCurrentUser = async (user: { id: string; firstName?: string | null; lastName?: string | null; emailAddresses: { emailAddress: string }[] }): Promise<void> => {
  try {
    // Get user's display name (prefer first name, fall back to email)
    const displayName = user.firstName || 
                       user.emailAddresses[0]?.emailAddress?.split('@')[0] || 
                       'User';
    
    // Add current user to team members (addPerson already handles duplicates)
    await addPerson(displayName);
    
    console.log(`✅ Initialized user: ${displayName}`);
  } catch (error) {
    console.error('Error initializing current user:', error);
  }
};