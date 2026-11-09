"use client";

import dynamic from "next/dynamic";
import type { PdfViewerProps } from "./PdfViewerInner";
import { Skeleton, cx } from "./ui";

// pdf.js needs the browser, so the viewer is loaded on the client only.
const Inner = dynamic(() => import("./PdfViewerInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-96 flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-6" role="status">
      <p className="text-sm text-ink-3">Preparing the document viewer…</p>
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-full min-h-72 w-full" />
    </div>
  ),
});

export default function PdfViewer(props: PdfViewerProps) {
  return <Inner {...props} className={cx("h-full", props.className)} />;
}
