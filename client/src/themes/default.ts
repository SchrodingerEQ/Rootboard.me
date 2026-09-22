import type { ThemeManifest } from "@shared/theme-manifest";

/**
 * DEFAULT THEME — the app's built-in look, and the authoring reference.
 *
 * To make a new theme: copy this file, change `id` and `name`, then edit
 * only the colors you want. Every token is required (the schema rejects a
 * missing one), so starting from a complete copy is the intended workflow.
 * Plain literals only — no var(), no helpers — so the file stays copyable.
 *
 * Contrast: new themes must meet WCAG AA (4.5:1) on the pairs listed in
 * client/src/themes/contrast.spec.ts; Default is grandfathered at its
 * measured values there.
 */
export const defaultTheme: ThemeManifest = {
  engineVersion: 1,
  id: "default",
  name: "Default",
  tokens: {
    // ===== Core palette =====
    "--rb-canvas": "#f7f6f3",          // page background
    "--rb-surface": "#ffffff",         // cards, popovers, dialogs
    "--rb-ink": "#2b3038",             // primary text
    "--rb-muted": "#9aa0aa",           // decorative muted text (not body copy)
    "--rb-faint": "#b0b5be",           // faintest icon/ink
    "--rb-chip": "#f1efea",            // chip / secondary control fill
    "--rb-chip-hover": "#e7e4dd",
    "--rb-accent": "#f2655a",          // brand accent (coral)
    "--rb-accent-hover": "#e8554a",
    "--rb-today-wash": "#fff1ea",      // today cell tint
    "--rb-today-col-wash": "#fff8f2",  // today column tint (week view)
    "--rb-grid-line": "#ededed",

    // ===== Nav + badge =====
    "--rb-nav-active-bg": "#fdeae8",   // = accent-wash
    "--rb-nav-inactive-ink": "#5b626d",// = ink-secondary
    "--rb-badge": "#ea8c00",           // nav-rail count badge
    "--rb-badge-ink": "#ffffff",       // = on-color-ink
    "--rb-shadow-soft": "rgba(0, 0, 0, 0.05)",
    "--rb-scrollbar-thumb": "#d9d5cc",
    "--rb-scrollbar-thumb-hover": "#c4bfb2",
    "--rb-screensaver-bg-1": "#0f0f0f",
    "--rb-screensaver-bg-2": "#1a1a1a",
    "--rb-confetti-1": "#f2655a",
    "--rb-confetti-2": "#f5a623",
    "--rb-confetti-3": "#16a34a",
    "--rb-confetti-4": "#2563eb",
    "--rb-confetti-5": "#9333ea",

    // ===== Ink =====
    "--rb-ink-secondary": "#5b626d",   // control + label ink
    "--rb-ink-tertiary": "#787f8c",    // quiet helper text (shadcn muted-foreground)
    "--rb-ink-soft": "#3a4049",        // names, chips, status
    "--rb-ink-disabled": "#b8bcc4",    // past / out-of-month / disabled
    "--rb-on-color-ink": "#ffffff",    // text + icons on any colored fill

    // ===== Surfaces + borders =====
    "--rb-surface-sunken": "#fbfaf7",  // text inputs, list-row wash
    "--rb-cell-weekend-bg": "#fbfaf7",
    "--rb-cell-inactive-bg": "#f0eee9",
    "--rb-field-border": "#e7e4dd",    // input borders; shadcn --border/--input
    "--rb-border-strong": "#d9d5cc",
    "--rb-accent-wash": "#fdeae8",     // accent tint fill

    // ===== Buttons =====
    "--rb-btn-dark-bg": "#2b3038",     // high-emphasis button fill (= ink in Default)
    "--rb-btn-dark-hover-bg": "#3a4049",

    // ===== Status: danger =====
    "--rb-danger": "#e11d48",
    "--rb-danger-hover": "#c9163d",
    "--rb-danger-ink": "#be123c",
    "--rb-danger-wash": "#fce4ea",
    "--rb-danger-wash-hover": "#f9d2dd",
    "--rb-danger-border": "#f9d2dd",   // = danger-wash-hover

    // ===== Status: success =====
    "--rb-success": "#16a34a",
    "--rb-success-hover": "#15803d",
    "--rb-success-ink": "#15803d",     // = success-hover
    "--rb-success-wash": "#e3f5ea",

    // ===== Status: info =====
    "--rb-info": "#2563eb",            // also shadcn --primary
    "--rb-info-hover": "#1e40af",
    "--rb-info-ink": "#1e40af",        // = info-hover
    "--rb-info-wash": "#eef4ff",
    "--rb-info-wash-hover": "#e1ebff",
    "--rb-info-border": "#cbdcff",

    // ===== Status: warning =====
    "--rb-warn": "#ea8c00",            // = badge
    "--rb-warn-ink": "#b45309",
    "--rb-warn-wash": "#fdf0db",
    "--rb-warn-border": "#f4dcae",

    // ===== Shadows + on-tint overlays =====
    "--rb-shadow-card": "rgba(0, 0, 0, 0.06)",
    "--rb-shadow-accent": "rgba(242, 101, 90, 0.35)",
    "--rb-shadow-panel": "rgba(0, 0, 0, 0.28)",
    "--rb-on-tint-border": "rgba(255, 255, 255, 0.9)",
    "--rb-on-tint-ring": "rgba(255, 255, 255, 0.7)",
    "--rb-on-tint-fill": "rgba(255, 255, 255, 0.65)",
    "--rb-on-tint-chip": "rgba(255, 255, 255, 0.6)",
    "--rb-on-tint-hover-strong": "rgba(255, 255, 255, 0.55)",
    "--rb-on-tint-hover": "rgba(255, 255, 255, 0.5)",

    // ===== On-screen keyboard =====
    "--rb-key-panel-bg": "#e8e6e1",
    "--rb-key-panel-border": "#c9c4b8",
    "--rb-key-border": "#d5d0c6",
    "--rb-key-ctrl-bg": "#d9d5cc",     // = scrollbar-thumb
    "--rb-key-ctrl-active-bg": "#cbc6bb",
    "--rb-key-active-bg": "#2b3038",   // = btn-dark-bg

    // ===== Screensaver =====
    "--rb-screensaver-logo-glow": "rgba(70, 130, 180, 0.3)",
    "--rb-power-saving-bg": "#000000",
  },
};
