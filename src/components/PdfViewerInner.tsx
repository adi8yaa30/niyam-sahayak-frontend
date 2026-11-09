"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { findQuote, renderItem, type MatchResult } from "@/lib/highlight";
import { pdfUrl } from "@/lib/api";
import { ChevronLeft, ChevronRight, ExternalIcon, InfoIcon, MinusIcon, PlusIcon, DocIcon } from "./Icons";
import { Skeleton, cx } from "./ui";

// Worker and data files are copied to /public/pdfjs by scripts/copy-pdfjs-assets.mjs (postinstall).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
const PDF_OPTIONS = {
  cMapUrl: "/pdfjs/cmaps/",
  standardFontDataUrl: "/pdfjs/standard_fonts/",
  wasmUrl: "/pdfjs/wasm/",
  iccUrl: "/pdfjs/iccs/",
};

const ZOOMS = [0.75, 1, 1.25, 1.5, 1.75, 2];

type PdfDoc = Parameters<NonNullable<React.ComponentProps<typeof Document>["onLoadSuccess"]>>[0];
type TextContent = Parameters<NonNullable<React.ComponentProps<typeof Page>["onGetTextSuccess"]>>[0];

export interface PdfViewerProps {
  file: string;
  title?: string;
  /** Page to open (1-based). */
  page?: number;
  /** Quote to highlight on that page. */
  quote?: string;
  /** Label for the highlighted source, e.g. "[1]". */
  label?: string;
  /** Change this to re-jump to `page` even if file/page didn't change (e.g. same pill clicked again). */
  nonce?: number;
  className?: string;
}

function textItems(tc: TextContent): string[] {
  return tc.items.map((it) => ("str" in it ? it.str : ""));
}

export default function PdfViewerInner({ file, title, page = 1, quote, label, nonce = 0, className }: PdfViewerProps) {
  const url = useMemo(() => pdfUrl(file), [file]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [pdf, setPdf] = useState<PdfDoc | null>(null);
  const [current, setCurrent] = useState(page);
  const [loadError, setLoadError] = useState(false);
  // Text of the page currently shown; keyed so a stale page never paints marks onto another page.
  const [pageText, setPageText] = useState<{ key: string; items: string[] } | null>(null);
  const [elsewhere, setElsewhere] = useState<number | null>(null);
  // True when the viewer should bring the highlighted quote into view after the next text-layer paint.
  const [pendingScroll, setPendingScroll] = useState(true);

  // Jump to the requested page whenever the target changes.
  const target = `${file}|${page}|${quote ?? ""}|${nonce}`;
  const [lastTarget, setLastTarget] = useState(target);
  if (target !== lastTarget) {
    setLastTarget(target);
    setCurrent(page);
    setElsewhere(null);
    setPendingScroll(true);
  }
  const [lastFile, setLastFile] = useState(file);
  if (file !== lastFile) {
    setLastFile(file);
    setNumPages(0);
    setPdf(null);
    setLoadError(false);
    setPageText(null);
  }

  // Fit the page to the panel width.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(([entry]) => {
      clearTimeout(t);
      t = setTimeout(() => setWidth(Math.floor(entry.contentRect.width)), 80);
    });
    ro.observe(el);
    setWidth(Math.floor(el.clientWidth));
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, []);

  const pageKey = `${file}|${current}`;
  const items = pageText?.key === pageKey ? pageText.items : null;
  const activeMatch: MatchResult | null = useMemo(() => {
    if (!items) return null;
    if (!quote) return { kind: "none", ranges: new Map() };
    return findQuote(items, quote);
  }, [items, quote]);

  const onGetText = useCallback(
    (tc: TextContent) => setPageText({ key: pageKey, items: textItems(tc) }),
    [pageKey],
  );

  const renderer = useCallback(
    ({ str, itemIndex }: { str: string; itemIndex: number }) => {
      if (!activeMatch || activeMatch.kind === "none") return renderItem(str, undefined, false);
      const range = activeMatch.ranges.get(itemIndex);
      const first = range !== undefined && itemIndex === Math.min(...activeMatch.ranges.keys());
      return renderItem(str, range, first);
    },
    [activeMatch],
  );

  // After the text layer paints with marks, bring the first mark into view.
  // Read through refs so this callback stays stable: a new identity would make react-pdf repaint the text layer.
  const pendingRef = useRef(pendingScroll);
  const matchRef = useRef(activeMatch);
  useLayoutEffect(() => {
    pendingRef.current = pendingScroll;
    matchRef.current = activeMatch;
  });
  const onTextLayer = useCallback(() => {
    const box = scrollRef.current;
    if (!box || !pendingRef.current || !matchRef.current) return;
    const mark = box.querySelector<HTMLElement>("mark.quote-mark-first");
    pendingRef.current = false;
    setPendingScroll(false);
    if (!mark) {
      box.scrollTo({ top: 0 });
      return;
    }
    const b = box.getBoundingClientRect();
    const m = mark.getBoundingClientRect();
    box.scrollTo({ top: box.scrollTop + (m.top - b.top) - b.height * 0.3, behavior: "smooth" });
  }, []);

  // If the quote isn't on the cited page, look for it on the other pages and offer a jump.
  useEffect(() => {
    if (!pdf || !quote || current !== page || activeMatch?.kind !== "none") return;
    let cancelled = false;
    (async () => {
      for (let p = 1; p <= pdf.numPages; p++) {
        if (p === page) continue;
        try {
          const tc = await (await pdf.getPage(p)).getTextContent();
          if (cancelled) return;
          if (findQuote(textItems(tc as TextContent), quote).kind !== "none") {
            setElsewhere(p);
            return;
          }
        } catch {
          return;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, quote, page, current, activeMatch?.kind]);

  const go = (p: number) => {
    if (p < 1 || (numPages && p > numPages)) return;
    setPendingScroll(true);
    setCurrent(p);
  };

  const zoomIdx = ZOOMS.indexOf(zoom);
  const pageWidth = width ? Math.max(240, (width - 32) * zoom) : undefined;
  const onCitedPage = current === page && !!quote;

  return (
    <section
      aria-label={title ? `Document viewer: ${title}` : "Document viewer"}
      className={cx("flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface", className)}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <DocIcon className="shrink-0 text-accent" />
          <h2 className="truncate text-[15px] font-semibold text-ink" title={title || file}>
            {title || file}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <IconBtn label="Previous page" onClick={() => go(current - 1)} disabled={current <= 1}>
            <ChevronLeft />
          </IconBtn>
          <span className="min-w-[6.5rem] text-center text-sm tabular-nums text-ink-2" aria-live="polite">
            Page {current} of {numPages || "…"}
          </span>
          <IconBtn label="Next page" onClick={() => go(current + 1)} disabled={!numPages || current >= numPages}>
            <ChevronRight />
          </IconBtn>
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          <IconBtn label="Zoom out" onClick={() => setZoom(ZOOMS[Math.max(0, zoomIdx - 1)])} disabled={zoomIdx <= 0}>
            <MinusIcon />
          </IconBtn>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="min-h-9 min-w-[3.25rem] rounded-md px-1 text-sm tabular-nums text-ink-2 hover:bg-sunken"
            aria-label="Reset zoom to fit width"
            title="Fit width"
          >
            {Math.round(zoom * 100)}%
          </button>
          <IconBtn
            label="Zoom in"
            onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, zoomIdx + 1)])}
            disabled={zoomIdx >= ZOOMS.length - 1}
          >
            <PlusIcon />
          </IconBtn>
          <a
            href={`${url}#page=${current}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line-strong px-2.5 text-sm font-medium text-ink hover:border-accent hover:text-accent"
          >
            <ExternalIcon width={16} height={16} />
            <span className="hidden sm:inline">Open full PDF</span>
            <span className="sr-only sm:hidden">Open full PDF in a new tab</span>
          </a>
        </div>
      </div>

      {/* Highlight status */}
      {onCitedPage && activeMatch && (
        <div
          className={cx(
            "flex items-start gap-2 border-b px-4 py-2 text-sm",
            activeMatch.kind === "none" ? "border-warn-line bg-warn-soft text-ink" : "border-line bg-sunken text-ink-2",
          )}
          role="status"
        >
          {activeMatch.kind === "none" ? (
            <>
              <InfoIcon className="mt-0.5 shrink-0 text-warn" width={16} height={16} />
              <span className="min-w-0">
                Quote on this page: <q className="font-serif italic">{quote}</q>
                {elsewhere && (
                  <>
                    {" "}
                    <button type="button" onClick={() => go(elsewhere)} className="font-medium text-accent underline underline-offset-2">
                      It appears on page {elsewhere}. Go there
                    </button>
                  </>
                )}
              </span>
            </>
          ) : (
            <>
              <span aria-hidden className="mt-1 inline-block h-3 w-5 shrink-0 rounded-sm bg-[var(--color-mark-strong)]" />
              <span>
                {label ? `Source ${label}: ` : ""}
                {activeMatch.kind === "full" ? "quoted line highlighted on page " : "closest matching text highlighted on page "}
                {current}
              </span>
            </>
          )}
        </div>
      )}

      {/* Page */}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto bg-sunken p-4">
        {loadError ? (
          <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 text-center">
            <DocIcon width={32} height={32} className="text-ink-3" />
            <p className="font-semibold text-ink">Couldn&apos;t open this PDF here.</p>
            <p className="max-w-sm text-ink-2">
              The file may not be uploaded to the server yet. You can still try opening it in a new tab.
            </p>
          </div>
        ) : (
          <Document
            file={url}
            options={PDF_OPTIONS}
            suspense={false}
            onLoadSuccess={(doc) => {
              setPdf(doc);
              setNumPages(doc.numPages);
              if (current > doc.numPages) setCurrent(doc.numPages);
            }}
            onLoadError={() => setLoadError(true)}
            loading={<PageSkeleton text="Opening document…" />}
            error={null}
            className="mx-auto w-fit"
          >
            {pageWidth && (
              <Page
                key={`${file}-${current}`}
                pageNumber={current}
                width={pageWidth}
                suspense={false}
                customTextRenderer={renderer}
                onGetTextSuccess={onGetText}
                onRenderTextLayerSuccess={onTextLayer}
                loading={<PageSkeleton text={`Loading page ${current}…`} width={pageWidth} />}
                error={<p className="p-6 text-ink-2">This page couldn&apos;t be displayed.</p>}
                className="overflow-hidden rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.08),0_8px_24px_-12px_rgba(0,0,0,0.25)]"
              />
            )}
          </Document>
        )}
      </div>
    </section>
  );
}

function IconBtn({
  label,
  children,
  ...props
}: { label: string; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className="inline-flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-sunken hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function PageSkeleton({ text, width }: { text: string; width?: number }) {
  return (
    <div
      className="flex aspect-[1/1.414] flex-col gap-3 rounded-sm bg-surface p-8"
      style={{ width: width ?? 480, maxWidth: "100%" }}
      role="status"
    >
      <p className="mb-2 text-sm text-ink-3">{text}</p>
      <Skeleton className="h-4 w-1/2 self-center" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-11/12" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="mt-4 h-3 w-full" />
      <Skeleton className="h-3 w-10/12" />
    </div>
  );
}
