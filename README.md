# Team Inbox

A minimal team task management application with ICE prioritization (Impact × Confidence × Ease). Built for small teams that need a simple, focused tool for managing priorities.

## Features

- **ICE Scoring**: Tasks prioritized by Impact × Confidence × Ease (1-5 scale each)
- **Team Management**: Add/remove team members for task assignment
- **Real-time Sync**: Firebase Firestore for live collaboration
- **Filtering & Search**: Find tasks by assignee, completion status, or text search
- **Import/Export**: JSON backup and restore functionality
- **Keyboard Shortcuts**: N for new tasks, K for filters, / for search, D for toggle done, E for export, R for clear completed

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **UI**: shadcn/ui components with Tailwind CSS
- **Database**: Firebase Firestore
- **Authentication**: Clerk
- **Deployment**: Vercel

## Development Setup

### Prerequisites

- Node.js 18+
- Firebase project with Firestore enabled
- Clerk account for authentication

### Environment Variables

Pull the latest environment variables from Vercel:

```bash
npm run env:pull:dev
```

Available scripts:
- `npm run env:pull` - Pull all environments
- `npm run env:pull:dev` - Development only
- `npm run env:pull:preview` - Preview only  
- `npm run env:pull:production` - Production only

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start Firebase emulators** (in separate terminal):
   ```bash
   npm run firebase:emulators
   ```
   This starts both Firestore (port 8080) and Auth (port 9099) emulators.
   
   Or run both services together:
   ```bash
   npm run dev:full
   ```

3. **Run the development server** (if not using dev:full):
   ```bash
   npm run dev
   ```

4. **Open** [http://localhost:3000](http://localhost:3000)

### Troubleshooting

**Firebase Permission Denied Errors:**
- Ensure Firebase emulators are running: `npm run firebase:emulators` 
- Check that both Firestore (port 8080) and Auth (port 9099) emulators are running
- Look for "🔥 Connected to Firestore emulator" and "🔥 Connected to Auth emulator" messages in console

**Firebase Custom Token Errors:**
- Make sure Firebase Auth emulator is running on port 9099
- Look for "✅ Successfully created Firebase custom token" message in API logs
- If you see credential errors, ensure you're using the emulator, not production

**Clerk Development Key Warnings:**
- Normal in development, will be resolved in production
- Indicates you're using development keys correctly

**"false for 'list'" Firestore Errors:**
- Usually means the app is connecting to production Firestore instead of emulator
- Restart both emulators and dev server
- Check console for emulator connection messages

### Firebase Emulator Configuration

The app automatically connects to Firebase emulators when running in development mode:
- **Firestore Emulator**: `localhost:8080`
- **Auth Emulator**: `localhost:9099`

### Authentication

The app uses a hybrid authentication approach combining Clerk and Firebase:

#### How Authentication Works
1. **Primary Authentication**: Clerk handles user sign-in/sign-up and session management
2. **Database Authentication**: Firebase custom tokens provide secure Firestore access
3. **Token Flow**: 
   - User signs in with Clerk
   - App calls `/api/auth/firebase-token` endpoint
   - Server verifies Clerk session and generates Firebase custom token
   - Client authenticates with Firebase using the custom token
   - Firestore operations now work with proper authentication

#### Implementation Details
- **API Endpoint**: `/src/app/api/auth/firebase-token/route.ts` - Generates Firebase custom tokens
- **Firebase Admin**: `/src/lib/firebase-admin.ts` - Server-side Firebase configuration
- **Client Auth**: `authenticateWithFirebase()` function handles token exchange
- **Automatic**: Authentication happens automatically when user loads the app

#### Development vs Production
- **Development**: Uses Firebase Auth emulator (localhost:9099) with simplified admin setup
- **Production**: Requires Firebase service account credentials in environment variables

#### Environment Variables Needed for Production
```env
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=your-service-account-email
FIREBASE_ADMIN_PRIVATE_KEY=your-service-account-private-key
```

This approach provides the best of both worlds: Clerk's excellent user management with Firebase's robust database security rules.

## Security Notice

⚠️ **This application has minimal security rules and is designed for internal team use only.** 

Current security approach:
- Users must be authenticated via Clerk
- All authenticated users can view/edit all tasks and team members
- No role-based permissions or data isolation between teams
- Suitable for small, trusted teams working on shared priorities

The application now has proper authentication-based security rules, but all authenticated users can access all team data - suitable for small trusted teams working together.

## Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run env:pull` - Pull environment variables from Vercel

## Project Structure

```
src/
├── app/                    # Next.js app router pages
├── components/
│   ├── ui/                # shadcn/ui components
│   └── team-inbox/        # Main application component
├── lib/
│   ├── firebase.ts        # Client-side Firebase configuration
│   └── firebase-admin.ts  # Server-side Firebase Admin SDK
├── types/
│   └── task.ts           # TypeScript definitions
└── utils/
    ├── firestore.ts      # Firestore operations
    ├── task-scoring.ts   # ICE scoring logic
    ├── storage.ts        # Local preferences
    └── import-export.ts  # JSON backup/restore
```

## Deployment

The app is configured for deployment on Vercel. Environment variables are managed through the Vercel dashboard.

## Future Enhancements

This MVP is structured for easy extension:
- Role-based permissions
- Team workspaces
- Advanced filtering
- Task templates
- Due dates and reminders
- Integration with external tools