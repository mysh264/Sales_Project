"use client";

import { Permissions, permissionLabels, type Permission } from "@/lib/permissions";

type PermissionRow = {
  resource: string;
  permission: Permission;
  description: string;
};

const permissionRows: PermissionRow[] = [
  {
    resource: "Sales",
    permission: Permissions.INVOICE_CREATE,
    description: "Create new invoices and issue receipts.",
  },
  {
    resource: "Sales",
    permission: Permissions.CUSTOMER_MANAGE,
    description: "Search, add, and update customer profiles.",
  },
  {
    resource: "Sales",
    permission: Permissions.DEBT_COLLECT,
    description: "Collect customer debt and reconcile balances.",
  },
  {
    resource: "Sales",
    permission: Permissions.MANAGER_VIEW_ALL_SALES,
    description: "View sales across all branches and staff.",
  },
  {
    resource: "Products",
    permission: Permissions.PRODUCT_MANAGE,
    description: "Create, edit, activate, and deactivate products.",
  },
  {
    resource: "Products",
    permission: Permissions.PRICE_RULE_UPDATE,
    description: "Set minimum and maximum selling prices.",
  },
  {
    resource: "Inventory",
    permission: Permissions.INVENTORY_UPDATE,
    description: "Adjust warehouse inventory and reconcile stock.",
  },
  {
    resource: "Logistics",
    permission: Permissions.LOGISTICS_EXECUTE,
    description: "Run morning load and evening return workflows.",
  },
  {
    resource: "Finance",
    permission: Permissions.FINANCE_VIEW,
    description: "Open finance dashboards and branch totals.",
  },
  {
    resource: "Users",
    permission: Permissions.USER_MANAGE,
    description: "Create, edit, activate, or deactivate employee accounts.",
  },
  {
    resource: "Roles",
    permission: Permissions.ROLE_MANAGE,
    description: "Create, edit, and clone permission bundles.",
  },
  {
    resource: "Audit",
    permission: Permissions.AUDIT_VIEW,
    description: "Inspect system audit logs.",
  },
  {
    resource: "Audit",
    permission: Permissions.AUDIT_DELETE,
    description: "Remove audit records where policy allows.",
  },
];

type PermissionChecklistProps = {
  selected?: string[];
  name?: string;
  autoSubmit?: boolean;
};

export function PermissionChecklist({ selected = [], name = "permissions", autoSubmit = false }: PermissionChecklistProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
          <tr>
            <th className="px-4 py-3">Resource</th>
            <th className="px-4 py-3">Permission</th>
            <th className="px-4 py-3">Enabled</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {permissionRows.map((row) => {
            const checked = selected.includes(row.permission);

            return (
              <tr key={row.permission} className={checked ? "bg-emerald-50/60" : "bg-white"}>
                <td className="px-4 py-3 font-black text-slate-950">{row.resource}</td>
                <td className="px-4 py-3">
                  <div className="font-bold text-slate-800">{permissionLabels[row.permission]}</div>
                  <div className="text-xs font-bold text-slate-500">{row.description}</div>
                </td>
                <td className="px-4 py-3">
                  <label className="inline-flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <input
                      type="checkbox"
                      name={name}
                      value={row.permission}
                      defaultChecked={checked}
                      onChange={(event) => {
                        if (autoSubmit) {
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-slate-950"
                    />
                    <span className="text-xs font-black uppercase tracking-wide text-slate-700">
                      {checked ? "Enabled" : "Disabled"}
                    </span>
                  </label>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
