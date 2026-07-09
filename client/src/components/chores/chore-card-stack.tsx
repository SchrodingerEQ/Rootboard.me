import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { CARD_GAP_PX, CARD_HEIGHT_PX, REORDER_EASING, REORDER_MS, type Chore } from "@/lib/chores-state";
import { ConfettiBurst, CONFETTI_FADE_MS, generateConfettiParticles, type ConfettiParticle } from "./confetti-burst";

interface Burst {
  id: string;
  choreId: string;
  particles: ConfettiParticle[];
  fired: boolean;
}

interface ChoreCardStackProps {
  chores: Chore[];
  /** The person's saturated palette color — check-button border/fill. */
  color: string;
  onToggle: (choreId: string) => void;
}

/**
 * Absolutely-positioned stack: active chores (stable original order) above
 * completed ones (stable original order). DOM order stays fixed (we map
 * `chores` as given) — only each card's `top` transitions, per the plan's
 * FLIP-style reorder.
 */
export function ChoreCardStack({ chores, color, onToggle }: ChoreCardStackProps) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const order = [...chores.filter((c) => !c.done), ...chores.filter((c) => c.done)];
  const height = Math.max(chores.length * (CARD_HEIGHT_PX + CARD_GAP_PX) - CARD_GAP_PX, 0);

  const handleToggle = (chore: Chore) => {
    if (!chore.done) {
      const burstId = `${chore.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setBursts((prev) => [...prev, { id: burstId, choreId: chore.id, particles: generateConfettiParticles(), fired: false }]);
      timers.current.push(
        setTimeout(() => {
          setBursts((prev) => prev.map((b) => (b.id === burstId ? { ...b, fired: true } : b)));
        }, 30),
      );
      timers.current.push(
        setTimeout(() => {
          setBursts((prev) => prev.filter((b) => b.id !== burstId));
        }, CONFETTI_FADE_MS + 200),
      );
    }
    onToggle(chore.id);
  };

  return (
    <div style={{ position: "relative", height }}>
      {chores.map((chore) => {
        const top = order.indexOf(chore) * (CARD_HEIGHT_PX + CARD_GAP_PX);
        const choreBursts = bursts.filter((b) => b.choreId === chore.id);
        return (
          <div
            key={chore.id}
            className="absolute left-0 right-0 flex items-center gap-4 bg-white shadow-sm"
            style={{
              top,
              height: CARD_HEIGHT_PX,
              borderRadius: 16,
              padding: "0 18px",
              opacity: chore.done ? 0.62 : 1,
              transition: `top ${REORDER_MS}ms ${REORDER_EASING}, opacity .3s ease`,
            }}
            data-testid={`chore-card-${chore.id}`}
          >
            <button
              type="button"
              onClick={() => handleToggle(chore)}
              title={chore.done ? "Mark as not done" : "Mark as done"}
              className="touch-button relative flex-shrink-0 flex items-center justify-center rounded-full"
              style={{
                width: 54,
                height: 54,
                border: `3px solid ${color}`,
                background: chore.done ? color : "#ffffff",
                transition: "background .2s ease",
              }}
              data-testid={`chore-toggle-${chore.id}`}
            >
              <Check
                size={28}
                strokeWidth={3}
                color="#ffffff"
                style={{ opacity: chore.done ? 1 : 0, transition: "opacity .2s ease" }}
              />
              {choreBursts.map((b) => (
                <ConfettiBurst key={b.id} particles={b.particles} fired={b.fired} />
              ))}
            </button>
            <span
              className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
              style={{
                fontSize: 21,
                fontWeight: 700,
                color: chore.done ? "#9aa0aa" : "#2b3038",
                textDecoration: chore.done ? "line-through" : "none",
              }}
            >
              {chore.title}
            </span>
          </div>
        );
      })}
    </div>
  );
}
