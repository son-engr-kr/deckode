import type { Deck } from "@/types/deck";

export interface ValidationIssue {
  severity: "error" | "warning";
  slideId?: string;
  elementId?: string;
  message: string;
  autoFixable: boolean;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  fixed: number;
}

export function validateDeck(deck: Deck): ValidationResult {
  const issues: ValidationIssue[] = [];
  const slideIds = new Set<string>();
  const elementIds = new Set<string>();

  for (const slide of deck.slides) {
    // Duplicate slide ID
    if (slideIds.has(slide.id)) {
      issues.push({
        severity: "error",
        slideId: slide.id,
        message: `Duplicate slide ID: "${slide.id}"`,
        autoFixable: false,
      });
    }
    slideIds.add(slide.id);

    // Forbidden element types (not supported / cause rendering issues)
    const FORBIDDEN_TYPES = ["mermaid", "video", "iframe", "audio"];
    for (const el of slide.elements) {
      if (FORBIDDEN_TYPES.includes(el.type)) {
        issues.push({
          severity: "error",
          slideId: slide.id,
          elementId: el.id,
          message: `Forbidden element type "${el.type}" — use shape+text for diagrams, code for code`,
          autoFixable: false,
        });
      }
    }

    // Overlap detection: check all pairs with significant area
    const measurableEls = slide.elements.filter(
      (e) => e.position && e.size && e.size.w > 5 && e.size.h > 5,
    );
    for (let a = 0; a < measurableEls.length; a++) {
      for (let b = a + 1; b < measurableEls.length; b++) {
        const ea = measurableEls[a]!;
        const eb = measurableEls[b]!;
        // Skip if they share a groupId (intentionally stacked)
        const gaGroup = (ea as { groupId?: string }).groupId;
        const gbGroup = (eb as { groupId?: string }).groupId;
        if (gaGroup && gaGroup === gbGroup) continue;
        const ax1 = ea.position.x, ay1 = ea.position.y;
        const ax2 = ax1 + ea.size.w,  ay2 = ay1 + ea.size.h;
        const bx1 = eb.position.x, by1 = eb.position.y;
        const bx2 = bx1 + eb.size.w,  by2 = by1 + eb.size.h;
        const overlapW = Math.min(ax2, bx2) - Math.max(ax1, bx1);
        const overlapH = Math.min(ay2, by2) - Math.max(ay1, by1);
        if (overlapW > 20 && overlapH > 20) {
          const areaA = ea.size.w * ea.size.h;
          const areaB = eb.size.w * eb.size.h;
          const overlapArea = overlapW * overlapH;
          const overlapPct = overlapArea / Math.min(areaA, areaB);
          // Skip label-on-box pattern: smaller element fully inside larger (area ratio > 3x)
          const isLabelOnBox = overlapPct > 0.9 && Math.max(areaA, areaB) / Math.min(areaA, areaB) > 3;
          if (!isLabelOnBox) {
            if (overlapPct > 0.5) {
              issues.push({
                severity: "error",
                slideId: slide.id,
                elementId: ea.id,
                message: `Elements "${ea.id}" and "${eb.id}" overlap by ${Math.round(overlapPct * 100)}% — move one to a different position`,
                autoFixable: false,
              });
            } else if (overlapPct > 0.15) {
              issues.push({
                severity: "warning",
                slideId: slide.id,
                elementId: ea.id,
                message: `Elements "${ea.id}" and "${eb.id}" overlap by ${Math.round(overlapPct * 100)}% (${overlapW}×${overlapH}px)`,
                autoFixable: false,
              });
            }
          }
        }
      }
    }

    for (const el of slide.elements) {
      // Duplicate element ID
      if (elementIds.has(el.id)) {
        issues.push({
          severity: "error",
          slideId: slide.id,
          elementId: el.id,
          message: `Duplicate element ID: "${el.id}"`,
          autoFixable: false,
        });
      }
      elementIds.add(el.id);

      // Missing required fields
      if (!(el as unknown as Record<string, unknown>).type) {
        issues.push({
          severity: "error",
          slideId: slide.id,
          elementId: el.id,
          message: "Element missing type",
          autoFixable: false,
        });
      }
      if (!el.position || el.position.x === undefined || el.position.y === undefined) {
        issues.push({
          severity: "error",
          slideId: slide.id,
          elementId: el.id,
          message: "Element missing position",
          autoFixable: false,
        });
        continue;
      }
      if (!el.size || !el.size.w || !el.size.h) {
        issues.push({
          severity: "warning",
          slideId: slide.id,
          elementId: el.id,
          message: "Element has zero or missing size",
          autoFixable: true,
        });
      }

      // Position out of bounds
      if (el.position.x < 0 || el.position.y < 0) {
        issues.push({
          severity: "warning",
          slideId: slide.id,
          elementId: el.id,
          message: `Element position negative: (${el.position.x}, ${el.position.y})`,
          autoFixable: true,
        });
      }

      // Overflow canvas
      if (el.position.x + el.size.w > 960) {
        issues.push({
          severity: "warning",
          slideId: slide.id,
          elementId: el.id,
          message: `Element overflows right edge: x(${el.position.x}) + w(${el.size.w}) = ${el.position.x + el.size.w} > 960`,
          autoFixable: true,
        });
      }
      if (el.position.y + el.size.h > 540) {
        issues.push({
          severity: "warning",
          slideId: slide.id,
          elementId: el.id,
          message: `Element overflows bottom edge: y(${el.position.y}) + h(${el.size.h}) = ${el.position.y + el.size.h} > 540`,
          autoFixable: true,
        });
      }

      // Arrow/line with rotation field (causes assert fail in renderer)
      if (el.type === "shape") {
        const shape = el as { shape?: string; rotation?: unknown };
        if ((shape.shape === "arrow" || shape.shape === "line") && shape.rotation !== undefined) {
          issues.push({
            severity: "error",
            slideId: slide.id,
            elementId: el.id,
            message: `Arrow/line element has rotation field (must be removed — use waypoints instead)`,
            autoFixable: false,
          });
        }
      }

      // scene3d: orbitControls in slide context interferes with navigation
      if (el.type === "scene3d") {
        const s3d = el as { scene?: { orbitControls?: boolean; camera?: { position?: number[] } } };
        if (s3d.scene?.orbitControls === true) {
          issues.push({
            severity: "warning",
            slideId: slide.id,
            elementId: el.id,
            message: "scene3d has orbitControls:true — this grabs mouse events and breaks slide navigation",
            autoFixable: false,
          });
        }
      }

      // TikZ missing bounding box \path ... rectangle
      if (el.type === "tikz") {
        const tikz = el as { content?: string };
        if (tikz.content && !tikz.content.includes("\\path") && !tikz.content.includes("rectangle")) {
          issues.push({
            severity: "warning",
            slideId: slide.id,
            elementId: el.id,
            message: "TikZ element missing bounding box (\\path ... rectangle)",
            autoFixable: false,
          });
        }
      }

      // Text: double backslash in non-TikZ text (LaTeX line-break error)
      if (el.type === "text") {
        const txt = el as { content?: string };
        if (txt.content && /\\\\/.test(txt.content)) {
          issues.push({
            severity: "warning",
            slideId: slide.id,
            elementId: el.id,
            message: "Text element contains \\\\ (LaTeX line break outside TikZ — may break rendering)",
            autoFixable: false,
          });
        }
        // Bold markers inside math delimiters
        if (txt.content && /\$[^$]*\*\*[^$]*\$/.test(txt.content)) {
          issues.push({
            severity: "warning",
            slideId: slide.id,
            elementId: el.id,
            message: "Text element has **bold** inside $math$ (use \\mathbf{} instead)",
            autoFixable: false,
          });
        }
      }

      // Code element: too many lines
      if (el.type === "code") {
        const code = el as { content?: string };
        if (code.content) {
          const lineCount = code.content.split("\n").length;
          if (lineCount > 25) {
            issues.push({
              severity: "warning",
              slideId: slide.id,
              elementId: el.id,
              message: `Code element has ${lineCount} lines (max 25 recommended)`,
              autoFixable: false,
            });
          }
        }
      }

      // Empty text content
      if (el.type === "text" && !(el as { content: string }).content?.trim()) {
        issues.push({
          severity: "warning",
          slideId: slide.id,
          elementId: el.id,
          message: "Text element has empty content",
          autoFixable: false,
        });
      }

      // Font size sanity
      if (el.type === "text") {
        const fontSize = (el as { style?: { fontSize?: number } }).style?.fontSize;
        if (fontSize !== undefined) {
          if (fontSize < 10) {
            issues.push({
              severity: "warning",
              slideId: slide.id,
              elementId: el.id,
              message: `Font size too small: ${fontSize}`,
              autoFixable: true,
            });
          }
          if (fontSize > 72) {
            issues.push({
              severity: "warning",
              slideId: slide.id,
              elementId: el.id,
              message: `Font size too large: ${fontSize}`,
              autoFixable: true,
            });
          }
        }
      }

      // Table: missing or empty columns/rows (causes PropertyPanel crash)
      if (el.type === "table") {
        const tbl = el as { columns?: unknown; rows?: unknown };
        if (!Array.isArray(tbl.columns) || tbl.columns.length === 0) {
          issues.push({
            severity: "error",
            slideId: slide.id,
            elementId: el.id,
            message: "Table element missing or empty columns array",
            autoFixable: false,
          });
        }
        if (!Array.isArray(tbl.rows) || tbl.rows.length === 0) {
          issues.push({
            severity: "error",
            slideId: slide.id,
            elementId: el.id,
            message: "Table element missing or empty rows array",
            autoFixable: false,
          });
        }
      }
    }

    // Step marker vs onClick animation count
    if (slide.notes && slide.animations) {
      const stepMatches = [...slide.notes.matchAll(/\[step:\d+\]/g)];
      const onClickCount = slide.animations.filter((a) => a.trigger === "onClick").length;
      if (stepMatches.length > 0 && stepMatches.length !== onClickCount) {
        issues.push({
          severity: "warning",
          slideId: slide.id,
          message: `Step marker count (${stepMatches.length}) does not match onClick animation count (${onClickCount})`,
          autoFixable: false,
        });
      }
    }
  }

  return { issues, fixed: 0 };
}

export function buildFixInstructions(result: ValidationResult): string {
  if (result.issues.length === 0) return "";

  const lines: string[] = [];

  for (const i of result.issues) {
    const loc = i.elementId ? `[${i.slideId}/${i.elementId}]` : `[${i.slideId}]`;
    if (i.autoFixable) {
      if (i.message.includes("overflows right")) {
        lines.push(`- FIX ${loc} Reduce width or move left to fit within 960px`);
      } else if (i.message.includes("overflows bottom")) {
        lines.push(`- FIX ${loc} Reduce height or move up to fit within 540px`);
      } else if (i.message.includes("negative")) {
        lines.push(`- FIX ${loc} Move position to positive coordinates`);
      } else if (i.message.includes("Font size too small")) {
        lines.push(`- FIX ${loc} Increase font size to at least 12`);
      } else if (i.message.includes("Font size too large")) {
        lines.push(`- FIX ${loc} Decrease font size to at most 60`);
      } else if (i.message.includes("zero or missing size")) {
        lines.push(`- FIX ${loc} Set reasonable width and height`);
      } else {
        lines.push(`- FIX ${loc} ${i.message}`);
      }
    } else if (i.severity === "error") {
      // Critical non-auto-fixable: report so reviewer is aware
      lines.push(`- CRITICAL ${loc} ${i.message}`);
    }
  }

  if (lines.length === 0) return "";
  return `Issues found:\n${lines.join("\n")}`;
}
