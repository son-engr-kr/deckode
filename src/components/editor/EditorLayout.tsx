import { useState, useEffect, useCallback, useRef } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { findUndoChanges } from "@/utils/deckDiff";
import { skipNextRestore } from "@/utils/handleStore";
import { SlideList } from "./SlideList";
import { EditorCanvas } from "./EditorCanvas";
import { PropertyPanel } from "./PropertyPanel";
import { CodePanel } from "./CodePanel";
import { ElementPalette } from "./ElementPalette";
import { SlideAnimationList } from "./SlideAnimationList";
import { ThemePanel } from "./ThemePanel";
import { PresentationMode } from "@/components/presenter/PresentationMode";
import { PrintExport } from "@/components/export/PrintExport";
import { exportToPptx } from "@/components/export/pptxExport";
import { useTikzAutoRender } from "@/hooks/useTikzAutoRender";

function performUndoRedo(direction: "undo" | "redo") {
  const temporal = useDeckStore.temporal.getState();
  const pastLen = temporal.pastStates.length;
  const futureLen = temporal.futureStates.length;
  if (direction === "undo" && pastLen === 0) return;
  if (direction === "redo" && futureLen === 0) return;

  const oldDeck = useDeckStore.getState().deck;
  temporal[direction]();
  const newDeck = useDeckStore.getState().deck;

  const changes = findUndoChanges(oldDeck, newDeck);
  if (changes.slideIndex !== -1) {
    useDeckStore.getState().setCurrentSlide(changes.slideIndex);
  }
  if (changes.elementIds.length > 0) {
    useDeckStore.getState().highlightElements(changes.elementIds);
  }
}

type BottomPanel = "code" | null;
type RightPanel = "properties" | "theme";

export function EditorLayout() {
  useTikzAutoRender();
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>(null);
  const [rightPanel, setRightPanel] = useState<RightPanel>("properties");
  const [presenting, setPresenting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const isDirty = useDeckStore((s) => s.isDirty);
  const isSaving = useDeckStore((s) => s.isSaving);
  const saveToDisk = useDeckStore((s) => s.saveToDisk);

  // Resizable panel widths
  const [leftWidth, setLeftWidth] = useState(170);
  const [rightWidth, setRightWidth] = useState(240);
  const dragRef = useRef<{
    side: "left" | "right";
    startX: number;
    startWidth: number;
  } | null>(null);
  const leftWidthRef = useRef(leftWidth);
  leftWidthRef.current = leftWidth;
  const rightWidthRef = useRef(rightWidth);
  rightWidthRef.current = rightWidth;

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { side, startX, startWidth } = dragRef.current;
      const delta = e.clientX - startX;
      if (side === "left") {
        setLeftWidth(Math.max(120, Math.min(400, startWidth + delta)));
      } else {
        setRightWidth(Math.max(180, Math.min(500, startWidth - delta)));
      }
    };
    const onMouseUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const startDrag = useCallback(
    (side: "left" | "right", e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = {
        side,
        startX: e.clientX,
        startWidth:
          side === "left" ? leftWidthRef.current : rightWidthRef.current,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [],
  );

  const handleSave = useCallback(() => {
    saveToDisk();
  }, [saveToDisk]);

  // Enter fullscreen presentation — must be called from a user gesture handler
  const startPresentation = useCallback(() => {
    document.documentElement.requestFullscreen?.();
    setPresenting(true);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs/textareas
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";

      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
        return;
      }
      if (e.key === "F5") {
        e.preventDefault();
        startPresentation();
        return;
      }

      // Skip remaining shortcuts if typing in an input
      if (isInput) return;

      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        performUndoRedo("undo");
        return;
      }
      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === "Z" || e.key === "y")) {
        e.preventDefault();
        performUndoRedo("redo");
        return;
      }
      // Duplicate element: Ctrl+D
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        const { deck, currentSlideIndex, selectedElementId, duplicateElement } = useDeckStore.getState();
        if (deck && selectedElementId) {
          const slide = deck.slides[currentSlideIndex];
          if (slide) duplicateElement(slide.id, selectedElementId);
        }
        return;
      }
      // Delete selected element
      if (e.key === "Delete" || e.key === "Backspace") {
        const { deck, currentSlideIndex, selectedElementId, deleteElement } = useDeckStore.getState();
        if (deck && selectedElementId) {
          const slide = deck.slides[currentSlideIndex];
          if (slide) deleteElement(slide.id, selectedElementId);
        }
        return;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleSave, startPresentation]);

  if (presenting) {
    return <PresentationMode onExit={() => setPresenting(false)} />;
  }

  // PrintExport portal renders off-screen; triggers window.print()
  const printPortal = printing ? (
    <PrintExport onDone={() => setPrinting(false)} />
  ) : null;

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-white">
      {printPortal}
      {/* Toolbar */}
      <div className="h-10 border-b border-zinc-800 flex items-center px-4 gap-4 shrink-0">
        <button
          onClick={() => { skipNextRestore(); useDeckStore.getState().closeProject(); }}
          className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Back to projects"
        >
          Projects
        </button>
        <span className="text-sm font-semibold text-zinc-300">
          {useDeckStore.getState().currentProject}
        </span>

        {/* Save status */}
        <span className="text-xs text-zinc-500">
          {isSaving ? "Saving..." : isDirty ? "Unsaved" : "Saved"}
        </span>

        <div className="flex-1" />

        <button
          onClick={() => performUndoRedo("undo")}
          className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          onClick={() => performUndoRedo("redo")}
          className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Redo (Ctrl+Shift+Z)"
        >
          Redo
        </button>

        <div className="w-px h-5 bg-zinc-700" />

        <ElementPalette />

        <button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition-colors"
        >
          Save
        </button>
        <button
          onClick={startPresentation}
          className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Present (F5)
        </button>
        <button
          onClick={() => setPrinting(true)}
          className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          PDF
        </button>
        <button
          onClick={() => {
            const deck = useDeckStore.getState().deck;
            if (deck) exportToPptx(deck);
          }}
          className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          PPTX
        </button>
        <button
          onClick={() => setRightPanel(rightPanel === "theme" ? "properties" : "theme")}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            rightPanel === "theme"
              ? "bg-blue-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Theme
        </button>
        <button
          onClick={() => setBottomPanel(bottomPanel === "code" ? null : "code")}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            bottomPanel === "code"
              ? "bg-blue-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          JSON
        </button>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Slide list sidebar */}
        <div
          style={{ width: leftWidth }}
          className="overflow-y-auto shrink-0 border-r border-zinc-800"
        >
          <SlideList />
        </div>

        {/* Left resize handle */}
        <div
          className="w-1 shrink-0 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-500/40 transition-colors"
          onMouseDown={(e) => startDrag("left", e)}
        />

        {/* Center: canvas + optional bottom panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <EditorCanvas />

          {bottomPanel === "code" && (
            <div className="h-[280px] border-t border-zinc-800 shrink-0">
              <CodePanel />
            </div>
          )}
        </div>

        {/* Right resize handle */}
        <div
          className="w-1 shrink-0 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-500/40 transition-colors"
          onMouseDown={(e) => startDrag("right", e)}
        />

        {/* Right sidebar */}
        <div
          style={{ width: rightWidth }}
          className="flex flex-col shrink-0 border-l border-zinc-800"
        >
          {rightPanel === "theme" ? (
            <div className="flex-1 overflow-y-auto">
              <ThemePanel />
            </div>
          ) : (
            <>
              {/* Properties — top half */}
              <div className="flex-1 overflow-y-auto border-b border-zinc-800">
                <PropertyPanel />
              </div>
              {/* Animations — bottom half */}
              <div className="flex-1 overflow-y-auto">
                <SlideAnimationList
                  onSelectElement={(elementId) => {
                    useDeckStore.getState().selectElement(elementId);
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

