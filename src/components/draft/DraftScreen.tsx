"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import type { AskResponse, Citation, DraftResponse, Template } from "@/lib/types";
import { LAST_ANSWER_KEY } from "@/lib/session";
import Drawer from "../Drawer";
import { CheckIcon, CopyIcon, DownloadIcon, InfoIcon, PenIcon } from "../Icons";
import PdfViewer from "../PdfViewer";
import { Button, Card, ErrorState, LoadingText, Skeleton, SourceCard, WAKING_UP, useCopy } from "../ui";

const LABELS: Record<string, string> = {
  name: "Employee name",
  designation: "Designation",
  office: "Office",
  leave_type: "Type of leave",
  from_date: "From",
  to_date: "To",
  days: "Number of days",
};

const PLACEHOLDERS: Record<string, string> = {
  name: "e.g. Smt. R. Das",
  designation: "e.g. Junior Assistant",
  office: "e.g. Deputy Commissioner, Kamrup (M)",
};

const LEAVE_TYPES = ["Earned leave", "Half pay leave", "Commuted leave", "Extraordinary leave", "Casual leave"];

const humanise = (f: string) => LABELS[f] ?? f.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const isDate = (f: string) => f.endsWith("_date");

/** "2024-11-09" -> "09.11.2024", the usual format in Assam government orders. */
const toOrderDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join(".") : iso);

function daysBetween(from: string, to: string): string {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (isNaN(a) || isNaN(b) || b < a) return "";
  return String(Math.round((b - a) / 86_400_000) + 1);
}

type Result = { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "done"; res: DraftResponse };

export default function DraftScreen() {
  const { department } = useSettings();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [tplError, setTplError] = useState("");
  const [tplAttempt, setTplAttempt] = useState(0);
  const [templateId, setTemplateId] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [daysTouched, setDaysTouched] = useState(false);
  const [result, setResult] = useState<Result>({ status: "idle" });
  const [text, setText] = useState("");
  const [fromAsk, setFromAsk] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Citation | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.templates().then(
      (t) => {
        if (cancelled) return;
        setTemplates(t);
        setTplError("");
        setTemplateId((cur) => cur || t[0]?.id || "");
      },
      (e) => !cancelled && setTplError(errorMessage(e)),
    );
    return () => {
      cancelled = true;
    };
  }, [tplAttempt]);

  // "Draft from this" on the Ask screen: carry the question over and guess the leave type.
  useEffect(() => {
    if (!window.location.search.includes("from=ask")) return;
    try {
      const last = JSON.parse(sessionStorage.getItem(LAST_ANSWER_KEY) || "null") as AskResponse | null;
      if (!last) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time prefill from the Ask screen
      setFromAsk(last.question);
      const q = last.question.toLowerCase();
      // Most specific first: "how is half pay leave earned?" is about half pay leave, not earned leave.
      const order = ["Half pay leave", "Commuted leave", "Extraordinary leave", "Casual leave", "Earned leave"];
      const guess = order.find((t) => q.includes(t.toLowerCase().replace(" leave", "")));
      if (guess) setFields((f) => ({ ...f, leave_type: f.leave_type || guess }));
    } catch {}
  }, []);

  const template = templates?.find((t) => t.id === templateId) ?? null;

  function setField(f: string, v: string) {
    setFields((prev) => {
      const next = { ...prev, [f]: v };
      if ((f === "from_date" || f === "to_date") && !daysTouched && template?.fields.includes("days")) {
        next.days = daysBetween(next.from_date ?? "", next.to_date ?? "") || prev.days || "";
      }
      return next;
    });
    if (f === "days") setDaysTouched(true);
  }

  async function generate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!template) return;
    setResult({ status: "loading" });
    const payload: Record<string, string> = {};
    for (const f of template.fields) payload[f] = isDate(f) ? toOrderDate(fields[f] ?? "") : (fields[f] ?? "").trim();
    try {
      const res = await api.draft({ template: template.id, fields: payload, department });
      setText(res.draft);
      setResult({ status: "done", res });
    } catch (err) {
      setResult({ status: "error", message: errorMessage(err) });
    }
  }

  const missing = template ? template.fields.filter((f) => !(fields[f] ?? "").trim()) : [];
  const closeViewer = useCallback(() => setViewing(null), []);

  return (
    <div className="mx-auto w-full max-w-[1300px] flex-1 px-4 pb-12 pt-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Draft an office order</h1>
      <p className="mt-1 max-w-2xl text-ink-2">
        Fill in the details. The governing rule is looked up in the approved documents and cited. You edit and sign; nothing is sent from here.
      </p>
      {fromAsk && (
        <p className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-accent-line bg-accent-soft px-3 py-1 text-sm text-accent">
          <PenIcon width={15} height={15} />
          <span className="truncate">Drafting after your question: {fromAsk}</span>
        </p>
      )}

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Form */}
        <Card className="p-5 lg:sticky lg:top-[7.5rem]">
          {tplError ? (
            <ErrorState message={tplError} onRetry={() => setTplAttempt((a) => a + 1)} />
          ) : !templates ? (
            <div className="space-y-3">
              <LoadingText messages={["Loading templates…"]} slowMessage={WAKING_UP} />
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11 w-full" />)}
            </div>
          ) : (
            <form onSubmit={generate} className="space-y-4">
              <Field label="Template" htmlFor="tpl">
                <select id="tpl" value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={inputCls}>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Field>
              {template && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                  {template.fields.map((f) => {
                    const id = `f-${f}`;
                    const half = isDate(f) || f === "days";
                    return (
                      <div key={f} className={half ? "col-span-1" : "col-span-2"}>
                        <Field label={humanise(f)} htmlFor={id}>
                          {f === "leave_type" ? (
                            <select id={id} value={fields[f] ?? ""} onChange={(e) => setField(f, e.target.value)} className={inputCls} required>
                              <option value="" disabled>Choose…</option>
                              {LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}
                            </select>
                          ) : (
                            <input
                              id={id}
                              type={isDate(f) ? "date" : f === "days" ? "number" : "text"}
                              min={f === "days" ? 1 : undefined}
                              value={fields[f] ?? ""}
                              onChange={(e) => setField(f, e.target.value)}
                              placeholder={PLACEHOLDERS[f]}
                              className={inputCls}
                              required
                            />
                          )}
                        </Field>
                      </div>
                    );
                  })}
                </div>
              )}
              <Button type="submit" variant="primary" className="w-full" disabled={result.status === "loading" || missing.length > 0}>
                <PenIcon /> {result.status === "loading" ? "Generating draft…" : "Generate draft"}
              </Button>
              {missing.length > 0 && (
                <p className="text-sm text-ink-3">Fill in all fields to generate. Still needed: {missing.map(humanise).join(", ")}.</p>
              )}
            </form>
          )}
        </Card>

        {/* Result */}
        <div className="min-w-0 space-y-5">
          {result.status === "idle" && (
            <div className="flex min-h-80 flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line-strong p-8 text-center">
              <PenIcon width={30} height={30} className="text-ink-3" />
              <p className="mt-3 font-semibold text-ink">Your draft will appear here</p>
              <p className="mt-1 max-w-sm text-ink-2">It will be editable, with the governing rule cited. Download it as Word or text when ready.</p>
            </div>
          )}
          {result.status === "loading" && (
            <Card className="space-y-4 p-6">
              <LoadingText messages={["Finding the governing rule…", "Filling in the template…", "Checking the citation…"]} slowMessage={WAKING_UP} />
              <Skeleton className="h-[420px] w-full" />
            </Card>
          )}
          {result.status === "error" && <ErrorState message={result.message} onRetry={() => generate()} />}
          {result.status === "done" && (
            <DraftResult res={result.res} text={text} setText={setText} onView={setViewing} fields={fields} />
          )}
        </div>
      </div>

      <Drawer open={!!viewing} onClose={closeViewer} label="Cited rule">
        {viewing && (
          <PdfViewer file={viewing.document} title={viewing.title} page={viewing.page} quote={viewing.quote} label={`[${viewing.n}]`} />
        )}
      </Drawer>
    </div>
  );
}

const inputCls =
  "min-h-11 w-full rounded-[var(--radius-ctl)] border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-ink-3 hover:border-accent focus:border-accent";

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink-2">{label}</label>
      {children}
    </div>
  );
}

const NOT_FOUND_RE = /(\[rule reference:[^\]]*\])/i;

function DraftResult({
  res,
  text,
  setText,
  onView,
  fields,
}: {
  res: DraftResponse;
  text: string;
  setText: (t: string) => void;
  onView: (c: Citation) => void;
  fields: Record<string, string>;
}) {
  const { copied, copy } = useCopy();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const baseName = `${(fields.leave_type || "draft").replace(/\s+/g, "_")}_${(fields.name || "order").replace(/[^\w]+/g, "_")}`.replace(/_+/g, "_");

  // Grow the textarea with its content, so the page scrolls instead of the box.
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight + 2}px`;
  }, [text]);

  function download(blob: Blob, name: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function downloadDocx() {
    const { Document, Packer, Paragraph, TextRun } = await import("docx");
    const doc = new Document({
      creator: "Niyam Sahayak (draft for review)",
      title: "Draft office order",
      sections: [
        {
          properties: { page: { margin: { top: 1200, bottom: 1200, left: 1300, right: 1300 } } },
          children: text.split("\n").map(
            (line, i) =>
              new Paragraph({
                // Office orders rely on spacing for the "Dated" and signature columns: keep a fixed-width font.
                children: [new TextRun({ text: line, font: "Courier New", size: 22, bold: i < 2 || line.trim() === "ORDER" })],
                spacing: { after: 40 },
              }),
          ),
        },
      ],
    });
    download(await Packer.toBlob(doc), `${baseName}.docx`);
  }

  const pieces = text.split(NOT_FOUND_RE);

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-accent-line bg-accent-soft p-4 text-[15px] text-ink">
        <InfoIcon className="mt-0.5 shrink-0 text-accent" />
        <p>{res.note}</p>
      </div>
      {!res.found && (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-warn-line bg-warn-soft p-4 text-[15px] text-ink">
          <InfoIcon className="mt-0.5 shrink-0 text-warn" />
          <p>No governing rule was found in the approved documents. The gap is marked in amber in the draft. Add the rule reference yourself before signing.</p>
        </div>
      )}

      <div className="paper rounded-[4px] border border-line px-5 py-8 sm:px-12 sm:py-12">
        <label htmlFor="draft-text" className="sr-only">Draft text (editable)</label>
        {/* Highlight layer under a transparent textarea: marks the "[rule reference: not found…]" gap in amber. */}
        <div className="relative font-mono text-[14.5px] leading-[1.7]">
          <div aria-hidden className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words p-1 text-transparent">
            {pieces.map((p, i) =>
              NOT_FOUND_RE.test(p) ? (
                <mark key={i} className="rounded-sm bg-warn-soft text-transparent shadow-[0_0_0_2px_var(--color-warn-line)]">{p}</mark>
              ) : (
                <span key={i}>{p}</span>
              ),
            )}
            {"\n"}
          </div>
          <textarea
            id="draft-text"
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck
            className="relative block w-full resize-none overflow-hidden whitespace-pre-wrap break-words bg-transparent p-1 text-ink focus:outline-none focus-visible:outline-none"
          />
        </div>
      </div>
      <p className="-mt-2 flex items-center gap-1.5 text-sm text-ink-3">
        <PenIcon width={14} height={14} /> Click anywhere in the draft to edit it.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => copy(text)}>
          {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copied" : "Copy"}
        </Button>
        <Button onClick={downloadDocx}>
          <DownloadIcon /> Download .docx
        </Button>
        <Button onClick={() => download(new Blob([text], { type: "text/plain;charset=utf-8" }), `${baseName}.txt`)}>
          <DownloadIcon /> Download .txt
        </Button>
        {/* Deliberately no "Send" or "Submit": the officer stays in control. */}
      </div>

      {res.citations.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-3">Rule cited</h2>
          {res.citations.map((c) => (
            <SourceCard key={c.n} citation={c} onSelect={() => onView(c)} />
          ))}
        </section>
      )}
    </div>
  );
}
