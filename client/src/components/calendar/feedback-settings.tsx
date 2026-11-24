// Settings → Send feedback (beta brief 04, docs/decisions/0019). The row on
// the Settings main screen, and the shared Crucible feedback dialog opened
// from it. The dialog's steps, review text and send are the shared client's
// (client/src/feedback/); this file only configures it for Rootboard.
import { useState, type ComponentProps } from "react";
import { ChevronRight, MessageSquare } from "lucide-react";
import { FeedbackDialog } from "@/feedback/feedback-dialog.jsx";
import {
  createRootboardFeedbackClient,
  hasFeedbackDraft,
  localStorageDrafts,
} from "@/feedback/rootboard-feedback";
import type { FeedbackContext } from "@/lib/feedback-context";
import "@/feedback/rootboard-feedback.css";

/** Said on the review screen, above the list of what will be sent. */
export const FEEDBACK_REVIEW_HINT =
  "Nothing is sent until you press Send. Feedback you choose to send goes to the Crucible feedback service. It contains what this screen shows and nothing else.";

// The shared dialog types `strings` from its frozen defaults, so each value's
// type is that exact English sentence and no override would type-check. The
// cast is the only way to pass one until crucible-feedback widens the type.
const DIALOG_STRINGS = { reviewHint: FEEDBACK_REVIEW_HINT } as unknown as ComponentProps<typeof FeedbackDialog>["strings"];

/** The Settings main-screen row. `open` is the popover's open state; the
 *  draft marker is read from storage whenever the row renders. */
export function FeedbackRow({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  const draftWaiting = open && hasFeedbackDraft(localStorage);
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="settings-send-feedback"
      className="touch-button w-full flex items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-rb-chip"
    >
      <MessageSquare className="h-4 w-4 flex-shrink-0 text-rb-ink-secondary" />
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2 text-sm font-medium">
          Send feedback
          {draftWaiting && (
            <span className="text-xs font-normal text-rb-info-ink" data-testid="settings-feedback-draft">
              · draft not sent yet
            </span>
          )}
        </span>
        <span className="block text-xs text-rb-muted truncate">Great, broken or an idea. You see it all before it's sent.</span>
      </span>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-rb-faint" />
    </button>
  );
}

/** Mounted while open, unmounted on close (the shared dialog keeps its
 *  state for one mount). The context is captured when it opens. */
export function SettingsFeedbackDialog({ context, onClose }: { context: FeedbackContext; onClose: () => void }) {
  const [client] = useState(() =>
    createRootboardFeedbackClient({ context, drafts: localStorageDrafts(localStorage), nav: navigator }),
  );
  return (
    <FeedbackDialog
      client={client}
      contact={true}
      onClose={onClose}
      strings={DIALOG_STRINGS}
    />
  );
}
