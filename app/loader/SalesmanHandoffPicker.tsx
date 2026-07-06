"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SalesmanOption = {
  id: string;
  fullName: string;
  branchName: string | null;
};

type SalesmanHandoffPickerProps = {
  salesmen: SalesmanOption[];
};

export function SalesmanHandoffPicker({ salesmen }: SalesmanHandoffPickerProps) {
  const router = useRouter();
  const [selectedSalesmanId, setSelectedSalesmanId] = useState(salesmen[0]?.id ?? "");

  const selectedSalesman = useMemo(
    () => salesmen.find((salesman) => salesman.id === selectedSalesmanId) ?? salesmen[0] ?? null,
    [salesmen, selectedSalesmanId],
  );

  function openMorningLoad() {
    if (selectedSalesman) {
      router.push(`/loader/load/${selectedSalesman.id}`);
    }
  }

  function openEveningReturn() {
    if (selectedSalesman) {
      router.push(`/loader/return/${selectedSalesman.id}`);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Salesman Hand-off</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Select a salesman to start a route</h2>
          <p className="mt-2 text-sm font-bold text-slate-600">
            Morning loads and evening returns are tracked directly against the salesman.
          </p>
        </div>
        <label className="block w-full lg:max-w-md">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">Salesman</span>
          <select
            value={selectedSalesmanId}
            onChange={(event) => setSelectedSalesmanId(event.target.value)}
            className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold"
          >
            {salesmen.map((salesman) => (
              <option key={salesman.id} value={salesman.id}>
                {salesman.fullName} {salesman.branchName ? `· ${salesman.branchName}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedSalesman ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={openMorningLoad}
            className="flex min-h-16 flex-1 items-center justify-center rounded-lg bg-emerald-700 px-5 text-center text-lg font-black text-white shadow-sm"
          >
            Morning Load
          </button>
          <button
            type="button"
            onClick={openEveningReturn}
            className="flex min-h-16 flex-1 items-center justify-center rounded-lg bg-amber-600 px-5 text-center text-lg font-black text-white shadow-sm"
          >
            Evening Return
          </button>
        </div>
      ) : null}
    </section>
  );
}
