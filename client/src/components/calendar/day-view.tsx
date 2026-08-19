import { useMemo, useRef, useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { MiniMonth } from "./mini-month";
import { ComingUp, type CountdownItem } from "./coming-up";
import { isToday, formatTime } from "@/lib/date-utils";
import { eventTint, eventTextColor } from "@/lib/color-utils";
import { getCalendarColor, getInitials, EVENT_FALLBACK_COLOR, type CalendarInfo } from "@/lib/calendar-meta";
import type { CalendarEvent } from "@shared/schema";

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  isLoading: boolean;
  onEventClick?: (event: CalendarEvent) => void;
  /** Full loaded window (month grid + lookahead), for mini-month dots + countdowns. */
  monthEvents?: CalendarEvent[];
  /** Calendar metadata for avatar names/colors. */
  calendars?: CalendarInfo[];
}

function durationLabel(start: Date, end: Date): string {
  const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

// Agenda-style Day view: left rail (mini-month + coming-up countdowns) and a
// main panel listing today's events as large tinted cards. Replaces the old
// 24-hour timeline (see git history for the timeline version).
export function DayView({ currentDate, events, isLoading, onEventClick, monthEvents, calendars }: DayViewProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const upNextRef = useRef<HTMLDivElement>(null);

  // Live clock so past-dimming and "Up next" stay correct on the 24/7 kiosk.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  // The mini-month can browse other months without changing the app's day;
  // it snaps back whenever the actual viewed day changes.
  const [railMonth, setRailMonth] = useState(() => new Date(currentDate));
  useEffect(() => setRailMonth(new Date(currentDate)), [currentDate]);
  const shiftRailMonth = (dir: number) =>
    setRailMonth(prev => {
      const next = new Date(prev);
      next.setDate(1);
      next.setMonth(next.getMonth() + dir);
      return next;
    });

  // Today's agenda: events starting on the viewed day, or spanning it.
  const dayEvents = useMemo(() => {
    return events.filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      return eventStart.toDateString() === currentDate.toDateString() || (eventStart <= currentDate && eventEnd >= currentDate);
    });
  }, [events, currentDate]);

  const allDayEvents = useMemo(() => dayEvents.filter(e => e.isAllDay), [dayEvents]);
  const timedEvents = useMemo(
    () =>
      dayEvents
        .filter(e => !e.isAllDay)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [dayEvents],
  );

  const poolEvents = useMemo(() => monthEvents ?? events, [monthEvents, events]);

  // Mini-month dots: day-of-month → color of that day's first event.
  const eventDays = useMemo(() => {
    const map = new Map<number, string>();
    for (const event of poolEvents) {
      const start = new Date(event.startTime);
      if (start.getMonth() === railMonth.getMonth() && start.getFullYear() === railMonth.getFullYear()) {
        const day = start.getDate();
        if (!map.has(day)) map.set(day, event.color || EVENT_FALLBACK_COLOR);
      }
    }
    return map;
  }, [poolEvents, railMonth]);

  // Coming up: next few events strictly after today.
  const countdowns = useMemo<CountdownItem[]>(() => {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    return poolEvents
      .filter(e => new Date(e.startTime) >= endOfToday)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 3)
      .map(e => {
        const start = new Date(e.startTime);
        const eventDay = new Date(start);
        eventDay.setHours(0, 0, 0, 0);
        const days = Math.max(1, Math.round((eventDay.getTime() - startOfToday.getTime()) / 86_400_000));
        const dateLabel = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        return {
          days,
          title: e.title,
          whenLabel: e.isAllDay ? dateLabel : `${dateLabel} · ${formatTime(start)}`,
          color: e.color || EVENT_FALLBACK_COLOR,
        };
      });
  }, [poolEvents, now]);

  // "Up next": first event that hasn't ended yet (only meaningful on today).
  const upNextId = useMemo(() => {
    if (!isToday(currentDate)) return null;
    const next = timedEvents.find(e => new Date(e.endTime) > now);
    return next ? next.id : null;
  }, [timedEvents, now, currentDate]);

  const stillToCome = useMemo(
    () => timedEvents.filter(e => new Date(e.startTime) > now).length,
    [timedEvents, now],
  );

  useEffect(() => {
    if (!isLoading && upNextRef.current) {
      upNextRef.current.scrollIntoView({ block: 'start' });
    }
  }, [isLoading, upNextId]);

  const calendarFor = (event: CalendarEvent) => calendars?.find(c => c.id === event.calendarId);

  if (isLoading) {
    return (
      <div className="h-full flex gap-[22px] bg-[var(--rb-canvas)]" style={{ padding: '22px 28px' }}>
        <aside className="flex flex-col gap-[18px] flex-shrink-0" style={{ width: 380 }}>
          <div className="bg-rb-surface rounded-[18px] p-4"><Skeleton className="h-6 w-32 mb-3 rounded-md" /><Skeleton className="h-48 w-full rounded-xl" /></div>
          <div className="bg-rb-surface rounded-[18px] p-4">
            <Skeleton className="h-4 w-24 mb-3 rounded-md" />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 mb-3"><Skeleton className="h-[54px] w-[54px] rounded-[14px]" /><Skeleton className="h-5 flex-1 rounded-md" /></div>
            ))}
          </div>
        </aside>
        <section className="flex-1 bg-rb-surface rounded-[18px] p-6">
          <Skeleton className="h-8 w-64 mb-6 rounded-md" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 mb-4"><Skeleton className="h-6 w-[96px] rounded-md" /><Skeleton className="h-[72px] flex-1 rounded-[14px]" /></div>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="h-full flex gap-[22px] bg-[var(--rb-canvas)] overflow-hidden" style={{ padding: '22px 28px' }}>
      {/* Left rail */}
      <aside className="flex flex-col gap-[18px] flex-shrink-0 overflow-y-auto" style={{ width: 380 }}>
        <MiniMonth date={railMonth} eventDays={eventDays} onPrev={() => shiftRailMonth(-1)} onNext={() => shiftRailMonth(1)} />
        <ComingUp items={countdowns} />
      </aside>

      {/* Agenda panel */}
      <section className="flex-1 bg-[var(--rb-surface)] rounded-[18px] flex flex-col min-w-0" style={{ boxShadow: '0 1px 3px var(--rb-shadow-card)' }}>
        <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-3 flex-shrink-0">
          <div>
            <h2 className="text-[26px] leading-tight text-rb-ink" style={{ fontWeight: 900 }}>Today's Schedule</h2>
            <div className="text-base font-semibold text-[var(--rb-muted)] mt-0.5">
              {timedEvents.length} {timedEvents.length === 1 ? 'event' : 'events'}
              {isToday(currentDate) ? ` · ${stillToCome} still to come` : ''}
            </div>
          </div>
          {allDayEvents.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1.5 max-w-[45%]">
              {allDayEvents.map(event => {
                const color = event.color || EVENT_FALLBACK_COLOR;
                return (
                  <button
                    key={event.id}
                    onClick={() => onEventClick?.(event)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold truncate"
                    style={{ background: eventTint(color), color: eventTextColor(color) }}
                  >
                    <span className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: color }} />
                    <span className="truncate">{event.title}</span>
                  </button>
                );
              })}
            </div>
          )}
        </header>

        <div ref={listRef} className="flex-1 overflow-y-auto px-6 pb-6">
          {timedEvents.length === 0 && allDayEvents.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-xl font-extrabold text-[var(--rb-muted)]">Nothing scheduled today</div>
                <div className="text-sm font-semibold text-[var(--rb-faint)] mt-1">Enjoy the open day</div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {timedEvents.map(event => {
                const start = new Date(event.startTime);
                const end = new Date(event.endTime);
                const color = event.color || EVENT_FALLBACK_COLOR;
                const cal = calendarFor(event);
                const avatarColor = cal ? getCalendarColor(cal) : color;
                const avatarInitials = getInitials(cal?.summary || event.calendarName || '?');
                const isPast = end <= now && isToday(currentDate);
                const isUpNext = event.id === upNextId;

                return (
                  <div
                    key={event.id}
                    ref={isUpNext ? upNextRef : undefined}
                    className="flex gap-4 items-stretch"
                    style={{ opacity: isPast ? 0.5 : 1, scrollMarginTop: 8 }}
                    data-testid={isUpNext ? 'agenda-up-next' : 'agenda-row'}
                  >
                    <div className="flex flex-col items-end justify-center flex-shrink-0 text-right" style={{ width: 96 }}>
                      <span className="text-[19px] leading-tight text-rb-ink" style={{ fontWeight: 800 }}>{formatTime(start)}</span>
                      <span className="text-sm font-semibold text-[var(--rb-faint)]">{formatTime(end)}</span>
                    </div>

                    <button
                      onClick={() => onEventClick?.(event)}
                      className="flex-1 flex items-center gap-4 text-left px-5 py-4 min-w-0 hover:brightness-95 transition-[filter]"
                      style={{
                        background: eventTint(color),
                        borderRadius: 14,
                        borderLeft: `6px solid ${color}`,
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[19px] leading-tight text-rb-ink truncate" style={{ fontWeight: 800 }}>{event.title}</span>
                          {isUpNext && (
                            <span className="flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-extrabold text-rb-on-color-ink" style={{ background: 'var(--rb-accent)' }}>
                              Up next
                            </span>
                          )}
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-1 mt-1 text-sm font-semibold text-[var(--rb-muted)] truncate">
                            <MapPin size={14} className="flex-shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm font-bold" style={{ color: eventTextColor(color) }}>{durationLabel(start, end)}</span>
                        <span
                          className="rounded-full flex items-center justify-center text-sm font-extrabold text-rb-on-color-ink"
                          style={{ width: 38, height: 38, background: avatarColor }}
                        >
                          {avatarInitials}
                        </span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
