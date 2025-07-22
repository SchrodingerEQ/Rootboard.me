import { Button } from "@/components/ui/button";
import { CalendarIcon, ChevronLeft, ChevronRight, RefreshCw, Key } from "lucide-react";
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
    <header className="bg-white border-b border-border px-3 py-1 flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-4">
        {/* Custom Logo */}
        <div className="flex items-center">
          <img 
            src={logoImage} 
            alt="McMurry Hurricane Logo" 
            className="h-12 w-auto"
          />
        </div>
        
        {/* Navigation Controls */}
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            className="touch-button px-2 py-1 text-[hsl(var(--google-gray))] hover:bg-[hsl(var(--google-light-gray))]"
            onClick={() => onNavigate(-1)}
          >
            <ChevronLeft size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="touch-button px-2 py-1 text-[hsl(var(--google-gray))] hover:bg-[hsl(var(--google-light-gray))]"
            onClick={() => onNavigate(1)}
          >
            <ChevronRight size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="touch-button px-3 py-1 text-[hsl(var(--google-blue))] hover:bg-blue-50 font-medium text-sm"
            onClick={onToday}
          >
            Today
          </Button>
        </div>
      </div>
      
      {/* Current Date Display */}
      <div className="flex-1 text-center">
        <h2 className="text-base font-medium text-[hsl(var(--google-gray))]">
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
            className={`touch-button px-2 py-1 rounded-md transition-colors text-sm ${
              currentView === 'day' 
                ? 'bg-white text-[hsl(var(--google-blue))] shadow-sm' 
                : 'text-[hsl(var(--google-gray))] hover:bg-white'
            }`}
            onClick={() => onViewChange('day')}
          >
            Day
          </Button>
          <Button
            variant={currentView === 'week' ? 'default' : 'ghost'}
            size="sm"
            className={`touch-button px-2 py-1 rounded-md transition-colors text-sm ${
              currentView === 'week' 
                ? 'bg-white text-[hsl(var(--google-blue))] shadow-sm' 
                : 'text-[hsl(var(--google-gray))] hover:bg-white'
            }`}
            onClick={() => onViewChange('week')}
          >
            Week
          </Button>
          <Button
            variant={currentView === 'month' ? 'default' : 'ghost'}
            size="sm"
            className={`touch-button px-2 py-1 rounded-md transition-colors text-sm ${
              currentView === 'month' 
                ? 'bg-white text-[hsl(var(--google-blue))] shadow-sm' 
                : 'text-[hsl(var(--google-gray))] hover:bg-white'
            }`}
            onClick={() => onViewChange('month')}
          >
            Month
          </Button>
        </div>
        
        {/* Auth Button */}
        {needsAuth && (
          <Button
            size="sm"
            className="touch-button bg-green-600 hover:bg-green-700 text-white px-2 py-1 text-sm"
            onClick={onAuth}
          >
            <Key className="mr-1" size={14} />
            Connect Google
          </Button>
        )}
        
        {/* Refresh Button */}
        <Button
          size="sm"
          className="touch-button bg-[hsl(var(--google-blue))] text-white hover:bg-[hsl(var(--google-blue-hover))] px-2 py-1 text-sm"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`mr-1 ${isRefreshing ? 'animate-spin' : ''}`} size={14} />
          Refresh
        </Button>
        
        {/* Settings Button */}
        {settingsButton}
      </div>
    </header>
  );
}
