import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DiagnosticsBundle } from "@shared/diagnostics";
import { diagnosticsRows } from "@/lib/diagnostics-rows";

const DIAGNOSTICS_URL = "/api/system/diagnostics?view=redacted";

/**
 * Settings → System → Diagnostics (beta-launch brief 05). Shows the
 * redacted bundle: the same document Copy puts on the clipboard, so what
 * the owner reads is exactly what they would paste to someone helping.
 */
export function SystemDiagnostics() {
  const [showLog, setShowLog] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data, isLoading, isError, refetch, isFetching } = useQuery<DiagnosticsBundle>({
    queryKey: [DIAGNOSTICS_URL],
    staleTime: 0,
    retry: false,
  });

  const handleCopy = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      (error) => console.error("Copying diagnostics failed:", error),
    );
  };

  if (isLoading) return <p className="text-xs text-rb-muted">Reading diagnostics…</p>;
  if (isError || !data) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-rb-warn-ink">Couldn't read diagnostics from the app's server.</p>
        <Button variant="outline" size="sm" className="touch-button" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      </div>
    );
  }

  const rows = diagnosticsRows(data, new Date());
  return (
    <div className="space-y-3" data-testid="system-diagnostics">
      <dl className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={`${row.label}-${i}`} className="flex gap-2 text-xs leading-snug">
            <dt className="w-32 flex-shrink-0 text-rb-muted flex items-start gap-1">
              {row.warn && <AlertTriangle className="h-3.5 w-3.5 text-rb-warn flex-shrink-0" aria-label="needs attention" />}
              {row.label}
            </dt>
            <dd className={`flex-1 min-w-0 break-words ${row.warn ? "text-rb-warn-ink" : "text-rb-ink-secondary"}`}>{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="touch-button flex-1" onClick={handleCopy} data-testid="diagnostics-copy">
          {copied ? <Check className="h-4 w-4 mr-2 text-rb-success" /> : <Copy className="h-4 w-4 mr-2" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="outline" size="sm" className="touch-button flex-1" onClick={() => setShowLog((v) => !v)} data-testid="diagnostics-toggle-log">
          {showLog ? "Hide details" : "Show details"}
        </Button>
        <Button variant="outline" size="sm" className="touch-button" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh diagnostics">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <p className="text-xs text-rb-faint leading-snug">
        Copy gives the same view, with no Wi-Fi name, IP address or email. It stays on this kiosk until you paste it somewhere.
      </p>

      {showLog && (
        <pre
          className="max-h-48 overflow-auto rounded-md bg-rb-canvas border border-rb-chip-hover p-2 text-[10px] leading-tight whitespace-pre-wrap break-all"
          data-testid="diagnostics-log"
        >
          {data.logTail.length > 0 ? data.logTail.join("\n") : "No log lines yet."}
        </pre>
      )}
    </div>
  );
}
