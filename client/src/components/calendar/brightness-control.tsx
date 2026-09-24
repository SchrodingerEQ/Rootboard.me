import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export const BRIGHTNESS_STORAGE_KEY = "calendar-brightness";

interface BrightnessControlProps {
  /** Seed when nothing is saved yet, as a 0–1.5 fraction. */
  initialBrightness: number;
  /** Applies the value live (0–1.5 fraction); the shell's screensaver hook
   *  owns the page filter. Absent → fall back to writing the filter here. */
  onBrightness?: (fraction: number) => void;
}

/**
 * The Brightness slider, isolated in its own component so a touch drag only
 * re-renders this small tree — not the whole Settings menu — on every
 * pointer move. Persistence happens once, when the drag ends
 * (`onValueCommit`), not on every tick; the live value goes straight to the
 * screensaver hook, which coalesces the page-filter write per frame.
 */
export function BrightnessControl({ initialBrightness, onBrightness }: BrightnessControlProps) {
  const [brightness, setBrightness] = useState(() => {
    const saved = localStorage.getItem(BRIGHTNESS_STORAGE_KEY);
    return saved ? parseInt(saved) : Math.round(initialBrightness * 100);
  });

  // Apply the saved brightness once at mount (this is what restores the
  // user's brightness at kiosk boot).
  useEffect(() => {
    applyBrightness(brightness);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyBrightness = (percent: number) => {
    if (onBrightness) onBrightness(percent / 100);
    else document.documentElement.style.filter = `brightness(${percent}%)`;
  };

  const handleChange = (value: number[]) => {
    const percent = value[0];
    setBrightness(percent);
    applyBrightness(percent);
  };

  const handleCommit = (value: number[]) => {
    localStorage.setItem(BRIGHTNESS_STORAGE_KEY, value[0].toString());
  };

  return (
    <div className="space-y-2" data-testid="brightness-control">
      <div className="flex items-center gap-2">
        <Sun className="h-4 w-4" />
        <Label className="text-sm font-medium">Brightness</Label>
      </div>
      <div className="flex items-center gap-3">
        <Moon className="h-3 w-3 text-rb-faint" />
        <Slider
          value={[brightness]}
          onValueChange={handleChange}
          onValueCommit={handleCommit}
          max={150}
          min={30}
          step={5}
          className="flex-1"
        />
        <Sun className="h-4 w-4 text-rb-ink-secondary" />
      </div>
      <p className="text-xs text-rb-muted">{brightness}%</p>
    </div>
  );
}
