import { useEffect } from 'react';
import logoImage from "@assets/image_1753142842256.png";

interface PowerSavingOverlayProps {
  isActive: boolean;
  onWake: () => void;
}

export function PowerSavingOverlay({ isActive, onWake }: PowerSavingOverlayProps) {
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
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
      style={{ filter: 'brightness(0.2)' }}
      data-testid="power-saving-overlay"
    >
      <div className="flex flex-col items-center">
        <img
          src={logoImage}
          alt="McMurry Hurricane Logo"
          className="w-[768px] h-[768px] opacity-40 select-none pointer-events-none"
        />
        <p className="text-white text-opacity-30 text-sm mt-8 font-light">
          Press any key or touch to wake
        </p>
      </div>
    </div>
  );
}
