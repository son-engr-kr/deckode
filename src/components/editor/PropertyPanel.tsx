import { useState, useEffect, useRef, useCallback } from "react";
import { useDeckStore } from "@/stores/deckStore";
import type { Slide, SlideElement, TikZElement, TableElement, CustomElement } from "@/types/deck";
import { useAdapter } from "@/contexts/AdapterContext";
import { AnimationEditor } from "./AnimationEditor";
import {
  ColorField,
  NumberField,
  SelectField,
  TextField,
  CODE_THEMES,
  OBJECT_FIT_OPTIONS,
  TEXT_ALIGN_OPTIONS,
  VERTICAL_ALIGN_OPTIONS,
  TEXT_SIZING_OPTIONS,
} from "./fields";

export function PropertyPanel() {
  const deck = useDeckStore((s) => s.deck);
  const currentSlideIndex = useDeckStore((s) => s.currentSlideIndex);
  const selectedSlideIds = useDeckStore((s) => s.selectedSlideIds);
  const selectedElementId = useDeckStore((s) => s.selectedElementId);
  const updateElement = useDeckStore((s) => s.updateElement);
  const updateSlide = useDeckStore((s) => s.updateSlide);

  if (!deck) return null;

  if (selectedElementId === null) {
    return (
      <SlidePropertiesPanel
        deck={deck}
        selectedSlideIds={selectedSlideIds}
        updateSlide={updateSlide}
      />
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

      {/* Custom component properties */}
      {element.type === "custom" && (
        <CustomPropsEditor
          element={element}
          slideId={slide.id}
          updateElement={updateElement}
        />
      )}

      {/* Table properties */}
      {element.type === "table" && (
        <TableDataEditor
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

      {/* Style */}
      <ElementStyleEditor
        element={element}
        slideId={slide.id}
        updateElement={updateElement}
      />

      {/* Animations */}
      <AnimationEditor
        slideId={slide.id}
        elementId={element.id}
        animations={slide.animations ?? []}
      />
    </div>
  );
}

function SlidePropertiesPanel({
  deck,
  selectedSlideIds,
  updateSlide,
}: {
  deck: { slides: Slide[]; theme?: import("@/types/deck").DeckTheme };
  selectedSlideIds: string[];
  updateSlide: (slideId: string, patch: Partial<Slide>) => void;
}) {
  const selectedSlides = selectedSlideIds
    .map((id) => deck.slides.find((s) => s.id === id))
    .filter((s): s is Slide => s !== undefined);

  if (selectedSlides.length === 0) {
    return (
      <div className="p-4 text-zinc-500 text-sm">
        Select a slide to edit its properties
      </div>
    );
  }

  // Compute common background color across all selected slides
  const bgColors = selectedSlides.map((s) => s.background?.color);
  const allSame = bgColors.every((c) => c === bgColors[0]);
  const isMixed = !allSame;
  const commonBgColor = allSame ? bgColors[0] : undefined;
  const themeBgColor = deck.theme?.slide?.background?.color;

  // Check if any selected slide has a per-slide override
  const hasOverride = selectedSlides.some((s) => s.background?.color !== undefined);
  // All selected slides are using the theme default (no per-slide color set)
  const allInherited = !isMixed && commonBgColor === undefined && themeBgColor !== undefined;

  return (
    <div className="p-3 space-y-4 text-sm overflow-y-auto">
      <div>
        <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Slide</div>
        <div className="text-zinc-300 font-mono">
          {selectedSlides.length === 1
            ? selectedSlides[0]!.id
            : `${selectedSlides.length} slides selected`}
        </div>
      </div>

      <div>
        <div className="text-zinc-400 text-xs uppercase tracking-wider mb-2">Background</div>
        <div className="space-y-2">
          <ColorField
            label="Color"
            value={commonBgColor ?? themeBgColor}
            mixed={isMixed}
            inherited={allInherited}
            onChange={(v) => {
              for (const slide of selectedSlides) {
                updateSlide(slide.id, {
                  background: { ...slide.background, color: v },
                });
              }
            }}
          />
          {hasOverride && (
            <button
              onClick={() => {
                for (const slide of selectedSlides) {
                  const bg = { ...slide.background };
                  delete bg.color;
                  // If background object is now empty, remove it entirely
                  const hasKeys = Object.keys(bg).length > 0;
                  updateSlide(slide.id, { background: hasKeys ? bg : undefined });
                }
              }}
              className="w-full px-3 py-1.5 text-xs font-medium rounded border border-zinc-600 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
            >
              Use theme default
            </button>
          )}
        </div>
      </div>

      {/* Presenter Notes */}
      {selectedSlides.length === 1 && (
        <div>
          <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">
            Presenter Notes
          </div>
          <div className="text-zinc-600 text-[10px] mb-1">
            Use [step:N]...[/step] to highlight text at animation step N
          </div>
          <textarea
            className="w-full bg-zinc-800 text-zinc-200 rounded px-2 py-1.5 text-xs resize-y min-h-24 border border-zinc-700 focus:border-blue-500 focus:outline-none"
            value={selectedSlides[0]!.notes ?? ""}
            rows={6}
            placeholder="Enter presenter notes here...&#10;&#10;Use [step:1]text[/step] to highlight during animation step 1"
            onChange={(e) => {
              updateSlide(selectedSlides[0]!.id, { notes: e.target.value });
            }}
          />
        </div>
      )}
    </div>
  );
}

function ElementStyleEditor({
  element,
  slideId,
  updateElement,
}: {
  element: SlideElement;
  slideId: string;
  updateElement: (slideId: string, elementId: string, patch: Partial<SlideElement>) => void;
}) {
  if (element.type === "custom") return null;

  const patchStyle = (prop: string, value: unknown) => {
    updateElement(slideId, element.id, {
      style: { ...element.style, [prop]: value },
    } as Partial<SlideElement>);
  };

  return (
    <div>
      <div className="text-zinc-400 text-xs uppercase tracking-wider mb-2">Style</div>
      <div className="space-y-2">
        {element.type === "text" && (
          <>
            <ColorField label="Color" value={element.style?.color} onChange={(v) => patchStyle("color", v)} />
            <TextField label="Font Family" value={element.style?.fontFamily} onChange={(v) => patchStyle("fontFamily", v)} placeholder="sans-serif" />
            <NumberField label="Font Size" value={element.style?.fontSize} onChange={(v) => patchStyle("fontSize", v)} min={8} max={200} />
            <SelectField label="Text Sizing" value={element.style?.textSizing} options={TEXT_SIZING_OPTIONS} onChange={(v) => patchStyle("textSizing", v)} />
            <SelectField label="Text Align" value={element.style?.textAlign} options={TEXT_ALIGN_OPTIONS} onChange={(v) => patchStyle("textAlign", v)} />
            <NumberField label="Line Height" value={element.style?.lineHeight} onChange={(v) => patchStyle("lineHeight", v)} min={0.5} max={4} step={0.1} />
            <SelectField label="Vertical Align" value={element.style?.verticalAlign} options={VERTICAL_ALIGN_OPTIONS} onChange={(v) => patchStyle("verticalAlign", v)} />
          </>
        )}
        {element.type === "code" && (
          <>
            <SelectField label="Theme" value={element.style?.theme} options={CODE_THEMES} onChange={(v) => patchStyle("theme", v)} />
            <NumberField label="Font Size" value={element.style?.fontSize} onChange={(v) => patchStyle("fontSize", v)} min={8} max={48} />
            <NumberField label="Border Radius" value={element.style?.borderRadius} onChange={(v) => patchStyle("borderRadius", v)} min={0} max={32} />
          </>
        )}
        {element.type === "shape" && (
          <>
            <ColorField label="Fill" value={element.style?.fill} onChange={(v) => patchStyle("fill", v)} />
            <ColorField label="Stroke" value={element.style?.stroke} onChange={(v) => patchStyle("stroke", v)} />
            <NumberField label="Stroke Width" value={element.style?.strokeWidth} onChange={(v) => patchStyle("strokeWidth", v)} min={0} max={20} />
            <NumberField label="Border Radius" value={element.style?.borderRadius} onChange={(v) => patchStyle("borderRadius", v)} min={0} max={100} />
            <NumberField label="Opacity" value={element.style?.opacity} onChange={(v) => patchStyle("opacity", v)} min={0} max={1} step={0.05} />
          </>
        )}
        {element.type === "image" && (
          <>
            <SelectField label="Object Fit" value={element.style?.objectFit} options={OBJECT_FIT_OPTIONS} onChange={(v) => patchStyle("objectFit", v)} />
            <NumberField label="Border Radius" value={element.style?.borderRadius} onChange={(v) => patchStyle("borderRadius", v)} min={0} max={100} />
            <NumberField label="Opacity" value={element.style?.opacity} onChange={(v) => patchStyle("opacity", v)} min={0} max={1} step={0.05} />
          </>
        )}
        {element.type === "video" && (
          <>
            <SelectField label="Object Fit" value={element.style?.objectFit} options={OBJECT_FIT_OPTIONS} onChange={(v) => patchStyle("objectFit", v)} />
            <NumberField label="Border Radius" value={element.style?.borderRadius} onChange={(v) => patchStyle("borderRadius", v)} min={0} max={100} />
          </>
        )}
        {element.type === "tikz" && (
          <>
            <ColorField label="Background" value={element.style?.backgroundColor} onChange={(v) => patchStyle("backgroundColor", v)} />
            <NumberField label="Border Radius" value={element.style?.borderRadius} onChange={(v) => patchStyle("borderRadius", v)} min={0} max={32} />
          </>
        )}
        {element.type === "table" && (
          <>
            <NumberField label="Font Size" value={element.style?.fontSize} onChange={(v) => patchStyle("fontSize", v)} min={8} max={48} />
            <ColorField label="Color" value={element.style?.color} onChange={(v) => patchStyle("color", v)} />
            <ColorField label="Header BG" value={element.style?.headerBackground} onChange={(v) => patchStyle("headerBackground", v)} />
            <ColorField label="Header Color" value={element.style?.headerColor} onChange={(v) => patchStyle("headerColor", v)} />
            <ColorField label="Border Color" value={element.style?.borderColor} onChange={(v) => patchStyle("borderColor", v)} />
            <NumberField label="Border Radius" value={element.style?.borderRadius} onChange={(v) => patchStyle("borderRadius", v)} min={0} max={32} />
          </>
        )}
      </div>
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
  const adapter = useAdapter();
  const [status, setStatus] = useState<RenderStatus>(element.svgUrl ? "rendered" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [showPreamble, setShowPreamble] = useState(!!element.preamble);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderIdRef = useRef(0);

  // Sync status when svgUrl is cleared externally (e.g. file deleted → onError)
  useEffect(() => {
    if (!element.svgUrl && status === "rendered") {
      setStatus("idle");
    }
  }, [element.svgUrl, status]);

  const doRender = useCallback(async (content: string, preamble?: string) => {
    const renderId = ++renderIdRef.current;
    setStatus("rendering");
    setError(null);

    const result = await adapter.renderTikz(element.id, content, preamble);

    // Stale render — a newer one was triggered
    if (renderId !== renderIdRef.current) return;

    if (result.ok) {
      setStatus("rendered");
      setError(null);
      updateElement(slideId, element.id, {
        svgUrl: result.svgUrl,
        renderedContent: content,
        renderedPreamble: preamble ?? "",
        renderError: undefined,
      } as Partial<SlideElement>);
    } else {
      setStatus("error");
      setError(result.error);
      updateElement(slideId, element.id, {
        renderError: result.error,
      } as Partial<SlideElement>);
    }
  }, [adapter, element.id, slideId, updateElement]);

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

function CustomPropsEditor({
  element,
  slideId,
  updateElement,
}: {
  element: CustomElement;
  slideId: string;
  updateElement: (slideId: string, elementId: string, patch: Partial<SlideElement>) => void;
}) {
  const [draft, setDraft] = useState(() => JSON.stringify(element.props ?? {}, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);

  // Sync draft when element.props changes externally (undo/redo)
  useEffect(() => {
    setDraft(JSON.stringify(element.props ?? {}, null, 2));
    setParseError(null);
  }, [element.id]);

  const handleBlur = () => {
    try {
      const parsed = JSON.parse(draft);
      setParseError(null);
      updateElement(slideId, element.id, { props: parsed } as Partial<SlideElement>);
    } catch (e: any) {
      setParseError(e.message);
    }
  };

  return (
    <>
      <div>
        <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Component</div>
        <div className="text-purple-300 font-mono text-xs">{element.component}</div>
      </div>
      <div>
        <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Props (JSON)</div>
        <textarea
          className="w-full bg-zinc-800 text-zinc-200 rounded px-2 py-1.5 text-xs font-mono resize-y min-h-20 border border-zinc-700 focus:border-blue-500 focus:outline-none"
          value={draft}
          rows={6}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
        />
        {parseError && (
          <div className="text-red-400 text-xs mt-1 font-mono">{parseError}</div>
        )}
      </div>
    </>
  );
}

function TableDataEditor({
  element,
  slideId,
  updateElement,
}: {
  element: TableElement;
  slideId: string;
  updateElement: (slideId: string, elementId: string, patch: Partial<SlideElement>) => void;
}) {
  const updateColumn = (index: number, value: string) => {
    const columns = [...element.columns];
    columns[index] = value;
    updateElement(slideId, element.id, { columns } as Partial<SlideElement>);
  };

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    const rows = element.rows.map((r) => [...r]);
    rows[rowIndex]![colIndex] = value;
    updateElement(slideId, element.id, { rows } as Partial<SlideElement>);
  };

  const addColumn = () => {
    const columns = [...element.columns, `Col ${element.columns.length + 1}`];
    const rows = element.rows.map((r) => [...r, ""]);
    updateElement(slideId, element.id, { columns, rows } as Partial<SlideElement>);
  };

  const removeColumn = () => {
    if (element.columns.length <= 1) return;
    const columns = element.columns.slice(0, -1);
    const rows = element.rows.map((r) => r.slice(0, -1));
    updateElement(slideId, element.id, { columns, rows } as Partial<SlideElement>);
  };

  const addRow = () => {
    const rows = [...element.rows, Array(element.columns.length).fill("")];
    updateElement(slideId, element.id, { rows } as Partial<SlideElement>);
  };

  const removeRow = () => {
    if (element.rows.length <= 1) return;
    const rows = element.rows.slice(0, -1);
    updateElement(slideId, element.id, { rows } as Partial<SlideElement>);
  };

  const toggleStriped = () => {
    updateElement(slideId, element.id, {
      style: { ...element.style, striped: !(element.style?.striped ?? false) },
    } as Partial<SlideElement>);
  };

  return (
    <>
      <div>
        <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Columns</div>
        <div className="space-y-1">
          {element.columns.map((col, i) => (
            <input
              key={i}
              type="text"
              className="w-full bg-zinc-800 text-zinc-200 rounded px-2 py-1 text-xs font-mono border border-zinc-700 focus:border-blue-500 focus:outline-none"
              value={col}
              onChange={(e) => updateColumn(i, e.target.value)}
            />
          ))}
        </div>
        <div className="flex gap-1 mt-1">
          <button
            onClick={addColumn}
            className="flex-1 px-2 py-1 text-xs rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 transition-colors"
          >
            + Col
          </button>
          <button
            onClick={removeColumn}
            disabled={element.columns.length <= 1}
            className="flex-1 px-2 py-1 text-xs rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            - Col
          </button>
        </div>
      </div>

      <div>
        <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Rows</div>
        <div className="space-y-2">
          {element.rows.map((row, ri) => (
            <div key={ri} className="space-y-1">
              <div className="text-zinc-500 text-[10px]">Row {ri + 1}</div>
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${element.columns.length}, 1fr)` }}>
                {element.columns.map((_, ci) => (
                  <input
                    key={ci}
                    type="text"
                    className="w-full bg-zinc-800 text-zinc-200 rounded px-1.5 py-1 text-xs font-mono border border-zinc-700 focus:border-blue-500 focus:outline-none"
                    value={row[ci] ?? ""}
                    onChange={(e) => updateCell(ri, ci, e.target.value)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-1 mt-1">
          <button
            onClick={addRow}
            className="flex-1 px-2 py-1 text-xs rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 transition-colors"
          >
            + Row
          </button>
          <button
            onClick={removeRow}
            disabled={element.rows.length <= 1}
            className="flex-1 px-2 py-1 text-xs rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            - Row
          </button>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={element.style?.striped ?? false}
            onChange={toggleStriped}
            className="rounded border-zinc-600"
          />
          Striped rows
        </label>
      </div>
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
