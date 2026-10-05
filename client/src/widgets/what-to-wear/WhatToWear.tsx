import type { CSSProperties } from "react";
import type { ForecastStatus } from "./forecast";
import type { Advice, Units, WindowSummary } from "./types";
import { formatTemp } from "./units";
import { ItemChip } from "./ItemChip";

export interface WhatToWearProps {
  loaded: boolean;
  status: ForecastStatus;
  advice: Advice | null;
  location: string;
  units: Units;
  footer: string;
}

const card: CSSProperties = {
  background: "var(--rb-surface)",
  border: "1px solid var(--rb-grid-line)",
  borderRadius: 24,
  padding: 20,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
};

function MessagePanel({ text, hint }: { text: string; hint?: string }) {
  return (
    <div
      data-testid="wtw-message"
      style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center", padding: 32 }}
    >
      <div style={{ fontSize: 40, fontWeight: 800, color: "var(--rb-ink)", maxWidth: 900, lineHeight: 1.2 }}>{text}</div>
      {hint && <div style={{ fontSize: 22, color: "var(--rb-muted)" }}>{hint}</div>}
    </div>
  );
}

function WindowCard({ w, units }: { w: WindowSummary; units: Units }) {
  return (
    <div data-testid={`wtw-window-${w.key}`} style={{ ...card, flex: 1, alignItems: "center", justifyContent: "center", gap: 6, textAlign: "center" }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--rb-ink-secondary)" }}>{w.title}</div>
      <div style={{ fontSize: 16, color: "var(--rb-muted)" }}>{w.timeLabel}</div>
      <div style={{ fontSize: 72, lineHeight: 1 }}>{w.emoji}</div>
      <div style={{ fontSize: 56, fontWeight: 900, color: "var(--rb-ink)", lineHeight: 1 }}>{formatTemp(w.tempC, units)}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--rb-ink)" }}>{w.phrase}</div>
      {w.chips.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {w.chips.map((c) => (
            <span key={c} style={{ fontSize: 18, fontWeight: 700, padding: "4px 12px", borderRadius: 999, background: "var(--rb-info-wash)", color: "var(--rb-ink)" }}>
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function WhatToWear({ loaded, status, advice, location, units, footer }: WhatToWearProps) {
  let body: JSX.Element;
  if (!loaded) {
    body = <MessagePanel text="Checking the weather… ☁️" />;
  } else if (status === "no-config") {
    body = <MessagePanel text="Ask a grown-up to add your zip code in Settings 🙂" hint="Settings is on the nav rail." />;
  } else if (status === "invalid-zip") {
    body = <MessagePanel text="That zip code didn't work — check it in Settings" />;
  } else if (!advice) {
    body = <MessagePanel text="Can't reach the weather right now. Try again in a bit ☁️" />;
  } else {
    body = (
      <>
        {/* 1. Header strip */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <span data-testid="wtw-day" style={{ fontSize: 34, fontWeight: 900, color: "var(--rb-ink)" }}>
              {advice.dayLabel} · {advice.weekday}
            </span>
            {location && <span style={{ fontSize: 20, color: "var(--rb-muted)", fontWeight: 600 }}>{location}</span>}
          </div>
          <span data-testid="wtw-headline" style={{ fontSize: 30, fontWeight: 800, color: "var(--rb-ink)", textAlign: "right" }}>
            {advice.headline}
          </span>
        </div>

        {/* 2. Day-at-a-glance row */}
        <div style={{ display: "flex", gap: 16, flex: 1.1, minHeight: 0 }}>
          {advice.windows.map((w) => (
            <WindowCard key={w.key} w={w} units={units} />
          ))}
        </div>

        {/* 3. Outfit cards */}
        <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
          <div data-testid="wtw-wear" style={{ ...card, flex: 1.3, gap: 14 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--rb-ink-secondary)" }}>This morning, wear…</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {advice.wear.map((item) => (
                <ItemChip key={item.id} item={item} />
              ))}
            </div>
          </div>
          <div data-testid="wtw-afternoon" style={{ ...card, flex: 1, gap: 12, background: "var(--rb-accent-wash)" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--rb-ink-secondary)" }}>This afternoon…</div>
            {advice.afternoonNotes.map((note) => (
              <div key={note} style={{ fontSize: 28, fontWeight: 700, color: "var(--rb-ink)", lineHeight: 1.25 }}>
                {note}
              </div>
            ))}
          </div>
        </div>

        {/* 4. Backpack strip */}
        <div data-testid="wtw-backpack" style={{ ...card, flexDirection: "row", alignItems: "center", gap: 14, padding: "14px 20px", flexWrap: "wrap" }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: "var(--rb-ink-secondary)" }}>🎒 Put in your backpack:</span>
          {advice.backpack.length === 0 ? (
            <span style={{ fontSize: 24, fontWeight: 700, color: "var(--rb-ink)" }}>Nothing extra today!</span>
          ) : (
            advice.backpack.map((item) => <ItemChip key={item.id} item={item} size="md" />)
          )}
        </div>
      </>
    );
  }

  return (
    <div
      data-testid="wtw-root"
      style={{ height: "100%", display: "flex", flexDirection: "column", gap: 16, padding: 24, overflow: "hidden", background: "var(--rb-canvas)", color: "var(--rb-ink)" }}
    >
      {body}
      {/* 5. Footer line */}
      <div data-testid="wtw-footer" style={{ fontSize: 16, color: "var(--rb-muted)", textAlign: "right" }}>
        {footer}
      </div>
    </div>
  );
}
