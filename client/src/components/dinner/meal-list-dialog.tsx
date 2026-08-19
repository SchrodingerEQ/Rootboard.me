import { useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MEAL_CAP } from "@/lib/dinner-state";

interface MealListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedMeals: string[];
  onAdd: (title: string) => void;
  onRemove: (title: string) => void;
}

/**
 * "Edit meal list" — feeds both the voting picker and the day picker.
 * Capped at MEAL_CAP; the counter pill turns red once full. Row remove
 * buttons are 44px (not the mockup's 38px) per the plan's "hit targets
 * ≥44px throughout" rule — same tradeoff EditPeople already makes for its
 * color swatches.
 */
export function MealListDialog({ open, onOpenChange, savedMeals, onAdd, onRemove }: MealListDialogProps) {
  const [draft, setDraft] = useState("");
  const isFull = savedMeals.length >= MEAL_CAP;

  const confirmAdd = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setDraft("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-none"
        style={{ width: 640, maxWidth: "90vw", maxHeight: 820, borderRadius: 22, padding: "34px 38px" }}
        data-testid="dialog-meal-list"
      >
        <DialogHeader>
          <div className="flex items-center" style={{ gap: 12, margin: "0 0 4px" }}>
            <DialogTitle style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-.4px", color: "var(--rb-ink)" }}>
              Meal list
            </DialogTitle>
            <span
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: isFull ? "var(--rb-danger)" : "var(--rb-ink-secondary)",
                background: isFull ? "var(--rb-danger-wash)" : "var(--rb-chip)",
                padding: "5px 14px",
                borderRadius: 999,
              }}
              data-testid="text-meal-count"
            >
              {savedMeals.length} of {MEAL_CAP}
            </span>
          </div>
        </DialogHeader>
        <p style={{ margin: "0 0 22px", fontSize: 17, fontWeight: 500, color: "var(--rb-muted)" }}>
          These show up as quick picks when adding dinners or votes.
        </p>

        <div
          className="flex flex-col overflow-y-auto"
          style={{ gap: 8, marginBottom: 22, maxHeight: 400, paddingRight: 6 }}
        >
          {savedMeals.map((m) => (
            <div
              key={m}
              className="flex items-center"
              style={{ gap: 12, background: "var(--rb-surface-sunken)", borderRadius: 12, padding: "10px 14px" }}
              data-testid={`row-saved-meal-${m}`}
            >
              <span className="flex-1" style={{ fontSize: 18, fontWeight: 700, color: "var(--rb-ink)" }}>
                {m}
              </span>
              <button
                type="button"
                onClick={() => onRemove(m)}
                title="Remove"
                className="touch-button flex-shrink-0 flex items-center justify-center rounded-full"
                style={{ width: 44, height: 44, border: "none", background: "var(--rb-chip)", color: "var(--rb-ink-secondary)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--rb-danger-wash)";
                  e.currentTarget.style.color = "var(--rb-danger)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--rb-chip)";
                  e.currentTarget.style.color = "var(--rb-ink-secondary)";
                }}
                data-testid={`button-remove-saved-meal-${m}`}
              >
                <X size={16} strokeWidth={2.4} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex" style={{ gap: 10, marginBottom: 26 }}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmAdd();
            }}
            placeholder="Add a meal to the list…"
            className="flex-1 min-w-0 outline-none"
            style={{ height: 56, border: "2px solid var(--rb-field-border)", borderRadius: 14, padding: "0 18px", fontSize: 19, fontWeight: 600, color: "var(--rb-ink)", background: "var(--rb-surface-sunken)" }}
            data-testid="input-add-saved-meal"
          />
          <button
            type="button"
            onClick={confirmAdd}
            className="touch-button flex-shrink-0 text-rb-on-color-ink"
            style={{ height: 56, padding: "0 24px", border: "none", background: "var(--rb-btn-dark-bg)", fontSize: 18, fontWeight: 700, borderRadius: 14 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--rb-btn-dark-hover-bg)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--rb-btn-dark-bg)")}
            data-testid="button-add-saved-meal"
          >
            Add
          </button>
        </div>

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="touch-button w-full text-rb-on-color-ink"
          style={{ height: 58, border: "none", background: "var(--rb-accent)", fontSize: 19, fontWeight: 800, borderRadius: 999, boxShadow: "0 2px 6px var(--rb-shadow-accent)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--rb-accent-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--rb-accent)")}
          data-testid="button-done-meal-list"
        >
          Done
        </button>
      </DialogContent>
    </Dialog>
  );
}
