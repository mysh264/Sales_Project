"use client";

import { useState } from "react";
import { regenerateMfaRecoveryCodes } from "@/app/actions/security";

export function RecoveryCodes() {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");

  async function handleGenerate() {
    try {
      const formData = new FormData();
      formData.set("password", password);
      const result = await regenerateMfaRecoveryCodes(formData);
      setCodes(result);
      setError("");
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate recovery codes.");
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-brand-50/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-black text-slate-950">Recovery Codes</p>
          <p className="text-xs font-bold text-slate-600">
            Use one of these once if you lose your authenticator. Each code works a single time.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!password}
          className="ui-btn ui-btn-primary ui-btn-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {codes ? "Regenerate" : "Generate"}
        </button>
      </div>
      <label className="mt-3 block">
        <span className="ui-label">Current password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="ui-input"
        />
      </label>
      {error ? <p className="mt-2 text-sm font-bold text-rose-700">{error}</p> : null}
      {codes ? (
        <div className="mt-3">
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-safety-700">
            Save these now — they will not be shown again.
          </p>
          <ul className="grid grid-cols-2 gap-2">
            {codes.map((code) => (
              <li key={code} className="rounded-lg bg-white px-3 py-2 font-mono text-sm font-bold text-slate-900" dir="ltr">
                {code}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
