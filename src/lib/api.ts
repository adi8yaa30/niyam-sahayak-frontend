// One place for every backend call. If NEXT_PUBLIC_API_URL is empty, the mock backend is used.

import { mockApi } from "./mock";
import type {
  AskRequest,
  AskResponse,
  Department,
  DraftRequest,
  DraftResponse,
  Health,
  LibraryDoc,
  LogsResponse,
  Rating,
  SummaryResponse,
  Template,
} from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
export const MOCK_MODE = API_URL === "";

/** An error that is always safe to show to an officer (never raw JSON or a stack trace). */
export class ApiError extends Error {
  constructor(
    message: string,
    public kind: "network" | "timeout" | "server" | "client" = "server",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// The first call after Render's free tier has slept can take ~50 s, so allow plenty of time.
const SLOW_TIMEOUT_MS = 100_000;
const FAST_TIMEOUT_MS = 70_000;

async function request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init?.timeoutMs ?? FAST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new ApiError("The assistant took too long to respond.", "timeout");
    }
    throw new ApiError("Couldn't reach the assistant.", "network");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // FastAPI errors look like {"detail": "..."}; show the detail only if it's a plain sentence.
    let detail = "";
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* not JSON */
    }
    if (res.status >= 400 && res.status < 500 && detail) throw new ApiError(detail, "client");
    throw new ApiError("The assistant ran into a problem. Please try again.", "server");
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError("The assistant sent an unreadable response.", "server");
  }
}

const post = <T>(path: string, body: unknown, timeoutMs = SLOW_TIMEOUT_MS) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body), timeoutMs });

/** Mock mode errors should look exactly like real ones. */
async function wrapMock<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch {
    throw new ApiError("Couldn't reach the assistant.", "network");
  }
}

/** One source card per citation number: the model can return several quotes for the same source. */
function dedupeCitations<T extends { citations: { n: number }[] }>(res: T): T {
  const seen = new Set<number>();
  return { ...res, citations: res.citations.filter((c) => !seen.has(c.n) && seen.add(c.n)) };
}

export const api = {
  health: (): Promise<Health> =>
    MOCK_MODE ? wrapMock(mockApi.health()) : request("/health", { timeoutMs: SLOW_TIMEOUT_MS }),

  documents: (department: Department | null): Promise<LibraryDoc[]> =>
    MOCK_MODE
      ? wrapMock(mockApi.documents(department))
      : request(`/documents${department ? `?department=${encodeURIComponent(department)}` : ""}`, {
          timeoutMs: SLOW_TIMEOUT_MS,
        }),

  ask: (body: AskRequest): Promise<AskResponse> =>
    MOCK_MODE ? wrapMock(mockApi.ask(body)) : post<AskResponse>("/ask", body).then(dedupeCitations),

  templates: (): Promise<Template[]> =>
    MOCK_MODE ? wrapMock(mockApi.templates()) : request("/templates", { timeoutMs: SLOW_TIMEOUT_MS }),

  draft: (body: DraftRequest): Promise<DraftResponse> =>
    MOCK_MODE ? wrapMock(mockApi.draft(body)) : post<DraftResponse>("/draft", body).then(dedupeCitations),

  summarise: (document: string): Promise<SummaryResponse> =>
    MOCK_MODE ? wrapMock(mockApi.summarise(document)) : post("/summarise", { document }),

  feedback: (log_id: string, rating: Rating, note = ""): Promise<{ ok: boolean }> =>
    MOCK_MODE ? wrapMock(mockApi.feedback(log_id, rating, note)) : post("/feedback", { log_id, rating, note }, FAST_TIMEOUT_MS),

  logs: (limit = 50): Promise<LogsResponse> =>
    MOCK_MODE ? wrapMock(mockApi.logs(limit)) : request(`/logs?limit=${limit}`),
};

/** URL of a document's PDF, usable directly as the react-pdf source. */
export function pdfUrl(file: string): string {
  if (MOCK_MODE) {
    const known = [
      "ASSAC_Leave_Rules.pdf",
      "DA_Order_46_to_50_wef_2024.pdf",
      "DA_Order_42_to_46.pdf",
      "DA_Order_38_to_42.pdf",
      "Flood_Situation_Report_2024.pdf",
      "AASC_Office_Procedure_Manual.pdf",
    ];
    return known.includes(file) ? `/mock/${file}` : "/mock.pdf";
  }
  return `${API_URL}/documents/${encodeURIComponent(file)}/file`;
}

export function errorMessage(e: unknown): string {
  return e instanceof ApiError ? e.message : "Something went wrong. Please try again.";
}
