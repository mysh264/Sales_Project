"use client";

import { Fragment, useState } from "react";
import { formatDateDMY } from "@/lib/date-format";

type AuditUser = {
  fullName: string;
  role: string;
};

type AuditLogRow = {
  id: string;
  timestamp: string;
  action: string;
  targetModel: string;
  targetId: string;
  oldValue: unknown;
  newValue: unknown;
  user: AuditUser;
};

type AuditLogTableProps = {
  logs: AuditLogRow[];
};

type ChangeEntry = {
  path: string;
  before: unknown;
  after: unknown;
};

function prettify(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

function normalizeChangeNode(node: unknown, path: string[] = []): ChangeEntry[] {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return [];
  }

  const record = node as Record<string, unknown>;
  if ("before" in record && "after" in record && Object.keys(record).length <= 3) {
    return [
      {
        path: path.join(".") || "value",
        before: record.before,
        after: record.after,
      },
    ];
  }

  return Object.entries(record).flatMap(([key, value]) => normalizeChangeNode(value, [...path, key]));
}

function humanizeAction(action: string) {
  return action
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (match) => match.toUpperCase());
}

export function AuditLogTable({ logs }: AuditLogTableProps) {
  const [openLogId, setOpenLogId] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3 text-right">Details</th>
            </tr>
          </thead>
      <tbody className="divide-y divide-slate-200">
            {logs.map((log) => {
              const isOpen = openLogId === log.id;
              const summary: ChangeEntry[] = normalizeChangeNode((log.newValue as { diff?: unknown } | null)?.diff);

              return (
                <Fragment key={log.id}>
                  <tr className="align-top hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                      {formatDateDMY(log.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-black text-slate-950">{log.user.fullName}</div>
                      <div className="text-xs font-bold text-slate-500">{log.user.role.replaceAll("_", " ")}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">{humanizeAction(log.action)}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-950">{log.targetModel}</div>
                      <div className="text-xs font-mono text-slate-500">{log.targetId}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setOpenLogId(isOpen ? null : log.id)}
                        className="rounded bg-slate-950 px-3 py-2 text-xs font-black text-white"
                      >
                        {isOpen ? "Hide" : "Details"}
                      </button>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="bg-slate-50">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                          <section className="rounded-lg border border-slate-200 bg-white p-4">
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Old Value</p>
                            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-800">
                              {prettify(log.oldValue)}
                            </pre>
                          </section>
                          <section className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">New Value / Diff</p>
                            {summary.length > 0 ? (
                              <div className="mt-3 space-y-3">
                                {summary.map((entry) => (
                                  <div key={entry.path} className="rounded-md border border-amber-200 bg-amber-50 p-3">
                                    <p className="text-xs font-black uppercase tracking-wide text-amber-900">{entry.path}</p>
                                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                                      <div>
                                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Before</p>
                                        <pre className="mt-1 whitespace-pre-wrap break-words text-xs leading-6 text-slate-800">
                                          {prettify(entry.before)}
                                        </pre>
                                      </div>
                                      <div>
                                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">After</p>
                                        <pre className="mt-1 whitespace-pre-wrap break-words text-xs leading-6 text-slate-800">
                                          {prettify(entry.after)}
                                        </pre>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-800">
                                {prettify(log.newValue)}
                              </pre>
                            )}
                          </section>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
