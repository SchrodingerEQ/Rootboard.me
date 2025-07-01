import { useState, useEffect } from "react";
import { CalendarHeader } from "@/components/calendar/calendar-header";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { DayView } from "@/components/calendar/day-view";
import { LoadingIndicator } from "@/components/calendar/loading-indicator";
import { useCalendar } from "@/hooks/use-calendar";
import { useToast } from "@/hooks/use-toast";

export type CalendarView = "day" | "week" | "month";

export default function CalendarPage() {
  const [currentView, setCurrentView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const { toast } = useToast();
  
  const {
    events,
    isLoading,
    isRefreshing,
    authStatus,
    refreshEvents,
    checkAuthStatus
  } = useCalendar(currentDate, currentView);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      toast({
        title: "Authentication Successful",
        description: "Google Calendar has been connected successfully.",
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('auth') === 'error') {
      toast({
        title: "Authentication Failed",
        description: "Failed to connect to Google Calendar. Please try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      refreshEvents();
    }, 300000);

    return () => clearInterval(interval);
  }, [refreshEvents]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          navigateCalendar(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigateCalendar(1);
          break;
        case 't':
        case 'T':
          setCurrentDate(new Date());
          break;
        case '1':
          setCurrentView('day');
          break;
        case '2':
          setCurrentView('week');
          break;
        case '3':
          setCurrentView('month');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentView]);

  const navigateCalendar = (direction: number) => {
    const newDate = new Date(currentDate);
    
    if (currentView === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else if (currentView === 'week') {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else if (currentView === 'day') {
      newDate.setDate(newDate.getDate() + direction);
    }
    
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleRefresh = () => {
    refreshEvents();
  };

  const handleAuth = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <CalendarHeader
        currentView={currentView}
        currentDate={currentDate}
        onViewChange={setCurrentView}
        onNavigate={navigateCalendar}
        onToday={goToToday}
        onRefresh={handleRefresh}
        onAuth={handleAuth}
        isRefreshing={isRefreshing}
        needsAuth={authStatus?.needsAuth}
      />
      
      <main className="flex-1 overflow-hidden">
        <div className={`view-container h-full ${currentView === 'month' ? 'active' : ''}`}>
          <MonthView 
            currentDate={currentDate} 
            events={events}
            isLoading={isLoading}
          />
        </div>
        
        <div className={`view-container h-full ${currentView === 'week' ? 'active' : ''}`}>
          <WeekView 
            currentDate={currentDate} 
            events={events}
            isLoading={isLoading}
          />
        </div>
        
        <div className={`view-container h-full ${currentView === 'day' ? 'active' : ''}`}>
          <DayView 
            currentDate={currentDate} 
            events={events}
            isLoading={isLoading}
          />
        </div>
      </main>

      <LoadingIndicator isVisible={isRefreshing} />
    </div>
  );
}
