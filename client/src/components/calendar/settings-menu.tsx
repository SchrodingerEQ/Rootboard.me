import { useState } from "react";
import { Settings, Sun, Moon, LogOut, Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from "@/components/ui/dialog";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
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
}

export function SettingsMenu({ 
  visibleCalendarsInHeader, 
  onCalendarToggle,
  setBrightness: externalSetBrightness,
  currentBrightness = 1.0
}: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [brightness, setBrightness] = useState(() => {
    const saved = localStorage.getItem('calendar-brightness');
    return saved ? parseInt(saved) : Math.round(currentBrightness * 100);
  });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { toast } = useToast();

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

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        toast({
          title: "Logged out successfully",
          description: "You have been logged out of your Google Calendar account.",
        });
        // Refresh the page to reset the auth state
        window.location.reload();
      } else {
        throw new Error('Logout failed');
      }
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "There was an error logging out. Please try again.",
        variant: "destructive",
      });
    }
    setShowLogoutConfirm(false);
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
            className="h-8 w-8 text-gray-600 hover:text-gray-800 hover:bg-gray-100"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
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
              <div className="space-y-2 max-h-40 overflow-y-auto">
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

            <Separator />

            {/* Logout Button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => setShowLogoutConfirm(true)}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout from Google Calendar
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Logout Confirmation Dialog */}
      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to logout from your Google Calendar account? 
              You'll need to sign in again to view your calendar events.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => setShowLogoutConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}