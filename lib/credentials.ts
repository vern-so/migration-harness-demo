// Source API credential handling for the demo's API-extractor flow.
//
// When a migration imports from a source's API (instead of uploaded files), the
// managed agent pauses and asks the end-customer for that source's credentials.
// The request — connection id, source name, and a connector credential schema —
// arrives two ways, both surfaced here as one canonical `CredentialPrompt`:
//   1. live, as a thread `request_input` event whose `data.kind` is
//      "source_credentials" (camelCase: connectionId, sourceKey, credentialSchema…)
//   2. on a polled run, as `credential_request` when `blocked_reason` is
//      "credentials" (snake_case: connection_id, source_key, schema…)
// The secret values are submitted to POST .../runs/{run_id}/credentials and are
// never echoed back; the schema here only describes which fields to collect.

import type { CredentialRequest } from "./types";

export type CredentialField = {
  name: string;
  label: string;
  required: boolean;
  secret: boolean;
  help?: string;
  // A schema `const` (e.g. a fixed auth_type) — collected automatically, not shown.
  constValue?: unknown;
};

export type CredentialMethod = { title: string | null; fields: CredentialField[] };

export type CredentialGuidance = {
  summary?: string;
  steps?: string[];
  links?: { label: string; url: string }[];
};

// One canonical credential ask, normalized from either source shape above.
export type CredentialPrompt = {
  connectionId: string;
  sourceKey: string;
  sourceName: string;
  reason?: string;
  guidance?: CredentialGuidance;
  schema: unknown;
};

// ---- schema → fields ------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function schemaProperties(schema: Record<string, unknown>): Record<string, unknown> {
  return isRecord(schema.properties) ? schema.properties : {};
}
function schemaRequired(schema: Record<string, unknown>): Set<string> {
  return new Set(
    Array.isArray(schema.required) ? schema.required.filter((v): v is string => typeof v === "string") : [],
  );
}
function recordsOf(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter(isRecord) : [];
}

// Each authentication method (a oneOf/anyOf branch, or the schema itself).
export function credentialMethods(schema: unknown): CredentialMethod[] {
  const root = isRecord(schema) ? schema : {};
  const branches = [...recordsOf(root.oneOf), ...recordsOf(root.anyOf)];
  const variants = branches.length > 0 ? branches : [root];
  return variants
    .map((variant) => {
      const required = schemaRequired(variant);
      const props = schemaProperties(variant);
      const fields: CredentialField[] = Object.entries(props).map(([name, raw]) => {
        const def = isRecord(raw) ? raw : {};
        return {
          name,
          label: str(def.title) ?? name,
          required: required.has(name),
          // Airbyte marks secrets with `airbyte_secret`; also treat obvious secret names.
          secret: def.airbyte_secret === true || /secret|password|token|key/i.test(name),
          constValue: def.const,
          help: str(def.description),
        };
      });
      return { title: str(variant.title) ?? null, fields };
    })
    .map((m) => ({ title: m.title, fields: m.fields.filter((f) => f.constValue === undefined) }))
    .filter((m) => m.fields.length > 0);
}

// All editable fields, merged across methods (used to gate the submit button).
export function credentialFields(schema: unknown): CredentialField[] {
  const byName = new Map<string, CredentialField>();
  for (const method of credentialMethods(schema)) {
    for (const field of method.fields) {
      const existing = byName.get(field.name);
      byName.set(field.name, {
        ...field,
        required: field.required || existing?.required === true,
        secret: field.secret || existing?.secret === true,
        help: field.help || existing?.help,
      });
    }
  }
  return [...byName.values()];
}

// Trim, drop empties — the object POSTed to .../credentials.
export function credentialsFromValues(values: Record<string, string>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values)
      .map(([k, v]) => [k, v.trim()] as const)
      .filter(([, v]) => v.length > 0),
  );
}

// ---- prompt normalization -------------------------------------------------

// A live thread `request_input` event carrying a source-credential ask, or null.
export function credentialPromptFromEvent(data: unknown): CredentialPrompt | null {
  if (!isRecord(data) || data.kind !== "source_credentials") return null;
  const guidance = isRecord(data.credentialGuidance) ? (data.credentialGuidance as CredentialGuidance) : undefined;
  return {
    connectionId: str(data.connectionId) ?? "",
    sourceKey: str(data.sourceKey) ?? "",
    sourceName: str(data.sourceName) ?? "this source",
    reason: str(data.reason),
    guidance,
    schema: data.credentialSchema,
  };
}

// The `credential_request` object on a polled, credentials-blocked run, or null.
export function credentialPromptFromRun(req: CredentialRequest | null | undefined): CredentialPrompt | null {
  if (!req) return null;
  return {
    connectionId: req.connection_id,
    sourceKey: req.source_key,
    sourceName: req.source_name || "this source",
    reason: req.reason,
    guidance: req.guidance as CredentialGuidance | undefined,
    schema: req.schema,
  };
}

// Best-effort source name → Airbyte connector key (e.g. "HubSpot" → "hubspot").
// The public API exposes source names, not connector keys; this slug matches the
// common Airbyte convention. An unknown key is rejected by the API with a clear
// error, so a wrong guess fails loudly rather than silently.
export function sourceKeyForName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
