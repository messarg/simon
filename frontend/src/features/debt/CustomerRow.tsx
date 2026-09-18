/** One debtor: name, what is owed, the age of the oldest charge, and an overdue marker with a word, not just a colour. */
import { AlertTriangle, Ban } from "lucide-react";
import { MoneyText } from "@/components/shared";
import { t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import type { CachedCustomer } from "@/lib/local-db.ts";

export function CustomerRow({ c, selected, onClick, showLimit }: { c: CachedCustomer; selected?: boolean; onClick: () => void; showLimit?: boolean }) {
  return (
    <button onClick={onClick} className={cn("flex min-h-touch-lg w-full items-center gap-3 px-4 py-2.5 text-left active:bg-muted", selected && "bg-primary-soft")}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{c.fullName ?? t("customers.anonymised")}</span>
          {c.isBlocked && <span className="inline-flex items-center gap-1 rounded-xs bg-muted px-2 text-xs text-muted-foreground"><Ban className="size-3" aria-hidden />{t("customers.blockedBadge")}</span>}
        </div>
        <div className="tabular text-sm text-muted-foreground">
          {c.phone ?? ""}{showLimit ? `${c.phone ? " · " : ""}${t("debt.limit")} ${c.creditLimit.toLocaleString("en").replace(/,/g, " ")}` : ""}
        </div>
      </div>
      <div className="text-right">
        {c.outstanding > 0 ? <MoneyText amount={c.outstanding} className="font-semibold" /> : c.outstanding < 0 ? <span className="text-sm text-success">{t("debt.credit", { amount: `${-c.outstanding}` })}</span> : <span className="text-sm text-muted-foreground">{t("debt.noDebt")}</span>}
        <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
          {c.overdue > 0 && <span className="inline-flex items-center gap-0.5 text-attention-foreground"><AlertTriangle className="size-3" aria-hidden />{t("customers.overdueBadge")}</span>}
          {c.oldestChargeDays !== null && c.outstanding > 0 && <span>{t("debt.days", { n: c.oldestChargeDays })}</span>}
        </div>
      </div>
    </button>
  );
}
