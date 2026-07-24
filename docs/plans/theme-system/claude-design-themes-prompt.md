# Claude Design Prompt — Rootboard Built-in Themes

Use this in Claude Design when Phase 1 begins. Run it once per theme (Spooky, Winter Holiday, Deep Space), or adapt into one session producing all three.

---

I'm designing visual themes for **Rootboard**, a 24/7 family touchscreen kiosk app (21.5" screen, 1920px wide, viewed from across a kitchen). It has three sections — Calendar (day/week/month views), Chores (person columns with card stacks and a confetti burst when a chore is checked off), and Dinner (weekly planner grid with a voting strip) — plus a left nav rail with a logo, and a floating-logo screensaver.

**Important constraint: themes change colors, fonts, and imagery ONLY. Layout, spacing, element sizes, and positions are fixed and identical across every theme.** Design within the existing structure.

The current default look for reference: warm off-white canvas (#f7f6f3), white cards with 16px rounded corners and soft shadows, ink text (#2b3038), coral accent (#f2655a), Nunito font, friendly and airy.

## What I need for each theme

1. **A full mockup** of the Calendar month view, the Chores board, and the Dinner planner in the theme, plus the nav rail, so I can judge the whole system together.
2. **A complete color specification** (I will transfer these into a JSON theme manifest):
   - Canvas/background, card surface, ink/text, muted text, borders/grid lines
   - Accent + accent hover, "today" highlight washes
   - Chip/button backgrounds + hover states
   - Badge color, destructive/warning color
   - A 5-color person palette (used to identify family members — each color must be clearly distinguishable from the others AND readable as text/fills against the theme's card surface)
   - Confetti color list (5 colors)
   - Scrollbar thumb + hover
   - Shadow color/opacity
3. **Font recommendation**: a Google Fonts family (open license, downloadable as woff2) that fits the theme but stays *legible at 13px from across a room*. Must look sane at weights 400–900. Provide a fallback stack.
4. **Confetti particle shapes**: 2–4 simple, flat, single-color SVG silhouette concepts (max ~24×24 viewBox) that read clearly at 7–13px rendered size.
5. **Screensaver image concept**: the theme's logo treatment or emblem that floats on a dark background overnight.

## The three themes

- **Spooky** (Halloween): playful-spooky, not horror — this is a family kitchen. Think dusk purples/oranges, moonlit tones. Confetti shapes: bats, tiny pumpkins, ghosts.
- **Winter Holiday**: cozy, non-denominational winter — evergreens, deep reds or icy blues, warm whites. Confetti shapes: snowflakes, holly, mittens.
- **Deep Space**: original retro-sci-fi command console. Dark navy/near-black canvas, glowing cyan/amber accents, starfield feel. **No Star Trek/LCARS or any existing franchise's design language — fully original.** This is the one dark theme, so double-check contrast everywhere (muted text on dark cards is the usual failure point).

## Hard requirements

- WCAG AA contrast (4.5:1) for all text-on-background pairs, including muted text and every person color on the card surface.
- Colors must work on a screen that dims to low brightness at night.
- Kids use this app — every theme must stay warm and inviting, not sterile or scary.
