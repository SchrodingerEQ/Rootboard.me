import type { ThemeManifest } from "@shared/theme-manifest";
import background from "./spooky/background.jpg";
import logo from "./spooky/logo.png";
import screensaver from "./spooky/screensaver.jpg";

/**
 * SPOOKY — a playful Halloween look for a family kitchen: dusk, not horror.
 * Deep plum canvas, plum surfaces, lavender-white ink, a pumpkin accent and
 * an amber badge, over one full-screen moonlit painting of misty hills and
 * a far-off village with lantern glows, a matching screensaver with a
 * grinning pumpkin patch and two bats across the moon, and a smiling
 * jack-o'-lantern logo (the founder's art, 2026-11-28). Original palette and
 * art: no brand characters or trademarked motifs. Same file shape as
 * default.ts, deep-space.ts and winter-holiday.ts so the four diff cleanly.
 *
 * Manifest v3 (THEME-ASSETS.md): one `background` image under the whole
 * viewer; no header or sidebar overlay. The text backing fades the canvas
 * colour from 80 % to clear behind the header bars (downward) and the rail
 * (rightward), and puts the canvas at 60 % behind Dinner's vote strip.
 *
 * Surfaces at 80 % alpha, the level the founder chose for Winter Holiday on
 * 2026-11-27 and kept here: cards, cells, panels and the person columns let
 * 20 % of the picture through. The contrast guard composites them over the
 * canvas. Contrast notes: a dark theme, so `--rb-on-color-ink` stays light
 * and every coloured fill it sits on (accent, badge, danger, success, info,
 * btn-dark, the person colours) is kept deep enough for 4.5:1. The bright
 * pumpkin orange, candle gold and moonlit violet live in the confetti, the
 * glows and the logo, not under text.
 */
export const spookyTheme: ThemeManifest = {
  engineVersion: 3,
  id: "spooky",
  name: "Spooky",
  // ===== Images (manifest v2/v3) =====
  // background: the whole viewer, 1920 × 1080, cover. screensaver: the
  // power-saving overlay, 1920 × 1080. logo: the nav rail and screensaver
  // logo, 256 × 256 with alpha. No header or sidebar overlay.
  images: { background, screensaver, logo },
  // ===== Confetti shapes (manifest v2) =====
  // 24 × 24 viewBox: a bat, a pumpkin, a ghost, a crescent moon, a star.
  // The moon is two arcs of different radii bulging the same way; the
  // pumpkin is a stem over one large elliptical arc.
  confettiShapes: [
    "M12 7 L10 5 L9 8 L5 6 L3 9 L2 13 L5 12 L7 14 L9 13 L12 17 L15 13 L17 14 L19 12 L22 13 L21 9 L19 6 L15 8 L14 5 Z",
    "M11 2 L13 2 L13 6 A8 7.5 0 1 1 11 6 Z",
    "M12 3 A7 7 0 0 1 19 10 L19 21 L16.5 18.5 L14 21 L12 18.5 L10 21 L7.5 18.5 L5 21 L5 10 A7 7 0 0 1 12 3 Z",
    "M15 2 A10 10 0 1 0 15 22 A11 11 0 0 1 15 2 Z",
    "M12 2 L14.6 8.6 L21.5 9.3 L16.3 13.9 L17.9 20.8 L12 17.2 L6.1 20.8 L7.7 13.9 L2.5 9.3 L9.4 8.6 Z",
  ],
  // ===== Text backing (manifest v3) =====
  // Canvas colour (#150c20) at the alphas below.
  backing: {
    header: { kind: "gradient", from: "rgba(21, 12, 32, 0.8)", to: "rgba(21, 12, 32, 0)", direction: "down" },
    rail: { kind: "gradient", from: "rgba(21, 12, 32, 0.8)", to: "rgba(21, 12, 32, 0)", direction: "right" },
    voteStrip: { kind: "solid", color: "rgba(21, 12, 32, 0.6)" },
  },
  tokens: {
    // ===== Core palette =====
    "--rb-canvas": "#150c20",
    "--rb-surface": "rgba(30, 20, 46, 0.8)",
    "--rb-ink": "#f3eef9",
    "--rb-muted": "#9a8db0",
    "--rb-faint": "#6a5f80",
    "--rb-chip": "#2a1c42",
    "--rb-chip-hover": "#35254f",
    "--rb-accent": "#bf4f0a",
    "--rb-accent-hover": "#a4430a",
    "--rb-today-wash": "#3a2318",
    "--rb-today-col-wash": "#2c1c2e",
    "--rb-grid-line": "#2d1f45",

    // ===== Nav + badge =====
    "--rb-nav-active-bg": "#3a1f14",
    "--rb-nav-inactive-ink": "#cdbfe3",
    "--rb-badge": "#a66206",
    "--rb-badge-ink": "#fffaf3",
    "--rb-shadow-soft": "rgba(0, 0, 0, 0.35)",
    "--rb-scrollbar-thumb": "#3b2a58",
    "--rb-scrollbar-thumb-hover": "#4a3669",
    "--rb-screensaver-bg-1": "#0d0716",
    "--rb-screensaver-bg-2": "#150c20",
    "--rb-confetti-1": "#f08a2b",
    "--rb-confetti-2": "#f2c14e",
    "--rb-confetti-3": "#8b6fd1",
    "--rb-confetti-4": "#f3eef9",
    "--rb-confetti-5": "#4fd18b",

    // ===== Ink =====
    "--rb-ink-secondary": "#cdbfe3",
    "--rb-ink-tertiary": "#a898c4",
    "--rb-ink-soft": "#e2d9f0",
    "--rb-ink-disabled": "#5a4d72",
    "--rb-on-color-ink": "#fffaf3",

    // ===== Surfaces + borders =====
    "--rb-surface-sunken": "rgba(24, 16, 38, 0.8)",
    "--rb-cell-weekend-bg": "rgba(27, 18, 42, 0.8)",
    "--rb-cell-inactive-bg": "rgba(22, 14, 34, 0.8)",
    "--rb-field-border": "#3b2a58",
    "--rb-border-strong": "#4a3669",
    "--rb-accent-wash": "#3a1f14",

    // ===== Buttons =====
    "--rb-btn-dark-bg": "#2a1c42",
    "--rb-btn-dark-hover-bg": "#3b2a58",

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
    "--rb-shadow-accent": "rgba(240, 138, 43, 0.45)",
    "--rb-shadow-panel": "rgba(0, 0, 0, 0.6)",
    "--rb-on-tint-border": "rgba(255, 255, 255, 0.25)",
    "--rb-on-tint-ring": "rgba(255, 255, 255, 0.2)",
    "--rb-on-tint-fill": "rgba(255, 255, 255, 0.12)",
    "--rb-on-tint-chip": "rgba(255, 255, 255, 0.1)",
    "--rb-on-tint-hover-strong": "rgba(255, 255, 255, 0.18)",
    "--rb-on-tint-hover": "rgba(255, 255, 255, 0.14)",

    // ===== On-screen keyboard =====
    "--rb-key-panel-bg": "#1c1230",
    "--rb-key-panel-border": "#3b2a58",
    "--rb-key-border": "#3b2a58",
    "--rb-key-ctrl-bg": "#2a1c42",
    "--rb-key-ctrl-active-bg": "#35254f",
    "--rb-key-active-bg": "#2d1f45",

    // ===== Screensaver =====
    "--rb-screensaver-logo-glow": "rgba(240, 138, 43, 0.3)",
    "--rb-power-saving-bg": "#000000",

    // ===== People (8 identity slots) =====
    "--rb-person-1-color": "#983ceb",  // purple
    "--rb-person-1-tint": "rgba(42, 21, 64, 0.8)",   // purple
    "--rb-person-1-text": "#d8b4fe",   // purple
    "--rb-person-2-color": "#157f3d",  // green
    "--rb-person-2-tint": "rgba(11, 46, 26, 0.8)",   // green
    "--rb-person-2-text": "#86efac",   // green
    "--rb-person-3-color": "#b35309",  // orange
    "--rb-person-3-tint": "rgba(58, 34, 5, 0.8)",   // orange
    "--rb-person-3-text": "#fdba74",   // orange
    "--rb-person-4-color": "#2865eb",  // blue
    "--rb-person-4-tint": "rgba(15, 31, 69, 0.8)",   // blue
    "--rb-person-4-text": "#93c5fd",   // blue
    "--rb-person-5-color": "#d91741",  // rose/red
    "--rb-person-5-tint": "rgba(59, 13, 26, 0.8)",   // rose/red
    "--rb-person-5-text": "#fda4af",   // rose/red
    "--rb-person-6-color": "#107c74",  // teal
    "--rb-person-6-tint": "rgba(6, 42, 39, 0.8)",   // teal
    "--rb-person-6-text": "#5eead4",   // teal
    "--rb-person-7-color": "#cd2974",  // pink
    "--rb-person-7-tint": "rgba(58, 15, 37, 0.8)",   // pink
    "--rb-person-7-text": "#f9a8d4",   // pink
    "--rb-person-8-color": "#5f7088",  // slate
    "--rb-person-8-tint": "rgba(30, 40, 54, 0.8)",   // slate
    "--rb-person-8-text": "#cbd5e1",   // slate
  },
};
