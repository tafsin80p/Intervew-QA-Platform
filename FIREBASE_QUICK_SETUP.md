# Quick Firebase Setup Guide

## Step 1: Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Add project" or select an existing project
3. Follow the setup wizard

## Step 2: Enable Firestore Database

1. In Firebase Console, click "Firestore Database" in the left menu
2. Click "Create database"
3. Select **"Start in test mode"** (for development)
4. Choose a location (e.g., us-central1)
5. Click "Enable"

## Step 3: Get Your Firebase Config

1. In Firebase Console, click the gear icon ⚙️ next to "Project Overview"
2. Scroll down to "Your apps" section
3. If you don't have a web app, click the web icon `</>` to add one
4. Register your app with a nickname (e.g., "WordPress Quiz")
5. You'll see a config object like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## Step 4: Create .env File

1. In your project root directory (`C:\interview\WordPress QA`), create a file named `.env`
2. Add the following content (replace with YOUR values from Step 3):

```env
VITE_FIREBASE_API_KEY=AIzaSy...your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

## Step 5: Restart Development Server

After creating the `.env` file:

1. Stop the current dev server (Ctrl+C)
2. Run: `npm run dev`
3. The Firestore connection should now work!

## Firestore Security Rules (Test Mode)

For development, test mode allows read/write access. For production, update rules in Firebase Console > Firestore Database > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /quiz_results/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Troubleshooting

- **Still showing "Disconnected"**: 
  - Make sure `.env` file is in the project root
  - Restart the dev server after creating `.env`
  - Check that all 6 environment variables are set correctly
  - No spaces around the `=` sign in `.env` file

- **Connection errors**: 
  - Verify your Firebase project is active
  - Check that Firestore Database is enabled
  - Ensure your network allows Firebase connections



