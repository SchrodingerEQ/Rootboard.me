// Shared view/section identifiers. Lives in lib/ so components never
// import types from page modules (pages will split in the widget-host
// refactor; see docs/plans/widget-system/WIDGET-SYSTEM-PLAN.md).
export type Section = "calendar" | "chores" | "dinner";
export type CalendarView = "day" | "week" | "month";
