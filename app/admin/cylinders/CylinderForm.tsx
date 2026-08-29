"use client";

import { useState, useTransition } from "react";
import { registerCylinder } from "./actions";

type Option = { id: string; name: string };

export function CylinderForm({ branches, products }: { branches: Option[]; products: Option[] }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      await registerCylinder(formData);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    });
  }

  return (
    <form action={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <select name="branchId" className="ui-input" defaultValue={branches[0]?.id ?? ""} required>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
      <select name="productId" className="ui-input" defaultValue={products[0]?.id ?? ""} required>
        {products.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <input name="serial" placeholder="Serial number" className="ui-input" required />
      <button type="submit" className="ui-btn ui-btn-primary" disabled={pending}>
        {pending ? "Saving…" : done ? "Saved ✓" : "Register"}
      </button>
    </form>
  );
}
