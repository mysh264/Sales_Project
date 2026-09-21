import type { ReactNode } from "react";

/* Dependency-free, server-renderable mini charts (pure SVG + CSS).
   No client JS, no chart library — keeps the bundle lean and works on mobile. */

const BRAND = "#4f46e5";
const SUCCESS = "#10b981";
const DANGER = "#f43f5e";
const WARNING = "#f59e0b";

export function Donut({
  segments,
  size = 160,
  thickness = 18,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="composition chart">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={thickness} />
        {total > 0 &&
          segments.map((s, i) => {
            const fraction = Math.max(0, s.value) / total;
            const dash = fraction * circumference;
            const seg = (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            );
            offset += dash;
            return seg;
          })}
        {centerValue ? (
          <text x={cx} y={cy - 4} textAnchor="middle" className="fill-slate-900" style={{ fontSize: 18, fontWeight: 800 }}>
            {centerValue}
          </text>
        ) : null}
        {centerLabel ? (
          <text x={cx} y={cy + 14} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 11, fontWeight: 600 }}>
            {centerLabel}
          </text>
        ) : null}
      </svg>
      <ul className="flex flex-col gap-1.5 text-sm">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="font-semibold text-slate-600">{s.label}</span>
            <span className="ml-auto font-bold text-slate-800">{s.value.toLocaleString("en-OM")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BarList({
  items,
  formatValue = (v: number) => v.toLocaleString("en-OM"),
  max,
  tone = "brand",
}: {
  items: { label: string; value: number; sublabel?: string }[];
  formatValue?: (value: number) => string;
  max?: number;
  tone?: "brand" | "success" | "danger" | "warning";
}) {
  const peak = max ?? Math.max(1, ...items.map((i) => i.value));
  const barColor =
    tone === "success" ? SUCCESS : tone === "danger" ? DANGER : tone === "warning" ? WARNING : BRAND;

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item, i) => {
        const pct = Math.max(2, Math.round((item.value / peak) * 100));
        return (
          <li key={i}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-semibold text-slate-700">{item.label}</span>
              <span className="shrink-0 text-sm font-bold text-slate-900">{formatValue(item.value)}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
            </div>
            {item.sublabel ? <p className="mt-0.5 text-xs font-medium text-slate-400">{item.sublabel}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

export function Trend({
  points,
  height = 64,
  width = 320,
  color = BRAND,
  area = true,
  labels,
}: {
  points: number[];
  height?: number;
  width?: number;
  color?: string;
  area?: boolean;
  labels?: string[];
}) {
  if (points.length === 0) return null;
  const max = Math.max(1, ...points);
  const min = Math.min(0, ...points);
  const range = max - min || 1;
  const stepX = points.length > 1 ? width / (points.length - 1) : width;
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p - min) / range) * height;
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${line} L${width},${height} L0,${height} Z`;

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="trend chart" style={{ height }}>
        {area ? <path d={areaPath} fill={color} opacity={0.12} /> : null}
        <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      {labels && labels.length ? (
        <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-400">
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function KpiCallout({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">{children}</div>;
}
