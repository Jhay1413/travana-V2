import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { classifyPdfError, pagesToRender, pickCurrentPage, renderScale, type PdfErrorKind } from "../../lib/document-viewer";
import { loadPdfjs } from "./pdfjs-loader";

interface PageSize {
  width: number;
  height: number;
}

interface LoadedPdf {
  doc: PDFDocumentProxy;
  sizes: PageSize[];
}

/** Sizes are read for this many pages up front; later pages assume the first page's shape until they render. */
const SIZED_PAGES = 200;
/** Widest a page is drawn (CSS px) on a big screen; on phones the page fills the screen width. */
const MAX_PAGE_CSS_WIDTH = 900;
/** The scroll area's side padding in CSS px: the design's 12px inset. */
const SIDE_PADDING = 12;

async function readPageSizes(doc: PDFDocumentProxy): Promise<PageSize[]> {
  const sizes: PageSize[] = [];
  const known = Math.min(doc.numPages, SIZED_PAGES);
  for (let n = 1; n <= known; n += 1) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    sizes.push({ width: viewport.width, height: viewport.height });
    page.cleanup();
  }
  const first = sizes[0] ?? { width: 595, height: 842 };
  while (sizes.length < doc.numPages) sizes.push(first);
  return sizes;
}

function PdfPage({ doc, pageNumber, size, cssWidth, active }: { doc: PDFDocumentProxy; pageNumber: number; size: PageSize; cssWidth: number; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!active || cssWidth <= 0) {
      // Released: zero the backing store so a page far off-screen holds no pixel memory.
      canvas.width = 0;
      canvas.height = 0;
      return;
    }
    let cancelled = false;
    let task: RenderTask | undefined;
    setFailed(false);
    void (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const scale = renderScale({ cssWidth, pageWidth: size.width, pageHeight: size.height, devicePixelRatio: window.devicePixelRatio });
        const viewport = page.getViewport({ scale });
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        task = page.render({ canvas, viewport });
        await task.promise;
      } catch (err) {
        const name = typeof err === "object" && err !== null && "name" in err ? String((err as { name: unknown }).name) : "";
        if (!cancelled && name !== "RenderingCancelledException") setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [active, doc, pageNumber, cssWidth, size.width, size.height]);

  return (
    <div
      data-page={pageNumber}
      className="relative mx-auto w-full bg-white"
      style={{ maxWidth: MAX_PAGE_CSS_WIDTH, aspectRatio: `${size.width} / ${size.height}` }}
      data-testid={`pdf-page-${pageNumber}`}
    >
      <canvas ref={canvasRef} role="img" aria-label={`Page ${pageNumber}`} className="absolute inset-0 size-full" data-testid="pdf-canvas" />
      {failed && <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-[13px] text-[#4E5666]">This page couldn&apos;t be shown.</p>}
    </div>
  );
}

/**
 * A PDF drawn with PDF.js, page by page, in a vertically scrolling column that fills the screen width. Pages render
 * only while they are within a screen of the visible area (IntersectionObserver) and release their canvas when they
 * leave it, so a long file cannot exhaust memory. Nothing in the file runs or is fetched: there is no annotation layer
 * (links are not clickable), no scripting and no external resources. Closing destroys the PDF.js document and worker.
 */
export function PdfPages({ blob, onFailed }: { blob: Blob; onFailed: (kind: PdfErrorKind) => void }) {
  const [loaded, setLoaded] = useState<LoadedPdf | null>(null);
  const [live, setLive] = useState<number[]>([]);
  const [current, setCurrent] = useState(1);
  const [cssWidth, setCssWidth] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const onFailedRef = useRef(onFailed);
  onFailedRef.current = onFailed;

  // Load the document; destroy it (and its worker) when the viewer closes or the file changes.
  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    void (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const data = new Uint8Array(await blob.arrayBuffer());
        if (cancelled) return;
        // Only what is needed to draw pages: no XFA forms, no range/stream fetching (the bytes are already here).
        const task = pdfjs.getDocument({ data, enableXfa: false, disableRange: true, disableStream: true, disableAutoFetch: true, useWorkerFetch: false });
        destroy = () => void task.destroy().catch(() => undefined);
        const doc = await task.promise;
        const sizes = await readPageSizes(doc);
        if (cancelled) return;
        setLoaded({ doc, sizes });
      } catch (err) {
        if (!cancelled) onFailedRef.current(classifyPdfError(err));
      }
    })();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [blob]);

  // Track the width pages are drawn at.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !loaded) return;
    const measure = () => setCssWidth(Math.min(MAX_PAGE_CSS_WIDTH, Math.max(0, Math.floor(scroller.clientWidth - SIDE_PADDING * 2))));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [loaded]);

  // Which pages are near the screen (to render) and which is in the middle band (the "Page N of M" answer).
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !loaded) return;
    const pageCount = loaded.doc.numPages;
    const near = new Set<number>();
    const band = new Set<number>();
    const pageOf = (el: Element) => Number((el as HTMLElement).dataset.page);
    const nearObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = pageOf(e.target);
          if (e.isIntersecting) near.add(n);
          else near.delete(n);
        }
        const next = pagesToRender(near, pageCount);
        setLive((prev) => (prev.length === next.length && prev.every((n, i) => n === next[i]) ? prev : next));
      },
      { root: scroller, rootMargin: "100% 0px 100% 0px" },
    );
    const bandObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = pageOf(e.target);
          if (e.isIntersecting) band.add(n);
          else band.delete(n);
        }
        setCurrent((prev) => pickCurrentPage(band, prev, pageCount));
      },
      { root: scroller, rootMargin: "-45% 0px -45% 0px" },
    );
    scroller.querySelectorAll("[data-page]").forEach((el) => {
      nearObserver.observe(el);
      bandObserver.observe(el);
    });
    return () => {
      nearObserver.disconnect();
      bandObserver.disconnect();
    };
  }, [loaded]);

  const pageCount = loaded?.doc.numPages ?? 0;
  return (
    <>
      <div
        ref={scrollerRef}
        className="relative mt-3.5 min-h-0 flex-1 overflow-y-auto bg-[#0D2A4E] px-3 py-3"
        tabIndex={0}
        role="region"
        aria-label="Document pages"
        data-testid="pdf-scroller"
      >
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center" role="status" data-testid="viewer-doc-opening">
            <span className="text-[11px] uppercase tracking-[0.24em] text-white/70">Opening…</span>
          </div>
        )}
        {loaded && (
          <div className="flex flex-col gap-3">
            {loaded.sizes.map((size, i) => (
              <PdfPage key={i} doc={loaded.doc} pageNumber={i + 1} size={size} cssWidth={cssWidth} active={live.includes(i + 1)} />
            ))}
          </div>
        )}
      </div>
      <div className="px-6 pt-[18px] text-[10px] uppercase tracking-[0.3em] text-accent" data-testid="pdf-page-count" role="status">
        {loaded ? `Page ${current} of ${pageCount}` : ""}
      </div>
    </>
  );
}
