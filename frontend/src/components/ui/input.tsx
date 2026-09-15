import type { ComponentProps } from "react";
import { cn } from "@/lib/cn.ts";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-touch w-full rounded-lg border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:border-ring",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-muted-foreground", className)} {...props} />;
}
