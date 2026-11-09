"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { MOCK_MODE } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import type { Department, Role } from "@/lib/types";
import { InfoIcon } from "./Icons";
import { cx } from "./ui";

const NAV = [
  { href: "/", label: "Ask" },
  { href: "/library", label: "Library" },
  { href: "/draft", label: "Draft" },
  { href: "/admin", label: "Admin", admin: true },
];

export default function Header() {
  const { department, setDepartment, role, setRole, health } = useSettings();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex items-center gap-3 rounded-md py-1">
          <Logo />
          <span className="leading-tight">
            <span className="block text-[17px] font-bold tracking-tight text-ink">Niyam Sahayak</span>
            <span className="block text-xs text-ink-3">Trusted rules assistant · Government of Assam (prototype)</span>
          </span>
        </Link>

        <Suspense fallback={<NavLinks pathname={null} role={role} />}>
          <ActiveNav role={role} />
        </Suspense>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <span>Department</span>
            <select
              value={department ?? ""}
              onChange={(e) => setDepartment((e.target.value || null) as Department | null)}
              className="min-h-9 rounded-[var(--radius-ctl)] border border-line-strong bg-surface px-2.5 text-[15px] text-ink hover:border-accent"
            >
              <option value="">All</option>
              <option value="aasc">AASC</option>
              <option value="assac">ASSAC</option>
            </select>
          </label>

          <div className="flex items-center gap-2 text-sm text-ink-2" role="group" aria-label="Viewing as">
            <span>Viewing as</span>
            <div className="flex rounded-[var(--radius-ctl)] border border-line-strong p-0.5">
              {(["officer", "admin"] as Role[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={role === r}
                  onClick={() => setRole(r)}
                  className={cx(
                    "min-h-8 rounded-md px-3 text-sm font-medium capitalize transition-colors",
                    role === r ? "bg-accent text-white" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-warn-line/60 bg-warn-soft/70">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 text-[13px] text-ink-2 sm:px-6">
          <span className="flex items-center gap-1.5">
            <InfoIcon width={15} height={15} className="text-warn" />
            Prototype using public documents. Verify against the source before official use.
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-ink-3">
            {MOCK_MODE && (
              <span className="rounded border border-line-strong bg-surface px-1.5 py-px font-medium text-ink-2">
                Mock data
              </span>
            )}
            <span
              aria-hidden
              className={cx(
                "size-2 rounded-full",
                health ? "bg-ok" : health === null ? "bg-line-strong" : "bg-warn",
              )}
            />
            {health
              ? `${health.documents} documents · ${health.pieces} indexed pieces`
              : health === null
                ? "Connecting…"
                : "Assistant offline"}
          </span>
        </div>
      </div>
    </header>
  );
}

function ActiveNav({ role }: { role: Role }) {
  return <NavLinks pathname={usePathname()} role={role} />;
}

/** pathname is null while it streams in (dynamic routes): links render without an active state. */
function NavLinks({ pathname, role }: { pathname: string | null; role: Role }) {
  return (
    <nav aria-label="Main" className="order-3 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
      {NAV.filter((n) => !n.admin || role === "admin").map((n) => {
        const active = pathname !== null && (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href));
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "relative inline-flex min-h-10 items-center rounded-md px-3.5 text-[15px] font-medium transition-colors",
              active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-sunken hover:text-ink",
            )}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Logo() {
  // A simple seal: an open book inside a circle. No mascots.
  return (
    <span aria-hidden className="flex size-10 items-center justify-center rounded-full border-2 border-accent text-accent">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M12 6.5C10 5 7 4.6 4 5v13c3-.4 6 0 8 1.5 2-1.5 5-1.9 8-1.5V5c-3-.4-6 0-8 1.5z" />
        <path d="M12 6.5v13" />
      </svg>
    </span>
  );
}
