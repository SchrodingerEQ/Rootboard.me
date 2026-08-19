// Shared view identifier. Lives in lib/ so components never import types
// from page modules. `Section` (the old 3-way calendar/chores/dinner union)
// was removed in Task 10 — the shell's nav section is config-driven
// (`string`, see AppShell) since dashboard.json can enable any installed
// widget, not just the three first-party ones.
export type CalendarView = "day" | "week" | "month";
