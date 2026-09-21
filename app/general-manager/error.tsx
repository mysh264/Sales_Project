"use client";

import { RoleError } from "@/components/ui/RoleError";

export default function GmError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RoleError homeHref="/general-manager" message={error.message} reset={reset} />;
}
