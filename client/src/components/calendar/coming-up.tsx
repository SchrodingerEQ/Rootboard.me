import { eventTint, eventTextColor } from "@/lib/color-utils";

export interface CountdownItem {
  days: number;
  title: string;
  whenLabel: string;
  color: string;
}

/** "Coming up" rail card: day-countdown tiles for the next few future events. */
export function ComingUp({ items }: { items: CountdownItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="bg-[var(--rb-surface)] rounded-[18px] p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div className="text-xs font-bold uppercase tracking-wide text-[var(--rb-faint)] mb-3">Coming up</div>
      <div className="flex flex-col gap-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3" data-testid="coming-up-row">
            <div
              className="flex flex-col items-center justify-center flex-shrink-0"
              style={{
                width: 54, height: 54, borderRadius: 14,
                background: eventTint(item.color),
                color: eventTextColor(item.color),
              }}
            >
              <span className="leading-none" style={{ fontWeight: 900, fontSize: 22 }}>{item.days}</span>
              <span className="leading-none text-[11px] font-bold mt-0.5">{item.days === 1 ? 'day' : 'days'}</span>
            </div>
            <div className="min-w-0">
              <div className="text-base font-extrabold text-[#2b3038] truncate">{item.title}</div>
              <div className="text-sm font-semibold text-[var(--rb-muted)] truncate">{item.whenLabel}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
