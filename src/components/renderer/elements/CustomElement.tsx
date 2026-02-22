import { useState, useEffect, type ComponentType } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { loadComponent } from "@/utils/componentLoader";
import type { CustomElement } from "@/types/deck";

interface Props {
  element: CustomElement;
}

export function CustomElementRenderer({ element }: Props) {
  const currentProject = useDeckStore((s) => s.currentProject);
  const [Component, setComponent] = useState<ComponentType<any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentProject) return;

    setComponent(null);
    setError(null);

    loadComponent(currentProject, element.component)
      .then((comp) => setComponent(() => comp))
      .catch((err) => setError(String(err)));
  }, [currentProject, element.component]);

  if (error) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 8,
          overflow: "auto",
        }}
      >
        <pre style={{ color: "#ef4444", fontFamily: "monospace", fontSize: 12, margin: 0, whiteSpace: "pre-wrap" }}>
          {error}
        </pre>
      </div>
    );
  }

  if (!Component) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#a1a1aa",
          fontSize: 12,
        }}
      >
        Loading {element.component}...
      </div>
    );
  }

  return <Component {...(element.props ?? {})} size={element.size} />;
}
