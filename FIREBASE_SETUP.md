# Firebase/Firestore Setup Guide

This project uses Firebase Firestore to store detailed quiz results for the admin dashboard.

## Setup Instructions

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard

### 2. Enable Firestore Database

1. In your Firebase project, go to "Firestore Database"
2. Click "Create database"
3. Start in **test mode** (for development) or **production mode** (for production)
4. Choose a location for your database

### 3. Get Firebase Configuration

1. In Firebase Console, go to Project Settings (gear icon)
2. Scroll down to "Your apps" section
3. Click the web icon (`</>`) to add a web app
4. Register your app with a nickname
5. Copy the Firebase configuration object

### 4. Add Environment Variables

Create a `.env` file in the root directory (or update existing `.env`) with the following variables:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

Replace the values with your actual Firebase configuration values.

### 5. Firestore Security Rules (Optional but Recommended)

For production, update your Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to quiz_results collection
    // In production, you should add authentication checks
    match /quiz_results/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 6. Restart Development Server

After adding environment variables, restart your development server:

```bash
npm run dev
```

## Admin Secret Key

The admin secret key is: `Softvence,Quize,Admin-dashboard`

Users can enter this key during **registration or login** to gain admin access to the dashboard. Any user who enters this secret key will automatically be granted admin privileges.

## Features

The Firestore-based admin dashboard provides:

- **Detailed Quiz Analytics**: See who answered correctly/wrong for each question
- **Time Tracking**: View how long each user took to complete quizzes
- **User Performance**: Track correct vs wrong answers per user
- **Question Breakdown**: View detailed answer breakdowns for each quiz attempt

## Data Structure

Quiz results are stored in Firestore with the following structure:

```typescript
{
  userId: string;
  userEmail: string;
  quizType: 'plugin' | 'theme';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  timeTakenSeconds: number;
  detailedAnswers: Array<{
    questionId: number;
    question: string;
    userAnswer: number | null;
    correctAnswer: number;
    isCorrect: boolean;
    options: string[];
  }>;
  completedAt: string; // ISO timestamp
}
```

## Troubleshooting

- **"Firestore is not configured"**: Make sure all environment variables are set correctly
- **Connection issues**: Check your Firebase project settings and network connection
- **Permission errors**: Update Firestore security rules to allow read/write access

