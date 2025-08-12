import { useState, useEffect, useCallback, useRef } from 'react';

interface ScreensaverConfig {
  inactivityTimeout: number; // milliseconds
  dimBrightness: number; // 0-1 scale
  originalBrightness: number; // 0-1 scale
}

interface ScreensaverState {
  isActive: boolean;
  isIdle: boolean;
  brightness: number;
  lastActivity: number;
}

export const useScreensaver = (config: ScreensaverConfig) => {
  const [state, setState] = useState<ScreensaverState>({
    isActive: false,
    isIdle: false,
    brightness: config.originalBrightness,
    lastActivity: Date.now()
  });

  const timeoutRef = useRef<NodeJS.Timeout>();
  const brightnessRef = useRef<number>(config.originalBrightness);

  // Apply brightness to the document
  const applyBrightness = useCallback((brightness: number) => {
    document.documentElement.style.filter = `brightness(${Math.round(brightness * 100)}%)`;
    brightnessRef.current = brightness;
    setState(prev => ({ ...prev, brightness }));
  }, []);

  // Reset activity timer
  const resetActivity = useCallback(() => {
    const now = Date.now();
    setState(prev => ({ ...prev, lastActivity: now }));

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Exit screensaver mode if active
    if (state.isActive) {
      setState(prev => ({
        ...prev,
        isActive: false,
        isIdle: false
      }));
      applyBrightness(config.originalBrightness);
      
      // Trigger calendar refresh to current month view
      window.dispatchEvent(new CustomEvent('screensaver-exit'));
    }

    // Set new inactivity timer
    timeoutRef.current = setTimeout(() => {
      setState(prev => ({
        ...prev,
        isActive: true,
        isIdle: true
      }));
      applyBrightness(config.dimBrightness);
    }, config.inactivityTimeout);
  }, [state.isActive, config.inactivityTimeout, config.dimBrightness, config.originalBrightness, applyBrightness]);

  // Activity event handlers
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      resetActivity();
    };

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Initialize timer
    resetActivity();

    return () => {
      // Cleanup
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [resetActivity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Reset brightness
      document.documentElement.style.filter = '';
    };
  }, []);

  // Manual brightness control
  const setBrightness = useCallback((brightness: number) => {
    const clampedBrightness = Math.max(0.1, Math.min(1.5, brightness));
    applyBrightness(clampedBrightness);
    // Update config original brightness if not in screensaver mode
    if (!state.isActive) {
      config.originalBrightness = clampedBrightness;
    }
  }, [state.isActive, applyBrightness, config]);

  const exitScreensaver = useCallback(() => {
    resetActivity();
  }, [resetActivity]);

  return {
    ...state,
    setBrightness,
    exitScreensaver,
    currentBrightness: brightnessRef.current
  };
};