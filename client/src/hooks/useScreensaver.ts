import { useState, useEffect, useCallback, useRef } from 'react';
import { createFrameCoalescer } from '@/lib/frame-coalescer';
import { BRIGHTNESS_MAX, BRIGHTNESS_MIN, DIM_OVERLAY_ID, paintBrightness } from '@/lib/brightness-layers';

interface ScreensaverConfig {
  inactivityTimeout: number;
  dimBrightness: number;
  originalBrightness: number;
}

interface ScreensaverState {
  isActive: boolean;
  isIdle: boolean;
  lastActivity: number;
}

const dispatchScreensaverEvent = (isActive: boolean) => {
  window.dispatchEvent(new CustomEvent('screensaver-state-change', {
    detail: { isActive }
  }));
};

export const useScreensaver = (config: ScreensaverConfig) => {
  const [state, setState] = useState<ScreensaverState>({
    isActive: false,
    isIdle: false,
    lastActivity: Date.now()
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const brightnessRef = useRef<number>(config.originalBrightness);
  const isActiveRef = useRef(false);
  const originalBrightnessRef = useRef(config.originalBrightness);
  const configRef = useRef(config);
  configRef.current = config;

  // Brightness is painted only as a black dim overlay (see
  // brightness-layers.ts for why the old root `filter: brightness()` made
  // the whole kiosk render at <9 fps), capped at 100%. Writes are coalesced
  // to one per animation frame, always the latest value. No React state is
  // touched here — a per-tick setState used to re-render the whole AppShell
  // on every pointer move. Consumers read `currentBrightness` (a ref).
  const writeRef = useRef(createFrameCoalescer<number>((brightness) => paintBrightness(brightness)));
  const applyBrightness = useCallback((brightness: number) => {
    brightnessRef.current = brightness;
    writeRef.current(brightness);
  }, []);

  const startTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      isActiveRef.current = true;
      setState(prev => ({
        ...prev,
        isActive: true,
        isIdle: true
      }));
      applyBrightness(configRef.current.dimBrightness);
      dispatchScreensaverEvent(true);
    }, configRef.current.inactivityTimeout);
  }, [applyBrightness]);

  const resetActivityRef = useRef(() => {});

  resetActivityRef.current = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (isActiveRef.current) {
      isActiveRef.current = false;
      setState(prev => ({
        ...prev,
        isActive: false,
        isIdle: false,
        lastActivity: Date.now()
      }));
      applyBrightness(originalBrightnessRef.current);
      dispatchScreensaverEvent(false);
      window.dispatchEvent(new CustomEvent('screensaver-exit'));
    } else {
      setState(prev => ({ ...prev, lastActivity: Date.now() }));
    }

    startTimer();
  };

  const resetActivity = useCallback(() => {
    resetActivityRef.current();
  }, []);

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      resetActivityRef.current();
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    startTimer();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [startTimer]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      document.getElementById(DIM_OVERLAY_ID)?.remove();
    };
  }, []);

  const setBrightness = useCallback((brightness: number) => {
    const clampedBrightness = Math.max(BRIGHTNESS_MIN, Math.min(BRIGHTNESS_MAX, brightness));
    if (!isActiveRef.current) {
      originalBrightnessRef.current = clampedBrightness;
    }
    applyBrightness(clampedBrightness);
  }, [applyBrightness]);

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
