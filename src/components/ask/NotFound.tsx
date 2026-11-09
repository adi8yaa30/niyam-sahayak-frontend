"use client";

import Link from "next/link";
import type { AskResponse } from "@/lib/types";
import { DocSearchIcon } from "../Icons";
import { Card } from "../ui";
import { Suggestions } from "./Suggestions";

/** Calm, neutral "not found" — this is the assistant being honest, not an error. */
export default function NotFound({ response, onPick }: { response: AskResponse; onPick: (q: string) => void }) {
  return (
    <div className="animate-fade-in space-y-6">
      <Card className="p-6 sm:p-8">
        <p className="text-sm font-medium text-ink-3">Your question</p>
        <h1 className="mt-0.5 text-lg font-semibold text-ink" lang={response.language === "Assamese" ? "as" : "en"}>
          {response.question}
        </h1>
        <div className="mt-5 flex gap-4 rounded-[var(--radius-ctl)] border border-line bg-sunken p-5">
          <DocSearchIcon width={30} height={30} className="shrink-0 text-ink-3" />
          <div>
            <p className="text-[17px] font-semibold text-ink">Not found in approved documents</p>
            <p className="mt-1 text-ink-2">
              Nothing in the current library answers this. Try rephrasing, or check the{" "}
              <Link href="/library" className="font-medium text-accent underline underline-offset-2">
                Library
              </Link>{" "}
              to see what&apos;s covered.
            </p>
            {response.source_check_failed && (
              <p className="mt-2 text-sm text-ink-3">
                A possible answer was found, but its quotes could not be matched to the documents, so it was withheld.
              </p>
            )}
          </div>
        </div>
      </Card>
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Try one of these</h2>
        <Suggestions onPick={onPick} />
      </div>
    </div>
  );
}
