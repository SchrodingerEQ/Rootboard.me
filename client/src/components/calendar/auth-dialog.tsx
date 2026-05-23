import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, RefreshCw, BookOpen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error?: string | null;
}

export function AuthDialog({ open, onOpenChange, error }: AuthDialogProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const queryClient = useQueryClient();

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['/api/calendar/auth-status'] });
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Google Calendar Not Connected
          </DialogTitle>
          <DialogDescription>
            The service account key file could not be loaded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md" data-testid="auth-error-detail">
              <p className="text-sm text-red-700 font-mono break-all">{error}</p>
            </div>
          )}

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
            <p className="font-medium mb-2">To connect your calendar:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Create a service account at <code className="bg-blue-100 px-1 rounded">console.cloud.google.com</code></li>
              <li>Enable the Google Calendar API for your project</li>
              <li>Download the service account JSON key file</li>
              <li>Copy the key file to the app directory on the Pi</li>
              <li>Set <code className="bg-blue-100 px-1 rounded">GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./service-account.json</code> in <code className="bg-blue-100 px-1 rounded">.env</code></li>
              <li>Share each Google Calendar with the service account's email address (the <code className="bg-blue-100 px-1 rounded">client_email</code> field in the JSON key file)</li>
              <li>Restart the app</li>
            </ol>
          </div>

          <Button
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full"
            data-testid="button-retry-connection"
          >
            {isRetrying ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              "Retry Connection"
            )}
          </Button>

          <div className="text-center pt-2 border-t border-gray-100">
            <Link href="/setup">
              <a className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline" data-testid="link-setup-guide">
                <BookOpen className="h-3 w-3" />
                View Setup Guide
              </a>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
