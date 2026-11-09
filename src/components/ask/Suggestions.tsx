"use client";

export const SUGGESTED: { q: string; lang?: string }[] = [
  { q: "Can an employee demand leave as a right?" },
  { q: "What is the current DA rate for Assam government employees?" },
  { q: "How is half pay leave earned?" },
  { q: "What is the work from home policy?" },
  // Assamese: "Can leave be demanded as a right?" Have a native speaker confirm the wording.
  { q: "ছুটি অধিকাৰ হিচাপে দাবী কৰিব পাৰিনে?", lang: "as" },
];

export function Suggestions({ onPick }: { onPick: (q: string) => void }) {
  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      {SUGGESTED.map((s) => (
        <li key={s.q}>
          <button
            type="button"
            lang={s.lang}
            onClick={() => onPick(s.q)}
            className="flex min-h-12 w-full items-center rounded-[var(--radius-ctl)] border border-line bg-surface px-4 py-3 text-left text-[15px] text-ink transition-colors hover:border-accent hover:text-accent"
          >
            {s.q}
          </button>
        </li>
      ))}
    </ul>
  );
}
