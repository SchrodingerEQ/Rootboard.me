# Google OAuth Setup Instructions

## Create Your Own Google OAuth Credentials

Since the current OAuth configuration has redirect URI issues, you need to create your own Google Calendar API credentials. This takes about 5 minutes:

### Step 1: Go to Google Cloud Console
1. Visit: https://console.cloud.google.com/
2. Sign in with your Google account

### Step 2: Create a New Project
1. Click "Select a project" at the top
2. Click "NEW PROJECT" 
3. Enter project name: "Calendar App"
4. Click "CREATE"

### Step 3: Enable Calendar API
1. Go to "APIs & Services" > "Library"
2. Search for "Google Calendar API"
3. Click on it and click "ENABLE"

### Step 4: Create OAuth Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "CREATE CREDENTIALS" > "OAuth client ID"
3. If prompted, configure the consent screen:
   - Choose "External" user type
   - Fill in required fields (App name: "Calendar App", User support email: your email)
   - Add your email to test users
4. For OAuth client ID:
   - Application type: "Web application" 
   - Name: "Calendar Web App"
   - Authorized redirect URIs: Add both:
     - `https://YOUR_REPLIT_URL.repl.co/api/auth/google/callback`
     - `urn:ietf:wg:oauth:2.0:oob`
   
   (Replace YOUR_REPLIT_URL with your actual Replit domain)

### Step 5: Get Your Credentials
1. After creating, you'll see your:
   - Client ID (starts with numbers, ends with .apps.googleusercontent.com)
   - Client Secret (random string)
2. Copy both values

### Step 6: Update Your App
1. In your Replit project, you'll need to update the environment secrets:
   - GOOGLE_CLIENT_ID: (your new client ID)
   - GOOGLE_CLIENT_SECRET: (your new client secret)

### Step 7: Test Authentication
1. After updating the credentials, try the "Connect Google Calendar" button again
2. It should now work properly with your own OAuth setup

## Alternative: Quick Test Method
If you want to test immediately, you can also:
1. Use the manual authorization method with your new credentials
2. The "urn:ietf:wg:oauth:2.0:oob" redirect URI will work with your own OAuth app

This approach gives you full control over the OAuth configuration and resolves all redirect URI issues.