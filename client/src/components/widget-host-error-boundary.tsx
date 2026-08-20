import { Component, type ReactNode } from "react";

interface WidgetHostErrorBoundaryProps {
  children: ReactNode;
  /** Reset signal: when this value changes WHILE the boundary is tripped,
   *  it clears `hasError` and re-renders `children` fresh. app-shell.tsx
   *  passes the joined set of currently-renderable widget ids
   *  (`renderableIds.join(",")`) — disabling the offending widget changes
   *  that string, which is what un-blanks the pane.
   *
   *  Deliberately a plain PROP, not a `key` — a `key` change forces React
   *  to unmount and recreate this component (and therefore its ENTIRE
   *  subtree, i.e. every OTHER currently-mounted widget too, not just the
   *  offender) on every single change, including completely ordinary
   *  enable/disable/reorder actions that never tripped the boundary in the
   *  first place. That was tried and reverted — it thrashed every mounted
   *  widget's React root on every toggle (observed live: "Attempted to
   *  synchronously unmount a root while React was already rendering",
   *  repeatedly, and settings writes silently failing to even reach the
   *  network while the thrash was in progress). Comparing this prop in
   *  `componentDidUpdate` instead means the reset only ever happens when
   *  `hasError` is actually true, and even then it's a state reset (re-
   *  render `children`), not a remount — WidgetHostMount's own existing
   *  entries-diffing effect is what tears down just the dropped widget.
   */
  resetKey: string;
}

interface WidgetHostErrorBoundaryState {
  hasError: boolean;
}

/**
 * Second belt behind widget-host-mount.tsx's own per-call try/catch guards
 * (mount/unmount/refresh/onVisibilityChange — CONTRACT §7: a widget's entry
 * module is otherwise-untrusted, host-executed code). Those guards should
 * catch essentially everything a widget can throw, so this boundary is
 * expected to rarely if ever actually catch anything — it exists for the
 * class of failure they CAN'T cover: a React render-phase throw (e.g. a
 * widget indirectly corrupting shared state that a later render reads).
 *
 * Scoped to wrap ONLY <WidgetHostMount> in app-shell.tsx, never the whole
 * app — <WidgetHostMount> is a SIBLING of <NavRail> and the settings popover
 * there, not a parent, so a catch here can only blank the widget content
 * pane. The nav rail, settings menu, and the rest of the shell chrome stay
 * fully interactive even in the worst case — including the switch that lets
 * the user disable the widget that tripped this boundary.
 *
 * Reset path: see `resetKey`'s doc comment above.
 */
export class WidgetHostErrorBoundary extends Component<
  WidgetHostErrorBoundaryProps,
  WidgetHostErrorBoundaryState
> {
  state: WidgetHostErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): WidgetHostErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error("[widget-host] uncaught render-phase error — widget pane disabled", error);
  }

  componentDidUpdate(prevProps: WidgetHostErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render(): ReactNode {
    // Renders app-shell.tsx's existing empty-state copy/markup (its
    // renderableEntries.length === 0 branch) rather than null: a blank pane
    // with no explanation looks indistinguishable from a hang, and the
    // fix is the same either way — open Settings and disable the offending
    // widget. Reusing that exact copy (rather than inventing new wording)
    // keeps the two "nothing is rendering" states consistent for the user.
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <p className="text-sm text-rb-muted max-w-xs">
            No widgets available — check Settings or data/config/dashboard.json
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
