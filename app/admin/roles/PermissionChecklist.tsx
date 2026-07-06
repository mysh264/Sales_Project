"use client";

import {
  SYSTEM_ACTIONS,
  SYSTEM_RESOURCES,
  normalizePermissions,
  makePermission,
  permissionLabels,
} from "@/lib/permissions";

type PermissionChecklistProps = {
  selected?: string[];
  name?: string;
  autoSubmit?: boolean;
};

export function PermissionChecklist({ selected = [], name = "permissions", autoSubmit = false }: PermissionChecklistProps) {
  const normalized = new Set(normalizePermissions(selected));

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Resource</th>
              {SYSTEM_ACTIONS.map((action) => (
                <th key={action} className="px-4 py-3 text-center">
                  {action}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {SYSTEM_RESOURCES.map((resource) => (
              <tr key={resource} className="bg-white">
                <td className="px-4 py-4 align-top">
                  <div className="font-black text-slate-950">{resource}</div>
                  <div className="mt-1 text-xs font-bold text-slate-500">
                    {SYSTEM_ACTIONS.map((action) => permissionLabels[makePermission(resource, action)]).join(" · ")}
                  </div>
                </td>
                {SYSTEM_ACTIONS.map((action) => {
                  const permission = makePermission(resource, action);
                  const checked = normalized.has(permission);

                  return (
                    <td key={action} className="px-4 py-4 text-center align-middle">
                      <label
                        className={`inline-flex h-12 w-12 items-center justify-center rounded-lg border ${
                          checked ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-white"
                        }`}
                        title={`${resource} ${action}`}
                      >
                        <input
                          type="checkbox"
                          name={name}
                          value={permission}
                          defaultChecked={checked}
                          onChange={(event) => {
                            if (autoSubmit) {
                              event.currentTarget.form?.requestSubmit();
                            }
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-slate-950"
                        />
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
