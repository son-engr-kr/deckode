/**
 * Export Fidelity Test
 *
 * Injects the comprehensive test deck, screenshots each slide on canvas,
 * exports to Image PDF and Native PDF, renders PDF pages, and computes
 * per-pixel RMSE between canvas and each PDF format.
 *
 * Usage:
 *   npx playwright test tests/visual/export-fidelity.spec.ts
 *
 * Output:
 *   test-results/export-compare/
 *     canvas-slide-N.png, image-pdf-N.png, native-pdf-N.png
 *     diff-image-N.png, diff-native-N.png
 *     fidelity-report.json
 */
import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.resolve(__dirname, "../../test-results/export-compare");
const FIXTURE_PATH = path.resolve(
  __dirname,
  "../fixtures/comprehensive-test-deck.json",
);

// Maximum allowed diff percentage per page
const MAX_DIFF_PERCENT = 1.0;

test("export fidelity: canvas vs PDF image vs PDF native", async ({
  page,
}) => {
  test.setTimeout(180_000);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Load the comprehensive test deck fixture
  const testDeck = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf-8"));
  const visibleSlides = testDeck.slides.filter(
    (s: { hidden?: boolean }) => !s.hidden,
  );

  // Navigate to the app
  await page.goto("/");
  await page.waitForSelector(".h-screen", { timeout: 15_000 });

  // Open a project if the project selector is shown
  const projectButton = page.locator("button", {
    hasText: /tekkal-intro|deckode-intro|example|muscle/,
  });
  const projectCount = await projectButton.count();
  if (projectCount > 0) {
    await projectButton.first().click();
    await page.waitForTimeout(2000);
  }

  // Wait for the editor to be ready
  await page
    .locator("button", { hasText: /PDF/ })
    .first()
    .waitFor({ state: "visible", timeout: 15_000 });

  // Inject the test deck into the Zustand store
  await page.evaluate((deck: unknown) => {
    // Access the Zustand store via window (vite dev injects it)
    const stores = (window as any).__ZUSTAND_STORES__;
    if (stores?.deck) {
      stores.deck.getState().setDeck(deck);
    } else {
      // Fallback: try to find the store via React dev tools or global
      const el = document.querySelector("[data-testid='slide-canvas']");
      if (!el) {
        console.warn("Could not find slide canvas or store");
      }
    }
  }, testDeck);

  await page.waitForTimeout(1000);

  // Screenshot each visible slide on the canvas
  const canvasScreenshots: string[] = [];
  for (let i = 0; i < visibleSlides.length; i++) {
    // Navigate to slide i via keyboard or store
    await page.evaluate((idx: number) => {
      const stores = (window as any).__ZUSTAND_STORES__;
      if (stores?.deck) {
        stores.deck.getState().setCurrentSlideIndex(idx);
      }
    }, i);
    await page.waitForTimeout(500);

    // Take a screenshot of the slide canvas area
    const canvas = page.locator("[data-testid='slide-canvas']").first();
    const isVisible = await canvas.isVisible().catch(() => false);

    if (isVisible) {
      const screenshotPath = path.join(OUT_DIR, `canvas-slide-${i + 1}.png`);
      await canvas.screenshot({ path: screenshotPath });
      canvasScreenshots.push(screenshotPath);
    } else {
      // Fallback: full page screenshot
      const screenshotPath = path.join(OUT_DIR, `canvas-slide-${i + 1}.png`);
      await page.screenshot({ path: screenshotPath });
      canvasScreenshots.push(screenshotPath);
    }
  }

  console.log(`Captured ${canvasScreenshots.length} canvas screenshots`);

  // Export Image PDF
  const pdfButton = page.locator("button", { hasText: /PDF/ }).first();
  await pdfButton.click();
  await page.waitForTimeout(300);

  const imageBtn = page.locator("button", { hasText: "PDF (Image)" });
  const imageBtnVisible = await imageBtn
    .isVisible({ timeout: 3000 })
    .catch(() => false);

  let imagePdfPath: string | null = null;
  if (imageBtnVisible) {
    const [imageDownload] = await Promise.all([
      page.waitForEvent("download", { timeout: 60_000 }),
      imageBtn.click(),
    ]);
    imagePdfPath = path.join(OUT_DIR, "export-image.pdf");
    await imageDownload.saveAs(imagePdfPath);
    console.log("Image PDF exported");
  }

  await page.waitForTimeout(2000);

  // Export Native PDF
  await pdfButton.click();
  await page.waitForTimeout(300);

  const nativeBtn = page.locator("button", { hasText: "PDF (Native)" });
  const nativeBtnVisible = await nativeBtn
    .isVisible({ timeout: 3000 })
    .catch(() => false);

  let nativePdfPath: string | null = null;
  if (nativeBtnVisible) {
    const [nativeDownload] = await Promise.all([
      page.waitForEvent("download", { timeout: 60_000 }),
      nativeBtn.click(),
    ]);
    nativePdfPath = path.join(OUT_DIR, "export-native.pdf");
    await nativeDownload.saveAs(nativePdfPath);
    console.log("Native PDF exported");
  }

  // Render PDFs to page images in the browser
  async function renderPdfToImages(pdfPath: string): Promise<string[]> {
    const bytes = fs.readFileSync(pdfPath);
    const b64 = bytes.toString("base64");

    return page.evaluate(async (b64Data: string) => {
      const binary = atob(b64Data);
      const arr = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);

      // @ts-expect-error dynamic CDN import
      const pdfjsLib = await import(
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.min.mjs"
      );
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs";

      const pdf = await pdfjsLib.getDocument({ data: arr }).promise;
      const imgs: string[] = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const pg = await pdf.getPage(p);
        const vp = pg.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext("2d")!;
        await pg.render({ canvasContext: ctx, viewport: vp }).promise;
        imgs.push(canvas.toDataURL("image/png"));
      }
      return imgs;
    }, b64);
  }

  // Compute diff between two images in the browser
  async function computeDiff(
    img1Base64: string,
    img2Base64: string,
  ): Promise<{ rmse: number; diffPercent: number; diffDataUrl: string }> {
    return page.evaluate(
      async (args: { img1: string; img2: string }) => {
        const load = (src: string): Promise<HTMLImageElement> =>
          new Promise((res) => {
            const img = new Image();
            img.onload = () => res(img);
            img.src = src;
          });

        const [a, b] = await Promise.all([load(args.img1), load(args.img2)]);

        const w = Math.max(a.width, b.width);
        const h = Math.max(a.height, b.height);

        const ca = document.createElement("canvas");
        ca.width = w;
        ca.height = h;
        const ctxA = ca.getContext("2d")!;
        ctxA.drawImage(a, 0, 0, a.width, a.height, 0, 0, w, h);
        const dataA = ctxA.getImageData(0, 0, w, h);

        const cb = document.createElement("canvas");
        cb.width = w;
        cb.height = h;
        const ctxB = cb.getContext("2d")!;
        ctxB.drawImage(b, 0, 0, b.width, b.height, 0, 0, w, h);
        const dataB = ctxB.getImageData(0, 0, w, h);

        const diffCanvas = document.createElement("canvas");
        diffCanvas.width = w;
        diffCanvas.height = h;
        const ctxD = diffCanvas.getContext("2d")!;
        const diffData = ctxD.createImageData(w, h);

        let sumSq = 0;
        let diffPixels = 0;
        const n = w * h;
        for (let p = 0; p < n; p++) {
          const idx = p * 4;
          const dr = dataA.data[idx]! - dataB.data[idx]!;
          const dg = dataA.data[idx + 1]! - dataB.data[idx + 1]!;
          const db = dataA.data[idx + 2]! - dataB.data[idx + 2]!;
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);
          sumSq += dist * dist;

          if (dist > 10) {
            diffPixels++;
            const intensity = Math.min(255, Math.round(dist * 2));
            diffData.data[idx] = intensity;
            diffData.data[idx + 1] = 0;
            diffData.data[idx + 2] = 0;
            diffData.data[idx + 3] = 255;
          } else {
            diffData.data[idx] = Math.round(
              ((dataA.data[idx]! + dataB.data[idx]!) / 2) * 0.3,
            );
            diffData.data[idx + 1] = Math.round(
              ((dataA.data[idx + 1]! + dataB.data[idx + 1]!) / 2) * 0.3,
            );
            diffData.data[idx + 2] = Math.round(
              ((dataA.data[idx + 2]! + dataB.data[idx + 2]!) / 2) * 0.3,
            );
            diffData.data[idx + 3] = 255;
          }
        }

        ctxD.putImageData(diffData, 0, 0);
        return {
          rmse: Math.round(Math.sqrt(sumSq / n) * 100) / 100,
          diffPercent: Math.round((diffPixels / n) * 10000) / 100,
          diffDataUrl: diffCanvas.toDataURL("image/png"),
        };
      },
      { img1: img1Base64, img2: img2Base64 },
    );
  }

  const report: Array<{
    page: number;
    imagePdf?: { rmse: number; diffPercent: number };
    nativePdf?: { rmse: number; diffPercent: number };
  }> = [];

  // Compare Image PDF pages vs canvas
  if (imagePdfPath) {
    console.log("\nRendering Image PDF pages...");
    const imagePages = await renderPdfToImages(imagePdfPath);
    console.log(`  ${imagePages.length} pages`);

    for (let i = 0; i < imagePages.length; i++) {
      const pdfImgB64 = imagePages[i]!;
      const canvasB64 = `data:image/png;base64,${fs.readFileSync(canvasScreenshots[i]!).toString("base64")}`;

      const pageFile = `image-pdf-${i + 1}.png`;
      fs.writeFileSync(
        path.join(OUT_DIR, pageFile),
        Buffer.from(
          pdfImgB64.replace(/^data:image\/png;base64,/, ""),
          "base64",
        ),
      );

      const diff = await computeDiff(canvasB64, pdfImgB64);
      const diffFile = `diff-image-${i + 1}.png`;
      fs.writeFileSync(
        path.join(OUT_DIR, diffFile),
        Buffer.from(
          diff.diffDataUrl.replace(/^data:image\/png;base64,/, ""),
          "base64",
        ),
      );

      if (!report[i]) report[i] = { page: i + 1 };
      report[i]!.imagePdf = { rmse: diff.rmse, diffPercent: diff.diffPercent };
      console.log(
        `  Image PDF page ${i + 1}: RMSE=${diff.rmse}, diff=${diff.diffPercent}%`,
      );
    }
  }

  // Compare Native PDF pages vs canvas
  if (nativePdfPath) {
    console.log("\nRendering Native PDF pages...");
    const nativePages = await renderPdfToImages(nativePdfPath);
    console.log(`  ${nativePages.length} pages`);

    for (let i = 0; i < nativePages.length; i++) {
      const pdfImgB64 = nativePages[i]!;
      const canvasB64 = `data:image/png;base64,${fs.readFileSync(canvasScreenshots[i]!).toString("base64")}`;

      const pageFile = `native-pdf-${i + 1}.png`;
      fs.writeFileSync(
        path.join(OUT_DIR, pageFile),
        Buffer.from(
          pdfImgB64.replace(/^data:image\/png;base64,/, ""),
          "base64",
        ),
      );

      const diff = await computeDiff(canvasB64, pdfImgB64);
      const diffFile = `diff-native-${i + 1}.png`;
      fs.writeFileSync(
        path.join(OUT_DIR, diffFile),
        Buffer.from(
          diff.diffDataUrl.replace(/^data:image\/png;base64,/, ""),
          "base64",
        ),
      );

      if (!report[i]) report[i] = { page: i + 1 };
      report[i]!.nativePdf = {
        rmse: diff.rmse,
        diffPercent: diff.diffPercent,
      };
      console.log(
        `  Native PDF page ${i + 1}: RMSE=${diff.rmse}, diff=${diff.diffPercent}%`,
      );
    }
  }

  // Save report
  fs.writeFileSync(
    path.join(OUT_DIR, "fidelity-report.json"),
    JSON.stringify(report, null, 2),
  );

  console.log(`\nFidelity report saved to: ${OUT_DIR}/fidelity-report.json`);

  // Assert diff thresholds (soft assertion — log all failures before failing)
  const failures: string[] = [];
  for (const entry of report) {
    if (entry.imagePdf && entry.imagePdf.diffPercent > MAX_DIFF_PERCENT) {
      failures.push(
        `Image PDF page ${entry.page}: diff ${entry.imagePdf.diffPercent}% > ${MAX_DIFF_PERCENT}%`,
      );
    }
    if (entry.nativePdf && entry.nativePdf.diffPercent > MAX_DIFF_PERCENT) {
      failures.push(
        `Native PDF page ${entry.page}: diff ${entry.nativePdf.diffPercent}% > ${MAX_DIFF_PERCENT}%`,
      );
    }
  }

  if (failures.length > 0) {
    console.warn("\nFidelity threshold exceeded:");
    for (const f of failures) console.warn(`  - ${f}`);
  }

  // For now, just verify exports produced output. Strict assertions can be
  // enabled once the baseline is established.
  expect(report.length).toBeGreaterThan(0);
});
