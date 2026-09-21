"use client";

import {
  ROLE_ASSIGNABLE_ACTIONS,
  ROLE_ASSIGNABLE_RESOURCES,
  normalizePermissions,
  makePermission,
  permissionLabels,
} from "@/lib/permissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PermissionChecklistProps = {
  selected?: string[];
  name?: string;
};

export function PermissionChecklist({ selected = [], name = "permissions" }: PermissionChecklistProps) {
  const normalized = new Set(normalizePermissions(selected));

  return (
    <div className="ui-card overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Resource</TableHead>
            {ROLE_ASSIGNABLE_ACTIONS.map((action) => (
              <TableHead key={action} className="text-center">
                {action}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROLE_ASSIGNABLE_RESOURCES.map((resource) => (
            <TableRow key={resource}>
              <TableCell className="align-top">
                <div className="font-black text-slate-950">{resource}</div>
                <div className="mt-1 text-xs font-bold text-slate-500">
                  {ROLE_ASSIGNABLE_ACTIONS.map((action) => permissionLabels[makePermission(resource, action)]).join(" · ")}
                </div>
              </TableCell>
              {ROLE_ASSIGNABLE_ACTIONS.map((action) => {
                const permission = makePermission(resource, action);
                const checked = normalized.has(permission);

                return (
                  <TableCell key={action} className="text-center align-middle">
                    <label
                      className={`inline-flex h-12 w-12 items-center justify-center rounded-xl border ${
                        checked ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-white"
                      }`}
                      title={`${resource} ${action}`}
                    >
                      <span className="sr-only">{`${resource} ${action}`}</span>
                      <input
                        type="checkbox"
                        name={name}
                        value={permission}
                        defaultChecked={checked}
                        className="h-4 w-4 rounded border-slate-300 text-brand-700 focus-visible:ring-brand-500"
                      />
                    </label>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
