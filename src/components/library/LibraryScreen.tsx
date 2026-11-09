"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { deptLabel, formatDate, plural } from "@/lib/format";
import { useSettings } from "@/lib/settings";
import type { LibraryDoc } from "@/lib/types";
import Drawer from "../Drawer";
import { ArrowRight, DocIcon, SearchIcon, SparkIcon } from "../Icons";
import PdfViewer from "../PdfViewer";
import { Card, EmptyNote, ErrorState, LoadingText, Skeleton, StatusBadge, WAKING_UP, cx } from "../ui";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "done"; docs: LibraryDoc[] };

export default function LibraryScreen() {
  const { department, health, ready } = useSettings();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [viewing, setViewing] = useState<LibraryDoc | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start of a fetch
    setLoad({ status: "loading" });
    api.documents(department).then(
      (docs) => !cancelled && setLoad({ status: "done", docs }),
      (e) => !cancelled && setLoad({ status: "error", message: errorMessage(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [department, ready, attempt]);

  const docs = useMemo(() => (load.status === "done" ? load.docs : []), [load]);
  const byFile = useMemo(() => new Map(docs.map((d) => [d.file, d])), [docs]);
  const types = useMemo(() => [...new Set(docs.map((d) => d.type).filter(Boolean))].sort(), [docs]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs
      .filter((d) => !q || d.title.toLowerCase().includes(q) || d.file.toLowerCase().includes(q) || d.number.toLowerCase().includes(q))
      .filter((d) => !type || d.type === type)
      .filter((d) => !status || d.status === status)
      .sort((a, b) => Number(a.status !== "in_force") - Number(b.status !== "in_force"));
  }, [docs, query, type, status]);

  const closeViewer = useCallback(() => setViewing(null), []);

  return (
    <div className="mx-auto w-full max-w-[1300px] flex-1 px-4 pb-12 pt-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Library</h1>
          <p className="mt-1 text-ink-2">
            {load.status === "done" ? plural(docs.length, "document") : "Documents"}
            {health ? ` · ${health.pieces} indexed pieces` : ""}. The assistant answers only from these.
          </p>
        </div>
        <p className="text-sm text-ink-3">Showing: {department ? `Common + ${deptLabel(department)}` : "All libraries"}</p>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap gap-3">
        <label className="flex min-h-11 min-w-[16rem] flex-1 items-center gap-2 rounded-[var(--radius-ctl)] border border-line-strong bg-surface px-3 focus-within:border-accent">
          <SearchIcon className="text-ink-3" />
          <span className="sr-only">Search by title</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or number"
            className="min-w-0 flex-1 bg-transparent py-2 focus:outline-none focus-visible:outline-none"
          />
        </label>
        <Select label="Type" value={type} onChange={setType} options={[["", "All types"], ...types.map((t) => [t, t] as [string, string])]} />
        <Select
          label="Status"
          value={status}
          onChange={setStatus}
          options={[["", "Any status"], ["in_force", "In force"], ["superseded", "Superseded"]]}
        />
      </div>

      <div className="mt-5">
        {load.status === "loading" && (
          <Card className="space-y-4 p-6">
            <LoadingText messages={["Loading the document library…"]} slowMessage={WAKING_UP} />
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </Card>
        )}
        {load.status === "error" && <ErrorState message={load.message} onRetry={() => setAttempt((a) => a + 1)} />}
        {load.status === "done" && shown.length === 0 && (
          <Card>
            <EmptyNote title="No documents match these filters">Clear the search or choose a different type or status.</EmptyNote>
          </Card>
        )}
        {load.status === "done" && shown.length > 0 && (
          <>
            {/* Desktop table */}
            <Card className="hidden overflow-hidden lg:block">
              <table className="w-full text-left text-[15px]">
                <thead className="border-b border-line bg-sunken text-[13px] font-semibold uppercase tracking-wide text-ink-3">
                  <tr>
                    <th scope="col" className="px-4 py-3">Document</th>
                    <th scope="col" className="px-3 py-3">Type</th>
                    <th scope="col" className="px-3 py-3">Date</th>
                    <th scope="col" className="px-3 py-3">Department</th>
                    <th scope="col" className="px-3 py-3">Library</th>
                    <th scope="col" className="px-3 py-3">Status</th>
                    <th scope="col" className="px-3 py-3 text-right">Pages</th>
                    <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {shown.map((d) => (
                    <tr key={d.file} className={cx("align-top", d.status === "superseded" && "bg-canvas/60")}>
                      <td className="max-w-[28rem] px-4 py-3.5">
                        <Link href={`/library/${encodeURIComponent(d.file)}`} className="font-semibold text-ink hover:text-accent hover:underline">
                          {d.title}
                        </Link>
                        {d.number && <div className="text-sm text-ink-3">{d.number}</div>}
                        <Lineage doc={d} byFile={byFile} />
                      </td>
                      <td className="px-3 py-3.5 text-ink-2">{d.type || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-ink-2">{formatDate(d.date)}</td>
                      <td className="px-3 py-3.5 text-ink-2">{d.department || "—"}</td>
                      <td className="px-3 py-3.5 text-ink-2">{deptLabel(d.library)}</td>
                      <td className="px-3 py-3.5"><StatusBadge status={d.status} size="xs" /></td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-ink-2">{d.pages_indexed}</td>
                      <td className="px-4 py-3">
                        <RowActions doc={d} onView={() => setViewing(d)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Mobile / tablet cards */}
            <ul className="space-y-3 lg:hidden">
              {shown.map((d) => (
                <li key={d.file}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/library/${encodeURIComponent(d.file)}`} className="font-semibold text-ink hover:text-accent">
                        {d.title}
                      </Link>
                      <StatusBadge status={d.status} size="xs" />
                    </div>
                    <p className="mt-1 text-sm text-ink-3">
                      {[d.type, d.number, formatDate(d.date), d.department, `${deptLabel(d.library)} library`, plural(d.pages_indexed, "page")]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <Lineage doc={d} byFile={byFile} />
                    <div className="mt-3">
                      <RowActions doc={d} onView={() => setViewing(d)} />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Drawer open={!!viewing} onClose={closeViewer} label={viewing ? `PDF: ${viewing.title}` : "PDF"}>
        {viewing && <PdfViewer file={viewing.file} title={viewing.title} page={1} />}
      </Drawer>
    </div>
  );
}

function Lineage({ doc, byFile }: { doc: LibraryDoc; byFile: Map<string, LibraryDoc> }) {
  const replacedBy = doc.replaced_by ? byFile.get(doc.replaced_by) : null;
  return (
    <>
      {doc.replaced_by && (
        <p className="mt-1.5 text-sm text-warn">
          Replaced by{" "}
          <ArrowRight width={14} height={14} className="inline -translate-y-px" />{" "}
          <Link href={`/library/${encodeURIComponent(doc.replaced_by)}`} className="font-medium underline underline-offset-2 hover:text-accent">
            {replacedBy?.title ?? doc.replaced_by}
          </Link>
        </p>
      )}
      {doc.replaces.length > 0 && (
        <p className="mt-1.5 text-sm text-ink-3">Replaces {plural(doc.replaces.length, "older order")}</p>
      )}
    </>
  );
}

function RowActions({ doc, onView }: { doc: LibraryDoc; onView: () => void }) {
  const cls =
    "inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-ctl)] border border-line-strong bg-surface px-3 text-sm font-medium text-ink whitespace-nowrap hover:border-accent hover:text-accent disabled:opacity-50";
  return (
    <div className="flex flex-wrap justify-end gap-2 lg:flex-nowrap">
      <button type="button" className={cls} onClick={onView} disabled={!doc.has_file} title={doc.has_file ? undefined : "PDF not uploaded"}>
        <DocIcon width={16} height={16} /> View PDF
      </button>
      <Link href={`/library/${encodeURIComponent(doc.file)}`} className={cls}>
        <SparkIcon width={16} height={16} /> Summarise
      </Link>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-2">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 rounded-[var(--radius-ctl)] border border-line-strong bg-surface px-3 text-[15px] text-ink hover:border-accent"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
