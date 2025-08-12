# Google OAuth Setup Troubleshooting

## "accounts.google.com refused to connect" Error

This error occurs when your current Replit URL is not configured as an authorized redirect URI in your Google Cloud Console OAuth application.

### Current Redirect URI
Your application is currently running at:
```
https://65e2fec4-e075-4d66-aad5-d37cbddd2fcf.Phitrix.repl.co/api/auth/google/callback
```

### How to Fix

1. **Open Google Cloud Console**
   - Go to https://console.cloud.google.com
   - Select your project

2. **Navigate to OAuth Settings**
   - Go to "APIs & Services" > "Credentials"
   - Find your OAuth 2.0 Client ID (starts with `381282129214-1f837jg...`)
   - Click the edit button (pencil icon)

3. **Add Authorized Redirect URI**
   - In the "Authorized redirect URIs" section, add:
     ```
     https://65e2fec4-e075-4d66-aad5-d37cbddd2fcf.Phitrix.repl.co/api/auth/google/callback
     ```
   - Click "Save"

4. **Wait for Changes to Propagate**
   - Google OAuth changes can take a few minutes to take effect
   - Try the authentication again after 2-3 minutes

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