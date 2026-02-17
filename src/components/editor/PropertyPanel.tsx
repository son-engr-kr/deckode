import { useState, useEffect, useRef, useCallback } from "react";
import { useDeckStore } from "@/stores/deckStore";
import type { SlideElement, TikZElement } from "@/types/deck";
import { renderTikz } from "@/utils/api";
import { AnimationEditor } from "./AnimationEditor";

export function PropertyPanel() {
  const deck = useDeckStore((s) => s.deck);
  const currentSlideIndex = useDeckStore((s) => s.currentSlideIndex);
  const selectedElementId = useDeckStore((s) => s.selectedElementId);
  const updateElement = useDeckStore((s) => s.updateElement);

  if (!deck || selectedElementId === null) {
    return (
      <div className="p-4 text-zinc-500 text-sm">
        Select an element to edit its properties
      </div>
    );
  }

  const slide = deck.slides[currentSlideIndex]!;
  const element = slide.elements.find((e) => e.id === selectedElementId);
  if (!element) return null;

  const handleNumberChange = (
    path: "position.x" | "position.y" | "size.w" | "size.h",
    value: string,
  ) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;

    const [group, field] = path.split(".") as ["position" | "size", string];
    const updated = { [group]: { ...element[group], [field]: num } };
    updateElement(slide.id, element.id, updated as Partial<SlideElement>);
  };

  return (
    <div className="p-3 space-y-4 text-sm overflow-y-auto">
      {/* Element info */}
      <div>
        <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Element</div>
        <div className="text-zinc-300 font-mono">
          {element.type} / {element.id}
        </div>
      </div>

      {/* Position */}
      <div>
        <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Position</div>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label="X" value={element.position.x} onChange={(v) => handleNumberChange("position.x", v)} />
          <NumberInput label="Y" value={element.position.y} onChange={(v) => handleNumberChange("position.y", v)} />
        </div>
      </div>

      {/* Size */}
      <div>
        <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Size</div>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label="W" value={element.size.w} onChange={(v) => handleNumberChange("size.w", v)} />
          <NumberInput label="H" value={element.size.h} onChange={(v) => handleNumberChange("size.h", v)} />
        </div>
      </div>

      {/* Content (for text/code — not tikz, which has its own editor) */}
      {"content" in element && element.type !== "tikz" && (
        <div>
          <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Content</div>
          <textarea
            className="w-full bg-zinc-800 text-zinc-200 rounded px-2 py-1.5 text-xs font-mono resize-y min-h-20 border border-zinc-700 focus:border-blue-500 focus:outline-none"
            value={element.content}
            rows={5}
            onChange={(e) => {
              updateElement(slide.id, element.id, { content: e.target.value } as Partial<SlideElement>);
            }}
          />
        </div>
      )}

      {/* TikZ editor */}
      {element.type === "tikz" && (
        <TikZEditor
          element={element}
          slideId={slide.id}
          updateElement={updateElement}
        />
      )}

      {/* Video properties */}
      {element.type === "video" && (
        <>
          <div>
            <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Video URL</div>
            <input
              type="text"
              className="w-full bg-zinc-800 text-zinc-200 rounded px-2 py-1.5 text-xs font-mono border border-zinc-700 focus:border-blue-500 focus:outline-none"
              value={element.src}
              onChange={(e) => {
                updateElement(slide.id, element.id, { src: e.target.value } as Partial<SlideElement>);
              }}
            />
          </div>
          <div>
            <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Options</div>
            <div className="space-y-1">
              {(["autoplay", "loop", "muted", "controls"] as const).map((prop) => (
                <label key={prop} className="flex items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={!!element[prop]}
                    onChange={(e) => {
                      updateElement(slide.id, element.id, { [prop]: e.target.checked } as Partial<SlideElement>);
                    }}
                    className="rounded border-zinc-600"
                  />
                  {prop}
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Animations */}
      <AnimationEditor
        slideId={slide.id}
        elementId={element.id}
        animations={slide.animations ?? []}
      />
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-zinc-500 text-xs w-3">{label}</span>
      <input
        type="number"
        className="flex-1 bg-zinc-800 text-zinc-200 rounded px-2 py-1 text-xs font-mono border border-zinc-700 focus:border-blue-500 focus:outline-none w-0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

// -- TikZ Editor --

type RenderStatus = "idle" | "modified" | "rendering" | "rendered" | "error";

function TikZEditor({
  element,
  slideId,
  updateElement,
}: {
  element: TikZElement;
  slideId: string;
  updateElement: (slideId: string, elementId: string, patch: Partial<SlideElement>) => void;
}) {
  const project = useDeckStore((s) => s.currentProject);
  const [status, setStatus] = useState<RenderStatus>(element.svgUrl ? "rendered" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [showPreamble, setShowPreamble] = useState(!!element.preamble);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderIdRef = useRef(0);

  const doRender = useCallback(async (content: string, preamble?: string) => {
    assert(project !== null, "No project selected");
    const renderId = ++renderIdRef.current;
    setStatus("rendering");
    setError(null);

    const result = await renderTikz(project, element.id, content, preamble);

    // Stale render — a newer one was triggered
    if (renderId !== renderIdRef.current) return;

    if (result.ok) {
      setStatus("rendered");
      setError(null);
      updateElement(slideId, element.id, { svgUrl: result.svgUrl } as Partial<SlideElement>);
    } else {
      setStatus("error");
      setError(result.error);
    }
  }, [project, element.id, slideId, updateElement]);

  // Auto-render: debounce 1.5s after content/preamble changes
  const scheduleRender = useCallback((content: string, preamble?: string) => {
    setStatus("modified");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doRender(content, preamble);
    }, 1500);
  }, [doRender]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleContentChange = (value: string) => {
    updateElement(slideId, element.id, { content: value } as Partial<SlideElement>);
    scheduleRender(value, element.preamble);
  };

  const handlePreambleChange = (value: string) => {
    updateElement(slideId, element.id, { preamble: value } as Partial<SlideElement>);
    scheduleRender(element.content, value);
  };

  const handleManualRender = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doRender(element.content, element.preamble);
  };

  return (
    <>
      {/* TikZ Code */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-zinc-400 text-xs uppercase tracking-wider">TikZ Code</div>
          <StatusBadge status={status} />
        </div>
        <textarea
          className="w-full bg-zinc-900 text-green-300 rounded px-2 py-1.5 text-xs font-mono resize-y min-h-32 border border-zinc-700 focus:border-blue-500 focus:outline-none"
          value={element.content}
          rows={10}
          spellCheck={false}
          onChange={(e) => handleContentChange(e.target.value)}
        />
      </div>

      {/* Preamble (collapsible) */}
      <div>
        <button
          onClick={() => setShowPreamble(!showPreamble)}
          className="text-zinc-500 text-xs hover:text-zinc-300 transition-colors"
        >
          {showPreamble ? "- Preamble" : "+ Preamble"}
        </button>
        {showPreamble && (
          <textarea
            className="w-full mt-1 bg-zinc-900 text-yellow-300 rounded px-2 py-1.5 text-xs font-mono resize-y min-h-12 border border-zinc-700 focus:border-blue-500 focus:outline-none"
            value={element.preamble ?? ""}
            rows={3}
            spellCheck={false}
            placeholder="\\usepackage{amsmath}"
            onChange={(e) => handlePreambleChange(e.target.value)}
          />
        )}
      </div>

      {/* Render button */}
      <button
        onClick={handleManualRender}
        disabled={status === "rendering"}
        className="w-full px-3 py-1.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {status === "rendering" ? "Rendering..." : "Render"}
      </button>

      {/* Error display */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded p-2">
          <div className="text-red-400 text-xs font-mono whitespace-pre-wrap break-all">
            {error}
          </div>
        </div>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: RenderStatus }) {
  const config: Record<RenderStatus, { label: string; color: string }> = {
    idle: { label: "Not rendered", color: "text-zinc-500" },
    modified: { label: "Modified", color: "text-yellow-400" },
    rendering: { label: "Rendering...", color: "text-blue-400" },
    rendered: { label: "Rendered", color: "text-green-400" },
    error: { label: "Error", color: "text-red-400" },
  };
  const { label, color } = config[status];
  return <span className={`text-xs ${color}`}>{label}</span>;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
