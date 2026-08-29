"use client";

import { useState } from "react";
import { regenerateMfaRecoveryCodes } from "@/app/actions/security";

export function RecoveryCodes() {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState("");

  async function handleGenerate() {
    try {
      const result = await regenerateMfaRecoveryCodes();
      setCodes(result);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate recovery codes.");
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-black text-slate-950">Recovery Codes</p>
          <p className="text-xs font-bold text-slate-600">
            Use one of these once if you lose your authenticator. Each code works a single time.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white"
        >
          {codes ? "Regenerate" : "Generate"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm font-bold text-red-700">{error}</p> : null}
      {codes ? (
        <div className="mt-3">
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-amber-700">
            Save these now — they will not be shown again.
          </p>
          <ul className="grid grid-cols-2 gap-2">
            {codes.map((code) => (
              <li key={code} className="rounded bg-white px-3 py-2 font-mono text-sm font-bold text-slate-900">
                {code}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
