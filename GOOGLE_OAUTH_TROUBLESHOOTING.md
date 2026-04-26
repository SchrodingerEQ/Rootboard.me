# Google OAuth Setup Troubleshooting

## "accounts.google.com refused to connect" Error

This error usually occurs due to one of these OAuth configuration issues.

### Identify Your Application URL

Replace `YOUR_APP_URL` in the examples below with the URL where your app is reachable. Common values:

- **Self-hosted on Raspberry Pi**: `http://localhost:5000`
- **Replit hosted**: `https://your-replit-app.replit.app`
- **Custom domain**: `https://your-custom-domain.com`

The redirect URI is always `YOUR_APP_URL/api/auth/google/callback`.

## Most Common Fixes

### 1. **Check OAuth Consent Screen Status**
   - Go to Google Cloud Console > APIs & Services > OAuth consent screen
   - If status is "Testing", you need to either:
     - **Publish the app** (recommended) - click "Publish App" button
     - **OR add your email as a test user** in the "Test users" section

### 2. **Add JavaScript Origins**
   - Go to "APIs & Services" > "Credentials"
   - Edit your OAuth 2.0 Client ID
   - In "Authorized JavaScript origins", add your application URL, e.g.:
     ```
     http://localhost:5000
     ```

### 3. **Verify Redirect URI**
   - In "Authorized redirect URIs", confirm the callback URL exists, e.g.:
     ```
     http://localhost:5000/api/auth/google/callback
     ```

### 4. **Wait for Changes to Propagate**
   - Google OAuth changes can take 5-10 minutes to take effect
   - Try the authentication again after waiting

### Note About Hosted URLs

Hosted URLs (like Replit's `*.replit.app`) can change when:
- The project is forked or copied
- The project is moved between accounts
- The hosting provider updates their domain structure

If your URL changes in the future, you'll need to repeat this process with the new URL.

### Alternative Solution: Use localhost for Development

If you're developing locally, add this to your authorized redirect URIs:
```
http://localhost:5000/api/auth/google/callback
```

This will work when running the development server locally.
