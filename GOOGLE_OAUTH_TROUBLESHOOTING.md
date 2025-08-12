# Google OAuth Setup Troubleshooting

## "accounts.google.com refused to connect" Error

This error usually occurs due to one of these OAuth configuration issues:

### Current Application URLs
```
Domain: https://65e2fec4-e075-4d66-aad5-d37cbddd2fcf.Phitrix.repl.co
Redirect URI: https://65e2fec4-e075-4d66-aad5-d37cbddd2fcf.Phitrix.repl.co/api/auth/google/callback
```

## Most Common Fixes

### 1. **Check OAuth Consent Screen Status**
   - Go to Google Cloud Console > APIs & Services > OAuth consent screen
   - If status is "Testing", you need to either:
     - **Publish the app** (recommended) - click "Publish App" button
     - **OR add your email as a test user** in the "Test users" section

### 2. **Add JavaScript Origins**
   - Go to "APIs & Services" > "Credentials" 
   - Edit your OAuth 2.0 Client ID
   - In "Authorized JavaScript origins", add:
     ```
     https://65e2fec4-e075-4d66-aad5-d37cbddd2fcf.Phitrix.repl.co
     ```

### 3. **Verify Redirect URI** (Already configured correctly)
   - In "Authorized redirect URIs", confirm this exists:
     ```
     https://65e2fec4-e075-4d66-aad5-d37cbddd2fcf.Phitrix.repl.co/api/auth/google/callback
     ```

### 4. **Wait for Changes to Propagate**
   - Google OAuth changes can take 5-10 minutes to take effect
   - Try the authentication again after waiting

### Note About Replit URLs

Replit URLs can change when:
- The project is forked or copied
- The project is moved between accounts
- Replit updates their domain structure

If your URL changes in the future, you'll need to repeat this process with the new URL.

### Alternative Solution: Use localhost for Development

If you're developing locally, you can also add:
```
http://localhost:5000/api/auth/google/callback
```

This will work when running the development server locally.