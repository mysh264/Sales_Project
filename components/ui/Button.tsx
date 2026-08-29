import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "ghost" | "subtle" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "ui-btn-primary",
  ghost: "ui-btn-ghost",
  subtle: "ui-btn-subtle",
  danger: "ui-btn-danger",
  success: "ui-btn-success",
};

const sizeClass: Record<Size, string> = {
  sm: "ui-btn-sm",
  md: "",
  lg: "ui-btn-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: { variant?: Variant; size?: Size; children: ReactNode } & ComponentProps<"button">) {
  return (
    <button className={`${variantClass[variant]} ${sizeClass[size]} ${className}`} {...props}>
      {children}
    </button>
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
    <Link href={href} className={`${variantClass[variant]} ${sizeClass[size]} ${className}`} {...props}>
      {children}
    </Link>
  );
}
