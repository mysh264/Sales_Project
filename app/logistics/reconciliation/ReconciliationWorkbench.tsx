"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { submitMorningLoad } from "@/app/actions/logistics";

type SalesmanOption = {
  id: string;
  fullName: string;
  branchName: string | null;
};

type ProductOption = {
  id: string;
  name: string;
  sku: string;
};

type MorningRow = {
  key: string;
  productId: string;
  morningFull: string;
};

type ReconciliationWorkbenchProps = {
  salesmen: SalesmanOption[];
  products: ProductOption[];
  selectedSalesmanId: string;
  selectedSalesmanName: string;
};

export function ReconciliationWorkbench({
  salesmen,
  products,
  selectedSalesmanId,
  selectedSalesmanName,
}: ReconciliationWorkbenchProps) {
  const router = useRouter();
  const [rows, setRows] = useState<MorningRow[]>([
    {
      key: crypto.randomUUID(),
      productId: products[0]?.id ?? "",
      morningFull: "",
    },
  ]);

  const salesmanOptions = useMemo(() => salesmen, [salesmen]);
  const usedProductIds = useMemo(() => rows.map((row) => row.productId).filter(Boolean), [rows]);

  function updateRow(key: string, patch: Partial<MorningRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function nextAvailableProduct(rowState: MorningRow[], currentProductId?: string) {
    const currentUsed = new Set(rowState.map((row) => row.productId).filter((id) => id && id !== currentProductId));
    return products.find((product) => !currentUsed.has(product.id))?.id ?? currentProductId ?? products[0]?.id ?? "";
  }

  function addRow() {
    setRows((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        productId: nextAvailableProduct(current),
        morningFull: "",
      },
    ]);
  }

  function removeRow(key: string) {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.key !== key)));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Salesman Selection</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Select the salesman for reconciliation</h2>
          </div>
          <label className="block w-full md:max-w-md">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">Salesman</span>
            <select
              value={selectedSalesmanId}
              onChange={(event) => {
                const next = event.target.value;
                router.replace(`/logistics/reconciliation?salesmanId=${encodeURIComponent(next)}`);
              }}
              className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold"
            >
              {salesmanOptions.map((salesman) => (
                <option key={salesman.id} value={salesman.id}>
                  {salesman.fullName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-sm font-bold text-slate-600">Current salesman: {selectedSalesmanName}</p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Morning Load-Out</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Add the product load for this salesman</h2>
          </div>
          <button
            type="button"
            onClick={addRow}
            className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white"
          >
            Add Row
          </button>
        </div>

        {products.length === 0 ? (
          <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm font-bold text-amber-900">No active products are configured.</p>
        ) : (
          <form action={submitMorningLoad} className="mt-5 space-y-4">
            <input type="hidden" name="salesmanId" value={selectedSalesmanId} />
            {rows.map((row, index) => (
              <div key={row.key} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-700">Row {index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-black text-slate-700"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(180px,1fr)]">
                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">Product</span>
                    <select
                      name="productId"
                      value={row.productId}
                      onChange={(event) => {
                        const nextProductId = event.target.value;
                        setRows((current) =>
                          current.map((candidate) => {
                            if (candidate.key === row.key) {
                              return { ...candidate, productId: nextProductId };
                            }

                            if (candidate.productId !== nextProductId) {
                              return candidate;
                            }

                            return { ...candidate, productId: nextAvailableProduct(current, nextProductId) };
                          }),
                        );
                      }}
                      className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold"
                    >
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {usedProductIds.includes(product.id) && product.id !== row.productId
                            ? `${product.name} · ${product.sku} (used)`
                            : `${product.name} · ${product.sku}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">Morning Full Count</span>
                    <input
                      name="morningFull"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={row.morningFull}
                      onChange={(event) => updateRow(row.key, { morningFull: event.target.value })}
                      className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 text-center text-2xl font-black"
                    />
                  </label>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-3">
              <button type="submit" className="rounded bg-emerald-700 px-5 py-3 text-sm font-black text-white">
                Save Morning Load
              </button>
              <button
                type="button"
                onClick={() =>
                  router.replace(`/logistics/reconciliation?salesmanId=${encodeURIComponent(selectedSalesmanId)}`)
                }
                className="rounded border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-900"
              >
                Refresh Selection
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
