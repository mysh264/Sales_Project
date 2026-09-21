"use client";

import { RoleError } from "@/components/ui/RoleError";

export default function LogisticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RoleError homeHref="/loader" message={error.message} reset={reset} />;
}
