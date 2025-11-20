import { useState, useEffect } from "react";

/**
 * Custom hook to track screensaver active state for energy optimization
 * Pauses React Query and reduces CPU usage when screensaver is active
 */
export const useScreensaverState = () => {
  const [isScreensaverActive, setIsScreensaverActive] = useState(false);
  
  useEffect(() => {
    // Guard for server-side rendering
    if (typeof window === 'undefined') return;
    
    const handleScreensaverChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ isActive: boolean }>;
      setIsScreensaverActive(customEvent.detail.isActive);
    };
    
    window.addEventListener('screensaver-state-change', handleScreensaverChange);
    
    return () => {
      window.removeEventListener('screensaver-state-change', handleScreensaverChange);
    };
  }, []);
  
  return isScreensaverActive;
};
