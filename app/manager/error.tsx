"use client";

import { RoleError } from "@/components/ui/RoleError";

export default function ManagerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RoleError homeHref="/manager" message={error.message} reset={reset} />;
}
