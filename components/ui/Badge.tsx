import type { ReactNode } from "react";

type Tone = "slate" | "brand" | "success" | "danger" | "warning" | "info";

const toneClass: Record<Tone, string> = {
  slate: "ui-badge-slate",
  brand: "ui-badge-brand",
  success: "ui-badge-success",
  danger: "ui-badge-danger",
  warning: "ui-badge-warning",
  info: "ui-badge-info",
};

export function Badge({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={toneClass[tone]}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, Tone> = {
    ISSUED: "success",
    ACTIVE: "success",
    PAID: "success",
    COMPLETED: "success",
    CANCELLED: "danger",
    INACTIVE: "slate",
    DISABLED: "slate",
    OPEN: "warning",
    PARTIALLY_PAID: "warning",
    PENDING: "warning",
    ON_ROUTE: "brand",
    WAITING: "slate",
    EVENING_RECONCILED: "success",
  };
  const tone = map[status] ?? "slate";
  return (
    <Badge tone={tone}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
