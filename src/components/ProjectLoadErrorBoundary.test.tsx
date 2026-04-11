/**
 * Unit tests for src/components/ProjectLoadErrorBoundary.tsx.
 *
 * The vitest environment for this repo is "node" (see vite.config.ts);
 * there is no jsdom and no @testing-library/react in the devDeps. The
 * spec for this work item explicitly forbids adding new dependencies,
 * so we test the boundary's contract by exercising its class methods
 * directly rather than by mounting it into a DOM. That is the right
 * boundary for a unit test in any case: the recovery wiring lives in
 * App.tsx (which calls skipNextRestore / clearHandle / setTabProject /
 * closeProject), and the boundary's job is exactly to surface the
 * thrown error to its parent via props.onError. Anything broader is
 * an integration test, which the spec explicitly excludes from this
 * task.
 *
 * What we pin here:
 *   1. getDerivedStateFromError flips state to { failed: true } so the
 *      next render returns null in place of the broken subtree.
 *   2. componentDidCatch forwards the (error, info) tuple verbatim to
 *      props.onError. This is the recovery hook the App parent uses
 *      to clear persisted "last opened project" state.
 *   3. render returns null when failed is true and the children when
 *      it is false.
 *   4. Re-mounting (a fresh instance, which is what React does when
 *      the parent passes a new key prop) starts in the unfaulted
 *      state, so a previous crash never leaks across project
 *      switches.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement, type ErrorInfo } from "react";
import { ProjectLoadErrorBoundary } from "./ProjectLoadErrorBoundary";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProjectLoadErrorBoundary", () => {
  it("getDerivedStateFromError flips failed to true", () => {
    // Static method — no instance needed.
    const next = ProjectLoadErrorBoundary.getDerivedStateFromError();
    expect(next).toEqual({ failed: true });
  });

  it("componentDidCatch forwards the error and ErrorInfo to props.onError", () => {
    const onError = vi.fn();
    const inst = new ProjectLoadErrorBoundary({
      onError,
      children: createElement("div", null, "child"),
    });
    // The boundary logs the full error and component stack to the
    // console — silence those during the test so the suite output
    // stays clean.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const thrown = new Error("synthetic deck crash");
    const info: ErrorInfo = {
      componentStack: "\n    at EditorLayout (src/components/editor/EditorLayout.tsx)",
    };
    inst.componentDidCatch(thrown, info);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(thrown, info);

    // Sanity-check that fail-fast logging is preserved (the spec
    // requires the crash to remain visible in the console even
    // though the boundary catches it).
    const loggedAnyError = errorSpy.mock.calls.some((args) => args.includes(thrown));
    expect(loggedAnyError).toBe(true);
  });

  it("renders the children when not failed and null once failed is set", () => {
    const onError = vi.fn();
    const child = createElement("div", null, "ok");
    const inst = new ProjectLoadErrorBoundary({ onError, children: child });

    // Initial state — children pass through.
    expect(inst.state.failed).toBe(false);
    expect(inst.render()).toBe(child);

    // After getDerivedStateFromError. React would call setState
    // for us in real use; in the unit test we apply the next state
    // directly because the static method already exposes the
    // contract above.
    inst.state = { failed: true };
    expect(inst.render()).toBeNull();
  });

  it("a freshly constructed instance starts unfaulted (key-based remount stays clean)", () => {
    // React resets a component completely when its parent passes a
    // new key prop — that's literally a fresh instance. Asserting
    // initial state on a new instance pins the same guarantee
    // without needing a renderer.
    const onError = vi.fn();
    const fresh = new ProjectLoadErrorBoundary({ onError, children: null });
    expect(fresh.state).toEqual({ failed: false });
    expect(fresh.render()).toBeNull(); // children was null
    expect(onError).not.toHaveBeenCalled();
  });
});
