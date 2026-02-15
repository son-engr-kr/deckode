import type { CodeElement as CodeElementType } from "@/types/deck";

interface Props {
  element: CodeElementType;
}

/**
 * Phase 0: renders code with basic styling.
 * Shiki integration comes in Phase 1.
 */
export function CodeElementRenderer({ element }: Props) {
  const style = element.style ?? {};

  return (
    <div
      className="overflow-auto"
      style={{
        width: element.size.w,
        height: element.size.h,
        borderRadius: style.borderRadius ?? 8,
        fontSize: style.fontSize ?? 16,
      }}
    >
      <pre
        className="h-full w-full p-4"
        style={{
          backgroundColor: "#1e1e2e",
          color: "#cdd6f4",
          margin: 0,
          fontFamily: "'Fira Code', 'Cascadia Code', monospace",
        }}
      >
        <code>{element.content}</code>
      </pre>
    </div>
  );
}
