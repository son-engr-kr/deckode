import { useEffect, useState } from "react";
import type { CodeElement as CodeElementType } from "@/types/deck";
import { codeToHtml } from "shiki";

interface Props {
  element: CodeElementType;
}

export function CodeElementRenderer({ element }: Props) {
  const style = element.style ?? {};
  const theme = style.theme ?? "github-dark";
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    codeToHtml(element.content, {
      lang: element.language,
      theme,
    }).then((result) => {
      if (!cancelled) setHtml(result);
    });
    return () => { cancelled = true; };
  }, [element.content, element.language, theme]);

  return (
    <div
      className="overflow-auto [&_pre]:h-full [&_pre]:w-full [&_pre]:p-4 [&_pre]:m-0 [&_code]:font-mono"
      style={{
        width: element.size.w,
        height: element.size.h,
        borderRadius: style.borderRadius ?? 8,
        fontSize: style.fontSize ?? 16,
      }}
    >
      {html ? (
        <div
          className="h-full [&_pre]:h-full [&_pre]:!rounded-none [&_pre]:!m-0"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre
          className="h-full w-full p-4"
          style={{ backgroundColor: "#1e1e2e", color: "#cdd6f4", margin: 0 }}
        >
          <code>{element.content}</code>
        </pre>
      )}
    </div>
  );
}
