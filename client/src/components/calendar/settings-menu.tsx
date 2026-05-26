import { useState } from "react";
import { Settings, Sun, Moon, Calendar, X, Info, RotateCcw, RefreshCw, Plus } from "lucide-react";
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
  visibleCalendarsInHeader: Set<string>;
  onCalendarToggle: (calendarId: string, visible: boolean) => void;
  setBrightness?: (brightness: number) => void;
  currentBrightness?: number;
  onCheckForUpdates?: () => void;
  onRollback?: () => void;
  onSubscribeSuccess?: () => void;
}

export function SettingsMenu({ 
  visibleCalendarsInHeader, 
  onCalendarToggle,
  setBrightness: externalSetBrightness,
  currentBrightness = 1.0,
  onCheckForUpdates,
  onRollback,
  onSubscribeSuccess,
}: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [brightness, setBrightness] = useState(() => {
    const saved = localStorage.getItem('calendar-brightness');
    return saved ? parseInt(saved) : Math.round(currentBrightness * 100);
  });
  const [calendarIdInput, setCalendarIdInput] = useState('');
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
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

  // Get calendars for selection
  const { data: calendars, isLoading } = useQuery<CalendarInfo[]>({
    queryKey: ['/api/calendar/calendars'],
    enabled: true,
    staleTime: 5 * 60 * 1000,
  });

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
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 text-gray-600 hover:text-gray-800 hover:bg-gray-100"
          >
            <Settings className="h-6 w-6" />
          </Button>
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
                <Moon className="h-3 w-3 text-gray-400" />
                <Slider
                  value={[brightness]}
                  onValueChange={handleBrightnessChange}
                  max={150}
                  min={30}
                  step={5}
                  className="flex-1"
                />
                <Sun className="h-4 w-4 text-gray-600" />
              </div>
              <p className="text-xs text-gray-500">{brightness}%</p>
            </div>

            <Separator />

            {/* Calendar Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <Label className="text-sm font-medium">Calendar Visibility</Label>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-6 [&::-webkit-scrollbar]:w-4 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-400 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-gray-100">
                {isLoading ? (
                  <div className="text-xs text-gray-500">Loading calendars...</div>
                ) : calendars && calendars.length > 0 ? (
                  calendars.map((calendar) => {
                    const isVisible = visibleCalendarsInHeader.has(calendar.id);
                    const color = getCalendarColor(calendar);
                    
                    return (
                      <div key={calendar.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-sm truncate">{calendar.summary}</span>
                        </div>
                        <Switch
                          checked={isVisible}
                          onCheckedChange={(checked) => 
                            onCalendarToggle(calendar.id, checked)
                          }
                        />
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-gray-500">No calendars available</div>
                )}
              </div>
            </div>

            {/* Add Calendar by ID */}
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <Input
                  value={calendarIdInput}
                  onChange={(e) => { setCalendarIdInput(e.target.value); setSubscribeError(null); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubscribe()}
                  placeholder="email@example.com or calendar ID"
                  className="text-xs h-8 flex-1"
                  disabled={subscribeMutation.isPending}
                />
                <Button
                  size="sm"
                  className="h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={handleSubscribe}
                  disabled={!calendarIdInput.trim() || subscribeMutation.isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {subscribeError && (
                <p className="text-xs text-red-600 leading-snug">{subscribeError}</p>
              )}
              <p className="text-xs text-gray-400 leading-snug">
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
                    className="flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
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
                    className="flex-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
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
            <div className="flex items-center justify-between text-xs text-gray-500">
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