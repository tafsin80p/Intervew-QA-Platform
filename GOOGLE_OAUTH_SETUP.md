# Google OAuth Setup Guide

This guide will help you configure Google OAuth authentication for your WordPress Quiz application using Supabase.

## Step 1: Get Google OAuth Credentials

### 1.1 Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click "New Project"
4. Enter a project name (e.g., "WordPress Quiz")
5. Click "Create"

### 1.2 Enable Google+ API

1. In Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Google+ API" or "Google Identity Services"
3. Click on it and click "Enable"

### 1.3 Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen first:
   - Choose "External" (unless you have a Google Workspace)
   - Fill in the required fields:
     - App name: WordPress Quiz
     - User support email: your-email@gmail.com
     - Developer contact: your-email@gmail.com
   - Click "Save and Continue"
   - Add scopes (optional): `email`, `profile`, `openid`
   - Click "Save and Continue"
   - Add test users (optional)
   - Click "Save and Continue"
   - Review and click "Back to Dashboard"

4. Now create the OAuth client ID:
   - Application type: **Web application**
   - Name: WordPress Quiz Web Client
   - Authorized JavaScript origins:
     - `http://localhost:8080` (for development)
     - `https://yourdomain.com` (for production)
   - Authorized redirect URIs:
     - `https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback`
     - Replace `YOUR_SUPABASE_PROJECT_REF` with your actual Supabase project reference
   - Click "Create"

5. **Copy the credentials:**
   - **Client ID**: (looks like: `123456789-abcdefghijklmnop.apps.googleusercontent.com`)
   - **Client Secret**: (looks like: `GOCSPX-abcdefghijklmnopqrstuvwxyz`)

## Step 2: Configure Google OAuth in Supabase

### 2.1 Access Supabase Dashboard

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project (or create a new one)

### 2.2 Navigate to Authentication Settings

1. In the left sidebar, click **"Authentication"**
2. Click on **"Providers"** tab
3. Find **"Google"** in the list of providers

### 2.3 Enable and Configure Google Provider

1. Toggle **"Enable Google provider"** to ON
2. Enter your Google OAuth credentials:
   - **Client ID (for OAuth)**: Paste your Google Client ID
   - **Client Secret (for OAuth)**: Paste your Google Client Secret
3. Click **"Save"**

### 2.4 Get Your Supabase Redirect URI

1. In Supabase Dashboard, go to **"Authentication"** > **"URL Configuration"**
2. Copy the **"Site URL"** (e.g., `http://localhost:8080`)
3. The redirect URI format is: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
   - You can find your project reference in your Supabase URL or in the project settings

## Step 3: Update Google Cloud Console Redirect URI

1. Go back to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" > "Credentials"
3. Click on your OAuth 2.0 Client ID
4. Under "Authorized redirect URIs", add:
   - `https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback`
   - Replace `YOUR_SUPABASE_PROJECT_REF` with your actual Supabase project reference
5. Click "Save"

## Step 4: Update Your Environment Variables (if needed)

Your Supabase credentials should already be in your `.env` file:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

## Step 5: Test Google OAuth

1. Make sure your frontend is running: `npm run dev`
2. Go to the login page
3. Click the "Google" button
4. You should be redirected to Google's login page
5. After logging in, you'll be redirected back to your app

## Troubleshooting

### Issue: "redirect_uri_mismatch" error
- **Solution**: Make sure the redirect URI in Google Cloud Console exactly matches:
  - `https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback`

### Issue: OAuth button not showing
- **Solution**: 
  1. Go to Admin Dashboard > Settings tab
  2. Make sure "Google OAuth" toggle is enabled
  3. Click "Save Settings"

### Issue: "OAuth login is not available"
- **Solution**: The current code shows this error because OAuth is configured for Supabase, but the app is using Express API. You need to update the `signInWithOAuth` function in `src/contexts/AuthContext.tsx` to use Supabase OAuth instead of showing an error.

## Important Notes

- **Development**: Use `http://localhost:8080` in authorized origins
- **Production**: Replace with your production domain
- **Client Secret**: Keep this secret! Never commit it to version control
- **Supabase Project Reference**: Found in your Supabase project URL or settings

## Next Steps

After configuring Google OAuth, you may need to update the `signInWithOAuth` function in your code to actually use Supabase's OAuth instead of showing an error message.

