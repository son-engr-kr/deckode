import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Narrowly-scoped ErrorBoundary for the project-load + first-render
 * boundary. The single exception to the project-wide fail-fast rule:
 * a malformed deck.json (e.g. an AI-generated benchmark deck that
 * crashes a renderer mid-render) used to lock the user out of the
 * entire web app, because the auto-restore logic would re-open the
 * same broken project on every reload.
 *
 * What this boundary does NOT do:
 *   - It does not wrap individual element renderers.
 *   - It does not swallow errors silently. The full stack trace is
 *     logged to the console and the rendered banner shows a summary.
 *   - It does not retry on its own.
 *
 * What it DOES do:
 *   - Catches the single failure that bubbles out of the project
 *     subtree, calls onError so the parent can clear persisted
 *     state, and renders nothing in place. The parent then routes
 *     the user back to the project picker.
 */

interface Props {
  children: ReactNode;
  onError: (err: Error, info: ErrorInfo) => void;
}

interface State {
  failed: boolean;
}

export class ProjectLoadErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Loud logging — fail-fast is preserved at the visibility level
    // even though the boundary stops the crash from blowing up the
    // whole tree. Anyone debugging still sees the full trace.
    console.error("[ProjectLoadErrorBoundary] project subtree crashed");
    console.error(error);
    if (info.componentStack) {
      console.error(info.componentStack);
    }
    this.props.onError(error, info);
  }

  render(): ReactNode {
    if (this.state.failed) {
      // Render nothing — the parent App is responsible for rendering
      // the recovery banner + project picker on the next pass.
      return null;
    }
    return this.props.children;
  }
}
