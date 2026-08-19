import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      screens: {
        'kiosk-21': '1920px',
        'kiosk-touch': { 'raw': '(min-width: 1920px) and (pointer: coarse)' },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        rb: {
          canvas: "var(--rb-canvas)",
          surface: "var(--rb-surface)",
          ink: "var(--rb-ink)",
          muted: "var(--rb-muted)",
          faint: "var(--rb-faint)",
          chip: "var(--rb-chip)",
          "chip-hover": "var(--rb-chip-hover)",
          accent: "var(--rb-accent)",
          "accent-hover": "var(--rb-accent-hover)",
          "today-wash": "var(--rb-today-wash)",
          "grid-line": "var(--rb-grid-line)",
          "nav-active-bg": "var(--rb-nav-active-bg)",
          "nav-inactive-ink": "var(--rb-nav-inactive-ink)",
          badge: "var(--rb-badge)",
          "badge-ink": "var(--rb-badge-ink)",
          // Task 6b addendum — inventory §12 "Task 6 Tailwind-map addendum"
          "ink-secondary": "var(--rb-ink-secondary)",
          "ink-soft": "var(--rb-ink-soft)",
          "on-color-ink": "var(--rb-on-color-ink)",
          "scrollbar-thumb": "var(--rb-scrollbar-thumb)",
          danger: "var(--rb-danger)",
          "danger-hover": "var(--rb-danger-hover)",
          "danger-ink": "var(--rb-danger-ink)",
          "danger-wash": "var(--rb-danger-wash)",
          "danger-border": "var(--rb-danger-border)",
          success: "var(--rb-success)",
          "success-hover": "var(--rb-success-hover)",
          "success-ink": "var(--rb-success-ink)",
          info: "var(--rb-info)",
          "info-hover": "var(--rb-info-hover)",
          "info-ink": "var(--rb-info-ink)",
          "info-wash": "var(--rb-info-wash)",
          "info-wash-hover": "var(--rb-info-wash-hover)",
          "info-border": "var(--rb-info-border)",
          warn: "var(--rb-warn)",
          "warn-ink": "var(--rb-warn-ink)",
          "warn-wash": "var(--rb-warn-wash)",
          "warn-border": "var(--rb-warn-border)",
          "power-saving-bg": "var(--rb-power-saving-bg)",
        },
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
