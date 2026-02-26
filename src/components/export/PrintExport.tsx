import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDeckStore } from "@/stores/deckStore";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/types/deck";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface Props {
  onDone: () => void;
}

export function PrintExport({ onDone }: Props) {
  const deck = useDeckStore((s) => s.deck);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggered = useRef(false);
  const [status, setStatus] = useState("Rendering slides…");

  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;

    const timer = setTimeout(async () => {
      const container = containerRef.current;
      assert(container !== null, "print container not mounted");

      const pages = Array.from(
        container.querySelectorAll<HTMLElement>(".print-export-page"),
      );
      assert(pages.length > 0, "no slides to export");

      // PDF with exact slide dimensions (960x540 pt ≈ 338.7×190.5 mm)
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [CANVAS_WIDTH, CANVAS_HEIGHT],
        hotfixes: ["px_scaling"],
      });

      for (let i = 0; i < pages.length; i++) {
        setStatus(`Capturing slide ${i + 1} / ${pages.length}…`);
        const page = pages[i];
        assert(page !== undefined, `page ${i} not found`);
        const canvas = await html2canvas(page, {
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          scale: 2, // 2x for sharp output
          useCORS: true,
          backgroundColor: null,
        });

        if (i > 0) pdf.addPage([CANVAS_WIDTH, CANVAS_HEIGHT], "landscape");
        pdf.addImage(
          canvas.toDataURL("image/png"),
          "PNG",
          0,
          0,
          CANVAS_WIDTH,
          CANVAS_HEIGHT,
        );
      }

      setStatus("Saving PDF…");
      const title = deck?.meta.title ?? "deck";
      pdf.save(`${title}.pdf`);
      onDone();
    }, 500); // let slides render before capturing

    return () => clearTimeout(timer);
  }, [onDone, deck]);

  if (!deck) return null;

  return createPortal(
    <>
      {/* Off-screen render target for html2canvas */}
      <div
        ref={containerRef}
        style={{ position: "fixed", left: -99999, top: 0 }}
      >
        {deck.slides.map((slide) => (
          <div
            key={slide.id}
            className="print-export-page"
            style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
          >
            <SlideRenderer slide={slide} scale={1} theme={deck.theme} />
          </div>
        ))}
      </div>
      {/* Overlay with progress */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 16,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {status}
      </div>
    </>,
    document.body,
  );
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`[PrintExport] ${message}`);
}
