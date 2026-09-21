import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const shadcnButtonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-brand-600 text-white shadow-soft hover:bg-brand-700 hover:shadow-pop active:translate-y-px",
        secondary: "border border-brand-200 bg-brand-50 text-brand-800 hover:border-brand-300 hover:bg-brand-100",
        outline: "border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50",
        ghost: "border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50",
        subtle: "bg-slate-100 text-slate-700 hover:bg-slate-200",
        destructive: "bg-rose-600 text-white hover:bg-rose-700",
        success: "bg-emerald-600 text-white hover:bg-emerald-700",
        link: "text-brand-700 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2.5",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-12 px-5 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ShadcnButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof shadcnButtonVariants> {
  asChild?: boolean;
}

export const ShadcnButton = React.forwardRef<HTMLButtonElement, ShadcnButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(shadcnButtonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
ShadcnButton.displayName = "ShadcnButton";

export { shadcnButtonVariants };
