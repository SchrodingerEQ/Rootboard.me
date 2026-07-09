import { CalendarDays, ClipboardCheck, UtensilsCrossed } from "lucide-react";
import logoImage from "@assets/image_1753142842256.png";

export type Section = "calendar" | "chores" | "dinner";

interface NavRailProps {
  active: Section;
  onNavigate: (section: Section) => void;
  choreBadgeCount?: number;
  settingsButton?: React.ReactNode;
}

const NAV_ITEMS: { section: Section; label: string; icon: typeof CalendarDays }[] = [
  { section: "calendar", label: "Calendar", icon: CalendarDays },
  { section: "chores", label: "Chores", icon: ClipboardCheck },
  { section: "dinner", label: "Dinner", icon: UtensilsCrossed },
];

export function NavRail({ active, onNavigate, choreBadgeCount, settingsButton }: NavRailProps) {
  return (
    <div
      className="flex flex-col items-center flex-shrink-0"
      style={{
        width: 104,
        background: "var(--rb-surface)",
        boxShadow: "1px 0 0 rgba(0,0,0,.05)",
        padding: "18px 0 20px",
        gap: 8,
      }}
    >
      <img
        src={logoImage}
        alt="Rootboard"
        style={{ width: 76, height: "auto", marginBottom: 14 }}
      />

      {NAV_ITEMS.map(({ section, label, icon: Icon }) => {
        const isActive = active === section;
        const showBadge = section === "chores" && !!choreBadgeCount;
        return (
          <button
            key={section}
            onClick={() => onNavigate(section)}
            className="touch-button relative flex flex-col items-center transition-colors"
            style={{
              width: 84,
              padding: "10px 0",
              borderRadius: 16,
              gap: 4,
              background: isActive ? "#fdeae8" : "transparent",
              color: isActive ? "var(--rb-accent)" : "#5b626d",
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = "var(--rb-chip)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = "transparent";
            }}
            data-testid={`nav-rail-${section}`}
          >
            {showBadge && (
              <span
                className="absolute flex items-center justify-center rounded-full text-white"
                style={{
                  top: 6,
                  right: 12,
                  minWidth: 20,
                  height: 20,
                  padding: "0 5px",
                  background: "#ea8c00",
                  fontSize: 12,
                  fontWeight: 800,
                }}
                data-testid="chore-badge"
              >
                {choreBadgeCount}
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
