/**
 * The confirmation for an action that cannot be undone (§8.1, §27.16).
 *
 * Only for those: a confirmation on a routine action teaches people to tap through
 * confirmations, which is how the one that mattered gets tapped through too. Anything that can
 * be taken back offers undo instead.
 */
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { t } from "@/i18n/t.ts";

export function ConfirmSheet({
  open, onOpenChange, title, description, confirmLabel, onConfirm, children, destructive = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  onConfirm: () => void;
  children?: ReactNode;
  destructive?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="space-y-4">
        {children}
        <Button size="lg" variant={destructive ? "destructive" : "primary"} className="w-full" onClick={() => { onConfirm(); onOpenChange(false); }}>
          {confirmLabel}
        </Button>
        <Button size="lg" variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
      </div>
    </Sheet>
  );
}
