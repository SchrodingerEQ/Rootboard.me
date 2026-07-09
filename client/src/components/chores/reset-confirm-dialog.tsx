import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ResetConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ResetConfirmDialog({ open, onOpenChange, onConfirm }: ResetConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        style={{ width: 560, maxWidth: "90vw", borderRadius: 22, padding: "34px 38px" }}
        data-testid="dialog-reset-chores"
      >
        <AlertDialogHeader>
          <AlertDialogTitle style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.4px", color: "#2b3038" }}>
            Reset all chores?
          </AlertDialogTitle>
          <AlertDialogDescription style={{ fontSize: 18, fontWeight: 500, color: "#5b626d" }}>
            Every chore goes back to active. Today's completed counts are kept.
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
            data-testid="button-cancel-reset"
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
            data-testid="button-confirm-reset"
          >
            Reset chores
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
