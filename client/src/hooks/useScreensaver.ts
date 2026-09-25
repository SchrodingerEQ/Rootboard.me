import { useState, useEffect, useCallback, useRef } from 'react';
import { createFrameCoalescer } from '@/lib/frame-coalescer';
import { brightnessLayers, createDimOverlay, DIM_OVERLAY_ID } from '@/lib/brightness-layers';

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

  // Brightness is painted as a black dim overlay (<=100%) plus, only above
  // 100%, a root filter — see brightness-layers.ts for why the old root
  // filter made a touch drag lag on the Pi. Writes are coalesced to one per
  // animation frame, always the latest value. `live` ticks (finger still on
  // the slider) touch only the overlay; the filter is written on commit
  // (drag end) and for programmatic changes (idle dim, wake, boot). No React
  // state is touched here — a per-tick setState used to re-render the whole
  // AppShell on every pointer move. Consumers read `currentBrightness` (a
  // ref) instead.
  const writeRef = useRef(
    createFrameCoalescer<{ brightness: number; commit: boolean }>(({ brightness, commit }) => {
      const layers = brightnessLayers(brightness);
      createDimOverlay().style.opacity = String(layers.overlayOpacity);
      if (commit) document.documentElement.style.filter = layers.filter;
    }),
  );
  const applyBrightness = useCallback((brightness: number, commit = true) => {
    brightnessRef.current = brightness;
    writeRef.current({ brightness, commit });
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
      document.getElementById(DIM_OVERLAY_ID)?.remove();
    };
  }, []);

  /** `live: true` while a finger is still on the slider — cheap overlay-only
   *  paint; `live: false` (default) on commit and for programmatic changes. */
  const setBrightness = useCallback((brightness: number, opts?: { live?: boolean }) => {
    const clampedBrightness = Math.max(0.1, Math.min(1.5, brightness));
    if (!isActiveRef.current) {
      originalBrightnessRef.current = clampedBrightness;
    }
    applyBrightness(clampedBrightness, !opts?.live);
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
