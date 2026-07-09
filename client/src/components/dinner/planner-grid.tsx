import { DayCell } from "./day-cell";
import { addDaysToKey, dateKeyToDate, startOfWeekKey } from "@/lib/dinner-state";

interface PlannerGridProps {
  todayKey: string;
  dinners: Record<string, string>;
  onDayClick: (dateKey: string) => void;
}

/** "THIS WEEK & NEXT" — 7x2 grid, current week Sun-Sat then next week. */
export function PlannerGrid({ todayKey, dinners, onDayClick }: PlannerGridProps) {
  const weekStartKey = startOfWeekKey(todayKey);
  const days = Array.from({ length: 14 }, (_, i) => {
    const dateKey = addDaysToKey(weekStartKey, i);
    const date = dateKeyToDate(dateKey);
    const showMonth = date.getDate() === 1 || i === 0;
    return {
      dateKey,
      weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
      dateLabel: showMonth
        ? `${date.toLocaleDateString("en-US", { month: "short" })} ${date.getDate()}`
        : String(date.getDate()),
      isToday: dateKey === todayKey,
      isPast: dateKey < todayKey,
      dinner: dinners[dateKey],
    };
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ padding: "20px 24px 24px" }}>
      <div style={{ padding: "0 4px 10px" }}>
        <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: ".8px", textTransform: "uppercase", color: "var(--rb-muted)" }}>
          This week &amp; next
        </span>
      </div>
      <div
        className="flex-1 grid"
        style={{ gridTemplateColumns: "repeat(7, 1fr)", gridTemplateRows: "1fr 1fr", gap: 10 }}
      >
        {days.map((d) => (
          <DayCell
            key={d.dateKey}
            weekday={d.weekday}
            dateLabel={d.dateLabel}
            isToday={d.isToday}
            isPast={d.isPast}
            dinner={d.dinner}
            onClick={() => onDayClick(d.dateKey)}
            testId={`day-cell-${d.dateKey}`}
          />
        ))}
      </div>
    </div>
  );
}
