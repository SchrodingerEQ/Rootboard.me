import { useEffect, useState } from 'react';
import logoImage from "@assets/image_1753142842256.png";

interface ScreensaverOverlayProps {
  isActive: boolean;
  onExit: () => void;
}

export const ScreensaverOverlay = ({ isActive, onExit }: ScreensaverOverlayProps) => {
  const [logoPosition, setLogoPosition] = useState({ x: 50, y: 50 });
  const [direction, setDirection] = useState({ x: 1, y: 1 });

  // Floating logo animation with requestAnimationFrame for better energy efficiency
  useEffect(() => {
    if (!isActive) return;

    let animationFrameId: number;
    let lastUpdate = Date.now();
    const updateInterval = 100; // Update every 100ms (same as before, but more efficient)
    
    const animate = () => {
      const now = Date.now();
      const elapsed = now - lastUpdate;
      
      // Only update position every 100ms to reduce CPU usage
      if (elapsed >= updateInterval) {
        lastUpdate = now;
        
        setLogoPosition(prev => {
          let newX = prev.x + direction.x * 0.5;
          let newY = prev.y + direction.y * 0.3;
          let newDirectionX = direction.x;
          let newDirectionY = direction.y;

          // Bounce off edges (leaving some margin)
          if (newX <= 10 || newX >= 85) {
            newDirectionX = -direction.x;
            newX = Math.max(10, Math.min(85, newX));
          }
          if (newY <= 10 || newY >= 80) {
            newDirectionY = -direction.y;
            newY = Math.max(10, Math.min(80, newY));
          }

          setDirection({ x: newDirectionX, y: newDirectionY });
          return { x: newX, y: newY };
        });
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isActive, direction]);

  // Handle click to exit screensaver
  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onExit();
  };

  if (!isActive) return null;

  return (
    <div
      className="fixed inset-0 z-50 screensaver-overlay flex items-center justify-center cursor-pointer"
      onClick={handleClick}
      onTouchStart={handleClick}
    >
      {/* Floating logo */}
      <div
        className="absolute transition-all duration-100 ease-linear"
        style={{
          left: `${logoPosition.x}%`,
          top: `${logoPosition.y}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <img
          src={logoImage}
          alt="ScreenSaver Logo"
          className="w-32 h-32 opacity-30 select-none pointer-events-none screensaver-logo"
          style={{
            filter: 'brightness(0.6) contrast(1.2)',
          }}
        />
      </div>

      {/* Subtle instructions */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
        <p className="text-white text-opacity-40 text-sm font-light">
          Touch screen to wake up
        </p>
      </div>

      {/* Current time display */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2">
        <div className="text-white text-opacity-60 text-center">
          <div className="text-4xl font-light mb-2">
            {new Date().toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true 
            })}
          </div>
          <div className="text-lg font-light">
            {new Date().toLocaleDateString([], { 
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}
          </div>
        </div>
      </div>
    </div>
  );
};