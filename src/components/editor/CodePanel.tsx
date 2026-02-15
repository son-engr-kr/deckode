import { useRef, useCallback } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useDeckStore } from "@/stores/deckStore";
import type { Deck } from "@/types/deck";

export function CodePanel() {
  const deck = useDeckStore((s) => s.deck);
  const loadDeck = useDeckStore((s) => s.loadDeck);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (!value) return;
      const parsed = JSON.parse(value) as Deck;
      loadDeck(parsed);
    },
    [loadDeck],
  );

  if (!deck) return null;

  const json = JSON.stringify(deck, null, 2);

  return (
    <div className="h-full">
      <Editor
        height="100%"
        language="json"
        theme="vs-dark"
        value={json}
        onChange={handleChange}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontSize: 12,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          tabSize: 2,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
