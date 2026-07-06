import { assignablePermissions, permissionLabels, type Permission } from "@/lib/permissions";

type PermissionChecklistProps = {
  selected?: string[];
  name?: string;
};

const permissionGroups = [
  {
    title: "Sales",
    items: ["INVOICE_CREATE", "CUSTOMER_MANAGE", "DEBT_COLLECT"],
  },
  {
    title: "Inventory",
    items: ["INVENTORY_UPDATE", "LOGISTICS_EXECUTE", "PRODUCT_MANAGE"],
  },
  {
    title: "Finance",
    items: ["PRICE_RULE_UPDATE", "MANAGER_VIEW_ALL_SALES", "FINANCE_VIEW"],
  },
  {
    title: "Administration",
    items: ["USER_MANAGE", "ROLE_MANAGE", "AUDIT_VIEW", "AUDIT_DELETE"],
  },
] as const;

export function PermissionChecklist({ selected = [], name = "permissions" }: PermissionChecklistProps) {
  return (
    <div className="space-y-4">
      {permissionGroups.map((group) => (
        <fieldset key={group.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <legend className="px-2 text-xs font-black uppercase tracking-wide text-slate-500">{group.title}</legend>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.items
              .filter((permission) => assignablePermissions.includes(permission as Permission))
              .map((permission) => {
                const checked = selected.includes(permission);

                return (
                  <label key={permission} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
                    <input
                      type="checkbox"
                      name={name}
                      value={permission}
                      defaultChecked={checked}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950"
                    />
                    <span>
                      <span className="block text-sm font-black text-slate-950">{permissionLabels[permission as Permission]}</span>
                      <span className="block text-xs font-bold text-slate-500">{permission}</span>
                    </span>
                  </label>
                );
              })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
