import { useEffect } from 'react';
import logoImage from "@assets/image_1753142842256.png";
import {
  POWER_SAVING_HINT_OPACITY,
  POWER_SAVING_LOGO_OPACITY,
  powerSavingOverlayFilter,
} from "./power-saving-dim";

interface PowerSavingOverlayProps {
  isActive: boolean;
  onWake: () => void;
  /** True when the idle timeout has already dimmed the whole page, so the
   *  overlay must not dim again (see power-saving-dim.ts). */
  pageDimmed?: boolean;
}

export function PowerSavingOverlay({ isActive, onWake, pageDimmed = false }: PowerSavingOverlayProps) {
  useEffect(() => {
    if (!isActive) return;

    const handleWake = (e: KeyboardEvent | MouseEvent | TouchEvent) => {
      e.preventDefault();
      onWake();
    };

    document.addEventListener('keydown', handleWake);
    document.addEventListener('mousedown', handleWake);
    document.addEventListener('touchstart', handleWake);

    return () => {
      document.removeEventListener('keydown', handleWake);
      document.removeEventListener('mousedown', handleWake);
      document.removeEventListener('touchstart', handleWake);
    };
  }, [isActive, onWake]);

  if (!isActive) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-rb-power-saving-bg flex items-center justify-center"
      style={{ filter: powerSavingOverlayFilter(pageDimmed) }}
      data-testid="power-saving-overlay"
    >
      <div className="flex flex-col items-center">
        <img
          src={logoImage}
          alt="ScreenSaver Logo"
          className="w-[768px] h-[768px] select-none pointer-events-none"
          style={{ opacity: POWER_SAVING_LOGO_OPACITY }}
        />
        <p
          className="text-rb-on-color-ink text-sm mt-8 font-light"
          style={{ opacity: POWER_SAVING_HINT_OPACITY }}
        >
          Press any key or touch to wake
        </p>
      </div>
    </div>
  );
}
