/**
 * Confetti particle math (pure) + the tiny React layer that renders one
 * burst. Origin is centered on whatever the caller positions this inside
 * (the check button) via `position: relative` + this component's
 * `left: 50%; top: 50%`.
 */

export interface ConfettiParticle {
  dx: number;
  dy: number;
  rot: number;
  color: string;
  size: number;
  radius: string;
}

export const CONFETTI_COLORS = ["#f2655a", "#f5a623", "#16a34a", "#2563eb", "#9333ea"];
export const CONFETTI_PARTICLE_COUNT = 14;
export const CONFETTI_FADE_MS = 1800;

/** ~14 particles (7–13px, circles + squares) fanning upward/outward
 *  45–120px with 270° of rotational spread either direction. */
export function generateConfettiParticles(): ConfettiParticle[] {
  const particles: ConfettiParticle[] = [];
  for (let i = 0; i < CONFETTI_PARTICLE_COUNT; i++) {
    const angle = Math.PI * (0.9 + Math.random() * 1.2) + Math.PI; // mostly upward fan
    const dist = 45 + Math.random() * 75; // 45–120px
    particles.push({
      dx: Math.round(Math.cos(angle) * dist),
      dy: Math.round(Math.sin(angle) * dist * -1) - 20,
      rot: Math.round(Math.random() * 540 - 270),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 7 + Math.round(Math.random() * 6),
      radius: Math.random() > 0.5 ? "50%" : "3px",
    });
  }
  return particles;
}

interface ConfettiBurstProps {
  particles: ConfettiParticle[];
  /** false = particles sit collapsed at the origin; true = flung out. The
   *  caller flips this ~30ms after mount so the transition actually plays. */
  fired: boolean;
}

export function ConfettiBurst({ particles, fired }: ConfettiBurstProps) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: "50%", top: "50%", width: 0, height: 0, zIndex: 5 }}
      aria-hidden="true"
    >
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            left: 0,
            top: 0,
            width: p.size,
            height: p.size,
            borderRadius: p.radius,
            background: p.color,
            transform: fired
              ? `translate(${p.dx}px, ${p.dy}px) rotate(${p.rot}deg)`
              : "translate(0px, 0px) rotate(0deg) scale(.4)",
            opacity: fired ? 0 : 1,
            transition: `transform ${CONFETTI_FADE_MS}ms cubic-bezier(.16,.84,.44,1), opacity ${CONFETTI_FADE_MS}ms ease`,
          }}
        />
      ))}
    </div>
  );
}
