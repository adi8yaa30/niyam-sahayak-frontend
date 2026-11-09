"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { deptLabel, formatDate, plural } from "@/lib/format";
import type { LibraryDoc, SummaryResponse } from "@/lib/types";
import { ArrowLeft, CheckIcon, DownloadIcon, InfoIcon, SparkIcon } from "../Icons";
import PdfViewer from "../PdfViewer";
import { Button, Card, EmptyNote, ErrorState, LoadingText, Skeleton, StatusBadge, WAKING_UP, cx } from "../ui";

type DocLoad = { status: "loading" } | { status: "error"; message: string } | { status: "done"; doc: LibraryDoc | null; all: LibraryDoc[] };
type SumState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; summary: SummaryResponse };

export default function DocDetail({ params }: { params: Promise<{ file: string }> }) {
  const { file: raw } = use(params);
  const file = decodeURIComponent(raw);
  const [load, setLoad] = useState<DocLoad>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [sum, setSum] = useState<SumState>({ status: "idle" });
  const [jump, setJump] = useState<{ page: number; quote?: string; nonce: number }>({ page: 1, nonce: 0 });

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start of a fetch
    setLoad({ status: "loading" });
    // All libraries, so a link to any document works whatever department is selected.
    api.documents(null).then(
      (all) => !cancelled && setLoad({ status: "done", doc: all.find((d) => d.file === file) ?? null, all }),
      (e) => !cancelled && setLoad({ status: "error", message: errorMessage(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [file, attempt]);

  async function summarise() {
    setSum({ status: "loading" });
    try {
      setSum({ status: "done", summary: await api.summarise(file) });
    } catch (e) {
      setSum({ status: "error", message: errorMessage(e) });
    }
  }

  function goTo(page: number | null, quote?: string) {
    if (!page) return;
    setJump((j) => ({ page, quote, nonce: j.nonce + 1 }));
  }

  const doc = load.status === "done" ? load.doc : null;
  const title = doc?.title ?? file;
  const byFile = load.status === "done" ? new Map(load.all.map((d) => [d.file, d])) : new Map<string, LibraryDoc>();

  return (
    <div className="mx-auto w-full max-w-[1500px] flex-1 px-4 pb-10 pt-6 sm:px-6">
      <Link href="/library" className="inline-flex min-h-9 items-center gap-1.5 rounded-md text-[15px] font-medium text-accent hover:underline">
        <ArrowLeft width={16} height={16} /> Back to library
      </Link>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-5">
          {load.status === "loading" && (
            <Card className="space-y-3 p-6">
              <LoadingText messages={["Loading document details…"]} slowMessage={WAKING_UP} />
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-24 w-full" />
            </Card>
          )}
          {load.status === "error" && <ErrorState message={load.message} onRetry={() => setAttempt((a) => a + 1)} />}
          {load.status === "done" && !doc && (
            <Card>
              <EmptyNote title="This document isn't in the library">
                It may have been removed or renamed. <Link href="/library" className="text-accent underline">See all documents</Link>.
              </EmptyNote>
            </Card>
          )}
          {doc && (
            <Card className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="text-xl font-bold leading-snug tracking-tight text-ink sm:text-2xl">{doc.title}</h1>
                <StatusBadge status={doc.status} />
              </div>
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px]">
                <Meta k="Number" v={doc.number || "—"} />
                <Meta k="Date" v={formatDate(doc.date)} />
                <Meta k="Type" v={doc.type || "—"} />
                <Meta k="Department" v={doc.department || "—"} />
                <Meta k="Library" v={deptLabel(doc.library)} />
                <Meta k="Indexed" v={plural(doc.pages_indexed, "page")} />
                <Meta k="File" v={<span className="break-all font-mono text-sm">{doc.file}</span>} />
              </dl>
              {doc.replaced_by && (
                <p className="mt-4 rounded-[var(--radius-ctl)] border border-warn-line bg-warn-soft p-3 text-[15px] text-ink">
                  Superseded. Replaced by{" "}
                  <Link className="font-medium text-accent underline" href={`/library/${encodeURIComponent(doc.replaced_by)}`}>
                    {byFile.get(doc.replaced_by)?.title ?? doc.replaced_by}
                  </Link>
                </p>
              )}
              {doc.replaces.length > 0 && (
                <div className="mt-4 text-[15px] text-ink-2">
                  Replaces:
                  <ul className="mt-1 list-disc pl-5">
                    {doc.replaces.map((f) => (
                      <li key={f}>
                        <Link className="text-accent underline" href={`/library/${encodeURIComponent(f)}`}>
                          {byFile.get(f)?.title ?? f}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {sum.status !== "done" && (
                <Button variant="primary" className="mt-5" onClick={summarise} disabled={sum.status === "loading"}>
                  <SparkIcon /> {sum.status === "loading" ? "Summarising…" : "Summarise"}
                </Button>
              )}
            </Card>
          )}

          {sum.status === "loading" && (
            <Card className="space-y-4 p-6">
              <LoadingText
                messages={["Reading the document…", "Picking out dates, amounts and deadlines…", "Checking each detail against its page…"]}
                slowMessage={WAKING_UP}
              />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-40 w-full" />
            </Card>
          )}
          {sum.status === "error" && <ErrorState message={sum.message} onRetry={summarise} />}
          {sum.status === "done" && <Summary s={sum.summary} title={title} onPage={goTo} />}
        </div>

        <div className="h-[78vh] lg:sticky lg:top-[7.5rem] lg:h-[calc(100vh-9rem)]">
          {(load.status !== "done" || doc) && (
            <PdfViewer file={file} title={title} page={jump.page} quote={jump.quote} nonce={jump.nonce} />
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <dt className="text-ink-3">{k}</dt>
      <dd className="text-ink">{v}</dd>
    </>
  );
}

function Summary({ s, title, onPage }: { s: SummaryResponse; title: string; onPage: (p: number | null, q?: string) => void }) {
  function downloadCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Label", "Value", "Page", "Verified"],
      ...s.key_details.map((d) => [d.label, d.value, d.page ?? "", d.verified ? "yes" : "check manually"]),
    ];
    // BOM so Excel opens Assamese text correctly.
    const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${s.document.replace(/\.pdf$/i, "")}_key_details.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div className="animate-fade-in space-y-5">
      <Card className="p-5 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-3">Summary</h2>
        <p className="mt-2 text-[16.5px] leading-[1.75] text-ink">{s.summary}</p>
        {s.pages_used.length > 0 && (
          <p className="mt-3 text-sm text-ink-3">Based on {plural(s.pages_used.length, "page")} of {title}.</p>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="font-semibold text-ink">Key details</h2>
          <Button size="sm" onClick={downloadCsv} disabled={!s.key_details.length}>
            <DownloadIcon width={16} height={16} /> Download as CSV
          </Button>
        </div>
        {s.key_details.length === 0 ? (
          <p className="p-5 text-ink-2">No key details were found in this document.</p>
        ) : (
          <table className="w-full text-left text-[15px]">
            <thead className="bg-sunken text-[13px] font-semibold uppercase tracking-wide text-ink-3">
              <tr>
                <th scope="col" className="px-5 py-2.5">Detail</th>
                <th scope="col" className="px-3 py-2.5">Value</th>
                <th scope="col" className="px-3 py-2.5">Page</th>
                <th scope="col" className="px-5 py-2.5">Check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {s.key_details.map((d, i) => (
                <tr key={i} className="align-top">
                  <td className="px-5 py-3 text-ink-2">{d.label}</td>
                  <td className="px-3 py-3 font-medium text-ink">{d.value}</td>
                  <td className="px-3 py-3">
                    {d.page ? (
                      <button
                        type="button"
                        onClick={() => onPage(d.page, d.value)}
                        className="inline-flex min-h-8 min-w-10 items-center justify-center rounded-md border border-accent-line bg-accent-soft px-2 font-mono text-sm font-semibold text-accent hover:border-accent hover:bg-accent hover:text-white"
                        aria-label={`Show page ${d.page} in the viewer`}
                      >
                        p{d.page}
                      </button>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium", d.verified ? "text-ok" : "text-warn")}>
                      {d.verified ? <CheckIcon width={16} height={16} /> : <InfoIcon width={16} height={16} />}
                      {d.verified ? "Verified" : "Check manually"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
