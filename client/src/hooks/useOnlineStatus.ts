import { useState, useEffect } from "react";

/**
 * Custom hook to detect online/offline status for energy optimization
 * Pauses API calls when network is unavailable
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(() => {
    // Guard for SSR/initial render
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });
  
  useEffect(() => {
    // Guard for server-side rendering
    if (typeof window === 'undefined') return;
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
};
