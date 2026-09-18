/**
 * Մատակարարներ (§6.14): what I owe and to whom — and, since v2, what I have asked them for (§13.3).
 * Orders live beside suppliers rather than in a destination of their own: §5.1's navigation stays
 * as it is, and an order is always to somebody.
 */
import { isOwner } from "@simon/shared";
import { useSession } from "@/lib/session-store.ts";
import { ClipboardList, Truck } from "lucide-react";
import { useSearchParams } from "react-router";
import { EmptyState } from "@/components/shared";
import { OrderEditor } from "@/features/buying/OrderEditor.tsx";
import { OrdersPanel } from "@/features/buying/OrdersPanel.tsx";
import { SupplierLedger } from "@/features/buying/SupplierLedger.tsx";
import { SupplierList } from "@/features/buying/SupplierList.tsx";
import { t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { useCurrentShift } from "../shift.ts";

export function SuppliersPage() {
  const shift = useCurrentShift().data;
  const [params, setParams] = useSearchParams();
  const owner = isOwner(useSession()?.user.role ?? "EMPLOYEE");
  const tab = owner ? params.get("tab") === "orders" ? "orders" : "suppliers" : "suppliers";
  const selected = params.get(tab === "orders" ? "order" : "supplier");
  const select = (id: string | null) => setParams({ ...(tab === "orders" ? { tab } : {}), ...(id ? { [tab === "orders" ? "order" : "supplier"]: id } : {}) });

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <section className={cn("flex min-h-0 flex-col border-border md:w-[26rem] md:border-r", selected && "hidden md:flex")}>
        {/* Drafting and sending orders is the owner's: an order's lines are prices (§16.4). */}
        {owner && <div className="flex gap-1 px-3 pt-3">
          {(["suppliers", "orders"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setParams(k === "orders" ? { tab: k } : {})}
              className={cn("h-touch flex-1 rounded-lg text-sm font-medium", tab === k ? "bg-primary-soft text-accent-foreground" : "text-muted-foreground")}
            >
              {k === "orders" ? t("orders.tabOrders") : t("orders.tabSuppliers")}
            </button>
          ))}
        </div>}
        {tab === "orders"
          ? <OrdersPanel selectedId={selected} onSelect={select} onNew={() => select("new")} />
          : <SupplierList selectedId={selected} onSelect={select} />}
      </section>
      <section className={cn("min-h-0 flex-1 overflow-y-auto", !selected && "hidden md:block")}>
        {tab === "orders"
          ? selected
            ? <OrderEditor key={selected} orderId={selected === "new" ? null : selected} onBack={() => select(null)} onSaved={(id) => select(id)} />
            : <EmptyState icon={ClipboardList} title={t("orders.title")} hint={t("orders.emptyHint")} className="h-full" />
          : selected
            ? <SupplierLedger key={selected} supplierId={selected} shiftId={shift?.shift.status === "OPEN" ? shift.shift.id : null} onBack={() => select(null)} />
            : <EmptyState icon={Truck} title={t("suppliers.selectHint")} className="h-full" />}
      </section>
    </div>
  );
}
