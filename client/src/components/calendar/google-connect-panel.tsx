import { useState } from "react";
import { LogIn, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { missingClientSentence, startFailureSentence, type OAuthClientStatus } from "@/lib/google-sign-in";

interface GoogleConnectPanelProps {
  /** Why the kiosk is not connected (a lost sign-in, a failed attempt), shown above the button. */
  reason?: string | null;
  /** Larger type and button, for a full-screen host such as the setup wizard. */
  size?: "default" | "large";
  /** The auth status's `oauthClient`. Missing or invalid: say so instead of
   *  offering a button that can't work (decision 0017: the client is on the unit). */
  clientStatus?: OAuthClientStatus;
}

/**
 * The "Connect Google" step (beta-launch brief 02): one button that sends
 * the kiosk's own browser to Google's sign-in page. Google sends it back to
 * the kiosk, which saves the tokens on the unit and reloads the app at
 * `http://localhost:5000/?google=connected` (or `?google=failed&reason=`).
 *
 * Self-contained on purpose: no dialog, popover or query-cache assumptions,
 * so the auth dialog, Settings and the setup wizard (brief 03 session 2)
 * can each drop it in as-is.
 */
export function GoogleConnectPanel({ reason, size = "default", clientStatus }: GoogleConnectPanelProps) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const large = size === "large";
  const noClient = missingClientSentence(clientStatus);

  if (noClient) {
    return (
      <div className="space-y-2" data-testid="google-connect-no-client">
        <p className={`${large ? "text-base" : "text-sm"} text-rb-warn-ink leading-snug`}>{noClient}</p>
        <p className={`${large ? "text-base" : "text-sm"} text-rb-muted leading-snug`}>
          The{" "}
          <Link href="/setup" className="underline">setup guide</Link>{" "}
          explains how to add one. Or connect with a Google service account instead (Advanced).
        </p>
      </div>
    );
  }

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/google/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        credentials: "include",
      });
      const body = (await res.json().catch(() => null)) as { url?: string } | null;
      if (!res.ok || !body?.url) {
        setError(startFailureSentence(res.status));
        setStarting(false);
        return;
      }
      // Leave the app for Google's page; the callback brings the browser back.
      window.location.assign(body.url);
    } catch {
      setError(startFailureSentence(0));
      setStarting(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="google-connect-panel">
      {reason && (
        <p className={`${large ? "text-base" : "text-sm"} text-rb-warn-ink leading-snug`} data-testid="google-connect-reason">
          {reason}
        </p>
      )}
      <p className={`${large ? "text-base" : "text-sm"} text-rb-muted leading-snug`}>
        Sign in with the Google account whose calendars this kiosk should show. Google gives this kiosk access
        to that account's calendars and events; the sign-in is kept only on this kiosk.
      </p>
      <Button
        onClick={start}
        disabled={starting}
        className={`w-full ${large ? "h-14 text-lg" : "h-12 text-base"}`}
        data-testid="button-connect-google"
      >
        {starting ? (
          <>
            <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
            Opening Google…
          </>
        ) : (
          <>
            <LogIn className="mr-2 h-5 w-5" />
            Connect Google
          </>
        )}
      </Button>
      {error && (
        <p className="text-sm text-rb-danger leading-snug" data-testid="google-connect-error">{error}</p>
      )}
    </div>
  );
}
