import { Button } from "@/components/ui/button";
import { CalendarIcon, ChevronLeft, ChevronRight, RefreshCw, Key, Moon } from "lucide-react";
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
  isRefreshing: boolean;
  needsAuth?: boolean;
  settingsButton?: React.ReactNode;
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
  isRefreshing,
  needsAuth,
  settingsButton
}: CalendarHeaderProps) {
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
