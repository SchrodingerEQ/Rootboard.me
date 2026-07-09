import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ResetVotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/** Mirrors client/src/components/chores/reset-confirm-dialog.tsx; copy and
 *  width (640px) per the Dinner mockup's reset-confirm modal. */
export function ResetVotesDialog({ open, onOpenChange, onConfirm }: ResetVotesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="max-w-none"
        style={{ width: 640, maxWidth: "90vw", borderRadius: 22, padding: "34px 38px" }}
        data-testid="dialog-reset-votes"
      >
        <AlertDialogHeader>
          <AlertDialogTitle style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.4px", color: "#2b3038" }}>
            Reset all votes?
          </AlertDialogTitle>
          <AlertDialogDescription style={{ fontSize: 18, fontWeight: 500, color: "#5b626d" }}>
            Every meal's vote count goes back to zero. The meals stay on the board.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="touch-button flex-1"
            style={{ height: 58, border: "none", background: "var(--rb-chip)", color: "#5b626d", fontSize: 19, fontWeight: 800, borderRadius: 999 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--rb-chip-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--rb-chip)")}
            data-testid="button-cancel-reset-votes"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="touch-button flex-1"
            style={{ height: 58, border: "none", background: "#e11d48", color: "#fff", fontSize: 19, fontWeight: 800, borderRadius: 999 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#c9163d")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#e11d48")}
            data-testid="button-confirm-reset-votes"
          >
            Reset votes
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
