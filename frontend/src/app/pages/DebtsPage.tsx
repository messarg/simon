/**
 * Պարտքեր (§6.15) for everyone who sells, and Հաճախորդներ (§6.13) for the owner: one list,
 * sorted by what is owed, and the customer's page beside it. The owner's version adds the controls.
 */
import { isManager } from "@simon/shared";
import { useSearchParams } from "react-router";
import { CustomerLedger } from "@/features/debt/CustomerLedger.tsx";
import { CustomerList } from "@/features/debt/CustomerList.tsx";
import { EmptyState } from "@/components/shared";
import { BookUser } from "lucide-react";
import { t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { useSession } from "@/lib/session-store.ts";
import { useCurrentShift } from "../shift.ts";

export function DebtsPage({ admin = false }: { admin?: boolean }) {
  const session = useSession();
  const shift = useCurrentShift().data;
  const [params, setParams] = useSearchParams();
  const selected = params.get("customer");
  const select = (id: string | null) => setParams(id ? { customer: id } : {}, { replace: false });
  const isAdmin = admin && !!session && isManager(session.user.role);
  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <section className={cn("flex min-h-0 flex-col border-border md:w-[26rem] md:border-r", selected && "hidden md:flex")}>
        <CustomerList admin={isAdmin} selectedId={selected} onSelect={select} />
      </section>
      <section className={cn("min-h-0 flex-1 overflow-y-auto", !selected && "hidden md:block")}>
        {selected
          ? <CustomerLedger key={selected} customerId={selected} admin={isAdmin} shiftId={shift?.shift.status === "OPEN" ? shift.shift.id : null} onBack={() => select(null)} />
          : <EmptyState icon={BookUser} title={t("debt.selectHint")} className="h-full" />}
      </section>
    </div>
  );
}
