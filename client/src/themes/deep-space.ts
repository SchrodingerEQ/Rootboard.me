import type { ThemeManifest } from "@shared/theme-manifest";

/**
 * DEEP SPACE — the built-in dark theme. Original design; no franchise
 * design language. Same file shape as default.ts so the two diff cleanly.
 *
 * Contrast notes: `--rb-on-color-ink` stays light, so every colored fill
 * it sits on (accent, badge, danger, success, info, btn-dark) is kept deep
 * enough for 4.5:1. That is why the accent is a deep cyan rather than a
 * neon one; the neon lives in the confetti and the logo glow.
 */
export const deepSpaceTheme: ThemeManifest = {
  engineVersion: 1,
  id: "deep-space",
  name: "Deep Space",
  tokens: {
    // ===== Core palette =====
    "--rb-canvas": "#0b1220",
    "--rb-surface": "#141c2e",
    "--rb-ink": "#e6edf7",
    "--rb-muted": "#6b7890",
    "--rb-faint": "#4a5568",
    "--rb-chip": "#1c2740",
    "--rb-chip-hover": "#253352",
    "--rb-accent": "#0e7490",
    "--rb-accent-hover": "#155e75",
    "--rb-today-wash": "#10303f",
    "--rb-today-col-wash": "#0f2431",
    "--rb-grid-line": "#1f2a40",

    // ===== Nav + badge =====
    "--rb-nav-active-bg": "#10303f",
    "--rb-nav-inactive-ink": "#aab7cc",
    "--rb-badge": "#b45309",
    "--rb-badge-ink": "#f8fafc",
    "--rb-shadow-soft": "rgba(0, 0, 0, 0.35)",
    "--rb-scrollbar-thumb": "#2c3a55",
    "--rb-scrollbar-thumb-hover": "#3a4a6a",
    "--rb-screensaver-bg-1": "#05080f",
    "--rb-screensaver-bg-2": "#0b1220",
    "--rb-confetti-1": "#22d3ee",
    "--rb-confetti-2": "#f59e0b",
    "--rb-confetti-3": "#34d399",
    "--rb-confetti-4": "#60a5fa",
    "--rb-confetti-5": "#c084fc",

    // ===== Ink =====
    "--rb-ink-secondary": "#aab7cc",
    "--rb-ink-tertiary": "#8e9bb0",
    "--rb-ink-soft": "#cbd5e3",
    "--rb-ink-disabled": "#4f5b70",
    "--rb-on-color-ink": "#f8fafc",

    // ===== Surfaces + borders =====
    "--rb-surface-sunken": "#0f1626",
    "--rb-cell-weekend-bg": "#101828",
    "--rb-cell-inactive-bg": "#0d1424",
    "--rb-field-border": "#2c3a55",
    "--rb-border-strong": "#3a4a6a",
    "--rb-accent-wash": "#10303f",

    // ===== Buttons =====
    "--rb-btn-dark-bg": "#1e293b",
    "--rb-btn-dark-hover-bg": "#2c3a55",

    // ===== Status: danger =====
    "--rb-danger": "#be123c",
    "--rb-danger-hover": "#9f1239",
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
    "--rb-info": "#1d4ed8",
    "--rb-info-hover": "#1e40af",
    "--rb-info-ink": "#93c5fd",
    "--rb-info-wash": "#0f1f45",
    "--rb-info-wash-hover": "#14285a",
    "--rb-info-border": "#1e3a8a",

    // ===== Status: warning =====
    "--rb-warn": "#b45309",
    "--rb-warn-ink": "#fcd34d",
    "--rb-warn-wash": "#3a2a05",
    "--rb-warn-border": "#5a4108",

    // ===== Shadows + on-tint overlays =====
    "--rb-shadow-card": "rgba(0, 0, 0, 0.4)",
    "--rb-shadow-accent": "rgba(14, 116, 144, 0.45)",
    "--rb-shadow-panel": "rgba(0, 0, 0, 0.6)",
    "--rb-on-tint-border": "rgba(255, 255, 255, 0.25)",
    "--rb-on-tint-ring": "rgba(255, 255, 255, 0.2)",
    "--rb-on-tint-fill": "rgba(255, 255, 255, 0.12)",
    "--rb-on-tint-chip": "rgba(255, 255, 255, 0.1)",
    "--rb-on-tint-hover-strong": "rgba(255, 255, 255, 0.18)",
    "--rb-on-tint-hover": "rgba(255, 255, 255, 0.14)",

    // ===== On-screen keyboard =====
    "--rb-key-panel-bg": "#101828",
    "--rb-key-panel-border": "#2c3a55",
    "--rb-key-border": "#2c3a55",
    "--rb-key-ctrl-bg": "#1c2740",
    "--rb-key-ctrl-active-bg": "#253352",
    "--rb-key-active-bg": "#1e293b",

    // ===== Screensaver =====
    "--rb-screensaver-logo-glow": "rgba(34, 211, 238, 0.3)",
    "--rb-power-saving-bg": "#000000",

    // ===== People (8 identity slots) =====
    "--rb-person-1-color": "#9333ea",  // purple
    "--rb-person-1-tint": "#2a1540",   // purple
    "--rb-person-1-text": "#d8b4fe",   // purple
    "--rb-person-2-color": "#15803d",  // green
    "--rb-person-2-tint": "#0b2e1a",   // green
    "--rb-person-2-text": "#86efac",   // green
    "--rb-person-3-color": "#b45309",  // orange
    "--rb-person-3-tint": "#3a2205",   // orange
    "--rb-person-3-text": "#fdba74",   // orange
    "--rb-person-4-color": "#2563eb",  // blue
    "--rb-person-4-tint": "#0f1f45",   // blue
    "--rb-person-4-text": "#93c5fd",   // blue
    "--rb-person-5-color": "#d4163f",  // rose/red
    "--rb-person-5-tint": "#3b0d1a",   // rose/red
    "--rb-person-5-text": "#fda4af",   // rose/red
    "--rb-person-6-color": "#0f766e",  // teal
    "--rb-person-6-tint": "#062a27",   // teal
    "--rb-person-6-text": "#5eead4",   // teal
    "--rb-person-7-color": "#c0266d",  // pink
    "--rb-person-7-tint": "#3a0f25",   // pink
    "--rb-person-7-text": "#f9a8d4",   // pink
    "--rb-person-8-color": "#5b6b82",  // slate
    "--rb-person-8-tint": "#1e2836",   // slate
    "--rb-person-8-text": "#cbd5e1",   // slate
  },
};
