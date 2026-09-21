"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="print-hidden ui-btn ui-btn-primary">
      Print
    </button>
  );
}
