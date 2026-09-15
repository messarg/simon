import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn.ts";

/** An empty state teaches what would put something here (§8.4) — never just "No results". */
export function EmptyState({ icon: Icon, title, hint, action, className }: { icon: LucideIcon; title: string; hint?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-primary-soft text-primary">
        <Icon className="size-8" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint && <p className="mt-1 max-w-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
