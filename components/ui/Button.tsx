import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ShadcnButton, shadcnButtonVariants } from "@/components/ui/shadcn-button";

type Variant = "primary" | "secondary" | "ghost" | "subtle" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const variantMap = {
  primary: "default",
  secondary: "secondary",
  ghost: "ghost",
  subtle: "subtle",
  danger: "destructive",
  success: "success",
} as const;

const sizeMap = {
  sm: "sm",
  md: "default",
  lg: "lg",
} as const;

/** Product Button — thin wrapper over shadcn button variants (Oman teal). */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: { variant?: Variant; size?: Size; children: ReactNode } & ComponentProps<"button">) {
  return (
    <ShadcnButton
      variant={variantMap[variant]}
      size={sizeMap[size]}
      className={cn(className)}
      {...props}
    >
      {children}
    </ShadcnButton>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  href,
  children,
  ...props
}: { variant?: Variant; size?: Size; href: string; children: ReactNode } & Omit<ComponentProps<typeof Link>, "href">) {
  return (
    <Link
      href={href}
      className={cn(shadcnButtonVariants({ variant: variantMap[variant], size: sizeMap[size] }), className)}
      {...props}
    >
      {children}
    </Link>
  );
}
