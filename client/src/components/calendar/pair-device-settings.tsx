import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DiagnosticsBundle } from "@shared/diagnostics";

const DEVICES_URL = "/api/system/paired-devices";
const CODE_URL = "/api/system/pairing-code";

interface PairedDevice {
  id: string;
  name: string;
  createdAt: string;
}

interface IssuedCode {
  code: string;
  expiresAt: string;
  /** Devices already paired when this code was shown, to spot the new one. */
  knownIds: Set<string>;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message ?? `Request failed (${res.status})`);
  return body as T;
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
  const [justPaired, setJustPaired] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  const remaining = issued ? secondsLeft(issued.expiresAt, now) : 0;
  const codeLive = issued !== null && remaining > 0;

  const devicesQuery = useQuery<{ devices: PairedDevice[] }>({
    queryKey: [DEVICES_URL],
    staleTime: 0,
    retry: false,
    // Poll only while a code is showing, to notice the pairing land.
    refetchInterval: codeLive ? 2000 : false,
  });
  const devices = devicesQuery.data?.devices ?? [];

  // The kiosk screen may read the full view; it is the one place the LAN
  // address is shown, so the owner can type it on the other device.
  const { data: fullDiagnostics } = useQuery<DiagnosticsBundle>({
    queryKey: ["/api/system/diagnostics?view=full"],
    staleTime: 0,
    retry: false,
  });
  const lanIp = fullDiagnostics?.network.ip ?? null;

  const devicesRef = useRef<PairedDevice[]>([]);
  devicesRef.current = devices;
  const shownCodeRef = useRef<string | null>(null);

  const issueMutation = useMutation({
    mutationFn: async () => jsonOrThrow<{ code: string; expiresAt: string }>(await fetch(CODE_URL, { method: "POST", credentials: "include" })),
    onSuccess: (data) => {
      setError(null);
      setJustPaired(null);
      setNow(Date.now());
      shownCodeRef.current = data.code;
      setIssued({ ...data, knownIds: new Set(devicesRef.current.map((d) => d.id)) });
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
    issue();
    return () => {
      const code = shownCodeRef.current;
      if (!code) return;
      fetch(`${CODE_URL}?code=${encodeURIComponent(code)}`, { method: "DELETE", credentials: "include" }).catch((e) =>
        console.error("Cancelling the pairing code failed:", e),
      );
    };
  }, [issue]);

  useEffect(() => {
    if (!codeLive) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [codeLive]);

  // A device that wasn't there when the code was shown means the code was used.
  useEffect(() => {
    if (!issued) return;
    const added = devices.find((d) => !issued.knownIds.has(d.id));
    if (added) {
      setJustPaired(added.name);
      setIssued(null);
    }
  }, [devices, issued]);

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
        <p className="text-xs text-rb-muted">{issueMutation.isPending ? "Getting a code…" : "The code has expired."}</p>
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
