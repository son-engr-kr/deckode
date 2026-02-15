import { useState } from "react";
import { SlideList } from "./SlideList";
import { EditorCanvas } from "./EditorCanvas";
import { PropertyPanel } from "./PropertyPanel";
import { CodePanel } from "./CodePanel";

type BottomPanel = "code" | null;

export function EditorLayout() {
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>(null);

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-white">
      {/* Toolbar */}
      <div className="h-10 border-b border-zinc-800 flex items-center px-4 gap-4 shrink-0">
        <span className="text-sm font-semibold text-zinc-300">Deckode</span>
        <div className="flex-1" />
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
        <div className="w-[170px] border-r border-zinc-800 overflow-y-auto shrink-0">
          <SlideList />
        </div>

        {/* Center: canvas + optional bottom panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <EditorCanvas />

          {/* Bottom panel (code editor) */}
          {bottomPanel === "code" && (
            <div className="h-[280px] border-t border-zinc-800 shrink-0">
              <CodePanel />
            </div>
          )}
        </div>

        {/* Right: property panel */}
        <div className="w-[240px] border-l border-zinc-800 overflow-y-auto shrink-0">
          <PropertyPanel />
        </div>
      </div>
    </div>
  );
}
