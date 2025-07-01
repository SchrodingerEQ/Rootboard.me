import { Button } from "@/components/ui/button";
import { CalendarIcon, ChevronLeft, ChevronRight, RefreshCw, Key } from "lucide-react";
import type { CalendarView } from "@/pages/calendar";

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
  needsAuth
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
        day: 'numeric',
        year: 'numeric' 
      })}`;
    } else if (currentView === 'day') {
      return currentDate.toLocaleDateString('en-US', { 
        weekday: 'long',
        month: 'long', 
        day: 'numeric',
        year: 'numeric' 
      });
    }
  };

  return (
    <header className="bg-white border-b border-border px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-6">
        {/* Logo and Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-[hsl(var(--google-blue))] rounded-lg flex items-center justify-center">
            <CalendarIcon className="text-white text-lg" size={20} />
          </div>
          <h1 className="text-2xl font-medium text-[hsl(var(--google-gray))]">Calendar</h1>
        </div>
        
        {/* Navigation Controls */}
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="touch-button px-4 py-2 text-[hsl(var(--google-gray))] hover:bg-[hsl(var(--google-light-gray))]"
            onClick={() => onNavigate(-1)}
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="touch-button px-4 py-2 text-[hsl(var(--google-gray))] hover:bg-[hsl(var(--google-light-gray))]"
            onClick={() => onNavigate(1)}
          >
            <ChevronRight size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="touch-button px-4 py-2 text-[hsl(var(--google-blue))] hover:bg-blue-50 font-medium"
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
      <div className="flex items-center space-x-4">
        {/* View Toggle Buttons */}
        <div className="flex items-center space-x-2 bg-[hsl(var(--google-light-gray))] rounded-lg p-1">
          <Button
            variant={currentView === 'day' ? 'default' : 'ghost'}
            size="sm"
            className={`touch-button px-4 py-2 rounded-md transition-colors ${
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
            className={`touch-button px-4 py-2 rounded-md transition-colors ${
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
            className={`touch-button px-4 py-2 rounded-md transition-colors ${
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
            className="touch-button bg-[hsl(var(--google-green))] hover:bg-[hsl(var(--google-green))]/90 text-white"
            onClick={onAuth}
          >
            <Key className="mr-2" size={16} />
            Connect Google
          </Button>
        )}
        
        {/* Refresh Button */}
        <Button
          size="sm"
          className="touch-button bg-[hsl(var(--google-blue))] text-white hover:bg-[hsl(var(--google-blue-hover))]"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} size={16} />
          Refresh
        </Button>
      </div>
    </header>
  );
}
