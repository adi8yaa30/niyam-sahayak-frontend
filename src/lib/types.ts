// Shapes returned by the Niyam Sahayak FastAPI backend. Do not change without changing the backend.

export type DocStatus = "in_force" | "superseded";
export type Department = "assac" | "aasc";
export type Role = "officer" | "admin";

export interface Health {
  status: string;
  documents: number;
  pieces: number;
  model: string;
}

export interface LibraryDoc {
  file: string;
  title: string;
  number: string;
  date: string;
  department: string;
  type: string;
  library: string; // "common" or a department id
  status: DocStatus;
  replaced_by: string | null;
  replaces: string[];
  pages_indexed: number;
  has_file: boolean;
}

export interface DocRef {
  document: string;
  title: string;
  number: string;
  date: string;
  status: DocStatus;
}

export interface Citation extends DocRef {
  n: number;
  page: number;
  quote: string;
}

export interface AskRequest {
  question: string;
  department: Department | null;
  role: Role;
}

export interface AskResponse {
  question: string;
  language: string; // "English" | "Assamese"
  found: boolean;
  answer: string;
  citations: Citation[];
  replaces: DocRef[];
  latency_ms: number;
  log_id: string;
  source_check_failed?: boolean;
}

export interface Template {
  id: string;
  name: string;
  fields: string[];
}

export interface DraftRequest {
  template: string;
  fields: Record<string, string>;
  department: Department | null;
}

export interface DraftResponse {
  draft: string;
  found: boolean;
  citations: Citation[];
  log_id: string;
  note: string;
}

export interface KeyDetail {
  label: string;
  value: string;
  page: number | null;
  verified: boolean;
}

export interface SummaryResponse extends DocRef {
  summary: string;
  key_details: KeyDetail[];
  pages_used: number[];
  log_id: string;
}

export type Rating = "up" | "down" | "report";

export interface LogEvent {
  id: string;
  time: string;
  type: string; // "ask" | "draft" | "summarise" | "feedback"
  role?: string | null;
  department?: string | null;
  question?: string;
  found?: boolean;
  answer?: string;
  sources?: string[];
  [key: string]: unknown;
}

export interface FeedbackEntry {
  log_id: string;
  rating: Rating;
  note: string | null;
  time: string;
}

export interface LogsResponse {
  events: LogEvent[];
  feedback: FeedbackEntry[];
}
