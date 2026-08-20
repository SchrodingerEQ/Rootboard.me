import { Component, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

/**
 * Top-level, whole-app belt behind widget-host-error-boundary.tsx's
 * WidgetHostMount-scoped boundary. That boundary only wraps <WidgetHostMount>
 * (a sibling of <NavRail> inside AppShell, not a parent), so it can only
 * blank the widget content pane — a render-phase throw ANYWHERE ELSE in the
 * tree (AppShell's own render, a page component, routing) has no boundary
 * above it and takes down the whole React root, leaving a truly blank kiosk
 * screen with no recovery path short of a manual power-cycle.
 *
 * Scoped to wrap only <Router /> in App.tsx, not the whole provider tree —
 * <Toaster /> and <OnScreenKeyboard /> are siblings, not children, of this
 * boundary, so a trip here doesn't also unmount the OSK or in-flight toasts.
 *
 * Deliberately has no reset-key/retry story like WidgetHostErrorBoundary:
 * there is no "disable the offending widget" escape hatch at this level —
 * the only recovery is a full reload, so the fallback offers exactly that.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error("[app] uncaught render-phase error — showing recovery screen", error);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-rb-canvas p-8 text-center">
          <div className="max-w-sm space-y-4">
            <p className="text-sm text-rb-muted">
              Something went wrong and Rootboard needs to reload.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md bg-rb-accent px-4 py-2 text-sm font-medium text-rb-ink"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
