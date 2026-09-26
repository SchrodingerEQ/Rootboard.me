import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getMonthCalendar, isSameDay, isToday } from "@/lib/date-utils";

interface MiniMonthProps {
  date: Date;
  /** day-of-month → dot color, for days (in the shown month) that have events */
  eventDays: Map<number, string>;
  onPrev: () => void;
  onNext: () => void;
  /** The day the agenda is showing — ringed in the grid when it isn't today. */
  selectedDate?: Date;
  /** Tap a day to show it in the agenda. */
  onSelectDate?: (date: Date) => void;
}

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Compact month grid for the Day view rail: today in coral, event-dot days,
 *  tap a day to pick it. */
export function MiniMonth({ date, eventDays, onPrev, onNext, selectedDate, onSelectDate }: MiniMonthProps) {
  const days = useMemo(() => getMonthCalendar(date), [date]);

  return (
    <div className="bg-[var(--rb-surface)] rounded-[18px] p-4" style={{ boxShadow: '0 1px 3px var(--rb-shadow-card)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg font-extrabold text-rb-ink">
          {date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            aria-label="Previous month"
            className="flex items-center justify-center rounded-full bg-[var(--rb-chip)] text-rb-ink-secondary hover:bg-[var(--rb-chip-hover)] transition-colors"
            style={{ width: 28, height: 28 }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={onNext}
            aria-label="Next month"
            className="flex items-center justify-center rounded-full bg-[var(--rb-chip)] text-rb-ink-secondary hover:bg-[var(--rb-chip-hover)] transition-colors"
            style={{ width: 28, height: 28 }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LETTERS.map((letter, i) => (
          <span key={i} className="text-center text-xs font-bold text-[var(--rb-faint)]">{letter}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day, i) => {
          const inMonth = day.getMonth() === date.getMonth() && day.getFullYear() === date.getFullYear();
          const today = isToday(day);
          const dotColor = inMonth && !today ? eventDays.get(day.getDate()) : undefined;
          const selected = !today && !!selectedDate && isSameDay(day, selectedDate);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDate?.(day)}
              className="flex flex-col items-center"
              style={{ height: 40 }}
              aria-label={day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              aria-pressed={!!selectedDate && isSameDay(day, selectedDate)}
              data-testid={selected ? 'mini-month-selected' : undefined}
            >
              <span
                className="inline-flex items-center justify-center rounded-full text-sm"
                style={{
                  width: 34, height: 34,
                  background: today ? 'var(--rb-accent)' : selected ? 'var(--rb-accent-wash)' : 'transparent',
                  boxShadow: selected ? 'inset 0 0 0 2px var(--rb-accent)' : undefined,
                  color: today ? 'var(--rb-on-color-ink)' : inMonth ? 'var(--rb-ink)' : 'var(--rb-ink-disabled)',
                  fontWeight: today || selected ? 800 : 700,
                }}
              >
                {day.getDate()}
              </span>
              {dotColor && (
                <span className="rounded-full" style={{ width: 5, height: 5, background: dotColor, marginTop: -4 }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
