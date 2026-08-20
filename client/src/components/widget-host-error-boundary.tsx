import { Component, type ReactNode } from "react";

interface WidgetHostErrorBoundaryProps {
  children: ReactNode;
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
 * fully interactive even in the worst case.
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

  render(): ReactNode {
    // Renders null, not a message: this path means a widget's OWN render
    // output is what threw, so the pane goes empty rather than risk
    // rendering more widget-adjacent content that could itself be
    // implicated. app-shell.tsx's own recovery pane (renderableEntries
    // empty) is the user-visible messaging path; this is a silent last
    // resort.
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
