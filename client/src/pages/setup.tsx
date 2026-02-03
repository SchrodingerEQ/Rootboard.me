import { ArrowLeft, Download, Monitor, Key, Play, RefreshCw, ExternalLink, Cpu, Terminal, Star, Usb, Wifi, HardDrive } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { APP_VERSION } from "@shared/version";

export default function SetupPage() {
  return (
    <div className="h-screen bg-gray-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8 py-8 px-4">
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
              Step 1: Get the Application onto Your Raspberry Pi
            </CardTitle>
            <CardDescription>
              Choose the method that works best for you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Recommended Option */}
            <div className="border-2 border-green-200 bg-green-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-green-600 fill-green-600" />
                <h4 className="font-semibold text-green-800">Recommended: USB Drive Method</h4>
                <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">Easiest</span>
              </div>
              <p className="text-sm text-green-700">
                Best for beginners - no coding knowledge required!
              </p>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 text-sm">
                <li>On your regular computer, visit the Replit project page</li>
                <li>Click the three-dot menu (⋮) in the top right corner</li>
                <li>Select <strong>"Download as zip"</strong></li>
                <li>Copy the downloaded zip file to a USB drive</li>
                <li>Plug the USB drive into your Raspberry Pi</li>
                <li>Open File Manager on the Pi and navigate to the USB drive</li>
                <li>Copy the zip file to your home folder (usually <code className="bg-green-100 px-1 rounded">/home/pi</code>)</li>
                <li>Right-click the zip file and select "Extract Here"</li>
                <li>Rename the extracted folder to <code className="bg-green-100 px-1 rounded">calendar-app</code></li>
              </ol>
            </div>

            <Separator />

            {/* Alternative Option 1: Direct Download */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Wifi className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-gray-900">Option 2: Direct Download on Pi</h4>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Requires Internet</span>
              </div>
              <p className="text-sm text-gray-600">
                Download directly on your Raspberry Pi if it's connected to the internet.
              </p>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 text-sm">
                <li>Open the web browser (Chromium) on your Raspberry Pi</li>
                <li>Go to the Replit project page</li>
                <li>Click the three-dot menu (⋮) → "Download as zip"</li>
                <li>The file will download to your Downloads folder</li>
                <li>Open File Manager and extract the zip file</li>
                <li>Move the extracted folder to <code className="bg-gray-100 px-1 rounded">/home/pi/calendar-app</code></li>
              </ol>
            </div>

            {/* Alternative Option 2: Git Clone */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-purple-600" />
                <h4 className="font-semibold text-gray-900">Option 3: Git Clone</h4>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Advanced</span>
              </div>
              <p className="text-sm text-gray-600">
                Best for easy updates - recommended if you're comfortable with the command line.
              </p>
              <div className="bg-gray-900 rounded-md p-3 font-mono text-sm text-green-400 overflow-x-auto">
                <div># Open Terminal on your Raspberry Pi and run:</div>
                <div>cd /home/pi</div>
                <div>git clone [REPLIT_GIT_URL] calendar-app</div>
              </div>
              <p className="text-xs text-gray-500">
                To find the Git URL: On Replit, click "Git" in the left sidebar, then copy the clone URL.
              </p>
            </div>

            {/* Alternative Option 3: SCP/SFTP */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-orange-600" />
                <h4 className="font-semibold text-gray-900">Option 4: Network Transfer (SCP/SFTP)</h4>
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Advanced</span>
              </div>
              <p className="text-sm text-gray-600">
                Transfer files over your local network using SSH.
              </p>
              <div className="bg-gray-900 rounded-md p-3 font-mono text-sm text-green-400 overflow-x-auto">
                <div># From your computer (replace PI_IP with your Pi's IP address):</div>
                <div>scp -r calendar-app pi@PI_IP:/home/pi/</div>
              </div>
              <p className="text-xs text-gray-500">
                You can also use FileZilla or WinSCP for a graphical interface.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
              <strong>Note:</strong> After transferring the files, make sure the folder is named <code className="bg-amber-100 px-1 rounded">calendar-app</code> and is located in <code className="bg-amber-100 px-1 rounded">/home/pi/</code> for the rest of these instructions to work correctly.
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
            <h4 className="font-medium text-gray-900">Part A: Create a Google Cloud Project</h4>
            <ol className="list-decimal list-inside space-y-3 text-gray-700">
              <li>
                Go to the{" "}
                <a 
                  href="https://console.cloud.google.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Google Cloud Console
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Click the project dropdown at the top and select <strong>"New Project"</strong></li>
              <li>Give your project a name (e.g., "Calendar Kiosk") and click <strong>Create</strong></li>
              <li>Wait for the project to be created, then select it from the dropdown</li>
            </ol>

            <Separator />

            <h4 className="font-medium text-gray-900">Part B: Enable the Google Calendar API</h4>
            <ol className="list-decimal list-inside space-y-3 text-gray-700">
              <li>
                Go to{" "}
                <a 
                  href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Google Calendar API
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Make sure your project is selected at the top</li>
              <li>Click <strong>"Enable"</strong></li>
            </ol>

            <Separator />

            <h4 className="font-medium text-gray-900">Part C: Configure OAuth Consent Screen</h4>
            <ol className="list-decimal list-inside space-y-3 text-gray-700">
              <li>
                Go to{" "}
                <a 
                  href="https://console.cloud.google.com/apis/credentials/consent" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  OAuth Consent Screen
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Select <strong>"External"</strong> user type and click <strong>Create</strong></li>
              <li>Fill in the required fields:
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-sm">
                  <li><strong>App name:</strong> Calendar Kiosk (or any name you prefer)</li>
                  <li><strong>User support email:</strong> Your email address</li>
                  <li><strong>Developer contact email:</strong> Your email address</li>
                </ul>
              </li>
              <li>Click <strong>Save and Continue</strong> through the remaining steps</li>
              <li>On the "Test users" page, click <strong>"Add Users"</strong> and add your Google email address</li>
              <li>Click <strong>Save and Continue</strong>, then <strong>Back to Dashboard</strong></li>
            </ol>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
              <strong>Why "Testing" mode?</strong> While your app is in testing mode, only the email addresses you add as test users can sign in. This is perfect for personal use on your Raspberry Pi.
            </div>

            <Separator />

            <h4 className="font-medium text-gray-900">Part D: Create OAuth Credentials</h4>
            <ol className="list-decimal list-inside space-y-3 text-gray-700">
              <li>
                Go to{" "}
                <a 
                  href="https://console.cloud.google.com/apis/credentials" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Credentials
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Click <strong>"Create Credentials"</strong> → <strong>"OAuth client ID"</strong></li>
              <li>Select <strong>"Web application"</strong> as the application type</li>
              <li>Give it a name (e.g., "Calendar Kiosk Client")</li>
            </ol>

            <Separator />

            <h4 className="font-medium text-gray-900">Part E: Add Authorized JavaScript Origins</h4>
            <p className="text-sm text-gray-600 mb-2">Under "Authorized JavaScript origins", click <strong>"Add URI"</strong> and add these exact values:</p>
            <div className="bg-gray-900 rounded-md p-3 font-mono text-sm text-green-400 space-y-1">
              <div>http://localhost:5000</div>
              <div>http://127.0.0.1:5000</div>
            </div>

            <Separator />

            <h4 className="font-medium text-gray-900">Part F: Add Authorized Redirect URIs</h4>
            <p className="text-sm text-gray-600 mb-2">Under "Authorized redirect URIs", click <strong>"Add URI"</strong> and add these exact values:</p>
            <div className="bg-gray-900 rounded-md p-3 font-mono text-sm text-green-400 space-y-1">
              <div>http://localhost:5000/api/auth/google/callback</div>
              <div>http://127.0.0.1:5000/api/auth/google/callback</div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800 mt-4">
              <strong>Important:</strong> Make sure to use <code className="bg-amber-100 px-1 rounded">http://</code> (not https) and include the exact port number <code className="bg-amber-100 px-1 rounded">:5000</code>. Click <strong>Create</strong> when done.
            </div>

            <Separator />

            <h4 className="font-medium text-gray-900">Part G: Copy Your Credentials</h4>
            <p className="text-sm text-gray-600">After clicking Create, a popup will show your credentials. Copy these values:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm mt-2">
              <li><strong>Client ID</strong> - looks like: <code className="bg-gray-100 px-1 rounded text-xs">123456789-abcdefg.apps.googleusercontent.com</code></li>
              <li><strong>Client Secret</strong> - a shorter code like: <code className="bg-gray-100 px-1 rounded text-xs">GOCSPX-xxxxxxxxxxxxxx</code></li>
            </ul>

            <Separator />

            <h4 className="font-medium text-gray-900">Part H: Create Environment File on Your Raspberry Pi</h4>
            <p className="text-sm text-gray-600 mb-3">Choose one of these methods to create the <code className="bg-gray-100 px-1 rounded">.env</code> file:</p>
            
            {/* Terminal Method */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-3 mb-4">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-gray-600" />
                <h5 className="font-medium text-gray-800">Method 1: Using Terminal (Recommended)</h5>
              </div>
              <div className="bg-gray-900 rounded-md p-3 font-mono text-sm text-green-400 overflow-x-auto space-y-1">
                <div># Step 1: Open Terminal and navigate to your app folder</div>
                <div>cd /home/pi/calendar-app</div>
                <div></div>
                <div># Step 2: Create and edit the .env file</div>
                <div>nano .env</div>
              </div>
              <p className="text-sm text-gray-600">Type these three lines (replace with your actual values from Google):</p>
              <div className="bg-gray-900 rounded-md p-3 font-mono text-sm text-green-400 overflow-x-auto space-y-1">
                <div>GOOGLE_CLIENT_ID=your_client_id_here</div>
                <div>GOOGLE_CLIENT_SECRET=your_client_secret_here</div>
                <div>GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback</div>
              </div>
              <p className="text-sm text-gray-600">Save the file:</p>
              <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                <li>Press <strong>Ctrl + X</strong> to exit</li>
                <li>Press <strong>Y</strong> to confirm saving</li>
                <li>Press <strong>Enter</strong> to confirm the filename</li>
              </ol>
            </div>

            {/* File Manager Method */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-gray-600" />
                <h5 className="font-medium text-gray-800">Method 2: Using File Manager (Graphical)</h5>
              </div>
              <ol className="list-decimal list-inside text-sm text-gray-700 space-y-2">
                <li>Open <strong>File Manager</strong> on your Raspberry Pi</li>
                <li>Navigate to <code className="bg-gray-100 px-1 rounded">/home/pi/calendar-app</code></li>
                <li>Press <strong>Ctrl + H</strong> to show hidden files (files starting with a dot)</li>
                <li>Right-click in the folder → <strong>Create New</strong> → <strong>Empty File</strong></li>
                <li>Name the file <code className="bg-gray-100 px-1 rounded">.env</code> (include the dot at the beginning)</li>
                <li>Right-click the new file → <strong>Open With</strong> → <strong>Text Editor</strong></li>
                <li>Add these three lines (with your actual values):
                  <div className="bg-gray-100 rounded-md p-2 font-mono text-xs mt-2 space-y-1">
                    <div>GOOGLE_CLIENT_ID=your_client_id_here</div>
                    <div>GOOGLE_CLIENT_SECRET=your_client_secret_here</div>
                    <div>GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback</div>
                  </div>
                </li>
                <li>Save and close the file</li>
              </ol>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800 mt-4">
              <strong>Important:</strong> The dot at the beginning of <code className="bg-blue-100 px-1 rounded">.env</code> makes it a hidden file. This is intentional for security. You can verify it was created by running <code className="bg-blue-100 px-1 rounded">ls -la</code> in Terminal.
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800 mt-3">
              <strong>After creating the .env file:</strong> You must restart the application for the changes to take effect. Stop the app (Ctrl+C) and run <code className="bg-amber-100 px-1 rounded">npm run dev</code> again.
            </div>

            <Separator />

            <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-800">
              <strong>Tip:</strong> When running locally without a DATABASE_URL, the app automatically uses SQLite for storage. Your calendar data is stored in <code className="bg-green-100 px-1 rounded">calendar.db</code> in the project folder.
            </div>

            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-800 space-y-2">
              <strong>Troubleshooting Authentication Errors:</strong>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li><strong>Access URL:</strong> Make sure you open the app via <code className="bg-red-100 px-1 rounded">http://localhost:5000</code> in your browser (not an IP address like 192.168.x.x)</li>
                <li><strong>Test User:</strong> Your Google email must be added as a "Test user" in the OAuth consent screen settings</li>
                <li><strong>Redirect URIs:</strong> The URIs in Google Cloud must match exactly - no trailing slashes, use <code className="bg-red-100 px-1 rounded">http://</code> not <code className="bg-red-100 px-1 rounded">https://</code></li>
                <li><strong>API Enabled:</strong> Make sure the Google Calendar API is enabled for your project</li>
                <li><strong>.env Format:</strong> No spaces around the = signs, no quotes around values</li>
                <li><strong>Restart Required:</strong> After editing .env, you must restart the app (stop with Ctrl+C, then run <code className="bg-red-100 px-1 rounded">npm run dev</code> again)</li>
              </ul>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-md p-4 text-sm text-purple-800 space-y-2 mt-3">
              <strong>Verify Your .env File:</strong>
              <p className="mt-1">Run this command in Terminal to check your .env file exists and has content:</p>
              <div className="bg-gray-900 rounded-md p-2 font-mono text-xs text-green-400 mt-2">
                <div>cat /home/pi/calendar-app/.env</div>
              </div>
              <p className="mt-2">You should see your three lines displayed. If you see "No such file or directory", the file wasn't created correctly.</p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-sm text-gray-800 space-y-2 mt-3">
              <strong>Common Error Messages:</strong>
              <ul className="list-disc list-inside space-y-2 mt-2">
                <li><strong>"redirect_uri_mismatch"</strong> - The redirect URI in your .env file doesn't match what's in Google Cloud Console. They must be identical.</li>
                <li><strong>"Access blocked: This app's request is invalid"</strong> - Usually means the OAuth consent screen isn't configured or you're not added as a test user.</li>
                <li><strong>"Error 400: invalid_request"</strong> - Check that your Client ID and Client Secret are copied correctly with no extra spaces.</li>
                <li><strong>"This app isn't verified"</strong> - This is normal! Click "Advanced" then "Go to [App Name] (unsafe)" to continue.</li>
              </ul>
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
