import { useState } from "react";
import { Settings, Sun, Moon, Calendar, X, Info, RotateCcw, RefreshCw, Plus, Trash2, Copy, Check, AlertTriangle, Keyboard } from "lucide-react";
import { Link } from "wouter";
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
import { APP_VERSION } from "@shared/version";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useOskMode } from "@/hooks/use-osk-mode";
import type { OskMode } from "@/lib/osk";

interface CalendarInfo {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  selected: boolean;
  accessRole: string;
}

interface SettingsMenuProps {
  /** Persisted calendar-widget setting `hiddenCalendars` (see
   *  client/src/widgets/calendar/shell-bridge.ts). A calendar is shown iff
   *  its id is NOT in here — a hidden-LIST, so a calendar the user has never
   *  touched (including one added after this setting was written) is visible
   *  by default. */
  hiddenCalendars: Set<string>;
  /** Writes `hiddenCalendars` through the shell's dashboard-config helper;
   *  persists to data/config/dashboard.json, so it survives a reload. */
  onCalendarToggle: (calendarId: string, visible: boolean) => void;
  setBrightness?: (brightness: number) => void;
  currentBrightness?: number;
  onCheckForUpdates?: () => void;
  onRollback?: () => void;
  onSubscribeSuccess?: () => void;
  onCalendarRemoved?: (calendarId: string) => void;
  /** Compact circular trigger (52px, rail-chip styling) for use in the nav rail, instead of the default header icon button. */
  compactTrigger?: boolean;
}

export function SettingsMenu({
  hiddenCalendars,
  onCalendarToggle,
  setBrightness: externalSetBrightness,
  currentBrightness = 1.0,
  onCheckForUpdates,
  onRollback,
  onSubscribeSuccess,
  onCalendarRemoved,
  compactTrigger = false,
}: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [brightness, setBrightness] = useState(() => {
    const saved = localStorage.getItem('calendar-brightness');
    return saved ? parseInt(saved) : Math.round(currentBrightness * 100);
  });
  const [oskMode, setOskMode] = useOskMode();
  const [calendarIdInput, setCalendarIdInput] = useState('');
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [calendarToRemove, setCalendarToRemove] = useState<CalendarInfo | null>(null);
  const [emailCopied, setEmailCopied] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const subscribeMutation = useMutation({
    mutationFn: async (calendarId: string) => {
      const res = await fetch('/api/calendar/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId }),
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message ?? `Request failed (${res.status})`);
      }
      return body;
    },
    onSuccess: (data) => {
      setCalendarIdInput('');
      setSubscribeError(null);
      toast({ title: `Added "${data.summary || data.id}"`, description: 'Syncing events now…' });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/calendars'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/sync-status'] });
      onSubscribeSuccess?.();
    },
    onError: (error: any) => {
      const msg = error?.message ?? 'Failed to subscribe to calendar.';
      setSubscribeError(msg);
    },
  });

  const handleSubscribe = () => {
    const id = calendarIdInput.trim();
    if (!id) return;
    setSubscribeError(null);
    subscribeMutation.mutate(id);
  };

  const unsubscribeMutation = useMutation({
    mutationFn: async (calendarId: string) => {
      const res = await fetch(`/api/calendar/calendars/${encodeURIComponent(calendarId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message ?? `Request failed (${res.status})`);
      }
      return body;
    },
    onSuccess: () => {
      const removedId = calendarToRemove?.id;
      const name = calendarToRemove?.summary || removedId || 'Calendar';
      setCalendarToRemove(null);
      toast({ title: `Removed "${name}"`, description: 'Calendar unsubscribed.' });
      if (removedId) onCalendarRemoved?.(removedId);
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/calendars'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
    },
    onError: (error: any) => {
      setCalendarToRemove(null);
      toast({ title: 'Failed to remove calendar', description: error?.message ?? 'Unknown error', variant: 'destructive' });
    },
  });

  // Get calendars for selection
  const { data: calendars, isLoading } = useQuery<CalendarInfo[]>({
    queryKey: ['/api/calendar/calendars'],
    enabled: true,
    staleTime: 5 * 60 * 1000,
  });

  const { data: serviceAccountData, isError: serviceAccountError } = useQuery<{ email: string }>({
    queryKey: ['/api/calendar/service-account-email'],
    enabled: isOpen,
    staleTime: Infinity,
    retry: false,
  });
  const serviceAccountEmail = serviceAccountData?.email ?? null;

  const handleCopyEmail = () => {
    if (!serviceAccountEmail) return;
    navigator.clipboard.writeText(serviceAccountEmail).then(() => {
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    });
  };

  const handleBrightnessChange = (value: number[]) => {
    const newBrightness = value[0];
    setBrightness(newBrightness);
    localStorage.setItem('calendar-brightness', newBrightness.toString());
    
    // Use external brightness control if available (screensaver integration)
    if (externalSetBrightness) {
      externalSetBrightness(newBrightness / 100); // Convert to 0-1 scale
    } else {
      // Fallback to direct DOM manipulation
      document.documentElement.style.filter = `brightness(${newBrightness}%)`;
    }
  };

  const getCalendarColor = (calendar: CalendarInfo): string => {
    if (calendar.backgroundColor) {
      return calendar.backgroundColor;
    }
    
    // Generate consistent color based on calendar ID
    const colors = [
      '#1a73e8', '#34a853', '#ea4335', '#ff9800', '#9c27b0', 
      '#795548', '#607d8b', '#e91e63', '#4caf50', '#ff5722', 
      '#3f51b5', '#009688'
    ];
    
    let hash = 0;
    for (let i = 0; i < calendar.id.length; i++) {
      hash = ((hash << 5) - hash + calendar.id.charCodeAt(i)) & 0xffffffff;
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Apply brightness on component mount
  useState(() => {
    document.documentElement.style.filter = `brightness(${brightness}%)`;
  });

  return (
    <>
      <AlertDialog open={!!calendarToRemove} onOpenChange={(open) => { if (!open) setCalendarToRemove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unsubscribe <strong>{calendarToRemove?.summary || calendarToRemove?.id}</strong> from the service account. Events from this calendar will no longer appear. You can re-add it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unsubscribeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rb-danger hover:bg-rb-danger-hover text-rb-on-color-ink"
              disabled={unsubscribeMutation.isPending}
              onClick={() => calendarToRemove && unsubscribeMutation.mutate(calendarToRemove.id)}
            >
              {unsubscribeMutation.isPending ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          {compactTrigger ? (
            <button
              className="flex items-center justify-center rounded-full bg-[var(--rb-chip)] text-rb-ink-secondary hover:bg-[var(--rb-chip-hover)] transition-colors"
              style={{ width: 52, height: 52, touchAction: "manipulation" }}
              title="Settings"
              data-testid="button-settings"
            >
              <Settings size={22} />
            </button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 text-rb-ink-secondary hover:text-rb-ink-soft hover:bg-rb-chip"
            >
              <Settings className="h-6 w-6" />
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-[416px] p-0" align="end">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Settings</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Separator />

            {/* Brightness Control */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4" />
                <Label className="text-sm font-medium">Brightness</Label>
              </div>
              <div className="flex items-center gap-3">
                <Moon className="h-3 w-3 text-rb-faint" />
                <Slider
                  value={[brightness]}
                  onValueChange={handleBrightnessChange}
                  max={150}
                  min={30}
                  step={5}
                  className="flex-1"
                />
                <Sun className="h-4 w-4 text-rb-ink-secondary" />
              </div>
              <p className="text-xs text-rb-muted">{brightness}%</p>
            </div>

            <Separator />

            {/* On-screen keyboard */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4" />
                <Label className="text-sm font-medium">On-screen keyboard</Label>
              </div>
              <div className="flex gap-1.5">
                {([
                  { value: 'auto', label: 'Auto' },
                  { value: 'on', label: 'Always' },
                  { value: 'off', label: 'Off' },
                ] as { value: OskMode; label: string }[]).map((opt) => (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant={oskMode === opt.value ? 'default' : 'outline'}
                    className="flex-1 h-8"
                    onClick={() => setOskMode(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-rb-faint leading-snug">
                Auto shows a touch keyboard on touchscreens only (e.g. the Pi kiosk).
              </p>
            </div>

            <Separator />

            {/* Calendar Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <Label className="text-sm font-medium">Calendar Visibility</Label>
              </div>
              {serviceAccountError ? (
                <div className="rounded-md bg-rb-warn-wash border border-rb-warn-border px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-rb-warn flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-rb-warn-ink leading-snug">
                    Key file not found —{" "}
                    <Link href="/setup" onClick={() => setIsOpen(false)} className="underline font-medium hover:text-rb-warn-ink">
                      visit the Setup Guide to get started
                    </Link>
                  </p>
                </div>
              ) : serviceAccountEmail ? (
                <div className="rounded-md bg-rb-canvas border border-rb-chip-hover px-3 py-2 space-y-1">
                  <p className="text-xs text-rb-muted">Share a Google Calendar with this email to make it available here.</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-rb-ink-secondary truncate flex-1 select-all">{serviceAccountEmail}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0 text-rb-faint hover:text-rb-ink-secondary"
                      onClick={handleCopyEmail}
                      title="Copy email"
                    >
                      {emailCopied ? <Check className="h-3.5 w-3.5 text-rb-success" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ) : null}
              <div className="space-y-2 max-h-40 overflow-y-auto pr-6 [&::-webkit-scrollbar]:w-4 [&::-webkit-scrollbar-track]:bg-rb-chip [&::-webkit-scrollbar-thumb]:bg-rb-scrollbar-thumb [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-rb-chip">
                {isLoading ? (
                  <div className="text-xs text-rb-muted">Loading calendars...</div>
                ) : calendars && calendars.length > 0 ? (
                  calendars.map((calendar) => {
                    const isVisible = !hiddenCalendars.has(calendar.id);
                    const color = getCalendarColor(calendar);
                    
                    return (
                      <div key={calendar.id} className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-sm truncate">{calendar.summary}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Switch
                            checked={isVisible}
                            onCheckedChange={(checked) => 
                              onCalendarToggle(calendar.id, checked)
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-rb-faint hover:text-rb-danger hover:bg-rb-danger-wash"
                            onClick={() => setCalendarToRemove(calendar)}
                            title="Remove calendar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-rb-muted">No calendars available</div>
                )}
              </div>
            </div>

            {/* Add Calendar by ID */}
            <div className="space-y-1.5">
              {/* 44px-tall input/button: kiosk touch targets, and roomier when
                  the on-screen keyboard is driving this field. */}
              <div className="flex gap-2">
                <Input
                  value={calendarIdInput}
                  onChange={(e) => { setCalendarIdInput(e.target.value); setSubscribeError(null); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubscribe()}
                  placeholder="email@example.com or calendar ID"
                  className="text-sm h-11 flex-1"
                  disabled={subscribeMutation.isPending}
                />
                <Button
                  size="sm"
                  className="h-11 px-4 bg-rb-success hover:bg-rb-success-hover text-rb-on-color-ink font-bold"
                  onClick={handleSubscribe}
                  disabled={!calendarIdInput.trim() || subscribeMutation.isPending}
                >
                  <Plus className="h-5 w-5" />
                  Add
                </Button>
              </div>
              {subscribeError && (
                <p className="text-xs text-rb-danger leading-snug">{subscribeError}</p>
              )}
              <p className="text-xs text-rb-faint leading-snug">
                Find Calendar ID in Google Calendar → Settings → Integrate calendar
              </p>
            </div>

            <Separator />

            {/* Update Controls */}
            <div className="space-y-2">
              <div className="flex gap-2">
                {onCheckForUpdates && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-rb-info hover:text-rb-info-hover hover:bg-rb-info-wash"
                    onClick={() => { onCheckForUpdates(); setIsOpen(false); }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Check for Updates
                  </Button>
                )}
                {onRollback && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-rb-warn hover:text-rb-warn-ink hover:bg-rb-warn-wash"
                    onClick={() => { onRollback(); setIsOpen(false); }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Roll Back
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            {/* Version Info */}
            <div className="flex items-center justify-between text-xs text-rb-muted">
              <div className="flex items-center gap-1">
                <Info className="h-3 w-3" />
                <span>Version {APP_VERSION}</span>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}