import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface MealPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Add a meal for voting" or "Dinner for {WD, Mon D}" (day mode). */
  title: string;
  savedMeals: string[];
  /** Picking a quick-pick chip or confirming the free-text draft both land here. */
  onPick: (title: string) => void;
  /** Day mode only: the day already has a dinner, so offer to clear it. */
  canRemoveDinner?: boolean;
  onRemoveDinner?: () => void;
}

/**
 * Shared "add a meal" modal for both the voting strip's empty slots and the
 * planner's day cells — the mockup's `add-vote` / `add-day` modal kinds.
 * Quick-pick chips come from the saved meal list; free text is also
 * accepted. Adding a candidate/dinner does NOT add to the saved list (that
 * only happens via the "Edit meal list" dialog) — matches the mockup's
 * `addMeal()`, which never touches `savedMeals`.
 */
export function MealPickerDialog({
  open,
  onOpenChange,
  title,
  savedMeals,
  onPick,
  canRemoveDinner,
  onRemoveDinner,
}: MealPickerDialogProps) {
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!open) setDraft("");
  }, [open]);

  const confirm = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onPick(trimmed);
    setDraft("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-none overflow-y-auto"
        style={{ width: 640, maxWidth: "90vw", maxHeight: 820, borderRadius: 22, padding: "34px 38px" }}
        data-testid="dialog-meal-picker"
      >
        <DialogHeader>
          <DialogTitle style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 800, letterSpacing: "-.4px", color: "#2b3038" }}>
            {title}
          </DialogTitle>
        </DialogHeader>
        <p style={{ margin: "0 0 22px", fontSize: 17, fontWeight: 500, color: "var(--rb-muted)" }}>
          Pick from your meal list, or type something new.
        </p>

        <div className="flex flex-wrap" style={{ gap: 9, marginBottom: 24 }}>
          {savedMeals.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => confirm(m)}
              className="touch-button"
              style={{ height: 48, padding: "0 20px", border: "none", background: "var(--rb-chip)", color: "#3a4049", fontSize: 17, fontWeight: 700, borderRadius: 999 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--rb-chip-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--rb-chip)")}
              data-testid={`chip-pick-meal-${m}`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex" style={{ gap: 10 }}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirm(draft);
              if (e.key === "Escape") onOpenChange(false);
            }}
            autoFocus
            placeholder="Type a meal…"
            className="flex-1 min-w-0 outline-none"
            style={{ height: 56, border: "2px solid #e7e4dd", borderRadius: 14, padding: "0 18px", fontSize: 19, fontWeight: 600, color: "#2b3038", background: "#fbfaf7" }}
            data-testid="input-meal-draft"
          />
          <button
            type="button"
            onClick={() => confirm(draft)}
            className="touch-button flex-shrink-0 text-white"
            style={{ height: 56, padding: "0 26px", border: "none", background: "var(--rb-accent)", fontSize: 18, fontWeight: 800, borderRadius: 14, boxShadow: "0 2px 6px rgba(242,101,90,.35)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--rb-accent-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--rb-accent)")}
            data-testid="button-confirm-meal-draft"
          >
            Add
          </button>
        </div>

        {canRemoveDinner && (
          <button
            type="button"
            onClick={() => {
              onRemoveDinner?.();
              onOpenChange(false);
            }}
            className="touch-button"
            style={{ marginTop: 20, height: 46, padding: "0 20px", border: "none", background: "#fce4ea", color: "#e11d48", fontSize: 16, fontWeight: 800, borderRadius: 999 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f9d2dd")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#fce4ea")}
            data-testid="button-remove-dinner"
          >
            Remove this dinner
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
