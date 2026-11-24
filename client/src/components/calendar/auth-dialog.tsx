import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, RefreshCw, BookOpen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { GoogleConnectPanel } from "./google-connect-panel";
import type { GoogleAuthStatus } from "@/lib/google-sign-in";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The auth status's `error`: with `mode` "oauth" it is why Google
   *  refused the sign-in (shown on the Connect tab); otherwise it is the
   *  service-account error (shown on the Advanced tab). */
  error?: string | null;
  mode?: GoogleAuthStatus["mode"];
  /** Whether this unit has its Google sign-in client (data/google-oauth-client.json). */
  oauthClient?: GoogleAuthStatus["oauthClient"];
  /** The tab it opens on. The setup wizard's manual-setup path opens it on
   *  the service-account steps. */
  initialTab?: "connect" | "service-account";
}

/**
 * "Connect Google Calendar" (beta-launch brief 02 §3): **Connect Google**,
 * the sign-in on the kiosk, and **Advanced: service account**, the
 * self-hoster path's instructions as they were before brief 02.
 */
export function AuthDialog({ open, onOpenChange, error, mode, oauthClient, initialTab = "connect" }: AuthDialogProps) {
  const lostReason = mode === "oauth" ? error : null;
  const serviceAccountError = mode === "oauth" ? null : error;
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
            <AlertCircle className="h-5 w-5 text-rb-danger" />
            Google Calendar Not Connected
          </DialogTitle>
          <DialogDescription>
            Connect a Google account to show its calendars here.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={initialTab}>
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="connect" className="h-10" data-testid="tab-connect-google">Connect Google</TabsTrigger>
            <TabsTrigger value="service-account" className="h-10" data-testid="tab-service-account">Advanced: service account</TabsTrigger>
          </TabsList>

          <TabsContent value="connect" className="pt-2 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0">
            <GoogleConnectPanel reason={lostReason} clientStatus={oauthClient} />
          </TabsContent>

          <TabsContent value="service-account" className="pt-2 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0">
            <div className="space-y-4">
              <p className="text-sm text-rb-muted leading-snug">
                For self-hosters: a Google service account reads the calendars you share with it, with no sign-in on the kiosk.
              </p>
              {serviceAccountError && (
                <div className="p-3 bg-rb-danger-wash border border-rb-danger-border rounded-md" data-testid="auth-error-detail">
                  <p className="text-sm text-rb-danger-ink font-mono break-all">{serviceAccountError}</p>
                </div>
              )}

              <div className="p-3 bg-rb-info-wash border border-rb-info-border rounded-md text-sm text-rb-info-ink">
                <p className="font-medium mb-2">To connect your calendar:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Create a service account at <code className="bg-rb-info-wash-hover px-1 rounded">console.cloud.google.com</code></li>
                  <li>Enable the Google Calendar API for your project</li>
                  <li>Download the service account JSON key file</li>
                  <li>Copy the key file to the app directory on the Pi</li>
                  <li>Set <code className="bg-rb-info-wash-hover px-1 rounded">GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./service-account.json</code> in <code className="bg-rb-info-wash-hover px-1 rounded">.env</code></li>
                  <li>Share each Google Calendar with the service account's email address (the <code className="bg-rb-info-wash-hover px-1 rounded">client_email</code> field in the JSON key file)</li>
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

              <div className="text-center pt-2 border-t border-rb-grid-line">
                <Link href="/setup">
                  <a className="inline-flex items-center gap-1 text-sm text-rb-info hover:text-rb-info-hover hover:underline" data-testid="link-setup-guide">
                    <BookOpen className="h-3 w-3" />
                    View Setup Guide
                  </a>
                </Link>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
