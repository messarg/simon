/**
 * Bottom sheet on phones, centred dialog on wide screens. Built on Radix Dialog for focus
 * trapping and Escape. A sheet sits over the basket and never replaces it (§16.3).
 */
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn.ts";
import { t } from "@/i18n/t.ts";

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
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/35 animate-fade-in" />
        <Dialog.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-xl bg-card px-4 pt-3 pb-5 shadow-2xl animate-sheet-up safe-bottom",
            "md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:animate-fade-in",
            className,
          )}
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border md:hidden" aria-hidden />
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-sm text-muted-foreground">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            {!hideClose && (
              <Dialog.Close className="grid size-touch shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label={t("common.close")}>
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
