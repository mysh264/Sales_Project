import type { ReactNode } from "react";

type Tone = "default" | "success" | "danger" | "brand" | "warning";

const toneClass: Record<Tone, string> = {
  default: "text-slate-950",
  success: "text-emerald-600",
  danger: "text-rose-600",
  brand: "text-brand-600",
  warning: "text-amber-600",
};

export function Stat({
  label,
  value,
  tone = "default",
  hint,
  icon,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: Tone;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="ui-stat">
      <div className="flex items-start justify-between gap-3">
        <p className="ui-stat-label">{label}</p>
        {icon ? <span className="text-brand-500">{icon}</span> : null}
      </div>
      <p className={`ui-stat-value ${toneClass[tone]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs font-semibold text-slate-500">{hint}</p> : null}
    </div>
  );
}
