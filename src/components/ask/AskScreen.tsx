"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { plural } from "@/lib/format";
import { LAST_ANSWER_KEY } from "@/lib/session";
import { useSettings } from "@/lib/settings";
import type { AskResponse } from "@/lib/types";
import { ClockIcon, SearchIcon } from "../Icons";
import PdfViewer from "../PdfViewer";
import { Card, ErrorState, LoadingText, Skeleton, WAKING_UP, cx } from "../ui";
import AnswerPanel from "./AnswerPanel";
import NotFound from "./NotFound";
import { Suggestions } from "./Suggestions";

const HISTORY_KEY = "niyam.history";

type State =
  | { status: "idle" }
  | { status: "loading"; question: string }
  | { status: "error"; question: string; message: string }
  | { status: "done"; response: AskResponse };

export default function AskScreen() {
  const { department, role, health } = useSettings();
  const [input, setInput] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const [history, setHistory] = useState<AskResponse[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const reqId = useRef(0);
  const viewerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const h = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring session history after hydration
      if (Array.isArray(h)) setHistory(h);
    } catch {}
  }, []);

  function remember(res: AskResponse) {
    setHistory((h) => {
      const next = [res, ...h.filter((x) => x.question !== res.question)].slice(0, 12);
      try {
        sessionStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    try {
      sessionStorage.setItem(LAST_ANSWER_KEY, JSON.stringify(res));
    } catch {}
  }

  function show(res: AskResponse) {
    setState({ status: "done", response: res });
    setSelected(res.found && res.citations.length ? res.citations[0].n : null);
    setNonce((n) => n + 1);
  }

  async function ask(question: string) {
    const q = question.trim();
    if (!q) {
      inputRef.current?.focus();
      return;
    }
    setInput(q);
    const id = ++reqId.current;
    setState({ status: "loading", question: q });
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const res = await api.ask({ question: q, department, role });
      if (id !== reqId.current) return;
      show(res);
      remember(res);
    } catch (e) {
      if (id !== reqId.current) return;
      setState({ status: "error", question: q, message: errorMessage(e) });
    }
  }

  function selectCitation(n: number) {
    setSelected(n);
    setNonce((x) => x + 1);
    // On small screens the viewer sits below the answer: bring it into view.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function reset() {
    reqId.current++;
    setState({ status: "idle" });
    setInput("");
    setSelected(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  const docCount = health?.documents;
  const searching = `Searching ${docCount ? plural(docCount, "document") : "the approved documents"}…`;

  // ------------------------------------------------------------------ empty state
  if (state.status === "idle") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 pb-16 pt-14 sm:pt-20">
        <h1 className="text-center text-3xl font-bold tracking-tight text-ink sm:text-[2.5rem] sm:leading-tight">
          Ask about government rules
        </h1>
        <p className="mt-3 max-w-xl text-center text-[17px] text-ink-2">
          Answers come only from approved documents. Every answer shows its source.
        </p>
        <SearchBox ref={inputRef} value={input} onChange={setInput} onSubmit={() => ask(input)} large autoFocus />
        <div className="mt-8 w-full">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Try a question</h2>
          <Suggestions onPick={ask} />
        </div>
        {history.length > 0 && (
          <div className="mt-8 w-full">
            <History items={history} onPick={show} />
          </div>
        )}
      </div>
    );
  }

  const question =
    state.status === "done" ? state.response.question : state.question;
  const response = state.status === "done" ? state.response : null;
  const selectedCitation = response?.citations.find((c) => c.n === selected) ?? null;

  return (
    <div className="mx-auto w-full max-w-[1500px] flex-1 px-4 pb-10 pt-5 sm:px-6">
      <div className="mb-5 flex items-center gap-3">
        <SearchBox ref={inputRef} value={input} onChange={setInput} onSubmit={() => ask(input)} />
        <button
          type="button"
          onClick={reset}
          className="hidden min-h-12 shrink-0 rounded-[var(--radius-ctl)] px-3 text-[15px] font-medium text-ink-2 hover:bg-sunken hover:text-ink sm:block"
        >
          New question
        </button>
      </div>

      {state.status === "loading" && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Card className="space-y-5 p-6">
            <p className="text-lg font-semibold text-ink">{question}</p>
            <LoadingText
              messages={[searching, "Reading the relevant rules…", "Checking every source…"]}
              slowMessage={WAKING_UP}
            />
            <div className="space-y-2.5 pt-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-3/5" />
            </div>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </Card>
          <div className="hidden min-h-[60vh] flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-6 lg:flex">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="w-full flex-1" />
          </div>
        </div>
      )}

      {state.status === "error" && (
        <div className="mx-auto max-w-2xl space-y-4">
          <p className="text-lg font-semibold text-ink">{question}</p>
          <ErrorState message={state.message} onRetry={() => ask(state.question)} />
        </div>
      )}

      {response && !response.found && (
        <div className="mx-auto max-w-2xl space-y-6">
          <NotFound response={response} onPick={ask} />
          {history.length > 1 && <History items={history} onPick={show} current={response.question} />}
        </div>
      )}

      {response && response.found && (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="space-y-6">
            <AnswerPanel
              key={response.log_id}
              response={response}
              selected={selected}
              onSelect={selectCitation}
            />
            {history.length > 1 && <History items={history} onPick={show} current={response.question} />}
          </div>
          <div
            ref={viewerRef}
            className="h-[78vh] scroll-mt-28 lg:sticky lg:top-[7.5rem] lg:h-[calc(100vh-9rem)]"
          >
            {selectedCitation && (
              <PdfViewer
                file={selectedCitation.document}
                title={selectedCitation.title}
                page={selectedCitation.page}
                quote={selectedCitation.quote}
                label={`[${selectedCitation.n}]`}
                nonce={nonce}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ pieces

function SearchBox({
  ref,
  value,
  onChange,
  onSubmit,
  large,
  autoFocus,
}: {
  ref: React.Ref<HTMLInputElement>;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  large?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className={cx(
        "flex w-full items-center gap-2 rounded-[14px] border border-line-strong bg-surface pl-4 pr-1.5 transition-shadow",
        "focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--color-accent-soft)]",
        large ? "mt-8 min-h-16 shadow-[0_8px_30px_-16px_rgba(15,94,110,0.35)]" : "min-h-12",
      )}
    >
      <SearchIcon className="shrink-0 text-ink-3" width={large ? 22 : 18} height={large ? 22 : 18} />
      <label htmlFor="ask-input" className="sr-only">
        Your question
      </label>
      <input
        id="ask-input"
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask about leave, pension, DA, office procedure…"
        autoComplete="off"
        autoFocus={autoFocus}
        className={cx(
          "min-w-0 flex-1 bg-transparent text-ink placeholder:text-ink-3 focus:outline-none focus-visible:outline-none",
          large ? "py-4 text-lg" : "py-2.5 text-base",
        )}
      />
      <button
        type="submit"
        className={cx(
          "shrink-0 rounded-[10px] bg-accent font-semibold text-white transition-colors hover:bg-accent-strong",
          large ? "min-h-12 px-6 text-base" : "min-h-9 px-4 text-[15px]",
        )}
      >
        Ask
      </button>
    </form>
  );
}

function History({
  items,
  onPick,
  current,
}: {
  items: AskResponse[];
  onPick: (r: AskResponse) => void;
  current?: string;
}) {
  const list = items.filter((i) => i.question !== current);
  if (!list.length) return null;
  return (
    <section aria-labelledby="history-h">
      <h2 id="history-h" className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-ink-3">
        <ClockIcon width={15} height={15} /> Earlier in this session
      </h2>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-ctl)] border border-line bg-surface">
        {list.map((r) => (
          <li key={r.log_id || r.question}>
            <button
              type="button"
              onClick={() => onPick(r)}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[15px] text-ink hover:bg-sunken"
            >
              <span className="truncate">{r.question}</span>
              <span className={cx("shrink-0 text-xs font-medium", r.found ? "text-ok" : "text-ink-3")}>
                {r.found ? plural(r.citations.length, "source") : "Not found"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
