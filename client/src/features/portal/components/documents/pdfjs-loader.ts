import type * as PdfJs from "pdfjs-dist";

export type PdfJsModule = typeof PdfJs;

let loading: Promise<PdfJsModule> | null = null;

/**
 * Loads PDF.js the first time a PDF is opened (a dynamic import, so the rest of the portal never pays for it). The worker
 * file is bundled by Vite from node_modules and served from this site: no CDN, no external request.
 */
export function loadPdfjs(): Promise<PdfJsModule> {
  if (!loading) {
    loading = Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
    // A failed load (offline mid-way) may be retried by the next open.
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}
