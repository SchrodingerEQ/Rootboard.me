import { useState } from "react";
import { LogOut, UserCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { GoogleConnectPanel } from "./google-connect-panel";
import type { GoogleAuthStatus } from "@/lib/google-sign-in";

/** Every query that changes when the Google account does. */
const GOOGLE_QUERY_KEYS = [
  ["/api/calendar/auth-status"],
  ["/api/google/status"],
  ["/api/calendar/calendars"],
  ["/api/calendar/events"],
  ["/api/calendar/sync-status"],
];

/**
 * Settings → Calendars, Google account (beta-launch brief 02): who the
 * kiosk is signed in as, and Sign out; or the Connect Google button when it
 * is not (or no longer) signed in. On a service-account kiosk (its own rows
 * stay in settings-menu.tsx) this is one collapsed "sign in instead" option,
 * since a sign-in takes over from the key file.
 */
export function GoogleAccountSettings({ status }: { status: GoogleAuthStatus | undefined }) {
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showSwitch, setShowSwitch] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (!status) return null;
  if (status.mode === "service-account") {
    return showSwitch ? (
      <div className="space-y-2" data-testid="google-account-switch">
        <p className="text-xs text-rb-muted leading-snug">
          This kiosk reads calendars through a service account. Once you sign in with Google, the sign-in is used
          instead; Sign out returns to the service account.
        </p>
        <GoogleConnectPanel clientStatus={status.oauthClient} />
      </div>
    ) : (
      <button
        type="button"
        className="text-xs text-rb-muted underline min-h-[32px]"
        onClick={() => setShowSwitch(true)}
        data-testid="button-google-switch"
      >
        Sign in with a Google account instead
      </button>
    );
  }

  const signOut = async () => {
    setSigningOut(true);
    try {
      const res = await fetch("/api/google/signout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        credentials: "include",
      });
      const body = (await res.json().catch(() => null)) as { revoked?: boolean; message?: string } | null;
      if (!res.ok) throw new Error(body?.message ?? `Sign out failed (${res.status})`);
      toast({
        title: "Signed out of Google",
        description: body?.revoked
          ? "This kiosk's access was removed at Google and its copy of the events was deleted."
          : "This kiosk's sign-in and its copy of the events were deleted. Google couldn't be reached to remove the access there; you can remove it from your Google account's security page.",
      });
      for (const queryKey of GOOGLE_QUERY_KEYS) queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      toast({ title: "Couldn't sign out", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSigningOut(false);
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-2" data-testid="google-account-settings">
      {status.mode === "oauth" && status.authenticated && (
        <div className="rounded-md bg-rb-canvas border border-rb-chip-hover px-3 py-2 flex items-center gap-2">
          <UserCircle className="h-4 w-4 flex-shrink-0 text-rb-muted" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-rb-muted">Signed in with Google as</p>
            <p className="text-sm text-rb-ink-secondary truncate" data-testid="google-account-email">
              {status.email ?? "your Google account"}
            </p>
          </div>
        </div>
      )}
      {!status.authenticated && <GoogleConnectPanel reason={status.mode === "oauth" ? status.error : null} clientStatus={status.oauthClient} />}
      {status.mode === "oauth" && (
        <Button
          variant="outline"
          className="w-full h-11"
          onClick={() => setConfirming(true)}
          disabled={signingOut}
          data-testid="button-google-sign-out"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      )}

      <AlertDialog open={confirming} onOpenChange={(open) => { if (!open && !signingOut) setConfirming(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of Google?</AlertDialogTitle>
            <AlertDialogDescription>
              This kiosk stops showing {status.email ?? "this account"}'s calendars, removes its access at Google,
              and deletes its own copy of the events. The Google account and its calendars are not changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={signingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rb-danger hover:bg-rb-danger-hover text-rb-on-color-ink"
              disabled={signingOut}
              onClick={(e) => { e.preventDefault(); void signOut(); }}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
