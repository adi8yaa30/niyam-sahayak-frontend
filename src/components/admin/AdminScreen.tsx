"use client";

import { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { deptLabel, formatTime } from "@/lib/format";
import { useSettings } from "@/lib/settings";
import type { LogsResponse } from "@/lib/types";
import { FlagIcon, RefreshIcon, ThumbDownIcon, ThumbUpIcon, UploadIcon } from "../Icons";
import { Button, Card, EmptyNote, ErrorState, LoadingText, Skeleton, WAKING_UP, cx } from "../ui";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "done"; data: LogsResponse };

export default function AdminScreen() {
  const { role, setRole, ready } = useSettings();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (role !== "admin") return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start of a fetch
    setLoad((l) => (l.status === "done" ? l : { status: "loading" }));
    api.logs(50).then(
      (data) => !cancelled && setLoad({ status: "done", data }),
      (e) => !cancelled && setLoad({ status: "error", message: errorMessage(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [role, attempt]);

  const stats = useMemo(() => {
    if (load.status !== "done") return null;
    const asks = load.data.events.filter((e) => e.type === "ask");
    const found = asks.filter((e) => e.found).length;
    const fb = load.data.feedback;
    return {
      asks,
      total: asks.length,
      foundPct: asks.length ? Math.round((found / asks.length) * 100) : 0,
      notFoundPct: asks.length ? Math.round(((asks.length - found) / asks.length) * 100) : 0,
      up: fb.filter((f) => f.rating === "up").length,
      down: fb.filter((f) => f.rating === "down").length,
      reports: fb.filter((f) => f.rating === "report").length,
    };
  }, [load]);

  if (!ready) return null;

  if (role !== "admin") {
    return (
      <div className="mx-auto w-full max-w-xl flex-1 px-4 pt-16">
        <Card>
          <EmptyNote title="Admin view">
            <p>This page is for document stewards and administrators.</p>
            <Button variant="primary" className="mt-4" onClick={() => setRole("admin")}>
              Switch to Admin
            </Button>
          </EmptyNote>
        </Card>
      </div>
    );
  }

  const questionFor = (logId: string) =>
    load.status === "done" ? load.data.events.find((e) => e.id === logId)?.question : undefined;

  const feedback =
    load.status === "done"
      ? [...load.data.feedback].sort((a, b) => Number(b.rating === "report") - Number(a.rating === "report"))
      : [];

  return (
    <div className="mx-auto w-full max-w-[1300px] flex-1 px-4 pb-12 pt-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Admin</h1>
          <p className="mt-1 text-ink-2">How the assistant is being used, and what officers are reporting.</p>
        </div>
        <Button size="sm" onClick={() => setAttempt((a) => a + 1)}>
          <RefreshIcon width={16} height={16} /> Refresh
        </Button>
      </div>

      {load.status === "loading" && (
        <div className="mt-6 space-y-4">
          <LoadingText messages={["Loading recent activity…"]} slowMessage={WAKING_UP} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      )}
      {load.status === "error" && (
        <div className="mt-6">
          <ErrorState message={load.message} onRetry={() => setAttempt((a) => a + 1)} />
        </div>
      )}

      {load.status === "done" && stats && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Questions asked" value={String(stats.total)} note="Since the server last restarted" />
            <Stat label="Answered with sources" value={`${stats.foundPct}%`} note="Every answer cites a page" tone="ok" />
            <Stat label="Not found" value={`${stats.notFoundPct}%`} note="Honest refusals: gaps in the library" />
            <Card className="p-5">
              <p className="text-sm font-medium text-ink-3">Feedback</p>
              <div className="mt-2 flex items-center gap-5">
                <span className="flex items-center gap-1.5 text-3xl font-bold tabular-nums text-ink">
                  <ThumbUpIcon width={22} height={22} className="text-ok" /> {stats.up}
                  <span className="sr-only">helpful</span>
                </span>
                <span className="flex items-center gap-1.5 text-3xl font-bold tabular-nums text-ink">
                  <ThumbDownIcon width={22} height={22} className="text-ink-3" /> {stats.down}
                  <span className="sr-only">not helpful</span>
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-3">{stats.reports} problem report{stats.reports === 1 ? "" : "s"}</p>
            </Card>
          </div>

          <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card className="overflow-hidden">
              <h2 className="border-b border-line px-5 py-3.5 font-semibold text-ink">Recent questions</h2>
              {stats.asks.length === 0 ? (
                <EmptyNote title="No questions yet">Questions officers ask will appear here.</EmptyNote>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-[15px]">
                    <thead className="bg-sunken text-[13px] font-semibold uppercase tracking-wide text-ink-3">
                      <tr>
                        <th scope="col" className="px-5 py-2.5">Time</th>
                        <th scope="col" className="px-3 py-2.5">Role</th>
                        <th scope="col" className="px-3 py-2.5">Dept</th>
                        <th scope="col" className="px-3 py-2.5">Question</th>
                        <th scope="col" className="px-3 py-2.5">Found</th>
                        <th scope="col" className="px-5 py-2.5">Sources</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {stats.asks.map((e) => (
                        <tr key={e.id} className="align-top">
                          <td className="whitespace-nowrap px-5 py-3 text-sm text-ink-3">{formatTime(e.time)}</td>
                          <td className="px-3 py-3 capitalize text-ink-2">{e.role || "—"}</td>
                          <td className="px-3 py-3 text-ink-2">{deptLabel(e.department)}</td>
                          <td className="px-3 py-3 text-ink">{e.question}</td>
                          <td className="px-3 py-3">
                            <span
                              className={cx(
                                "inline-flex rounded-full border px-2 py-px text-xs font-medium",
                                e.found ? "border-ok-line bg-ok-soft text-ok" : "border-line-strong bg-sunken text-ink-2",
                              )}
                            >
                              {e.found ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="px-5 py-3 font-mono text-[13px] text-ink-2">
                            {e.sources?.length ? [...new Set(e.sources)].map((s) => <div key={s} className="break-all">{s}</div>) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <div className="space-y-6">
              <Card className="overflow-hidden">
                <h2 className="border-b border-line px-5 py-3.5 font-semibold text-ink">Feedback</h2>
                {feedback.length === 0 ? (
                  <p className="p-5 text-ink-2">No feedback yet.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {feedback.map((f, i) => {
                      const q = questionFor(f.log_id);
                      return (
                        <li key={i} className={cx("px-5 py-3.5", f.rating === "report" && "bg-warn-soft/50")}>
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={cx(
                                "inline-flex items-center gap-1.5 text-sm font-semibold",
                                f.rating === "report" ? "text-warn" : f.rating === "up" ? "text-ok" : "text-ink-2",
                              )}
                            >
                              {f.rating === "report" ? <FlagIcon width={15} height={15} /> : f.rating === "up" ? <ThumbUpIcon width={15} height={15} /> : <ThumbDownIcon width={15} height={15} />}
                              {f.rating === "report" ? "Problem reported" : f.rating === "up" ? "Helpful" : "Not helpful"}
                            </span>
                            <span className="text-xs text-ink-3">{formatTime(f.time)}</span>
                          </div>
                          {q && <p className="mt-1 text-sm text-ink-2">On: {q}</p>}
                          {f.note && <p className="mt-1.5 text-[15px] text-ink">&ldquo;{f.note}&rdquo;</p>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>

              <Card className="p-5">
                <h2 className="font-semibold text-ink">Uploading documents</h2>
                <p className="mt-1.5 text-[15px] text-ink-2">
                  In this prototype, documents are added by re-indexing. In the pilot, stewards upload here with number, date and status.
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <Button disabled aria-describedby="pilot-badge">
                    <UploadIcon /> Upload document
                  </Button>
                  <span id="pilot-badge" className="rounded-full border border-accent-line bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                    Pilot
                  </span>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "ok" }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-ink-3">{label}</p>
      <p className={cx("mt-1 text-3xl font-bold tabular-nums", tone === "ok" ? "text-ok" : "text-ink")}>{value}</p>
      <p className="mt-1 text-sm text-ink-3">{note}</p>
    </Card>
  );
}
