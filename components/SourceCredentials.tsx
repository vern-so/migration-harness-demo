"use client";

import { useMemo, useState } from "react";
import {
  credentialFields,
  credentialMethods,
  credentialsFromValues,
  type CredentialField,
  type CredentialPrompt,
} from "@/lib/credentials";
import { InfoIcon } from "./Icons";
import { Button } from "./Button";

// Schema-driven form for a source's API credentials. Shown both up front (when
// the user chooses to import from a source's API) and mid-run (when the agent
// pauses to ask). The connector schema decides the fields; secrets render as
// password inputs and are submitted to .../runs/{run_id}/credentials — they're
// never read back, persisted client-side, or shown in the activity feed.
export function SourceCredentials({
  prompt,
  onSubmit,
  submitting,
}: {
  prompt: CredentialPrompt;
  onSubmit: (credentials: Record<string, unknown>) => void;
  submitting?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  const methods = useMemo(() => credentialMethods(prompt.schema), [prompt.schema]);
  const allFields = useMemo(() => credentialFields(prompt.schema), [prompt.schema]);
  const multiMethod = methods.length > 1;

  // Fall back to a single generic secret field if the schema yields nothing.
  const fallback: CredentialField[] =
    allFields.length === 0
      ? [{ name: "credential", label: "Credential", required: true, secret: true }]
      : [];

  const set = (name: string, value: string) => setValues((v) => ({ ...v, [name]: value }));
  const ready = Object.values(credentialsFromValues(values)).length > 0;
  const links = (prompt.guidance?.links ?? []).filter((l) => /^https?:\/\//i.test(l.url));

  return (
    <div className="rounded-xl border border-[var(--brand)] bg-[var(--brand-soft)] p-5">
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: "var(--brand)", color: "var(--brand-fg)" }}
        >
          🔑
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-800">Connect {prompt.sourceName}</p>
          <p className="text-xs text-zinc-500">
            {prompt.reason || `Enter your ${prompt.sourceName} API credentials so we can pull your data.`}
          </p>
        </div>
      </div>

      {(prompt.guidance?.summary || prompt.guidance?.steps?.length || links.length > 0) && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 text-xs">
          <p className="font-medium text-zinc-700">Where to find these in {prompt.sourceName}</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-zinc-500">
            {links[0] ? (
              <li>
                Open{" "}
                <a
                  href={links[0].url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-zinc-700 underline underline-offset-2"
                >
                  {links[0].label}
                </a>
                .
              </li>
            ) : (
              prompt.guidance?.summary && <li>{prompt.guidance.summary}</li>
            )}
            {prompt.guidance?.steps?.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-4">
        {multiMethod && (
          <p className="text-xs text-zinc-500">
            Complete any one of the methods below — fields marked * are required for that method.
          </p>
        )}
        {(multiMethod ? methods : [{ title: null, fields: allFields.length ? allFields : fallback }]).map(
          (method, mi) => (
            <fieldset
              key={method.title ?? mi}
              className={multiMethod ? "rounded-lg border border-zinc-200 bg-white px-3 pb-3 pt-2" : ""}
            >
              {multiMethod && (
                <legend className="px-1 text-xs font-medium text-zinc-700">
                  {method.title || `Method ${mi + 1}`}
                </legend>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {method.fields.map((field) => (
                  <Field key={field.name} field={field} value={values[field.name] ?? ""} onChange={set} />
                ))}
              </div>
            </fieldset>
          ),
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={() => onSubmit(credentialsFromValues(values))} disabled={!ready} loading={submitting}>
          Save &amp; continue
        </Button>
      </div>
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: CredentialField;
  value: string;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1 text-sm font-medium text-zinc-700">
        <span className="min-w-0 break-words">{field.label}</span>
        {field.required && <span className="text-zinc-400">*</span>}
        {field.help && (
          <span className="group relative inline-flex shrink-0">
            <button type="button" aria-label={field.help} className="text-zinc-400 transition hover:text-zinc-600">
              <InfoIcon className="h-3.5 w-3.5" />
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-60 -translate-x-1/2 rounded-lg bg-zinc-900 px-3 py-2 text-left text-[11px] leading-snug text-zinc-100 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            >
              {field.help}
            </span>
          </span>
        )}
      </label>
      <input
        type={field.secret ? "password" : "text"}
        value={value}
        autoComplete="off"
        placeholder={field.name}
        onChange={(e) => onChange(field.name, e.target.value)}
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
      />
    </div>
  );
}
