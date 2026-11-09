"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { formatDate, plural } from "@/lib/format";
import type { AskResponse, Rating } from "@/lib/types";
import { CheckIcon, CopyIcon, FlagIcon, PenIcon, ThumbDownIcon, ThumbUpIcon } from "../Icons";
import { AnswerText, Card, SourceCard, StatusBadge, cx, useCopy } from "../ui";

export default function AnswerPanel({
  response,
  selected,
  onSelect,
}: {
  response: AskResponse;
  selected: number | null;
  onSelect: (n: number) => void;
}) {
  const r = response;
  const lang = r.language === "Assamese" ? "as" : "en";
  return (
    <div className="animate-fade-in space-y-5">
      <Card className="p-5 sm:p-6">
        <p className="text-sm font-medium text-ink-3">Your question</p>
        <h1 className="mt-0.5 text-lg font-semibold leading-snug text-ink" lang={lang}>
          {r.question}
        </h1>
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-[17px] leading-[1.75] text-ink" lang={lang}>
            <AnswerText text={r.answer} citations={r.citations} selected={selected} onSelect={onSelect} />
          </p>
        </div>
        <Actions response={r} />
        <p className="mt-4 text-[13px] text-ink-3">
          Answered in {(r.latency_ms / 1000).toFixed(1)} s · {r.language}
        </p>
      </Card>

      <section aria-labelledby="sources-h" className="space-y-3">
        <h2 id="sources-h" className="text-sm font-semibold uppercase tracking-wide text-ink-3">
          Based on {plural(r.citations.length, "source")}
        </h2>
        {r.citations.map((c) => (
          <SourceCard key={c.n} citation={c} selected={selected === c.n} onSelect={() => onSelect(c.n)} />
        ))}
      </section>

      {r.replaces.length > 0 && (
        <section className="rounded-[var(--radius-card)] border border-warn-line bg-warn-soft/60 p-4">
          <h2 className="font-semibold text-ink">This replaces older orders:</h2>
          <ul className="mt-2 space-y-2">
            {r.replaces.map((d) => (
              <li key={d.document} className="flex flex-wrap items-center justify-between gap-2 text-[15px] text-ink-2">
                <span>
                  {d.title}
                  {d.date && <span className="text-ink-3"> · {formatDate(d.date)}</span>}
                </span>
                <StatusBadge status="superseded" size="xs" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Actions({ response }: { response: AskResponse }) {
  const router = useRouter();
  const { copied, copy } = useCopy();
  const [rated, setRated] = useState<Rating | null>(null);
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  async function rate(rating: Rating, text = "") {
    setSending(true);
    try {
      await api.feedback(response.log_id, rating, text);
      setRated(rating);
      setMsg(rating === "report" ? "Thank you. The problem has been reported to the document stewards." : "Thanks for the feedback.");
      setReporting(false);
    } catch {
      setMsg("Couldn't send feedback. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const plain =
    response.answer +
    "\n\nSources:\n" +
    response.citations.map((c) => `[${c.n}] ${c.title}, page ${c.page}: "${c.quote}"`).join("\n");

  const btn =
    "inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-ctl)] border px-3 text-sm font-medium transition-colors disabled:opacity-50";
  const idle = "border-line-strong bg-surface text-ink-2 hover:border-accent hover:text-accent";
  const on = "border-accent bg-accent-soft text-accent";

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={cx(btn, rated === "up" ? on : idle)} onClick={() => rate("up")}
          disabled={sending || !!rated} aria-pressed={rated === "up"} aria-label="Helpful">
          <ThumbUpIcon width={16} height={16} />
          <span className="sr-only sm:not-sr-only">Helpful</span>
        </button>
        <button type="button" className={cx(btn, rated === "down" ? on : idle)} onClick={() => rate("down")}
          disabled={sending || !!rated} aria-pressed={rated === "down"} aria-label="Not helpful">
          <ThumbDownIcon width={16} height={16} />
          <span className="sr-only sm:not-sr-only">Not helpful</span>
        </button>
        <button type="button" className={cx(btn, reporting || rated === "report" ? on : idle)}
          onClick={() => setReporting((x) => !x)} disabled={sending || !!rated} aria-expanded={reporting}>
          <FlagIcon width={16} height={16} /> Report a problem
        </button>
        <button type="button" className={cx(btn, idle)} onClick={() => router.push("/draft?from=ask")}>
          <PenIcon width={16} height={16} /> Draft from this
        </button>
        <button type="button" className={cx(btn, idle)} onClick={() => copy(plain)}>
          {copied ? <CheckIcon width={16} height={16} /> : <CopyIcon width={16} height={16} />}
          {copied ? "Copied" : "Copy answer"}
        </button>
      </div>

      {reporting && (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            rate("report", note.trim());
          }}
        >
          <label htmlFor="report-note" className="block text-sm font-medium text-ink-2">
            What&apos;s wrong with this answer?
          </label>
          <textarea
            id="report-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="For example: the quoted rule has been amended, or the page is wrong."
            className="w-full rounded-[var(--radius-ctl)] border border-line-strong bg-surface p-3 text-[15px] focus:border-accent"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={sending}
              className="min-h-10 rounded-[var(--radius-ctl)] bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-50">
              {sending ? "Sending…" : "Send report"}
            </button>
            <button type="button" onClick={() => setReporting(false)}
              className="min-h-10 rounded-[var(--radius-ctl)] px-3 text-sm font-medium text-ink-2 hover:bg-sunken">
              Cancel
            </button>
          </div>
        </form>
      )}
      {msg && (
        <p role="status" className="mt-2 text-sm text-ink-2">
          {msg}
        </p>
      )}
    </div>
  );
}
