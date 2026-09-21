"use client";

import { useState, useTransition } from "react";
import { generateStatementShareToken } from "@/app/actions/statement";

export function StatementShareButton({ customerId }: { customerId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    const fd = new FormData();
    fd.set("customerId", customerId);
    startTransition(async () => {
      const t = await generateStatementShareToken(fd);
      setToken(t);
    });
  }

  const url = token ? `${window.location.origin}/s/${token}` : "";

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={onClick} disabled={pending} className="ui-btn ui-btn-ghost ui-btn-sm">
        {pending ? "Generating…" : "Create share link"}
      </button>
      {token ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Public link (valid 30 days)</p>
          <a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-sm font-bold text-brand underline">
            {url}
          </a>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(url)}
            className="mt-1 text-xs font-black text-brand underline"
          >
            Copy
          </button>
        </div>
      ) : null}
    </div>
  );
}
