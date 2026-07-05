"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print-hidden rounded bg-slate-950 px-5 py-3 text-sm font-black text-white"
    >
      Print
    </button>
  );
}

