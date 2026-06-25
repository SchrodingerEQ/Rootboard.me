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
          <h1 className="text-3xl font-bold text-gray-900">Rootboard</h1>
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
              Step 3: Connect Google Calendar (Service Account)
            </CardTitle>
            <CardDescription>
              Create a Google service account so the kiosk can read your calendars without a browser sign-in
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
              <strong>Why a service account?</strong> A service account is a Google identity that belongs to the app itself, not to a person. The Pi authenticates with a JSON key file — no browser sign-in, no consent screen, and the kiosk keeps working forever without anyone re-logging in.
            </div>

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

            <h4 className="font-medium text-gray-900">Part C: Create a Service Account</h4>
            <ol className="list-decimal list-inside space-y-3 text-gray-700">
              <li>
                Go to{" "}
                <a
                  href="https://console.cloud.google.com/iam-admin/serviceaccounts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Service Accounts
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Click <strong>"+ Create Service Account"</strong> at the top</li>
              <li>Give it a name (e.g., <code className="bg-gray-100 px-1 rounded">calendar-kiosk</code>). The ID auto-fills — leave it as is.</li>
              <li>Click <strong>Create and Continue</strong></li>
              <li>You can skip the optional "Grant this service account access to project" and "Grant users access" steps — click <strong>Continue</strong>, then <strong>Done</strong></li>
            </ol>

            <Separator />

            <h4 className="font-medium text-gray-900">Part D: Generate a JSON Key File</h4>
            <ol className="list-decimal list-inside space-y-3 text-gray-700">
              <li>Click the service account you just created in the list</li>
              <li>Open the <strong>"Keys"</strong> tab at the top</li>
              <li>Click <strong>Add Key → Create new key</strong></li>
              <li>Choose <strong>JSON</strong> and click <strong>Create</strong></li>
              <li>A JSON file downloads to your computer. <strong>Keep it safe</strong> — anyone with this file can read every calendar shared with the service account.</li>
            </ol>

            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
              <strong>Write down the service account's email address.</strong> Open the JSON file in a text editor and find the <code className="bg-amber-100 px-1 rounded">"client_email"</code> field — it looks like <code className="bg-amber-100 px-1 rounded text-xs">calendar-kiosk@your-project-id.iam.gserviceaccount.com</code>. You'll need it in Part G.
            </div>

            <Separator />

            <h4 className="font-medium text-gray-900">Part E: Copy the JSON Key to the Pi</h4>
            <p className="text-sm text-gray-600">Place the key file inside the app folder and rename it to <code className="bg-gray-100 px-1 rounded">service-account.json</code>:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm">
              <li>Easiest: copy it onto a USB drive, plug it into the Pi, and drag it into <code className="bg-gray-100 px-1 rounded">/home/pi/calendar-app</code> using File Manager. Rename it to <code className="bg-gray-100 px-1 rounded">service-account.json</code>.</li>
              <li>From another computer over SSH:</li>
            </ul>
            <div className="bg-gray-900 rounded-md p-3 font-mono text-sm text-green-400 overflow-x-auto">
              <div>scp ~/Downloads/your-key-file.json pi@PI_IP:/home/pi/calendar-app/service-account.json</div>
            </div>
            <p className="text-sm text-gray-600">Verify it's there:</p>
            <div className="bg-gray-900 rounded-md p-3 font-mono text-sm text-green-400 overflow-x-auto">
              <div>ls -la /home/pi/calendar-app/service-account.json</div>
            </div>

            <Separator />

            <h4 className="font-medium text-gray-900">Part F: Create the .env File on Your Raspberry Pi</h4>
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
              <p className="text-sm text-gray-600">Add this single line (it points at the key file you just copied):</p>
              <div className="bg-gray-900 rounded-md p-3 font-mono text-sm text-green-400 overflow-x-auto space-y-1">
                <div>GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./service-account.json</div>
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
                <li>Add this single line:
                  <div className="bg-gray-100 rounded-md p-2 font-mono text-xs mt-2 space-y-1">
                    <div>GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./service-account.json</div>
                  </div>
                </li>
                <li>Save and close the file</li>
              </ol>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800 mt-4">
              <strong>Important:</strong> The dot at the beginning of <code className="bg-blue-100 px-1 rounded">.env</code> makes it a hidden file. This is intentional. You can verify it was created by running <code className="bg-blue-100 px-1 rounded">ls -la</code> in Terminal.
            </div>

            <Separator />

            <h4 className="font-medium text-gray-900">Part G: Share Your Calendars With the Service Account</h4>
            <p className="text-sm text-gray-600">A service account starts with zero access. You have to share each calendar you want the kiosk to display with the service account's email address.</p>
            <ol className="list-decimal list-inside space-y-3 text-gray-700">
              <li>
                Open{" "}
                <a
                  href="https://calendar.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Google Calendar
                  <ExternalLink className="h-3 w-3" />
                </a>{" "}
                on a regular computer
              </li>
              <li>In the left sidebar under <strong>"My calendars"</strong>, hover over a calendar → click the three-dot menu → <strong>Settings and sharing</strong></li>
              <li>Scroll to <strong>"Share with specific people or groups"</strong> → click <strong>Add people and groups</strong></li>
              <li>Paste the service account's email address (the <code className="bg-gray-100 px-1 rounded">client_email</code> from the JSON file)</li>
              <li>Set permission to <strong>"Make changes to events"</strong> (this lets the app create events from the kiosk later)</li>
              <li>Click <strong>Send</strong>. No email is sent — service accounts don't get notifications.</li>
              <li>Repeat for every calendar you want the kiosk to display</li>
            </ol>

            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
              <strong>After editing .env or adding the key file:</strong> restart the app for the changes to take effect. Stop the app with Ctrl+C and start it again.
            </div>

            <Separator />

            <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-800">
              <strong>Tip:</strong> When running locally without a DATABASE_URL, the app automatically uses SQLite for storage. Your calendar data is stored in <code className="bg-green-100 px-1 rounded">calendar.db</code> in the project folder.
            </div>

            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-800 space-y-2">
              <strong>Troubleshooting:</strong>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li><strong>"Service account key file could not be loaded":</strong> the path in <code className="bg-red-100 px-1 rounded">GOOGLE_SERVICE_ACCOUNT_KEY_FILE</code> doesn't match where the JSON file actually lives. Run <code className="bg-red-100 px-1 rounded">ls /home/pi/calendar-app/service-account.json</code> to confirm it's there.</li>
                <li><strong>Calendars appear empty:</strong> you haven't shared the calendars with the service account email yet (Part G), or you shared them with your personal email by mistake.</li>
                <li><strong>API not enabled:</strong> double-check the Google Calendar API is enabled for the same project the service account belongs to.</li>
                <li><strong>.env format:</strong> no spaces around the <code className="bg-red-100 px-1 rounded">=</code> sign, no quotes around the path.</li>
                <li><strong>Restart required:</strong> after editing <code className="bg-red-100 px-1 rounded">.env</code> or replacing the JSON file, restart the app.</li>
              </ul>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-md p-4 text-sm text-purple-800 space-y-2 mt-3">
              <strong>Verify your setup:</strong>
              <div className="bg-gray-900 rounded-md p-2 font-mono text-xs text-green-400 mt-2 space-y-1">
                <div>cat /home/pi/calendar-app/.env</div>
                <div>ls -la /home/pi/calendar-app/service-account.json</div>
              </div>
              <p className="mt-2">You should see your <code className="bg-purple-100 px-1 rounded">GOOGLE_SERVICE_ACCOUNT_KEY_FILE</code> line, and the JSON file should exist at the listed path.</p>
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
              <div>rm -rf dist</div>
              <div>npm run build</div>
              <div>npm start</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
              <strong>Important:</strong> Always delete the <code className="bg-amber-100 px-1 rounded">dist</code> folder before building. This ensures a clean build and prevents issues with stale files from a previous version.
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
              The app checks for updates daily at 8 AM. When a new version is available, you'll see a notification with an <strong>"Update Now"</strong> button.
            </p>

            <h4 className="font-medium text-gray-900">Automatic Updates (Recommended):</h4>
            <ol className="list-decimal list-inside space-y-3 text-gray-700">
              <li>When you see the update notification, tap <strong>"Update Now"</strong></li>
              <li>The app will automatically download, install, and restart</li>
              <li>Your settings, calendar data, and Google login are preserved</li>
            </ol>

            <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-700">
              <strong>Safe updates:</strong> Before each update, the app creates a backup of the current version. If anything goes wrong, it will automatically roll back. You can also manually roll back from <strong>Settings → Roll Back</strong>.
            </div>

            <Separator />

            <h4 className="font-medium text-gray-900">Manual Check:</h4>
            <p className="text-sm text-gray-600">
              You can also check for updates anytime from <strong>Settings → Check for Updates</strong>.
            </p>

            <Separator />

            <h4 className="font-medium text-gray-900">Using the Startup Script:</h4>
            <p className="text-sm text-gray-600 mb-2">
              For the best experience, use the included startup script instead of running <code className="bg-gray-100 px-1 rounded">npm run dev</code> directly. 
              This script automatically restarts the app after updates and handles rollbacks if a new version fails to start.
            </p>
            <div className="bg-gray-900 rounded-md p-3 font-mono text-sm text-green-400 overflow-x-auto">
              <div>cd calendar-app</div>
              <div>bash scripts/start.sh</div>
            </div>

            <Separator />

            <h4 className="font-medium text-gray-900">Manual Update via Terminal:</h4>
            <div className="bg-gray-900 rounded-md p-3 font-mono text-sm text-green-400 overflow-x-auto">
              <div>cd calendar-app</div>
              <div>git pull origin main</div>
              <div>npm install</div>
              <div>rm -rf dist</div>
              <div>npm run build</div>
              <div>npm start</div>
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
                <h4 className="font-medium text-gray-900">"Service account key file could not be loaded"</h4>
                <p className="text-sm text-gray-600 mt-1">
                  The app couldn't find or read <code className="bg-gray-100 px-1 rounded">service-account.json</code>. Confirm the file exists at the path in <code className="bg-gray-100 px-1 rounded">GOOGLE_SERVICE_ACCOUNT_KEY_FILE</code> (default is <code className="bg-gray-100 px-1 rounded">./service-account.json</code> inside the app folder) and that it's valid JSON.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium text-gray-900">Calendars appear but are empty</h4>
                <p className="text-sm text-gray-600 mt-1">
                  You haven't shared the calendars with the service account yet. Open Google Calendar → calendar settings → Share with specific people, and add the service account's <code className="bg-gray-100 px-1 rounded">client_email</code> from the JSON key file.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium text-gray-900">Calendar Not Syncing</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Click the refresh button in the header. If issues persist, confirm the Google Calendar API is enabled for the project that owns the service account, and that the service account still has access to each calendar.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium text-gray-900">Port Already in Use (EADDRINUSE)</h4>
                <p className="text-sm text-gray-600 mt-1">
                  If you see "EADDRINUSE: address already in use", the previous process is still running. Stop it first with <code className="bg-gray-100 px-1 rounded">{"kill -9 $(lsof -t -i:5000) 2>/dev/null"}</code> then start the app again.
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
          Rootboard v{APP_VERSION}
        </div>
      </div>
    </div>
  );
}
