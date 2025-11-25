import { ArrowLeft, Download, Monitor, Key, Play, RefreshCw, ExternalLink, Cpu, Terminal } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { APP_VERSION } from "@shared/version";

export default function SetupPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-to-calendar">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Calendar
            </Button>
          </Link>
          <span className="text-sm text-gray-500">Version {APP_VERSION}</span>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">McMurry Hurricane Calendar</h1>
          <p className="text-lg text-gray-600">
            Raspberry Pi Setup Guide
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600" />
              Step 1: Download the Application
            </CardTitle>
            <CardDescription>
              Get the calendar app code from Replit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-3 text-gray-700">
              <li>Visit the Replit project page</li>
              <li>Click the three-dot menu (⋮) in the top right</li>
              <li>Select "Download as zip"</li>
              <li>Extract the zip file to your preferred location</li>
            </ol>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-700">
              <strong>Tip:</strong> You can also use Git to clone the repository for easier updates.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-green-600" />
              Step 2: Prepare Your Raspberry Pi
            </CardTitle>
            <CardDescription>
              Set up the required environment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <h4 className="font-medium text-gray-900">System Requirements:</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm">
              <li>Raspberry Pi 4 or newer (recommended)</li>
              <li>Raspberry Pi OS (64-bit recommended)</li>
              <li>Node.js 18 or newer</li>
              <li>21.5" touchscreen display (optimized for)</li>
            </ul>
            
            <Separator />
            
            <h4 className="font-medium text-gray-900">Install Node.js:</h4>
            <div className="bg-gray-900 rounded-md p-3 font-mono text-sm text-green-400 overflow-x-auto">
              <div># Install Node.js using NodeSource</div>
              <div>curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -</div>
              <div>sudo apt-get install -y nodejs</div>
            </div>

            <h4 className="font-medium text-gray-900">Install Dependencies:</h4>
            <div className="bg-gray-900 rounded-md p-3 font-mono text-sm text-green-400 overflow-x-auto">
              <div>cd calendar-app  # Navigate to extracted folder</div>
              <div>npm install</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-amber-600" />
              Step 3: Configure Google OAuth
            </CardTitle>
            <CardDescription>
              Set up Google Calendar API access for your local installation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <h4 className="font-medium text-gray-900">Create OAuth Credentials:</h4>
            <ol className="list-decimal list-inside space-y-3 text-gray-700">
              <li>
                Go to the{" "}
                <a 
                  href="https://console.cloud.google.com/apis/credentials" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Google Cloud Console
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Create a new project or select an existing one</li>
              <li>Enable the Google Calendar API</li>
              <li>Go to "Credentials" → "Create Credentials" → "OAuth client ID"</li>
              <li>Select "Web application" as the application type</li>
              <li>
                Add these authorized redirect URIs:
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-sm">
                  <li><code className="bg-gray-100 px-1 rounded">http://localhost:5000/api/auth/google/callback</code></li>
                  <li><code className="bg-gray-100 px-1 rounded">http://127.0.0.1:5000/api/auth/google/callback</code></li>
                  <li><code className="bg-gray-100 px-1 rounded">http://[YOUR_PI_IP]:5000/api/auth/google/callback</code></li>
                </ul>
              </li>
              <li>Add these authorized JavaScript origins:
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-sm">
                  <li><code className="bg-gray-100 px-1 rounded">http://localhost:5000</code></li>
                  <li><code className="bg-gray-100 px-1 rounded">http://127.0.0.1:5000</code></li>
                  <li><code className="bg-gray-100 px-1 rounded">http://[YOUR_PI_IP]:5000</code></li>
                </ul>
              </li>
              <li>Copy your Client ID and Client Secret</li>
            </ol>

            <Separator />

            <h4 className="font-medium text-gray-900">Create Environment File:</h4>
            <p className="text-sm text-gray-600">Create a file named <code className="bg-gray-100 px-1 rounded">.env</code> in the project root:</p>
            <div className="bg-gray-900 rounded-md p-3 font-mono text-sm text-green-400 overflow-x-auto">
              <div>GOOGLE_CLIENT_ID=your_client_id_here</div>
              <div>GOOGLE_CLIENT_SECRET=your_client_secret_here</div>
              <div>GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback</div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
              <strong>Important:</strong> When running locally without a DATABASE_URL, the app automatically uses SQLite for storage. Your calendar data is stored in <code className="bg-amber-100 px-1 rounded">calendar.db</code> in the project folder.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-purple-600" />
              Step 4: Run the Application
            </CardTitle>
            <CardDescription>
              Start the calendar app
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <h4 className="font-medium text-gray-900">Development Mode:</h4>
            <div className="bg-gray-900 rounded-md p-3 font-mono text-sm text-green-400 overflow-x-auto">
              <div>npm run dev</div>
            </div>
            <p className="text-sm text-gray-600">
              The app will be available at <code className="bg-gray-100 px-1 rounded">http://localhost:5000</code>
            </p>

            <Separator />

            <h4 className="font-medium text-gray-900">Production Mode (Recommended for Kiosk):</h4>
            <div className="bg-gray-900 rounded-md p-3 font-mono text-sm text-green-400 overflow-x-auto">
              <div>npm run build</div>
              <div>npm start</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-indigo-600" />
              Step 5: Set Up Kiosk Mode
            </CardTitle>
            <CardDescription>
              Configure Raspberry Pi to auto-start in fullscreen kiosk mode
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <h4 className="font-medium text-gray-900">Install Chromium Kiosk Dependencies:</h4>
            <div className="bg-gray-900 rounded-md p-3 font-mono text-sm text-green-400 overflow-x-auto">
              <div>sudo apt-get install -y chromium-browser unclutter</div>
            </div>

            <Separator />

            <h4 className="font-medium text-gray-900">Create Kiosk Startup Script:</h4>
            <p className="text-sm text-gray-600">Create <code className="bg-gray-100 px-1 rounded">/home/pi/kiosk.sh</code>:</p>
            <div className="bg-gray-900 rounded-md p-3 font-mono text-sm text-green-400 overflow-x-auto whitespace-pre">
{`#!/bin/bash
# Wait for desktop to load
sleep 10

# Start the calendar server
cd /home/pi/calendar-app
npm start &

# Wait for server to start
sleep 5

# Disable screen blanking
xset s off
xset -dpms
xset s noblank

# Hide mouse cursor
unclutter -idle 0.1 -root &

# Start Chromium in kiosk mode
chromium-browser --noerrdialogs --disable-infobars \\
  --kiosk --incognito --disable-translate \\
  --disable-features=TranslateUI \\
  --check-for-update-interval=31536000 \\
  http://localhost:5000`}
            </div>

            <h4 className="font-medium text-gray-900">Make it Executable:</h4>
            <div className="bg-gray-900 rounded-md p-3 font-mono text-sm text-green-400 overflow-x-auto">
              <div>chmod +x /home/pi/kiosk.sh</div>
            </div>

            <Separator />

            <h4 className="font-medium text-gray-900">Auto-Start on Boot:</h4>
            <p className="text-sm text-gray-600">Create <code className="bg-gray-100 px-1 rounded">/etc/xdg/autostart/kiosk.desktop</code>:</p>
            <div className="bg-gray-900 rounded-md p-3 font-mono text-sm text-green-400 overflow-x-auto whitespace-pre">
{`[Desktop Entry]
Type=Application
Name=Calendar Kiosk
Exec=/home/pi/kiosk.sh
X-GNOME-Autostart-enabled=true`}
            </div>
          </CardContent>
        </Card>

        <Card id="updating">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-teal-600" />
              Updating to a New Version
            </CardTitle>
            <CardDescription>
              Keep your calendar app up to date
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">
              The app checks for updates daily at 8 AM and displays a notification when a new version is available.
            </p>
            
            <h4 className="font-medium text-gray-900">To Update:</h4>
            <ol className="list-decimal list-inside space-y-3 text-gray-700">
              <li>Stop the running calendar app</li>
              <li>Download the new version from Replit (or pull via Git)</li>
              <li>Extract and replace your existing installation</li>
              <li>Run <code className="bg-gray-100 px-1 rounded">npm install</code> to update dependencies</li>
              <li>Rebuild and restart: <code className="bg-gray-100 px-1 rounded">npm run build && npm start</code></li>
            </ol>

            <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-700">
              <strong>Note:</strong> Your Google credentials and calendar data are stored locally and will be preserved during updates.
            </div>

            <Separator />

            <h4 className="font-medium text-gray-900">Using Git (Recommended):</h4>
            <div className="bg-gray-900 rounded-md p-3 font-mono text-sm text-green-400 overflow-x-auto">
              <div>cd calendar-app</div>
              <div>git pull origin main</div>
              <div>npm install</div>
              <div>npm run build && npm start</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-gray-600" />
              Troubleshooting
            </CardTitle>
            <CardDescription>
              Common issues and solutions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900">OAuth Error: Redirect URI Mismatch</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Make sure the redirect URI in your <code className="bg-gray-100 px-1 rounded">.env</code> file exactly matches one of the authorized redirect URIs in your Google Cloud Console.
                </p>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="font-medium text-gray-900">OAuth Error: Access Blocked</h4>
                <p className="text-sm text-gray-600 mt-1">
                  In Google Cloud Console, go to "OAuth consent screen" and either publish your app or add your email address as a test user.
                </p>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="font-medium text-gray-900">Calendar Not Syncing</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Click the refresh button in the header. If issues persist, try logging out and signing in again.
                </p>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="font-medium text-gray-900">Touchscreen Issues</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Make sure you're running Chromium in kiosk mode with touch events enabled. The app is optimized for 21.5" touchscreens.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-gray-500 pb-8">
          McMurry Hurricane Calendar v{APP_VERSION}
        </div>
      </div>
    </div>
  );
}
