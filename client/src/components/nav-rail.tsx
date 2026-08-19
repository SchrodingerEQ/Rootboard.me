import { LayoutGrid, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import logoImage from "@assets/image_1753142842256.png";

export interface NavRailItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Numeric badge shown iff truthy (0/null/undefined all hide it) —
   *  mirrors the pre-widget `!!choreBadgeCount` check exactly. */
  badgeCount?: number | null;
}

/* LEGACY_NAV_META (a hardcoded icon/label map for not-yet-ported sections)
 * was deleted in Task 8: calendar was its last entry, and calendar now
 * resolves through BUILTIN_WIDGETS like chores and dinner. Every nav item
 * is manifest-driven — there is no legacy-rendered section left. */

/** Fallback for a BUILTIN_WIDGETS entry that doesn't declare a `navIcon`
 *  (optional per registry.ts) — every first-party widget sets one today, so
 *  this is only a safety net against a future built-in forgetting to. */
export const DEFAULT_NAV_ICON: LucideIcon = LayoutGrid;

interface NavRailProps {
  items: NavRailItem[];
  active: string;
  onNavigate: (id: string) => void;
  settingsButton?: ReactNode;
}

export function NavRail({ items, active, onNavigate, settingsButton }: NavRailProps) {
  return (
    <div
      className="flex flex-col items-center flex-shrink-0"
      style={{
        width: 104,
        background: "var(--rb-surface)",
        boxShadow: "1px 0 0 var(--rb-shadow-soft)",
        padding: "18px 0 20px",
        gap: 8,
      }}
    >
      <img
        src={logoImage}
        alt="Rootboard"
        style={{ width: 76, height: "auto", marginBottom: 14 }}
      />

      {items.map(({ id, label, icon: Icon, badgeCount }) => {
        const isActive = active === id;
        const showBadge = !!badgeCount;
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className="touch-button relative flex flex-col items-center transition-colors"
            style={{
              width: 84,
              padding: "10px 0",
              borderRadius: 16,
              gap: 4,
              background: isActive ? "var(--rb-nav-active-bg)" : "transparent",
              color: isActive ? "var(--rb-accent)" : "var(--rb-nav-inactive-ink)",
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = "var(--rb-chip)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = "transparent";
            }}
            data-testid={`nav-rail-${id}`}
          >
            {showBadge && (
              <span
                className="absolute flex items-center justify-center rounded-full"
                style={{
                  top: 6,
                  right: 12,
                  minWidth: 20,
                  height: 20,
                  padding: "0 5px",
                  background: "var(--rb-badge)",
                  color: "var(--rb-badge-ink)",
                  fontSize: 12,
                  fontWeight: 800,
                }}
                data-testid={id === "chores" ? "chore-badge" : `${id}-badge`}
              >
                {badgeCount}
              </span>
            )}
            <Icon size={26} strokeWidth={2.2} />
            <span style={{ fontSize: 13, fontWeight: isActive ? 800 : 700 }}>{label}</span>
          </button>
        );
      })}

      <div className="flex-1" />

      {settingsButton}
    </div>
  );
}
