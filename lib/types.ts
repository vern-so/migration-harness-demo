// Shapes from the Vern Migration API (https://docs.vern.so/migration-api).

export type Source = {
  name: string;
  logo_url: string | null;
};

export type TemplateColumn = {
  name: string;
  description?: string | null;
  required?: boolean;
  unique?: boolean;
  desiredRule?: "none" | "ai" | "strict" | "link" | string;
  strictRule?: string;
  linkRule?: { templateId: string; columnName: string }[];
};

export type Template = {
  slug: string;
  name: string;
  description?: string | null;
  columns?: TemplateColumn[];
};

export type SampleCsvFile = {
  name: string;
  description?: string;
  csv: string;
};

export type Migration = {
  id: string;
  status: string;
  templates?: { slug: string; name: string }[];
};

export type RunKind = "generate" | "update" | "clarify" | "execute";

export type RunStatus =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "blocked"
  | "failed"
  | "canceled"
  | "completed"
  | string;

export type AgentQuestion = {
  id: string;
  question: string;
  context?: string | null;
  options?: { id: string; label: string }[];
  allowCustom?: boolean;
};

export type RunReport = {
  inserted?: number;
  invalidCellCount?: number;
  perSheet?: { templateName: string; sheetId: string; rowCount: number }[];
  // Optional per-column fill/distinct profile of sources vs. outputs (null when
  // the run predates coverage profiling).
  coverage?: Record<string, unknown> | null;
  [k: string]: unknown;
};

// A blocked run awaiting source API credentials (blocked_reason === "credentials").
// Carries the field schema + where-to-find-it guidance, never the secret values.
// Answered via POST .../runs/{run_id}/credentials — never the messages endpoint.
export type CredentialRequest = {
  connection_id: string;
  source_key: string;
  source_name: string;
  reason?: string;
  guidance?: string;
  schema: unknown;
};

// One event from the agent's activity thread (SSE stream or snapshot).
export type ThreadEvent = {
  sequence: number;
  type:
    | "message"
    | "thinking"
    | "status"
    | "tool_call"
    | "tool_result"
    | "task"
    | "request_input"
    | "prepared"
    | "preview"
    | "completed"
    | "error"
    | "done"
    | string;
  data: unknown;
  created_at?: string;
};

export type Run = {
  run_id: string;
  status: RunStatus;
  poll_url?: string;
  // When status is "blocked": "question" (with `questions`) or "credentials"
  // (with `credential_request`).
  blocked_reason?: "question" | "credentials" | string;
  questions?: AgentQuestion[];
  credential_request?: CredentialRequest | null;
  report?: RunReport;
  message?: string;
  error?: string;
  [k: string]: unknown;
};

export type DemoMigration = {
  id: string;
  prospect_slug: string;
  email: string | null;
  migration_id: string;
  current_run_id: string | null;
  generate_run_id: string | null;
  update_run_id: string | null;
  execute_run_id: string | null;
  run_kind: "generate" | "update" | "execute" | null;
  status: "created" | "mapping" | "awaiting_review" | "importing" | "blocked" | "completed" | "failed" | string;
  templates: string[];
  source: string | null;
  report: RunReport | null;
  resume_after: number | null;
  last_thread_sequence: number | null;
  // User answers (anchored to the thread sequence each followed). Persisted as a
  // workaround until the thread API exposes them; used to replay on resume.
  answers: { after: number; text: string }[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};
