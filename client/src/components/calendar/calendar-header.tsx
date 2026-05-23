import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarIcon, ChevronLeft, ChevronRight, RefreshCw, Key, Moon, AlertTriangle, Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { CalendarView } from "@/pages/calendar";
import logoImage from "@assets/image_1753142842256.png";

interface CalendarHeaderProps {
  currentView: CalendarView;
  currentDate: Date;
  onViewChange: (view: CalendarView) => void;
  onNavigate: (direction: number) => void;
  onToday: () => void;
  onRefresh: () => void;
  onAuth: () => void;
  onSleep: () => void;
  onNewEvent?: () => void;
  isRefreshing: boolean;
  needsAuth?: boolean;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  settingsButton?: React.ReactNode;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "unknown";
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec} sec ago`;
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.round(hr / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function CalendarHeader({
  currentView,
  currentDate,
  onViewChange,
  onNavigate,
  onToday,
  onRefresh,
  onAuth,
  onSleep,
  onNewEvent,
  isRefreshing,
  needsAuth,
  lastSyncAt,
  lastSyncError,
  settingsButton
}: CalendarHeaderProps) {
  // Re-render every 30s so the relative timestamp stays fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30 * 1000);
    return () => clearInterval(id);
  }, []);
  const getDateTitle = () => {
    if (currentView === 'month') {
      return currentDate.toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
      });
    } else if (currentView === 'week') {
      return `Week of ${currentDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric'
      })}`;
    } else if (currentView === 'day') {
      return currentDate.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric'
      });
    }
  };

  return (
    <header className="bg-white border-b border-border px-3 py-0.5 flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-3">
        {/* Custom Logo */}
        <div className="flex items-center">
          <img 
            src={logoImage} 
            alt="McMurry Hurricane Logo" 
            className="h-16 w-auto"
          />
        </div>
        
        {/* Navigation Controls */}
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            className="touch-button px-2 py-1 text-[hsl(var(--google-gray))] hover:bg-[hsl(var(--google-light-gray))] h-14 w-14"
            onClick={() => onNavigate(-1)}
          >
            <ChevronLeft size={30} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="touch-button px-2 py-1 text-[hsl(var(--google-gray))] hover:bg-[hsl(var(--google-light-gray))] h-14 w-14"
            onClick={() => onNavigate(1)}
          >
            <ChevronRight size={30} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="touch-button px-4 py-2 text-[hsl(var(--google-blue))] hover:bg-blue-50 font-medium text-base h-10"
            onClick={onToday}
          >
            Today
          </Button>
        </div>
      </div>
      
      {/* Current Date Display */}
      <div className="flex-1 text-center">
        <h2 className="text-lg font-medium text-[hsl(var(--google-gray))]">
          {getDateTitle()}
        </h2>
      </div>
      
      {/* View Toggle and Actions */}
      <div className="flex items-center space-x-2">
        {/* View Toggle Buttons */}
        <div className="flex items-center space-x-1 bg-[hsl(var(--google-light-gray))] rounded-lg p-0.5">
          <Button
            variant={currentView === 'day' ? 'default' : 'ghost'}
            size="sm"
            className={`touch-button px-4 py-2 rounded-md transition-colors text-base font-medium h-10 ${
              currentView === 'day' 
                ? 'bg-emerald-400 hover:bg-emerald-500 text-white shadow-sm' 
                : 'text-[hsl(var(--google-gray))] hover:bg-white'
            }`}
            onClick={() => onViewChange('day')}
          >
            Day
          </Button>
          <Button
            variant={currentView === 'week' ? 'default' : 'ghost'}
            size="sm"
            className={`touch-button px-4 py-2 rounded-md transition-colors text-base font-medium h-10 ${
              currentView === 'week' 
                ? 'bg-emerald-400 hover:bg-emerald-500 text-white shadow-sm' 
                : 'text-[hsl(var(--google-gray))] hover:bg-white'
            }`}
            onClick={() => onViewChange('week')}
          >
            Week
          </Button>
          <Button
            variant={currentView === 'month' ? 'default' : 'ghost'}
            size="sm"
            className={`touch-button px-4 py-2 rounded-md transition-colors text-base font-medium h-10 ${
              currentView === 'month' 
                ? 'bg-emerald-400 hover:bg-emerald-500 text-white shadow-sm' 
                : 'text-[hsl(var(--google-gray))] hover:bg-white'
            }`}
            onClick={() => onViewChange('month')}
          >
            Month
          </Button>
        </div>
        
        {/* New Event Button */}
        {onNewEvent && (
          <Button
            size="sm"
            className="touch-button bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 text-base h-10"
            onClick={onNewEvent}
            data-testid="button-new-event"
          >
            <Plus className="mr-1" size={18} />
            New Event
          </Button>
        )}

        {/* Sleep Button */}
        <button
          onClick={onSleep}
          className="touch-button px-5 py-2 bg-sky-400 hover:bg-sky-500 text-white text-base font-medium rounded-full transition-colors h-10"
          data-testid="button-sleep"
        >
          SLEEP
        </button>
        
        {/* Auth Button */}
        {needsAuth && (
          <Button
            size="sm"
            className="touch-button bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-base h-10"
            onClick={onAuth}
          >
            <Key className="mr-1" size={18} />
            Connect Google
          </Button>
        )}
        
        {/* Sync health indicator */}
        {(lastSyncAt || lastSyncError) && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex items-center space-x-1.5 text-xs text-[hsl(var(--google-gray))] px-2"
                  data-testid="sync-status-indicator"
                >
                  {lastSyncError ? (
                    <AlertTriangle
                      size={16}
                      className="text-red-600"
                      data-testid="sync-error-icon"
                    />
                  ) : (
                    <span
                      className="inline-block h-2 w-2 rounded-full bg-emerald-500"
                      data-testid="sync-ok-dot"
                    />
                  )}
                  <span>
                    {lastSyncAt
                      ? `Updated: ${formatRelative(lastSyncAt)}`
                      : "Not yet synced"}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {lastSyncError ? (
                  <div className="max-w-xs">
                    <div className="font-medium text-red-600">Last sync failed</div>
                    <div className="text-xs mt-1 break-words">{lastSyncError}</div>
                  </div>
                ) : (
                  <div className="text-xs">
                    Last successful sync:{" "}
                    {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "never"}
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Refresh Button */}
        <Button
          size="sm"
          className="touch-button bg-[hsl(var(--google-blue))] text-white hover:bg-[hsl(var(--google-blue-hover))] px-4 py-2 text-base h-10"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`mr-1 ${isRefreshing ? 'animate-spin' : ''}`} size={18} />
          Refresh
        </Button>
        
        {/* Settings Button */}
        {settingsButton}
      </div>
    </header>
  );
}
