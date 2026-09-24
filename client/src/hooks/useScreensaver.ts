import { useState, useEffect, useCallback, useRef } from 'react';
import { createFrameCoalescer } from '@/lib/frame-coalescer';

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

  // One page-filter write per animation frame, always the latest value: a
  // touch drag on the brightness slider delivers pointer moves faster than
  // the Pi can recomposite a filtered full-screen page. No React state is
  // touched here — a per-tick setState re-rendered the whole AppShell on
  // every pointer move and was the main source of slider lag. Consumers
  // read `currentBrightness` (a ref) instead.
  const writeFilterRef = useRef(
    createFrameCoalescer<number>((brightness) => {
      document.documentElement.style.filter = `brightness(${Math.round(brightness * 100)}%)`;
    }),
  );
  const applyBrightness = useCallback((brightness: number) => {
    brightnessRef.current = brightness;
    writeFilterRef.current(brightness);
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
      document.documentElement.style.filter = '';
    };
  }, []);

  const setBrightness = useCallback((brightness: number) => {
    const clampedBrightness = Math.max(0.1, Math.min(1.5, brightness));
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
