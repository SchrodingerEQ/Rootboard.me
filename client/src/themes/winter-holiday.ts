import type { ThemeManifest } from "@shared/theme-manifest";

/**
 * WINTER HOLIDAY — a cozy, non-denominational winter look, colours only.
 * Deep evergreen canvas, warm evergreen surfaces, soft snow-white ink, a
 * cranberry accent and a gold badge. Original palette: no holiday brand
 * colours or trademarked motifs. Same file shape as default.ts and
 * deep-space.ts so the three diff cleanly.
 *
 * Contrast notes: like Deep Space this is a dark theme, so
 * `--rb-on-color-ink` stays light and every coloured fill it sits on
 * (accent, badge, danger, success, info, btn-dark, the person colours) is
 * kept deep enough for 4.5:1. The bright reds, golds and snow live in the
 * confetti and the logo glow.
 */
export const winterHolidayTheme: ThemeManifest = {
  engineVersion: 1,
  id: "winter-holiday",
  name: "Winter Holiday",
  tokens: {
    // ===== Core palette =====
    "--rb-canvas": "#0b1813",
    "--rb-surface": "#12221c",
    "--rb-ink": "#f5f1e8",
    "--rb-muted": "#7e958b",
    "--rb-faint": "#536a60",
    "--rb-chip": "#1f3830",
    "--rb-chip-hover": "#28463b",
    "--rb-accent": "#d92b3d",
    "--rb-accent-hover": "#bc2231",
    "--rb-today-wash": "#2c2a16",
    "--rb-today-col-wash": "#212718",
    "--rb-grid-line": "#22382f",

    // ===== Nav + badge =====
    "--rb-nav-active-bg": "#241112",
    "--rb-nav-inactive-ink": "#c0cec6",
    "--rb-badge": "#a66206",
    "--rb-badge-ink": "#fffdf8",
    "--rb-shadow-soft": "rgba(0, 0, 0, 0.35)",
    "--rb-scrollbar-thumb": "#2e4a3f",
    "--rb-scrollbar-thumb-hover": "#3c5c4f",
    "--rb-screensaver-bg-1": "#06110d",
    "--rb-screensaver-bg-2": "#0b1813",
    "--rb-confetti-1": "#f5f1e8",
    "--rb-confetti-2": "#e0414f",
    "--rb-confetti-3": "#f2c14e",
    "--rb-confetti-4": "#3fa36a",
    "--rb-confetti-5": "#8ecae6",

    // ===== Ink =====
    "--rb-ink-secondary": "#c0cec6",
    "--rb-ink-tertiary": "#9bb0a6",
    "--rb-ink-soft": "#d8e2dc",
    "--rb-ink-disabled": "#4d6258",
    "--rb-on-color-ink": "#fffdf8",

    // ===== Surfaces + borders =====
    "--rb-surface-sunken": "#0f1e18",
    "--rb-cell-weekend-bg": "#10201a",
    "--rb-cell-inactive-bg": "#0d1b16",
    "--rb-field-border": "#2e4a3f",
    "--rb-border-strong": "#3c5c4f",
    "--rb-accent-wash": "#241112",

    // ===== Buttons =====
    "--rb-btn-dark-bg": "#1f3830",
    "--rb-btn-dark-hover-bg": "#2e4a3f",

    // ===== Status: danger =====
    "--rb-danger": "#e01547",
    "--rb-danger-hover": "#c0123d",
    "--rb-danger-ink": "#fda4af",
    "--rb-danger-wash": "#3b0d1a",
    "--rb-danger-wash-hover": "#4c1122",
    "--rb-danger-border": "#4c1122",

    // ===== Status: success =====
    "--rb-success": "#15803d",
    "--rb-success-hover": "#166534",
    "--rb-success-ink": "#86efac",
    "--rb-success-wash": "#0b2e1a",

    // ===== Status: info =====
    "--rb-info": "#3d69e5",
    "--rb-info-hover": "#2153e1",
    "--rb-info-ink": "#93c5fd",
    "--rb-info-wash": "#0a152f",
    "--rb-info-wash-hover": "#0f1f45",
    "--rb-info-border": "#1e3a8a",

    // ===== Status: warning =====
    "--rb-warn": "#b45309",
    "--rb-warn-ink": "#fcd34d",
    "--rb-warn-wash": "#3a2a05",
    "--rb-warn-border": "#5a4108",

    // ===== Shadows + on-tint overlays =====
    "--rb-shadow-card": "rgba(0, 0, 0, 0.4)",
    "--rb-shadow-accent": "rgba(217, 43, 61, 0.45)",
    "--rb-shadow-panel": "rgba(0, 0, 0, 0.6)",
    "--rb-on-tint-border": "rgba(255, 255, 255, 0.25)",
    "--rb-on-tint-ring": "rgba(255, 255, 255, 0.2)",
    "--rb-on-tint-fill": "rgba(255, 255, 255, 0.12)",
    "--rb-on-tint-chip": "rgba(255, 255, 255, 0.1)",
    "--rb-on-tint-hover-strong": "rgba(255, 255, 255, 0.18)",
    "--rb-on-tint-hover": "rgba(255, 255, 255, 0.14)",

    // ===== On-screen keyboard =====
    "--rb-key-panel-bg": "#10201a",
    "--rb-key-panel-border": "#2e4a3f",
    "--rb-key-border": "#2e4a3f",
    "--rb-key-ctrl-bg": "#1f3830",
    "--rb-key-ctrl-active-bg": "#28463b",
    "--rb-key-active-bg": "#22382f",

    // ===== Screensaver =====
    "--rb-screensaver-logo-glow": "rgba(242, 193, 78, 0.3)",
    "--rb-power-saving-bg": "#000000",

    // ===== People (8 identity slots) =====
    "--rb-person-1-color": "#983ceb",  // purple
    "--rb-person-1-tint": "#2a1540",   // purple
    "--rb-person-1-text": "#d8b4fe",   // purple
    "--rb-person-2-color": "#157f3d",  // green
    "--rb-person-2-tint": "#0b2e1a",   // green
    "--rb-person-2-text": "#86efac",   // green
    "--rb-person-3-color": "#b35309",  // orange
    "--rb-person-3-tint": "#3a2205",   // orange
    "--rb-person-3-text": "#fdba74",   // orange
    "--rb-person-4-color": "#2865eb",  // blue
    "--rb-person-4-tint": "#0f1f45",   // blue
    "--rb-person-4-text": "#93c5fd",   // blue
    "--rb-person-5-color": "#d91741",  // rose/red
    "--rb-person-5-tint": "#3b0d1a",   // rose/red
    "--rb-person-5-text": "#fda4af",   // rose/red
    "--rb-person-6-color": "#107c74",  // teal
    "--rb-person-6-tint": "#062a27",   // teal
    "--rb-person-6-text": "#5eead4",   // teal
    "--rb-person-7-color": "#cd2974",  // pink
    "--rb-person-7-tint": "#3a0f25",   // pink
    "--rb-person-7-text": "#f9a8d4",   // pink
    "--rb-person-8-color": "#5f7088",  // slate
    "--rb-person-8-tint": "#1e2836",   // slate
    "--rb-person-8-text": "#cbd5e1",   // slate
  },
};
