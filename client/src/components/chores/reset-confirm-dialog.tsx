import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PERSON_PALETTE, type Person } from "@/lib/chores-state";

interface ResetConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: Person[];
  /** Called with the chosen person's id; removes ALL chores on their list. */
  onConfirm: (personId: string) => void;
}

/**
 * "Reset chores" flow: pick WHOSE list to reset, then the red confirm button
 * deletes every chore on that person's list (their "N today" tally is kept —
 * see clearPersonChores in lib/chores-state.ts).
 */
export function ResetConfirmDialog({ open, onOpenChange, people, onConfirm }: ResetConfirmDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Fresh selection every time the dialog opens.
  useEffect(() => {
    if (open) setSelectedId(null);
  }, [open]);

  const selected = people.find((p) => p.id === selectedId);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        style={{ width: 560, maxWidth: "90vw", borderRadius: 22, padding: "34px 38px" }}
        data-testid="dialog-reset-chores"
      >
        <AlertDialogHeader>
          <AlertDialogTitle style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.4px", color: "#2b3038" }}>
            Reset whose chores?
          </AlertDialogTitle>
          <AlertDialogDescription style={{ fontSize: 18, fontWeight: 500, color: "#5b626d" }}>
            Pick a person — every chore on their list will be removed. Today's completed counts are kept.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2.5 overflow-y-auto" style={{ maxHeight: 400, margin: "6px 0 4px" }}>
          {people.length === 0 ? (
            <span style={{ fontSize: 17, fontWeight: 600, color: "var(--rb-muted)", padding: "10px 2px" }}>
              No people yet — add someone in Edit people first.
            </span>
          ) : (
            people.map((p) => {
              const pal = PERSON_PALETTE[p.colorIdx % PERSON_PALETTE.length];
              const initials = p.name.slice(0, 2).toUpperCase();
              const isSelected = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(isSelected ? null : p.id)}
                  className="touch-button flex items-center gap-3 text-left"
                  style={{
                    background: pal.tint,
                    border: "none",
                    borderRadius: 14,
                    padding: "12px 16px",
                    minHeight: 64,
                    boxShadow: isSelected ? `inset 0 0 0 3px ${pal.color}` : "none",
                  }}
                  data-testid={`row-reset-person-${p.id}`}
                >
                  <span
                    className="flex items-center justify-center rounded-full text-white flex-shrink-0"
                    style={{ width: 40, height: 40, background: pal.color, fontSize: 16, fontWeight: 800 }}
                  >
                    {initials}
                  </span>
                  <span
                    className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
                    style={{ fontSize: 20, fontWeight: 800, color: pal.text }}
                  >
                    {p.name}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: pal.text, opacity: 0.75 }}>
                    {p.chores.length} {p.chores.length === 1 ? "chore" : "chores"}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <AlertDialogFooter className="flex-row gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="touch-button flex-1"
            style={{ height: 58, border: "none", background: "var(--rb-chip)", color: "#5b626d", fontSize: 19, fontWeight: 800, borderRadius: 999 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--rb-chip-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--rb-chip)")}
            data-testid="button-cancel-reset"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={() => selected && onConfirm(selected.id)}
            className="touch-button flex-1"
            style={{
              height: 58,
              border: "none",
              background: selected ? "#e11d48" : "var(--rb-chip)",
              color: selected ? "#fff" : "#b8bcc4",
              fontSize: 19,
              fontWeight: 800,
              borderRadius: 999,
              cursor: selected ? "pointer" : "default",
            }}
            onMouseEnter={(e) => { if (selected) e.currentTarget.style.background = "#c9163d"; }}
            onMouseLeave={(e) => { if (selected) e.currentTarget.style.background = "#e11d48"; }}
            data-testid="button-confirm-reset"
          >
            {selected ? `Remove ${selected.name}'s chores` : "Remove chores"}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
