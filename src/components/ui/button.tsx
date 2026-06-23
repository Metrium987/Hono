import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[10px] text-[14px] font-medium tracking-[-0.01em]",
    "transition-all duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1",
    "disabled:pointer-events-none disabled:opacity-40",
    "active:scale-[0.97]",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        /* Apple-style filled button: vibrant blue, soft inner glow */
        default:
          "bg-primary text-white hover:opacity-90 shadow-[0_1px_2px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.15)]",
        destructive:
          "bg-destructive text-white hover:opacity-90 shadow-[0_1px_2px_rgba(0,0,0,0.18)]",
        /* Apple-style tinted button: very subtle fill, bordered */
        outline:
          "bg-white dark:bg-white/[0.07] text-foreground dark:text-white border border-black/[0.12] dark:border-white/[0.14] hover:bg-black/[0.04] dark:hover:bg-white/[0.12] shadow-[0_1px_1px_rgba(0,0,0,0.05)]",
        secondary:
          "bg-black/[0.06] dark:bg-white/[0.10] text-foreground dark:text-white hover:bg-black/[0.09] dark:hover:bg-white/[0.15]",
        ghost:
          "text-foreground/65 dark:text-white/55 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] hover:text-foreground dark:hover:text-white",
        link:
          "text-primary underline-offset-4 hover:underline p-0 h-auto shadow-none",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm:      "h-7 rounded-[8px] px-3 text-[13px]",
        lg:      "h-10 px-6 text-[15px]",
        icon:    "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
