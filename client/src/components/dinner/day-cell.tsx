import { useState } from "react";
import { Plus, Utensils } from "lucide-react";

interface DayCellProps {
  weekday: string;
  dateLabel: string;
  isToday: boolean;
  isPast: boolean;
  dinner: string | undefined;
  onClick: () => void;
  testId: string;
}

/** One cell of the two-week planner grid. States (today / past / has-dinner /
 *  ghost "+ Add dinner") per CHORES_DINNER_BUILD_PLAN.md and the mockup. */
export function DayCell({ weekday, dateLabel, isToday, isPast, dinner, onClick, testId }: DayCellProps) {
  const [hovered, setHovered] = useState(false);
  const bg = isPast ? "#f0eee9" : "#ffffff";
  const border = hovered ? "#d9d5cc" : isToday ? "#f2655a" : "transparent";
  const wdColor = isPast ? "#b8bcc4" : "var(--rb-muted)";
  const numColor = isToday ? "#f2655a" : isPast ? "#b8bcc4" : "#2b3038";

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="min-w-0 text-left flex flex-col overflow-hidden touch-button"
      style={{
        background: bg,
        border: `3px solid ${border}`,
        borderRadius: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,.05)",
        padding: "12px 14px",
        gap: 8,
      }}
      data-testid={testId}
    >
      <div className="flex items-baseline" style={{ gap: 7 }}>
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".6px", textTransform: "uppercase", color: wdColor }}>
          {weekday}
        </span>
        <span style={{ fontSize: 20, fontWeight: 800, color: numColor }}>{dateLabel}</span>
        {isToday && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: ".5px",
              textTransform: "uppercase",
              color: "#f2655a",
              background: "#fdeae8",
              padding: "2px 9px",
              borderRadius: 999,
            }}
          >
            Today
          </span>
        )}
      </div>

      {dinner ? (
        <div className="flex items-center min-w-0" style={{ gap: 9, background: "#e3f5ea", borderRadius: 10, padding: "8px 12px" }}>
          <Utensils size={17} color="#16a34a" strokeWidth={2.2} style={{ flexShrink: 0 }} />
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: 17, fontWeight: 800, color: "#15803d" }}>
            {dinner}
          </span>
        </div>
      ) : (
        <div className="flex items-center" style={{ gap: 7, color: "#b8bcc4", padding: "8px 2px" }}>
          <Plus size={16} strokeWidth={2.4} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>Add dinner</span>
        </div>
      )}
    </button>
  );
}
