import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RefreshCw, Key, Moon, AlertTriangle, Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { WeatherIcon } from "./weather-icon";
import { useWeather } from "@/hooks/use-weather";
import type { CalendarView } from "@/pages/calendar";

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

// Reusable Circular icon button
function IconButton({ children, onClick, title, disabled }: { children: React.ReactNode; onClick?: () => void; title?: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="touch-button flex items-center justify-center rounded-full bg-[var(--rb-chip)] text-[#5b626d] hover:bg-[var(--rb-chip-hover)] transition-colors disabled:opacity-50"
      style={{ width: 46, height: 46 }}
    >
      {children}
    </button>
  );
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
}: CalendarHeaderProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  const weather = useWeather();

  const getDateTitle = () => {
    if (currentView === 'month') {
      return { main: currentDate.toLocaleDateString('en-US', { month: 'long' }), sub: currentDate.toLocaleDateString('en-US', { year: 'numeric' }) };
    } else if (currentView === 'week') {
      return { main: `Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, sub: currentDate.toLocaleDateString('en-US', { year: 'numeric' }) };
    }
    return { main: currentDate.toLocaleDateString('en-US', { weekday: 'long' }), sub: currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) };
  };

  const title = getDateTitle();

  const viewButton = (view: CalendarView, label: string) => (
    <Button
      variant="ghost"
      size="sm"
      // hover:text-* must be pinned on BOTH states: the ghost variant's
      // hover:text-accent-foreground is dark ink, and on the touchscreen
      // :hover sticks to the last tapped button — on the selected (dark)
      // button that made the label dark-on-dark, i.e. invisible.
      className={`touch-button px-5 rounded-full text-base font-bold transition-colors h-[38px] ${
        currentView === view
          ? 'bg-[#2b3038] text-white hover:bg-[#2b3038] hover:text-white'
          : 'text-[#5b626d] hover:bg-white hover:text-[#5b626d]'
      }`}
      onClick={() => onViewChange(view)}
    >
      {label}
    </Button>
  );

  return (
    <header className="bg-white px-7 py-3 flex items-center justify-between">
      {/* Left: nav + title + today */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <IconButton onClick={() => onNavigate(-1)} title="Previous"><ChevronLeft size={24} /></IconButton>
          <IconButton onClick={() => onNavigate(1)} title="Next"><ChevronRight size={24} /></IconButton>
        </div>
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-[30px] font-extrabold tracking-tight text-[#2b3038] leading-none">{title.main}</h1>
          <span className="text-[30px] font-normal text-[var(--rb-muted)] leading-none">{title.sub}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="touch-button px-5 h-10 rounded-full bg-[#eef4ff] text-[#2563eb] hover:bg-[#e1ebff] font-bold text-base"
          onClick={onToday}
        >
          Today
        </Button>

        {weather.isEnabled && weather.current && (
          <div
            className="flex items-center gap-2 h-10 px-4 rounded-full bg-[var(--rb-chip)]"
            data-testid="weather-chip"
          >
            <WeatherIcon icon={weather.current.icon} size={18} className="text-[#5b626d]" />
            <span className="text-base font-extrabold text-[#2b3038]">{weather.current.temp}°</span>
            <span className="text-sm font-bold text-[var(--rb-muted)]">
              {weather.current.label}
              {weather.location ? ` · ${weather.location}` : ""}
            </span>
          </div>
        )}
      </div>

      {/* Right: view toggle + actions */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1 bg-[var(--rb-chip)] rounded-full p-1">
          {viewButton('day', 'Day')}
          {viewButton('week', 'Week')}
          {viewButton('month', 'Month')}
        </div>

        {onNewEvent && (
          <Button
            size="sm"
            className="touch-button h-[46px] px-5 rounded-full bg-[var(--rb-accent)] hover:bg-[var(--rb-accent-hover)] text-white text-base font-bold shadow-[0_2px_6px_rgba(242,101,90,.35)]"
            onClick={onNewEvent}
            data-testid="button-new-event"
          >
            <Plus className="mr-1.5" size={20} strokeWidth={2.6} />
            Add Event
          </Button>
        )}

        {needsAuth && (
          <Button
            size="sm"
            className="touch-button h-[46px] px-4 rounded-full bg-[#16a34a] hover:bg-[#15803d] text-white text-base font-bold"
            onClick={onAuth}
          >
            <Key className="mr-1.5" size={18} />
            Connect Google
          </Button>
        )}

        {(lastSyncAt || lastSyncError) && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#8b919b] px-2" data-testid="sync-status-indicator">
                  {lastSyncError ? (
                    <AlertTriangle size={16} className="text-red-600" data-testid="sync-error-icon" />
                  ) : (
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" data-testid="sync-ok-dot" />
                  )}
                  <span>{lastSyncAt ? `Updated ${formatRelative(lastSyncAt)}` : "Not yet synced"}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {lastSyncError ? (
                  <div className="max-w-xs">
                    <div className="font-medium text-red-600">Last sync failed</div>
                    <div className="text-xs mt-1 break-words">{lastSyncError}</div>
                  </div>
                ) : (
                  <div className="text-xs">Last successful sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "never"}</div>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <IconButton onClick={onRefresh} title="Refresh" disabled={isRefreshing}>
          <RefreshCw className={isRefreshing ? 'animate-spin' : ''} size={22} />
        </IconButton>
        <Button
          variant="ghost"
          size="sm"
          className="touch-button h-[46px] px-5 rounded-full bg-[var(--rb-chip)] hover:bg-[var(--rb-chip-hover)] text-[#5b626d] text-base font-bold"
          onClick={onSleep}
          data-testid="button-sleep"
        >
          <Moon className="mr-1.5" size={20} />
          Sleep
        </Button>
      </div>
    </header>
  );
}
