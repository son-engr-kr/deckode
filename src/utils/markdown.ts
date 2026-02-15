import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

/**
 * Minimal Markdown-to-React renderer.
 * Supports: headings, bold, italic, inline code, lists, paragraphs.
 * No external dependency — intentionally simple for Phase 0.
 */
export function renderMarkdown(source: string): ReactNode {
  const lines = source.split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let blockKey = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      createElement(
        "ul",
        { key: blockKey++, className: "list-disc pl-6 space-y-1" },
        listItems.map((item, i) => createElement("li", { key: i }, renderInline(item))),
      ),
    );
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // List item
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listItems.push(trimmed.slice(2));
      continue;
    }

    flushList();

    // Empty line
    if (trimmed === "") continue;

    // Heading
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1]!.length as 1 | 2 | 3;
      const text = headingMatch[2]!;
      const tag = `h${level}` as const;
      const sizeClass = { 1: "text-[1.8em] font-bold", 2: "text-[1.4em] font-semibold", 3: "text-[1.1em] font-medium" }[level];
      blocks.push(createElement(tag, { key: blockKey++, className: sizeClass }, renderInline(text)));
      continue;
    }

    // Paragraph
    blocks.push(createElement("p", { key: blockKey++ }, renderInline(trimmed)));
  }

  flushList();
  return createElement(Fragment, null, ...blocks);
}

function renderInline(text: string): ReactNode {
  // Split by inline patterns: **bold**, *italic*, `code`, $math$
  const parts: ReactNode[] = [];
  // Combined regex: bold(**), italic(*), inline code(`), math($)
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\$(.+?)\$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partKey = 0;

  while ((match = regex.exec(text)) !== null) {
    // Push text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2] !== undefined) {
      // Bold
      parts.push(createElement("strong", { key: partKey++, className: "font-bold" }, match[2]));
    } else if (match[4] !== undefined) {
      // Italic
      parts.push(createElement("em", { key: partKey++, className: "italic" }, match[4]));
    } else if (match[6] !== undefined) {
      // Inline code
      parts.push(
        createElement(
          "code",
          { key: partKey++, className: "bg-white/10 px-1.5 py-0.5 rounded text-[0.85em] font-mono" },
          match[6],
        ),
      );
    } else if (match[8] !== undefined) {
      // Math placeholder (KaTeX integration later)
      parts.push(
        createElement(
          "span",
          { key: partKey++, className: "font-mono text-blue-300" },
          match[8],
        ),
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : createElement(Fragment, null, ...parts);
}
