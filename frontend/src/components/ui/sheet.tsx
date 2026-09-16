/**
 * Bottom sheet on a phone, centred dialog on a wide screen. Built on Radix Dialog for focus
 * trapping and Escape. A sheet sits over the basket and never replaces it (§16.3).
 *
 * Two rules the screens depend on:
 *
 * - **Only the top sheet is visible.** A sheet opened from inside another — the customer picker
 *   over payment, a confirmation over a list — replaces it for as long as it is open, instead of
 *   stacking two headers and two close buttons over each other.
 * - **Opening a sheet does not focus its close button.** Radix would focus the first thing it
 *   finds, which puts a focus ring on «close» and reads it out first; the sheet takes focus
 *   itself, so the title is what a screen reader announces and the ring goes where it belongs.
 */
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/cn.ts";
import { t } from "@/i18n/t.ts";

// The stack of open sheets, oldest first. Module state: nesting crosses portals, so context alone
// would not see it.
let stack: readonly string[] = [];
const listeners = new Set<() => void>();
const publish = (next: readonly string[]) => { stack = next; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

function useIsTopSheet(id: string, open: boolean) {
  useEffect(() => {
    if (!open) return;
    publish([...stack, id]);
    return () => publish(stack.filter((x) => x !== id));
  }, [id, open]);
  const current = useSyncExternalStore(subscribe, () => stack);
  return current.length === 0 || current[current.length - 1] === id;
}

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Hide the close button when the sheet must be completed or explicitly cancelled. */
  hideClose?: boolean;
}

export function Sheet({ open, onOpenChange, title, description, children, className, hideClose }: SheetProps) {
  const id = useId();
  const isTop = useIsTopSheet(id, open);
  const content = useRef<HTMLDivElement>(null);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={cn("fixed inset-0 z-40 bg-foreground/35 animate-fade-in", !isTop && "hidden")} />
        <Dialog.Content
          ref={content}
          {...(description ? {} : { "aria-describedby": undefined })}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            content.current?.focus({ preventScroll: true });
          }}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-y-auto rounded-t-xl bg-card px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl outline-none animate-sheet-up",
            "md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:pb-5 md:animate-fade-in",
            !isTop && "invisible",
            className,
          )}
        >
          <div className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-border md:hidden" aria-hidden />
          <div className={cn("mb-4 flex shrink-0 gap-3", description ? "items-start" : "items-center")}>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-xl font-semibold leading-snug">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-1 text-sm text-muted-foreground">{description}</Dialog.Description>}
            </div>
            {!hideClose && (
              <Dialog.Close
                className="-me-1 grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("common.close")}
              >
                <X className="size-6" />
              </Dialog.Close>
            )}
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
