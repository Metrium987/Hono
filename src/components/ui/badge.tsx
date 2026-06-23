import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-[0.6875rem] font-medium transition-colors select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground",
        secondary:
          "bg-black/[0.06] dark:bg-white/[0.10] text-foreground/70 dark:text-white/60",
        destructive:
          "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400",
        outline:
          "border border-border text-foreground/70",
        success:
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
        warning:
          "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
        info:
          "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
