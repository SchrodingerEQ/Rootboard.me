import type { ThemeManifest } from "@shared/theme-manifest";
import background from "./winter-holiday/background.jpg";
import logo from "./winter-holiday/logo.png";
import screensaver from "./winter-holiday/screensaver.jpg";

/**
 * WINTER HOLIDAY — a cozy, non-denominational winter look. Deep evergreen
 * canvas, warm evergreen surfaces, soft snow-white ink, a cranberry accent
 * and a gold badge, over one full-screen picture of frosted boughs, berries
 * and warm lights, a matching screensaver framed by boughs, and a
 * snow-white sparkle logo (the founder's art, 2026-11-27). Original palette and
 * art: no holiday brand colours or trademarked motifs. Same file shape as
 * default.ts and deep-space.ts so the three diff cleanly.
 *
 * Manifest v3 (THEME-ASSETS.md): one `background` image under the whole
 * viewer; no header or sidebar overlay, so the picture runs continuously
 * under the title bars and the rail. The text backing fades the canvas
 * colour from 80 % to clear behind the header bars (downward) and the rail
 * (rightward), and puts the canvas at 60 % behind Dinner's vote strip.
 *
 * Surfaces at 80 % alpha (founder 2026-11-27, after comparing 10/15/20/30 %):
 * cards, cells, panels and the person columns let 20 % of the background
 * picture through. The contrast guard composites them over the canvas.
 * Contrast notes: like Deep Space this is a dark theme, so
 * `--rb-on-color-ink` stays light and every coloured fill it sits on
 * (accent, badge, danger, success, info, btn-dark, the person colours) is
 * kept deep enough for 4.5:1. The bright reds, golds and snow live in the
 * confetti and the logo glow.
 */
export const winterHolidayTheme: ThemeManifest = {
  engineVersion: 3,
  id: "winter-holiday",
  name: "Winter Holiday",
  // ===== Images (manifest v2/v3) =====
  // background: the whole viewer, 1920 × 1080, cover. screensaver: the
  // power-saving overlay, 1920 × 1080. logo: the nav rail and screensaver
  // logo, 256 × 256 with alpha. No header or sidebar overlay.
  images: { background, screensaver, logo },
  // ===== Confetti shapes (manifest v2) =====
  // 24 × 24 viewBox: a six-point snowflake, a four-point sparkle, a round berry.
  // The berry is one arc ending just short of its start (11.99): an arc whose
  // end equals its start draws nothing.
  confettiShapes: [
    "M12 2 L15 7.5 L21 7.5 L18 12 L21 16.5 L15 16.5 L12 22 L9 16.5 L3 16.5 L6 12 L3 7.5 L9 7.5 Z",
    "M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z",
    "M12 4 A8 8 0 1 1 11.99 4 Z",
  ],
  // ===== Text backing (manifest v3) =====
  // Canvas colour (#0b1813) at the alphas below.
  backing: {
    header: { kind: "gradient", from: "rgba(11, 24, 19, 0.8)", to: "rgba(11, 24, 19, 0)", direction: "down" },
    rail: { kind: "gradient", from: "rgba(11, 24, 19, 0.8)", to: "rgba(11, 24, 19, 0)", direction: "right" },
    voteStrip: { kind: "solid", color: "rgba(11, 24, 19, 0.6)" },
  },
  tokens: {
    // ===== Core palette =====
    "--rb-canvas": "#0b1813",
    "--rb-surface": "rgba(18, 34, 28, 0.8)",
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
    "--rb-surface-sunken": "rgba(15, 30, 24, 0.8)",
    "--rb-cell-weekend-bg": "rgba(16, 32, 26, 0.8)",
    "--rb-cell-inactive-bg": "rgba(13, 27, 22, 0.8)",
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
