/** Մատակարարներ (§6.14): what I owe and to whom — the debt book with the arrow pointing the other way. */
import { Truck } from "lucide-react";
import { useSearchParams } from "react-router";
import { EmptyState } from "@/components/shared";
import { SupplierLedger } from "@/features/buying/SupplierLedger.tsx";
import { SupplierList } from "@/features/buying/SupplierList.tsx";
import { t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { useCurrentShift } from "../shift.ts";

export function SuppliersPage() {
  const shift = useCurrentShift().data;
  const [params, setParams] = useSearchParams();
  const selected = params.get("supplier");
  const select = (id: string | null) => setParams(id ? { supplier: id } : {});
  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <section className={cn("flex min-h-0 flex-col border-border md:w-[26rem] md:border-r", selected && "hidden md:flex")}>
        <SupplierList selectedId={selected} onSelect={select} />
      </section>
      <section className={cn("min-h-0 flex-1 overflow-y-auto", !selected && "hidden md:block")}>
        {selected
          ? <SupplierLedger key={selected} supplierId={selected} shiftId={shift?.shift.status === "OPEN" ? shift.shift.id : null} onBack={() => select(null)} />
          : <EmptyState icon={Truck} title={t("suppliers.selectHint")} className="h-full" />}
      </section>
    </div>
  );
}
