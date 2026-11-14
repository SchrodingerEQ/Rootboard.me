import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import {
  ArrowRight,
  Cable,
  CheckCircle2,
  Clock,
  CloudSun,
  Lock,
  RefreshCw,
  Wifi,
  WifiOff,
  X,
  CalendarDays,
} from "lucide-react";
import type { WeatherLocation } from "@shared/dashboard-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthDialog } from "@/components/calendar/auth-dialog";
import { WeatherLocationSettings } from "@/components/calendar/weather-location-settings";
import {
  canSkip,
  connectFailureSentence,
  defaultTimezone,
  FAILURE_COPY,
  filterTimezones,
  formatTimeIn,
  isOpenedFromSettings,
  isPlausibleWifiPassword,
  signalBars,
  stepsFor,
  type SetupMode,
  type SetupStepId,
} from "@/lib/setup-wizard";

/**
 * First-run setup wizard (beta-launch brief 03, docs/SPEC.md §3.11).
 * Welcome → Network → Time zone → Google → Weather → Done, all by touch with
 * the global on-screen keyboard. At boot the shell renders this in place of
 * the widget host; from Settings it opens over the dashboard.
 *
 * Session 1 of the brief: the Google step shows today's service-account
 * instructions (AuthDialog) as a placeholder until brief 02's connect dialog
 * replaces it.
 */

export interface SetupWizardProps {
  mode: SetupMode;
  weatherLocation?: WeatherLocation;
  /** Absent when the dashboard config has not loaded (nothing to save onto). */
  onSaveWeatherLocation?: (location: WeatherLocation) => void;
  googleConnected: boolean;
  googleError?: string | null;
  /** `finished` is true when the user reached the end (Done / the last
   *  step), false when they closed it from Settings part-way. */
  onClose: (finished: boolean) => void;
}

// --- Server types (server/services/networkService.ts) ----------------------

interface NetworkStatus {
  managed: boolean;
  timezoneManaged: boolean;
  connected: boolean;
  connection: { type: "wifi" | "ethernet"; device: string; name: string; ip: string | null } | null;
  hasWifiDevice: boolean;
  internet?: "reachable" | "unreachable";
  uptimeSeconds: number;
}

interface WifiNetwork {
  ssid: string;
  signal: number;
  secured: boolean;
  inUse: boolean;
}

type TimezoneInfo = { managed: false } | { managed: true; current: string | null; zones: string[] };

async function getJson<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: T | null }> {
  const res = await fetch(url, { credentials: "include", ...init });
  const body = (await res.json().catch(() => null)) as T | null;
  return { ok: res.ok, status: res.status, body };
}

const postJson = <T,>(url: string, data: unknown) =>
  getJson<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

/** While the Network step shows, re-read the status this often so a saved
 *  connection coming up passes the step on its own (decision 2). */
const NETWORK_POLL_MS = 5_000;
/** The one-line confirmation stays this long before an auto-pass moves on. */
const AUTO_PASS_MS = 2_500;

// --- Shell -----------------------------------------------------------------

export function SetupWizard({ mode, weatherLocation, onSaveWeatherLocation, googleConnected, googleError, onClose }: SetupWizardProps) {
  const steps = stepsFor(mode);
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const fromSettings = isOpenedFromSettings(mode);

  const next = useCallback(() => {
    if (index + 1 >= steps.length) onClose(true);
    else setIndex(index + 1);
  }, [index, steps.length, onClose]);

  const progress: SetupStepId[] = steps.length > 1 ? steps.filter((s) => s !== "welcome" && s !== "done") : [];
  const progressIndex = progress.indexOf(step);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background text-rb-ink overflow-y-auto"
      data-setup-wizard
      data-testid="setup-wizard"
      data-step={step}
    >
      <div className="w-full max-w-2xl mx-auto px-8 pt-10 pb-8 flex flex-col gap-6">
        <div className="flex items-center gap-3 min-h-11">
          {progress.length > 0 && progressIndex >= 0 && (
            <p className="text-sm text-rb-muted" data-testid="setup-progress">
              Step {progressIndex + 1} of {progress.length}
            </p>
          )}
          <div className="flex-1" />
          {fromSettings && (
            <Button variant="ghost" className="h-11 px-3" onClick={() => onClose(false)} data-testid="setup-close">
              <X className="h-5 w-5 mr-1" />
              Close
            </Button>
          )}
        </div>

        {step === "welcome" && <WelcomeStep onNext={next} />}
        {step === "network" && <NetworkStep autoPass={mode !== "rerun" && mode !== "network"} onNext={next} lastStep={index === steps.length - 1} />}
        {step === "timezone" && <TimezoneStep onNext={next} lastStep={index === steps.length - 1} />}
        {step === "google" && <GoogleStep connected={googleConnected} error={googleError} onNext={next} />}
        {step === "weather" && <WeatherStep location={weatherLocation} onSave={onSaveWeatherLocation} onNext={next} />}
        {step === "done" && <DoneStep onFinish={next} />}

        {canSkip(step) && (
          <div className="flex justify-center">
            <Button variant="ghost" className="h-12 px-6 text-rb-muted" onClick={next} data-testid="setup-skip">
              Skip this step
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepHeader({ icon: Icon, title, children }: { icon: typeof Wifi; title: string; children?: ReactNode }) {
  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-semibold flex items-center gap-3">
        <Icon className="h-8 w-8 text-rb-accent shrink-0" />
        {title}
      </h1>
      {children && <div className="text-base text-rb-muted leading-relaxed">{children}</div>}
    </div>
  );
}

function PrimaryButton({ children, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button className="h-14 px-8 text-lg" {...props}>
      {children}
    </Button>
  );
}

/** A failure is one plain sentence and a Retry button (decision 9). */
function Failure({ sentence, onRetry }: { sentence: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-md bg-rb-danger-wash border border-rb-danger-border" role="alert" data-testid="setup-failure">
      <p className="flex-1 text-base text-rb-danger-ink">{sentence}</p>
      {onRetry && (
        <Button variant="outline" className="h-12 px-5" onClick={onRetry} data-testid="setup-retry">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      )}
    </div>
  );
}

function Managed({ what }: { what: string }) {
  return (
    <p className="p-4 rounded-md bg-rb-info-wash border border-rb-info-border text-base text-rb-info-ink" data-testid="setup-managed-outside">
      {what} is managed outside Rootboard on this computer, so there is nothing to set here.
    </p>
  );
}

// --- Welcome / Done ----------------------------------------------------------

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <>
      <StepHeader icon={CalendarDays} title="Welcome to Rootboard">
        A few quick steps get this screen ready: Wi-Fi, time zone, Google Calendar and weather.
        Everything here can be changed later from Settings → System.
      </StepHeader>
      <div>
        <PrimaryButton onClick={onNext} data-testid="setup-start">
          Get started
          <ArrowRight className="h-5 w-5 ml-2" />
        </PrimaryButton>
      </div>
    </>
  );
}

function DoneStep({ onFinish }: { onFinish: () => void }) {
  return (
    <>
      <StepHeader icon={CheckCircle2} title="All set">
        Rootboard is ready. Anything you skipped can be set from Settings → System → Run setup again.
      </StepHeader>
      <div>
        <PrimaryButton onClick={onFinish} data-testid="setup-finish">
          Go to the dashboard
          <ArrowRight className="h-5 w-5 ml-2" />
        </PrimaryButton>
      </div>
    </>
  );
}

// --- Network -------------------------------------------------------------------

type ScanState = { kind: "idle" } | { kind: "scanning" } | { kind: "done"; networks: WifiNetwork[] } | { kind: "error" };
type JoinTarget = { ssid: string; secured: boolean; hidden: boolean };
type JoinState =
  | { kind: "idle" }
  | { kind: "joining" }
  | { kind: "failed"; sentence: string }
  | { kind: "joined"; internet: "checking" | "reachable" | "unreachable" };

function NetworkStep({ autoPass, onNext, lastStep }: { autoPass: boolean; onNext: () => void; lastStep: boolean }) {
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [statusFailed, setStatusFailed] = useState(false);
  const [scan, setScan] = useState<ScanState>({ kind: "idle" });
  const [target, setTarget] = useState<JoinTarget | null>(null);
  const [password, setPassword] = useState("");
  const [join, setJoin] = useState<JoinState>({ kind: "idle" });
  const passedRef = useRef(false);

  const readStatus = useCallback(async (checkInternet = false) => {
    try {
      const r = await getJson<NetworkStatus>(`/api/system/network/status${checkInternet ? "?internet=1" : ""}`);
      if (!r.ok || !r.body) throw new Error(String(r.status));
      setStatus(r.body);
      setStatusFailed(false);
      return r.body;
    } catch {
      setStatusFailed(true);
      return null;
    }
  }, []);

  const runScan = useCallback(async () => {
    setScan({ kind: "scanning" });
    try {
      const r = await postJson<{ networks: WifiNetwork[] }>("/api/system/network/scan", {});
      if (!r.ok || !r.body) throw new Error(String(r.status));
      setScan({ kind: "done", networks: r.body.networks });
    } catch {
      setScan({ kind: "error" });
    }
  }, []);

  // First read, then poll while the step shows.
  useEffect(() => {
    let cancelled = false;
    void readStatus().then((s) => {
      if (!cancelled && s?.managed && s.hasWifiDevice) void runScan();
    });
    const timer = window.setInterval(() => void readStatus(), NETWORK_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [readStatus, runScan]);

  // Auto-pass (decision 2): at boot, Ethernet, a connection that is already
  // up, or a saved one coming up while this shows — after a one-line
  // confirmation. Never while the user is typing a password or joining, and
  // never from Settings, where the point is to change the network.
  const connected = status?.connected === true;
  // Hold an auto-pass while a join is in hand, and after one whose internet
  // check failed, so its sentence and Retry stay readable.
  const holdForInternet = join.kind === "joined" && join.internet !== "reachable";
  const busy = target !== null || join.kind === "joining" || holdForInternet;
  const unmanaged = status !== null && !status.managed;
  useEffect(() => {
    if (passedRef.current) return;
    if (!(unmanaged || (autoPass && connected && !busy))) return;
    const timer = window.setTimeout(() => {
      passedRef.current = true;
      onNext();
    }, AUTO_PASS_MS);
    return () => window.clearTimeout(timer);
  }, [unmanaged, autoPass, connected, busy, onNext]);

  const doJoin = async (t: JoinTarget) => {
    setJoin({ kind: "joining" });
    try {
      const r = await postJson<{ status: string; reason?: string }>("/api/system/network/connect", {
        ssid: t.ssid,
        password: t.secured ? password : "",
        hidden: t.hidden || undefined,
      });
      if (r.body?.status !== "connected") {
        setJoin({ kind: "failed", sentence: r.status >= 500 && !r.body?.reason ? FAILURE_COPY.server : connectFailureSentence(r.body?.reason) });
        return;
      }
      // The password has done its job; drop it from memory now.
      setPassword("");
      setJoin({ kind: "joined", internet: "checking" });
      setTarget(null);
      const s = await readStatus(true);
      setJoin({ kind: "joined", internet: s?.internet === "reachable" ? "reachable" : "unreachable" });
    } catch {
      setJoin({ kind: "failed", sentence: FAILURE_COPY.server });
    }
  };

  const recheckInternet = async () => {
    setJoin({ kind: "joined", internet: "checking" });
    const s = await readStatus(true);
    setJoin({ kind: "joined", internet: s?.internet === "reachable" ? "reachable" : "unreachable" });
  };

  const pick = (t: JoinTarget) => {
    setTarget(t);
    setPassword("");
    setJoin({ kind: "idle" });
    if (!t.secured && !t.hidden) void doJoin(t);
  };

  const cancelPick = () => {
    setTarget(null);
    setPassword("");
    setJoin({ kind: "idle" });
  };

  if (status === null && !statusFailed) {
    return <StepHeader icon={Wifi} title="Network">Checking the network…</StepHeader>;
  }
  if (statusFailed && status === null) {
    return (
      <>
        <StepHeader icon={WifiOff} title="Network" />
        <Failure sentence={FAILURE_COPY.server} onRetry={() => void readStatus()} />
      </>
    );
  }
  if (unmanaged) {
    return (
      <>
        <StepHeader icon={Wifi} title="Network" />
        <Managed what="The network" />
        <div>
          <PrimaryButton onClick={() => { passedRef.current = true; onNext(); }} data-testid="setup-network-continue">
            Continue
          </PrimaryButton>
        </div>
      </>
    );
  }

  const s = status!;
  const ethernet = s.connection?.type === "ethernet";
  const continueLabel = lastStep ? "Done" : "Continue";

  return (
    <>
      <StepHeader icon={ethernet ? Cable : Wifi} title={ethernet || !s.hasWifiDevice ? "Network" : "Connect to Wi-Fi"}>
        {!connected && !s.hasWifiDevice && "Not connected. Plug in an Ethernet cable — this computer has no Wi-Fi."}
      </StepHeader>

      {connected && s.connection && (
        <div className="flex items-center gap-3 p-4 rounded-md border border-rb-grid-line bg-rb-surface" data-testid="setup-network-connected">
          <CheckCircle2 className="h-6 w-6 text-rb-success shrink-0" />
          <p className="flex-1 text-lg">
            {ethernet ? "Connected by Ethernet." : `Connected to ${s.connection.name}.`}
            {autoPass && !busy && <span className="text-rb-muted"> Moving on…</span>}
          </p>
          {(!autoPass || holdForInternet) && (
            <PrimaryButton onClick={onNext} data-testid="setup-network-continue">
              {continueLabel}
            </PrimaryButton>
          )}
        </div>
      )}

      {join.kind === "joined" && join.internet === "unreachable" && (
        <Failure sentence={FAILURE_COPY.noInternet} onRetry={() => void recheckInternet()} />
      )}
      {join.kind === "joined" && join.internet === "checking" && (
        <p className="text-base text-rb-muted">Checking the internet connection…</p>
      )}

      {/* Picked a network: the password form sits at the top, above where
          the on-screen keyboard opens. */}
      {target && (
        <div className="space-y-3 p-4 rounded-md border border-rb-grid-line bg-rb-surface" data-testid="setup-join-form">
          {target.hidden ? (
            <Input
              value={target.ssid}
              onChange={(e) => setTarget({ ...target, ssid: e.target.value })}
              placeholder="Network name"
              aria-label="Network name"
              maxLength={32}
              autoFocus
              className="h-14 text-lg"
              data-testid="setup-hidden-ssid"
            />
          ) : (
            <p className="text-lg font-medium">{target.ssid}</p>
          )}
          {target.secured && (
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && isPlausibleWifiPassword(password, true) && target.ssid && void doJoin(target)}
              placeholder="Password"
              aria-label="Wi-Fi password"
              autoComplete="off"
              autoFocus={!target.hidden}
              maxLength={64}
              className="h-14 text-lg"
              data-testid="setup-password"
            />
          )}
          {target.hidden && (
            <label className="flex items-center gap-3 text-base">
              <input
                type="checkbox"
                className="h-6 w-6"
                checked={target.secured}
                onChange={(e) => setTarget({ ...target, secured: e.target.checked })}
                data-testid="setup-hidden-secured"
              />
              This network has a password
            </label>
          )}
          {/* The Connect button below doubles as this failure's Retry. */}
          {join.kind === "failed" && <Failure sentence={join.sentence} />}
          <div className="flex gap-3">
            <PrimaryButton
              onClick={() => void doJoin(target)}
              disabled={join.kind === "joining" || !target.ssid || !isPlausibleWifiPassword(password, target.secured)}
              data-testid="setup-join"
            >
              {join.kind === "joining" ? "Connecting…" : join.kind === "failed" ? "Retry" : "Connect"}
            </PrimaryButton>
            <Button variant="outline" className="h-14 px-6 text-lg" onClick={cancelPick} disabled={join.kind === "joining"}>
              Back
            </Button>
          </div>
        </div>
      )}

      {!target && s.hasWifiDevice && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <p className="flex-1 text-base text-rb-muted">{connected ? "Or choose a different network:" : "Choose your network:"}</p>
            <Button variant="outline" className="h-12 px-5" onClick={() => void runScan()} disabled={scan.kind === "scanning"} data-testid="setup-scan">
              <RefreshCw className={`h-4 w-4 mr-2 ${scan.kind === "scanning" ? "animate-spin" : ""}`} />
              {scan.kind === "scanning" ? "Looking…" : "Look again"}
            </Button>
          </div>
          {scan.kind === "error" && <Failure sentence={FAILURE_COPY.scan} onRetry={() => void runScan()} />}
          {scan.kind === "done" && scan.networks.length === 0 && (
            <p className="text-base text-rb-muted">No networks found nearby.</p>
          )}
          {scan.kind === "done" && (
            <div className="space-y-2" data-testid="setup-networks">
              {scan.networks.map((n) => (
                <button
                  key={n.ssid}
                  type="button"
                  onClick={() => pick({ ssid: n.ssid, secured: n.secured, hidden: false })}
                  className="w-full h-14 px-4 flex items-center gap-3 rounded-md border border-rb-grid-line bg-rb-surface hover:bg-rb-chip-hover text-left text-lg"
                  data-testid="setup-network-row"
                >
                  <SignalIcon signal={n.signal} />
                  <span className="flex-1 truncate">{n.ssid}</span>
                  {n.inUse && <span className="text-sm text-rb-success">Connected</span>}
                  {n.secured && <Lock className="h-4 w-4 text-rb-muted" aria-label="Password required" />}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => pick({ ssid: "", secured: true, hidden: true })}
            className="w-full h-14 px-4 rounded-md border border-dashed border-rb-border-strong text-left text-lg text-rb-muted hover:bg-rb-chip-hover"
            data-testid="setup-hidden-network"
          >
            Network not listed? Type its name
          </button>
          {/* Principle 5: say what leaves the kiosk. */}
          <p className="text-sm text-rb-faint leading-snug">
            The Wi-Fi password is stored only by this computer's own network settings — never in Rootboard's files or logs.
            After joining, Rootboard checks the internet with one request to www.googleapis.com, Google's API address; it
            sends nothing about you.
          </p>
        </div>
      )}
    </>
  );
}

function SignalIcon({ signal }: { signal: number }) {
  const bars = signalBars(signal);
  return (
    <span className="flex items-end gap-0.5 h-5 w-6" aria-label={`Signal ${bars} of 4`}>
      {[1, 2, 3, 4].map((b) => (
        <span key={b} className={`w-1 rounded-sm ${b <= bars ? "bg-rb-ink" : "bg-rb-grid-line"}`} style={{ height: `${b * 25}%` }} />
      ))}
    </span>
  );
}

// --- Time zone -------------------------------------------------------------------

function useNow(intervalMs = 1_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

type TzSave = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; zone: string } | { kind: "failed" };

function TimezoneStep({ onNext, lastStep }: { onNext: () => void; lastStep: boolean }) {
  const [info, setInfo] = useState<TimezoneInfo | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [save, setSave] = useState<TzSave>({ kind: "idle" });
  const now = useNow();

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const r = await getJson<TimezoneInfo>("/api/system/timezone");
      if (!r.ok || !r.body) throw new Error(String(r.status));
      setInfo(r.body);
      if (r.body.managed) {
        const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setSelected(defaultTimezone(r.body.zones, browserZone, r.body.current));
      }
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const zones = info?.managed ? info.zones : [];
  const matches = useMemo(() => filterTimezones(zones, query), [zones, query]);

  const confirm = async () => {
    if (!selected) return;
    setSave({ kind: "saving" });
    try {
      const r = await postJson<{ status: string }>("/api/system/timezone", { timezone: selected });
      if (!r.ok) throw new Error(String(r.status));
      setSave({ kind: "saved", zone: selected });
      setInfo((prev) => (prev?.managed ? { ...prev, current: selected } : prev));
    } catch {
      setSave({ kind: "failed" });
    }
  };

  const continueLabel = lastStep ? "Done" : "Continue";

  if (loadFailed) {
    return (
      <>
        <StepHeader icon={Clock} title="Time zone" />
        <Failure sentence={FAILURE_COPY.server} onRetry={() => void load()} />
      </>
    );
  }
  if (!info) return <StepHeader icon={Clock} title="Time zone">Reading the time zone…</StepHeader>;
  if (!info.managed) {
    return (
      <>
        <StepHeader icon={Clock} title="Time zone">It's {formatTimeIn(Intl.DateTimeFormat().resolvedOptions().timeZone, now)} here.</StepHeader>
        <Managed what="The time zone" />
        <div>
          <PrimaryButton onClick={onNext} data-testid="setup-timezone-continue">{continueLabel}</PrimaryButton>
        </div>
      </>
    );
  }

  // The browser keeps the zone it started with, so after a change the
  // dashboard's own clock may lag until Firefox restarts. Say so rather than
  // let a wrong clock look like a failed setting.
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <>
      <StepHeader icon={Clock} title="Time zone">
        Pick where this Rootboard lives so events show at the right time.
      </StepHeader>

      {save.kind === "saved" ? (
        <div className="space-y-3 p-4 rounded-md border border-rb-grid-line bg-rb-surface" data-testid="setup-timezone-saved">
          <p className="text-lg flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-rb-success shrink-0" />
            Time zone set to {save.zone.replace(/_/g, " ")}. It's {formatTimeIn(save.zone, now)} there now.
          </p>
          {browserZone !== save.zone && (
            <p className="text-base text-rb-muted">The dashboard clock follows after the next restart.</p>
          )}
          <PrimaryButton onClick={onNext} data-testid="setup-timezone-continue">{continueLabel}</PrimaryButton>
        </div>
      ) : (
        <>
          <div className="p-4 rounded-md border border-rb-grid-line bg-rb-surface">
            <p className="text-sm text-rb-muted">Selected</p>
            <p className="text-2xl font-medium" data-testid="setup-timezone-selected">
              {selected ? `${selected.replace(/_/g, " ")} — ${formatTimeIn(selected, now)}` : "None"}
            </p>
            {info.current && info.current !== selected && (
              <p className="text-sm text-rb-muted mt-1">Now set to {info.current.replace(/_/g, " ")} ({formatTimeIn(info.current, now)})</p>
            )}
          </div>
          {save.kind === "failed" && <Failure sentence={FAILURE_COPY.timezone} onRetry={() => void confirm()} />}
          <div>
            <PrimaryButton onClick={() => void confirm()} disabled={!selected || save.kind === "saving"} data-testid="setup-timezone-confirm">
              {save.kind === "saving" ? "Setting…" : "Use this time zone"}
            </PrimaryButton>
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search, e.g. New York"
            aria-label="Search time zones"
            className="h-14 text-lg"
            data-testid="setup-timezone-search"
          />
          <div className="space-y-2" data-testid="setup-timezone-list">
            {matches.map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setSelected(z)}
                className={`w-full h-12 px-4 flex items-center rounded-md border text-left text-base ${
                  z === selected ? "border-rb-accent bg-rb-accent-wash" : "border-rb-grid-line bg-rb-surface hover:bg-rb-chip-hover"
                }`}
              >
                <span className="flex-1 truncate">{z.replace(/_/g, " ")}</span>
                <span className="text-rb-muted">{formatTimeIn(z, now)}</span>
              </button>
            ))}
            {matches.length === 0 && <p className="text-base text-rb-muted">No time zone matches that.</p>}
          </div>
        </>
      )}
    </>
  );
}

// --- Google (session 1 placeholder) ------------------------------------------------

function GoogleStep({ connected, error, onNext }: { connected: boolean; error?: string | null; onNext: () => void }) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <>
      <StepHeader icon={CalendarDays} title="Google Calendar">
        {connected ? "Google Calendar is connected." : "Rootboard isn't connected to Google Calendar yet."}
      </StepHeader>
      <div className="flex gap-3">
        {!connected && (
          <PrimaryButton variant="outline" onClick={() => setShowHelp(true)} data-testid="setup-google-help">
            How to connect
          </PrimaryButton>
        )}
        {connected && <PrimaryButton onClick={onNext} data-testid="setup-google-continue">Continue</PrimaryButton>}
      </div>
      <AuthDialog open={showHelp} onOpenChange={setShowHelp} error={error} />
    </>
  );
}

// --- Weather ---------------------------------------------------------------------

function WeatherStep({ location, onSave, onNext }: { location?: WeatherLocation; onSave?: (l: WeatherLocation) => void; onNext: () => void }) {
  return (
    <>
      <StepHeader icon={CloudSun} title="Weather">
        Enter a postal code to show the local forecast.
      </StepHeader>
      {onSave ? (
        <div className="p-4 rounded-md border border-rb-grid-line bg-rb-surface [&_input]:text-lg">
          <WeatherLocationSettings location={location} onSave={onSave} />
        </div>
      ) : (
        <Failure sentence={FAILURE_COPY.server} />
      )}
      {location && (
        <div>
          <PrimaryButton onClick={onNext} data-testid="setup-weather-continue">Continue</PrimaryButton>
        </div>
      )}
    </>
  );
}
