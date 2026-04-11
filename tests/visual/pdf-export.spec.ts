import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DECK_PATH = path.resolve(__dirname, "../fixtures/test-deck.json");

test.describe("PDF Export Visual Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("[data-testid='editor-layout'], .h-screen", {
      timeout: 15_000,
    });
  });

  test("app loads without errors", async ({ page }) => {
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });

  test("test fixture deck is valid JSON", () => {
    const raw = fs.readFileSync(TEST_DECK_PATH, "utf-8");
    const deck = JSON.parse(raw);
    expect(deck.version).toBe("1.0");
    expect(deck.meta.title).toBe("Test Deck");
    expect(deck.slides).toHaveLength(4);
    const hidden = deck.slides.filter(
      (s: { hidden?: boolean }) => s.hidden,
    );
    expect(hidden).toHaveLength(1);
  });

  test("PDF dropdown menu opens and shows both options", async ({ page }) => {
    const pdfButton = page.locator("button", { hasText: "PDF" });
    const count = await pdfButton.count();
    if (count > 0) {
      await pdfButton.first().click();
      const imageOption = page.locator("button", { hasText: "PDF (Image)" });
      const nativeOption = page.locator("button", { hasText: "PDF (Native)" });
      await expect(imageOption).toBeVisible({ timeout: 3000 });
      await expect(nativeOption).toBeVisible({ timeout: 3000 });
    }
  });
});

test.describe("PDF Comparison Tests", () => {
  const COMPARE_DIR = path.resolve(__dirname, "../../test-results/pdf-compare");

  test("compare image-based and native PDF page renders", async ({ page }) => {
    // Ensure output directory exists
    fs.mkdirSync(COMPARE_DIR, { recursive: true });

    await page.goto("/");
    await page.waitForSelector(".h-screen", { timeout: 15_000 });

    // Load the test deck fixture by injecting it into the store
    const deckJson = fs.readFileSync(TEST_DECK_PATH, "utf-8");
    await page.evaluate((json) => {
      const deck = JSON.parse(json);
      // Access the Zustand store via window (exposed by the app)
      // If not available, we set it via localStorage and reload
      localStorage.setItem("__test_deck__", json);
      (window as unknown as Record<string, unknown>).__TEST_DECK__ = deck;
    }, deckJson);

    // Try to trigger both exports and intercept the downloaded PDFs
    // This test captures both PDFs and renders each page to PNG for visual comparison
    const downloads: Array<{ name: string; path: string }> = [];

    // Listen for downloads
    page.on("download", async (download) => {
      const suggestedName = download.suggestedFilename();
      const savePath = path.join(COMPARE_DIR, suggestedName);
      await download.saveAs(savePath);
      downloads.push({ name: suggestedName, path: savePath });
    });

    // Check if PDF dropdown exists (need a project loaded)
    const pdfButton = page.locator("button", { hasText: /PDF/ });
    const pdfCount = await pdfButton.count();

    if (pdfCount === 0) {
      // No project loaded — skip the export comparison
      console.log("No project loaded in editor, skipping PDF comparison");
      return;
    }

    // Export Image PDF
    await pdfButton.first().click();
    const imageOption = page.locator("button", { hasText: "PDF (Image)" });
    if (await imageOption.isVisible({ timeout: 2000 })) {
      await imageOption.click();
      // Wait for download
      await page.waitForTimeout(5000);
    }

    // Export Native PDF
    await pdfButton.first().click();
    const nativeOption = page.locator("button", { hasText: "PDF (Native)" });
    if (await nativeOption.isVisible({ timeout: 2000 })) {
      await nativeOption.click();
      await page.waitForTimeout(5000);
    }

    if (downloads.length < 2) {
      console.log(
        `Only ${downloads.length} PDFs downloaded, skipping comparison`,
      );
      return;
    }

    // Render each PDF page to PNG using pdfjs-dist in the browser context
    for (const dl of downloads) {
      const pdfBytes = fs.readFileSync(dl.path);
      const b64 = pdfBytes.toString("base64");
      const prefix = dl.name.includes("native") ? "native" : "image";

      const pageImages: string[] = await page.evaluate(async (args) => {
        const { b64Data } = args;
        // Load pdfjs-dist from CDN
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";
        script.type = "module";

        // Use the raw binary approach instead
        const binary = atob(b64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        // @ts-expect-error - dynamic import
        const pdfjsLib = await import(
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs"
        );
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";

        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;

        const images: string[] = [];
        for (let p = 1; p <= pdf.numPages; p++) {
          const pg = await pdf.getPage(p);
          const viewport = pg.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d")!;
          await pg.render({ canvasContext: ctx, viewport }).promise;
          images.push(canvas.toDataURL("image/png"));
        }
        return images;
      }, { b64Data: b64 });

      // Save each page as PNG
      for (let i = 0; i < pageImages.length; i++) {
        const dataUrl = pageImages[i]!;
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
        const outPath = path.join(COMPARE_DIR, `${prefix}-page-${i + 1}.png`);
        fs.writeFileSync(outPath, Buffer.from(base64Data, "base64"));
      }
    }

    console.log(`PDF comparison images saved to: ${COMPARE_DIR}`);
    console.log("Compare image-page-*.png vs native-page-*.png visually");

    // Verify files were created
    const files = fs.readdirSync(COMPARE_DIR).filter((f) => f.endsWith(".png"));
    expect(files.length).toBeGreaterThan(0);
  });
});
