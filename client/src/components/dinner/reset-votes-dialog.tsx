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
          <AlertDialogTitle style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.4px", color: "var(--rb-ink)" }}>
            Reset the vote?
          </AlertDialogTitle>
          <AlertDialogDescription style={{ fontSize: 18, fontWeight: 500, color: "var(--rb-ink-secondary)" }}>
            All meal options and their votes are cleared from the board so new options can be added. Your saved meal list is not affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="touch-button flex-1"
            style={{ height: 58, border: "none", background: "var(--rb-chip)", color: "var(--rb-ink-secondary)", fontSize: 19, fontWeight: 800, borderRadius: 999 }}
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
            style={{ height: 58, border: "none", background: "var(--rb-danger)", color: "var(--rb-on-color-ink)", fontSize: 19, fontWeight: 800, borderRadius: 999 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--rb-danger-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--rb-danger)")}
            data-testid="button-confirm-reset-votes"
          >
            Reset votes
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
