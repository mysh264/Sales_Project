"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SalesmanOption = {
  id: string;
  fullName: string;
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
    <section className="ui-card p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="ui-label mb-0">Salesman hand-off</p>
          <h2 className="mt-1 font-display text-xl font-black text-slate-950">Select a salesman to start a route</h2>
          <p className="mt-2 text-sm font-bold text-slate-600">
            Morning loads and evening returns are tracked directly against the salesman.
          </p>
        </div>
        <label className="ui-field w-full lg:max-w-md">
          <span className="ui-label">Salesman</span>
          <select
            value={selectedSalesmanId}
            onChange={(event) => setSelectedSalesmanId(event.target.value)}
            className="ui-input"
          >
            {salesmen.map((salesman) => (
              <option key={salesman.id} value={salesman.id}>
                {salesman.fullName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedSalesman ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={openMorningLoad} className="ui-btn ui-btn-success ui-btn-lg min-h-16 flex-1 text-lg">
            Morning Load
          </button>
          <button
            type="button"
            onClick={openEveningReturn}
            className="ui-btn ui-btn-lg min-h-16 flex-1 bg-safety-600 text-lg text-white hover:bg-safety-700"
          >
            Evening Return
          </button>
        </div>
      ) : null}
    </section>
  );
}
