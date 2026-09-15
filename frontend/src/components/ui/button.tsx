import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn.ts";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-[background-color,transform,opacity] active:scale-[0.98] disabled:opacity-45 disabled:active:scale-100 [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/92 shadow-sm",
        secondary: "bg-card text-foreground border border-border hover:bg-muted",
        soft: "bg-primary-soft text-accent-foreground hover:bg-accent",
        ghost: "text-foreground hover:bg-muted",
        attention: "bg-attention text-attention-foreground hover:bg-attention/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        sm: "h-10 px-3 text-sm",
        md: "h-touch px-4 text-base",
        lg: "h-touch-lg px-5 text-lg",
        xl: "h-touch-xl px-6 text-xl font-semibold",
        icon: "size-touch",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, type = "button", ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp type={asChild ? undefined : type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
