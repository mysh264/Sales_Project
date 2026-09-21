"use client";

import { RoleError } from "@/components/ui/RoleError";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RoleError homeHref="/admin" message={error.message} reset={reset} />;
}
