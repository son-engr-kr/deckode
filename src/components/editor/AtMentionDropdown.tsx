import { useState, useEffect, useCallback, useRef } from "react";
import { useProjectRefStore } from "@/stores/projectRefStore";
import { useContextBarStore } from "@/stores/contextBarStore";

interface Props {
  inputValue: string;
  cursorPosition: number;
  onSelect: (projectName: string) => void;
  onDismiss: () => void;
}

export function AtMentionDropdown({ inputValue, cursorPosition, onSelect, onDismiss }: Props) {
  const registeredProjects = useProjectRefStore((s) => s.registeredProjects);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Find the @ trigger: look backwards from cursor for @
  const textBeforeCursor = inputValue.slice(0, cursorPosition);
  const atIndex = textBeforeCursor.lastIndexOf("@");
  const isActive =
    atIndex !== -1 &&
    // @ must be at start or preceded by whitespace
    (atIndex === 0 || /\s/.test(textBeforeCursor[atIndex - 1]!)) &&
    // no space between @ and cursor
    !textBeforeCursor.slice(atIndex + 1).includes(" ");

  const query = isActive ? textBeforeCursor.slice(atIndex + 1).toLowerCase() : "";

  const filtered = isActive
    ? registeredProjects.filter((p) => p.name.toLowerCase().includes(query))
    : [];

  // Reset selection when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

  const handleSelect = useCallback(
    (projectName: string) => {
      const project = registeredProjects.find((p) => p.name === projectName);
      if (project) {
        useContextBarStore.getState().addProjectRef({ name: project.name, handle: project.handle });
      }
      onSelect(projectName);
    },
    [registeredProjects, onSelect],
  );

  // Keyboard handler — called from parent's onKeyDown
  useEffect(() => {
    if (!isActive || filtered.length === 0) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        const selected = filtered[selectedIndex];
        if (selected) handleSelect(selected.name);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    };

    // Capture phase so we intercept before the textarea's onKeyDown
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [isActive, filtered, selectedIndex, handleSelect, onDismiss]);

  if (!isActive || filtered.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 mb-1 w-56 bg-zinc-800 border border-zinc-700 rounded-md shadow-xl py-1 z-50 max-h-[160px] overflow-y-auto"
    >
      {filtered.map((project, i) => (
        <button
          key={project.name}
          onMouseDown={(e) => {
            e.preventDefault(); // don't blur textarea
            handleSelect(project.name);
          }}
          className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${
            i === selectedIndex
              ? "bg-blue-600/20 text-blue-400"
              : "text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          <span className="shrink-0">📁</span>
          <span className="truncate">{project.name}</span>
        </button>
      ))}
    </div>
  );
}
