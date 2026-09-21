"use client";

import { RoleError } from "@/components/ui/RoleError";

export default function FinanceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RoleError homeHref="/finance/reconciliation-overview" message={error.message} reset={reset} />;
}
