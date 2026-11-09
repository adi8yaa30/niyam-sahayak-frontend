"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "./Icons";

/** Right-hand slide-over used to show a PDF without leaving the page. */
export default function Drawer({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      (lastFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={label}>
      <button
        type="button"
        aria-label="Close viewer"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/35"
      />
      <div className="animate-fade-in relative flex h-full w-full max-w-[920px] flex-col bg-canvas p-3 shadow-2xl sm:p-4">
        <div className="mb-2 flex justify-end">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-ctl)] px-3 text-[15px] font-medium text-ink-2 hover:bg-sunken hover:text-ink"
          >
            <CloseIcon /> Close
          </button>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
