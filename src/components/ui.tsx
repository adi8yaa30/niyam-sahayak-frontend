"use client";

// Shared building blocks. Source cards and citation pills are the product's visual signature:
// use these components everywhere (Ask, Draft, Summarise) so they stay consistent.

import { Fragment, useEffect, useState } from "react";
import { formatDate } from "@/lib/format";
import type { Citation, DocStatus } from "@/lib/types";
import { AlertIcon, DocSearchIcon, RefreshIcon } from "./Icons";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ------------------------------------------------------------------ status badge

export function StatusBadge({ status, size = "sm" }: { status: DocStatus | string; size?: "sm" | "xs" }) {
  const inForce = status !== "superseded";
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-2.5 py-0.5 text-[13px]" : "px-2 py-px text-xs",
        inForce ? "border-ok-line bg-ok-soft text-ok" : "border-warn-line bg-warn-soft text-warn",
      )}
    >
      <span aria-hidden className={cx("size-1.5 rounded-full", inForce ? "bg-ok" : "bg-warn")} />
      {inForce ? "In force" : "Superseded"}
    </span>
  );
}

// ------------------------------------------------------------------ citation pill

export function CitationPill({
  n,
  selected,
  onClick,
  title,
}: {
  n: number;
  selected?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`Source ${n}${title ? `: ${title}` : ""}`}
      title={title}
      className={cx(
        "mx-0.5 inline-flex h-[1.45em] min-w-[1.6em] translate-y-[-0.1em] items-center justify-center rounded-md border px-1",
        "align-middle font-mono text-[0.78em] font-semibold leading-none tabular-nums transition-colors",
        selected
          ? "border-accent bg-accent text-white"
          : "border-accent-line bg-accent-soft text-accent hover:border-accent hover:bg-accent hover:text-white",
      )}
    >
      {n}
    </button>
  );
}

/** Renders text with [1], [2], [1, 2] turned into clickable citation pills. */
export function AnswerText({
  text,
  citations,
  selected,
  onSelect,
}: {
  text: string;
  citations: Citation[];
  selected: number | null;
  onSelect: (n: number) => void;
}) {
  const parts = text.split(/(\[\s*\d+(?:\s*,\s*\d+)*\s*\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[\s*([\d\s,]+)\]$/);
        if (!m) return <Fragment key={i}>{part}</Fragment>;
        const nums = m[1].split(",").map((x) => Number(x.trim()));
        return (
          <span key={i} className="whitespace-nowrap">
            {nums.map((n) => {
              const c = citations.find((x) => x.n === n);
              if (!c) return <Fragment key={n}>[{n}]</Fragment>;
              return (
                <CitationPill key={n} n={n} selected={selected === n} onClick={() => onSelect(n)} title={c.title} />
              );
            })}
          </span>
        );
      })}
    </>
  );
}

// ------------------------------------------------------------------ source card

export function SourceCard({
  citation,
  selected,
  onSelect,
}: {
  citation: Citation;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const c = citation;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cx(
        "group relative flex w-full gap-3.5 rounded-[var(--radius-card)] border bg-surface p-4 text-left transition-all",
        selected
          ? "border-accent shadow-[0_0_0_1px_var(--color-accent)]"
          : "border-line hover:border-accent-line hover:shadow-sm",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "flex size-8 shrink-0 items-center justify-center rounded-md border font-mono text-sm font-semibold tabular-nums",
          selected ? "border-accent bg-accent text-white" : "border-accent-line bg-accent-soft text-accent",
        )}
      >
        {c.n}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <span className="font-semibold leading-snug text-ink">{c.title}</span>
          <StatusBadge status={c.status} size="xs" />
        </span>
        <span className="mt-0.5 block text-sm text-ink-3">
          {c.number ? `${c.number} · ` : ""}
          {formatDate(c.date)} · Page {c.page}
        </span>
        <span className="mt-2.5 block border-l-2 border-accent-line pl-3 font-serif text-[15.5px] italic leading-relaxed text-ink-2">
          &ldquo;{c.quote}&rdquo;
        </span>
        <span
          className={cx(
            "mt-2 block text-[13px] font-medium",
            selected ? "text-accent" : "text-ink-3 group-hover:text-accent",
          )}
        >
          {selected ? "Showing in viewer" : "View in document"}
        </span>
      </span>
    </button>
  );
}

// ------------------------------------------------------------------ generic bits

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cx("rounded-[var(--radius-card)] border border-line bg-surface", className)}>{children}</div>
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-ctl)] font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-55",
        size === "md" ? "min-h-11 px-4 text-[15px]" : "min-h-9 px-3 text-sm",
        variant === "primary" && "bg-accent text-white hover:bg-accent-strong",
        variant === "secondary" && "border border-line-strong bg-surface text-ink hover:border-accent hover:text-accent",
        variant === "ghost" && "text-ink-2 hover:bg-sunken hover:text-ink",
        className,
      )}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden />;
}

/** Text that rotates through messages while waiting. Every loading state has words, never a silent spinner. */
export function LoadingText({ messages, slowAfterMs = 15_000, slowMessage }: {
  messages: string[];
  slowAfterMs?: number;
  slowMessage?: string;
}) {
  const [i, setI] = useState(0);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, messages.length - 1)), 2200);
    const s = setTimeout(() => setSlow(true), slowAfterMs);
    return () => {
      clearInterval(t);
      clearTimeout(s);
    };
  }, [messages.length, slowAfterMs]);
  return (
    <div role="status" aria-live="polite" className="space-y-1.5">
      <p className="flex items-center gap-2.5 font-medium text-ink-2">
        <span className="relative flex size-2.5" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-50" />
          <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
        </span>
        <span key={i} className="animate-fade-in">{messages[i]}</span>
      </p>
      {slow && slowMessage && <p className="animate-fade-in pl-5 text-sm text-ink-3">{slowMessage}</p>}
    </div>
  );
}

export const WAKING_UP = "The server may be waking up, which can take up to a minute on first use.";

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-start gap-3 p-6">
      <div className="flex items-center gap-2.5 font-semibold text-ink">
        <AlertIcon className="text-warn" />
        {message || "Couldn't reach the assistant."}
      </div>
      <p className="text-ink-2">Check your connection and try again. Nothing you typed has been lost.</p>
      {onRetry && (
        <Button onClick={onRetry} variant="primary">
          <RefreshIcon /> Retry
        </Button>
      )}
    </Card>
  );
}

export function EmptyNote({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <DocSearchIcon width={32} height={32} className="text-ink-3" />
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="max-w-md text-ink-2">{children}</div>}
    </div>
  );
}

/** Copies text and briefly shows "Copied". */
export function useCopy() {
  const [copied, setCopied] = useState(false);
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return { copied, copy };
}
