import PptxGenJS from "pptxgenjs";
import type {
  Deck,
  SlideElement,
  TextElement,
  CodeElement,
  ShapeElement,
  ImageElement,
  TableElement,
} from "@/types/deck";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/types/deck";

const SLIDE_W = 10; // inches (standard 16:9 widescreen)
const SLIDE_H = 5.625;
const PX_TO_IN_X = SLIDE_W / CANVAS_WIDTH;
const PX_TO_IN_Y = SLIDE_H / CANVAS_HEIGHT;

function stripMarkdown(md: string): string {
  return md
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/^\s*[-*]\s/gm, "")
    .replace(/\$\$([\s\S]*?)\$\$/g, "$1") // block math
    .replace(/\$(.*?)\$/g, "$1") // inline math
    .trim();
}

function toHex(color: string | undefined): string | undefined {
  if (!color || color === "transparent") return undefined;
  return color.replace(/^#/, "");
}

async function fetchImageAsBase64(src: string): Promise<string | null> {
  const urls = [
    src,
    src.startsWith("./") ? src.slice(2) : src,
  ];
  for (const url of urls) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch {
      continue;
    }
  }
  return null;
}

export async function exportToPptx(deck: Deck): Promise<void> {
  const pres = new PptxGenJS();
  pres.defineLayout({ name: "DECKODE", width: SLIDE_W, height: SLIDE_H });
  pres.layout = "DECKODE";
  pres.title = deck.meta.title;
  if (deck.meta.author) pres.author = deck.meta.author;

  for (const slide of deck.slides) {
    const pptSlide = pres.addSlide();

    // Background
    const bg = slide.background ?? deck.theme?.slide?.background;
    if (bg?.color) {
      const hex = toHex(bg.color);
      if (hex) pptSlide.background = { fill: hex };
    }

    // Elements
    for (const el of slide.elements) {
      await addElement(pptSlide, el);
    }

    // Notes (strip [step:N]...[/step] markers)
    if (slide.notes) {
      const clean = slide.notes
        .replace(/\[step:\d+\]/g, "")
        .replace(/\[\/step\]/g, "");
      pptSlide.addNotes(clean);
    }
  }

  const filename = (deck.meta.title || "presentation")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  await pres.writeFile({ fileName: `${filename}.pptx` });
}

async function addElement(
  slide: PptxGenJS.Slide,
  el: SlideElement,
): Promise<void> {
  const x = el.position.x * PX_TO_IN_X;
  const y = el.position.y * PX_TO_IN_Y;
  const w = el.size.w * PX_TO_IN_X;
  const h = el.size.h * PX_TO_IN_Y;

  switch (el.type) {
    case "text":
      addText(slide, el, x, y, w, h);
      break;
    case "code":
      addCode(slide, el, x, y, w, h);
      break;
    case "image":
      await addImage(slide, el, x, y, w, h);
      break;
    case "shape":
      addShape(slide, el, x, y, w, h);
      break;
    case "table":
      addTable(slide, el, x, y, w, h);
      break;
    // video, tikz, custom — not representable in PPTX
    default:
      break;
  }
}

function addText(
  slide: PptxGenJS.Slide,
  el: TextElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const s = el.style;
  slide.addText(stripMarkdown(el.content), {
    x,
    y,
    w,
    h,
    fontSize: s?.fontSize ? Math.round(s.fontSize * 0.75) : 14,
    fontFace: s?.fontFamily || undefined,
    color: toHex(s?.color) || undefined,
    align: s?.textAlign || "left",
    valign: s?.verticalAlign || "top",
    wrap: true,
    margin: 0,
  });
}

function addCode(
  slide: PptxGenJS.Slide,
  el: CodeElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const s = el.style;
  slide.addText(el.content, {
    x,
    y,
    w,
    h,
    fontSize: s?.fontSize ? Math.round(s.fontSize * 0.75) : 11,
    fontFace: "Courier New",
    color: "D4D4D4",
    fill: { color: "1E1E1E" },
    valign: "top",
    wrap: true,
    margin: [4, 8, 4, 8],
  });
}

async function addImage(
  slide: PptxGenJS.Slide,
  el: ImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const base64 = await fetchImageAsBase64(el.src);
  if (base64) {
    slide.addImage({ data: base64, x, y, w, h });
  }
}

function addShape(
  slide: PptxGenJS.Slide,
  el: ShapeElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const s = el.style;
  const fillHex = toHex(s?.fill);
  const strokeHex = toHex(s?.stroke);
  const fill = fillHex ? { color: fillHex } : undefined;
  const line = strokeHex
    ? { color: strokeHex, width: s?.strokeWidth ?? 1 }
    : undefined;

  if (el.shape === "rectangle") {
    slide.addShape("rect" as PptxGenJS.ShapeType, {
      x,
      y,
      w,
      h,
      fill,
      line,
      rectRadius: s?.borderRadius
        ? s.borderRadius * PX_TO_IN_X
        : undefined,
    });
  } else if (el.shape === "ellipse") {
    slide.addShape("ellipse" as PptxGenJS.ShapeType, {
      x,
      y,
      w,
      h,
      fill,
      line,
    });
  } else if (el.shape === "line" || el.shape === "arrow") {
    slide.addShape("line" as PptxGenJS.ShapeType, {
      x,
      y,
      w,
      h: 0,
      line: {
        color: strokeHex ?? "FFFFFF",
        width: s?.strokeWidth ?? 2,
        endArrowType: el.shape === "arrow" ? "triangle" : undefined,
      },
    });
  }
}

function addTable(
  slide: PptxGenJS.Slide,
  el: TableElement,
  x: number,
  y: number,
  w: number,
  _h: number,
) {
  const s = el.style;
  const headerBg = toHex(s?.headerBackground ?? "#1e293b");
  const headerColor = toHex(s?.headerColor ?? "#f8fafc");
  const textColor = toHex(s?.color ?? "#e2e8f0");
  const borderColor = toHex(s?.borderColor ?? "#334155");
  const fontSize = s?.fontSize ? Math.round(s.fontSize * 0.75) : 10;

  const headerRow: PptxGenJS.TableRow = el.columns.map((col) => ({
    text: col,
    options: {
      bold: true,
      fontSize,
      color: headerColor,
      fill: headerBg ? { color: headerBg } : undefined,
    },
  }));

  const dataRows: PptxGenJS.TableRow[] = el.rows.map((row) =>
    el.columns.map((_, ci) => ({
      text: row[ci] ?? "",
      options: {
        fontSize,
        color: textColor,
      },
    })),
  );

  const colW = w / el.columns.length;

  slide.addTable([headerRow, ...dataRows], {
    x,
    y,
    w,
    colW,
    border: borderColor
      ? { type: "solid", pt: 0.5, color: borderColor }
      : undefined,
    margin: [2, 4, 2, 4],
  });
}
