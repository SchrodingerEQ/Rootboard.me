import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DiagnosticsBundle } from "@shared/diagnostics";
import { pairingOutcome, type PairedDeviceSummary } from "@/lib/pairing-outcome";

const DEVICES_URL = "/api/system/paired-devices";
const CODE_URL = "/api/system/pairing-code";
const POLL_MS = 2000;

interface IssuedCode {
  code: string;
  expiresAt: string;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message ?? `Request failed (${res.status})`);
  return body as T;
}

function cancelCode(code: string): void {
  fetch(`${CODE_URL}?code=${encodeURIComponent(code)}`, { method: "DELETE", credentials: "include" }).catch((e) =>
    console.error("Cancelling the pairing code failed:", e),
  );
}

function secondsLeft(expiresAt: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
}

/**
 * Settings → System → Pair a device (beta-launch brief 05, decision 0020).
 * Opening this screen shows a 6-digit code for 5 minutes; a laptop or agent
 * on the same network trades it for a token with POST /api/pair. Leaving
 * the screen cancels the code. Paired devices are listed with Revoke.
 */
export function PairDeviceSettings() {
  const queryClient = useQueryClient();
  const [issued, setIssued] = useState<IssuedCode | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const shownCodeRef = useRef<string | null>(null);

  const devicesQuery = useQuery<{ devices: PairedDeviceSummary[] }>({
    queryKey: [DEVICES_URL],
    staleTime: 0,
    retry: false,
  });
  const devices = devicesQuery.data?.devices ?? [];
  const refetchDevices = devicesQuery.refetch;

  // Ask the server whether the shown code still works: it can end early
  // (5 wrong tries, a restart), and the countdown alone wouldn't know.
  const codeStatus = useQuery<{ active: boolean }>({
    queryKey: [`${CODE_URL}?code=${issued?.code ?? ""}`],
    enabled: issued !== null,
    staleTime: 0,
    retry: false,
  });

  const refetchCodeStatus = codeStatus.refetch;

  const outcome = issued ? pairingOutcome(issued.expiresAt, codeStatus.data?.active, devices) : null;
  const remaining = issued ? secondsLeft(issued.expiresAt, now) : 0;
  const waiting = outcome?.kind === "waiting" && remaining > 0;

  // Poll only while a code is showing, to notice the pairing land.
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      refetchDevices();
      refetchCodeStatus();
    }, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      clearInterval(tick);
    };
  }, [waiting, refetchDevices, refetchCodeStatus]);

  // The kiosk screen may read the full view; it is the one place the LAN
  // address is shown, so the owner can type it on the other device.
  const { data: fullDiagnostics } = useQuery<DiagnosticsBundle>({
    queryKey: ["/api/system/diagnostics?view=full"],
    staleTime: 0,
    retry: false,
  });
  const lanIp = fullDiagnostics?.network.ip ?? null;

  const issueMutation = useMutation({
    mutationFn: async () => {
      const data = await jsonOrThrow<IssuedCode>(await fetch(CODE_URL, { method: "POST", credentials: "include" }));
      // The screen was left while this was in flight: nobody will see the
      // code, so cancel it rather than leave it live for 5 minutes.
      if (!mountedRef.current) {
        cancelCode(data.code);
        return null;
      }
      return data;
    },
    onSuccess: (data) => {
      if (!data) return;
      setError(null);
      setNow(Date.now());
      shownCodeRef.current = data.code;
      setIssued(data);
    },
    onError: (e: Error) => setError(e.message),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${DEVICES_URL}/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
      if (!res.ok && res.status !== 404) await jsonOrThrow(res);
    },
    onSuccess: () => {
      setConfirmRevoke(null);
      queryClient.invalidateQueries({ queryKey: [DEVICES_URL] });
    },
    onError: (e: Error) => setError(e.message),
  });

  // Show a code on open; cancel it on leave, so it never outlives the
  // screen. The cancel names the code it means, so a late cancel can't
  // remove a newer code (React's dev double-mount, or a quick re-open).
  const issue = issueMutation.mutate;
  useEffect(() => {
    mountedRef.current = true;
    issue();
    return () => {
      mountedRef.current = false;
      if (shownCodeRef.current) cancelCode(shownCodeRef.current);
    };
  }, [issue]);

  const codeLive = issued !== null && waiting;
  const justPaired = outcome?.kind === "paired" ? outcome.name : null;

  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, "0");

  return (
    <div className="space-y-3" data-testid="pair-device">
      {justPaired ? (
        <p className="text-sm text-rb-success" data-testid="pair-success">Paired “{justPaired}”.</p>
      ) : codeLive ? (
        <div className="space-y-1 text-center">
          <p className="text-xs text-rb-muted">Pairing code</p>
          <p className="font-mono text-4xl font-bold tracking-[0.3em]" data-testid="pairing-code">{issued.code}</p>
          <p className="text-xs text-rb-muted">Expires in {minutes}:{seconds}</p>
        </div>
      ) : (
        <p className="text-xs text-rb-muted">
          {issueMutation.isPending || !issued ? "Getting a code…" : "That code no longer works (it expired, or had too many wrong tries)."}
        </p>
      )}

      {!codeLive && !issueMutation.isPending && (
        <Button variant="outline" size="sm" className="touch-button w-full" onClick={() => issue()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {justPaired ? "Pair another device" : "Show a new code"}
        </Button>
      )}

      <p className="text-xs text-rb-faint leading-snug">
        On a laptop on the same Wi-Fi, send the code to{" "}
        <span className="font-mono text-rb-ink-secondary">{lanIp ? `http://${lanIp}:5000/api/pair` : "/api/pair on this kiosk"}</span>{" "}
        as {"{"}"code", "name"{"}"}. It gets a token that works until you revoke it here. Keep the token private: whoever has it can read and change this kiosk's calendar and settings.
      </p>

      {error && <p className="text-xs text-rb-danger leading-snug">{error}</p>}

      <div className="space-y-1.5">
        <p className="text-sm font-medium">Paired devices</p>
        {devices.length === 0 ? (
          <p className="text-xs text-rb-muted">None yet.</p>
        ) : (
          devices.map((d) => (
            <div key={d.id} className="flex items-center gap-2" data-testid={`paired-device-${d.id}`}>
              <Laptop className="h-4 w-4 flex-shrink-0 text-rb-ink-secondary" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm truncate">{d.name}</span>
                <span className="block text-xs text-rb-faint">Paired {new Date(d.createdAt).toLocaleDateString()}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="touch-button text-rb-danger hover:bg-rb-danger-wash"
                disabled={revokeMutation.isPending}
                onClick={() => (confirmRevoke === d.id ? revokeMutation.mutate(d.id) : setConfirmRevoke(d.id))}
                data-testid={`revoke-device-${d.id}`}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {confirmRevoke === d.id ? "Tap to confirm" : "Revoke"}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
