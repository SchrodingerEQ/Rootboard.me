import { LayoutGrid, Puzzle, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import logoImage from "@assets/image_1753142842256.png";

/** A nav-rail glyph is either a lucide component (built-ins) or a
 *  same-origin image URL (community widgets, Phase 4 — CONTRACT.md §2's
 *  icon field). Community icons render via `<img src>` ONLY, never inline
 *  SVG/innerHTML: an `<img>` executes no scripts and loads no external
 *  resources, which is how "sanitized before render" is satisfied in v1
 *  without an actual sanitizer (see docs/plans/widget-system/
 *  PHASE4-EXECUTION.md Global Constraints — "Icon safety"). */
export type NavRailIconSpec = LucideIcon | { kind: "image"; src: string };

export interface NavRailItem {
  id: string;
  label: string;
  icon: NavRailIconSpec;
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

/** Fallback for a community widget whose manifest declares no `icon`
 *  (Phase 4) — deliberately distinct from DEFAULT_NAV_ICON so a
 *  sideloaded widget with no icon reads as "third-party", not "built-in
 *  forgot its icon". */
export const COMMUNITY_FALLBACK_ICON: LucideIcon = Puzzle;

// Discriminate on `kind`, NOT `typeof icon === "function"` — lucide-react
// icons are React.forwardRef components, which are OBJECTS at runtime
// (`typeof Icon === "object"`, not "function"), so a typeof-based check
// would misroute every builtin icon into the image branch (caught in
// manual browser verification: builtin nav icons rendered as broken
// `<img>`s with no `src`).
function NavGlyph({ icon }: { icon: NavRailIconSpec }) {
  const isImage = typeof icon === "object" && icon !== null && "kind" in icon && icon.kind === "image";
  // Tracks the specific `src` that last failed to load (not just a
  // boolean) — a sideloaded icon path can be bad (typo, corrupt file, the
  // widget's folder edited mid-session), and an <img> with a broken src
  // fires onError once and then just sits there as a broken-image box
  // forever with no re-render trigger. State-flip per id (this component
  // instance is keyed by id in NavRail's .map() below) rather than a DOM
  // hack (e.g. hiding the element via ref) keeps the fallback declarative
  // and re-render-driven. Comparing against the CURRENT src (not a bare
  // flag) means a manifest update that fixes the icon path automatically
  // retries instead of staying stuck on the fallback forever.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (isImage) {
    const src = (icon as { src: string }).src;
    if (src === failedSrc) {
      return <COMMUNITY_FALLBACK_ICON size={26} strokeWidth={2.2} />;
    }
    return (
      <img
        src={src}
        alt=""
        width={26}
        height={26}
        style={{ objectFit: "contain" }}
        onError={() => setFailedSrc(src)}
      />
    );
  }
  const Icon = icon as LucideIcon;
  return <Icon size={26} strokeWidth={2.2} />;
}

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

      {items.map(({ id, label, icon, badgeCount }) => {
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
            <NavGlyph icon={icon} />
            <span style={{ fontSize: 13, fontWeight: isActive ? 800 : 700 }}>{label}</span>
          </button>
        );
      })}

      <div className="flex-1" />

      {settingsButton}
    </div>
  );
}
