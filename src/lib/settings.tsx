"use client";

// Department + role (UI-only for the demo), and backend health. Stored in localStorage.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Department, Health, Role } from "./types";

interface Settings {
  department: Department | null;
  role: Role;
  setDepartment: (d: Department | null) => void;
  setRole: (r: Role) => void;
  /** null while loading; undefined when the backend couldn't be reached. */
  health: Health | null | undefined;
  ready: boolean;
}

const SettingsContext = createContext<Settings | null>(null);

const DEPT_KEY = "niyam.department";
const ROLE_KEY = "niyam.role";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [department, setDepartmentState] = useState<Department | null>(null);
  const [role, setRoleState] = useState<Role>("officer");
  const [ready, setReady] = useState(false);
  const [health, setHealth] = useState<Health | null | undefined>(null);

  useEffect(() => {
    try {
      const d = localStorage.getItem(DEPT_KEY);
      const r = localStorage.getItem(ROLE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage after hydration
      if (d === "assac" || d === "aasc") setDepartmentState(d);
      if (r === "officer" || r === "admin") setRoleState(r);
    } catch {
      /* storage unavailable */
    }
    setReady(true);
    // Ping /health on load: shows the document count and wakes a sleeping free-tier server early.
    api.health().then(setHealth, () => setHealth(undefined));
  }, []);

  const setDepartment = useCallback((d: Department | null) => {
    setDepartmentState(d);
    try {
      if (d) localStorage.setItem(DEPT_KEY, d);
      else localStorage.removeItem(DEPT_KEY);
    } catch {}
  }, []);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    try {
      localStorage.setItem(ROLE_KEY, r);
    } catch {}
  }, []);

  const value = useMemo(
    () => ({ department, role, setDepartment, setRole, health, ready }),
    [department, role, setDepartment, setRole, health, ready],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
