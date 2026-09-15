/**
 * Held baskets (§6.1, §12.1): listed by time and first item. One parked on this till and not
 * yet sent comes back from the outbox; one the server holds is resumed onto this shift — which
 * is what moves it to the drawer that completes it.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PauseCircle } from "lucide-react";
import { toast } from "sonner";
import type { SaleBody } from "@simon/shared";
import { EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { getCachedProduct } from "@/lib/catalogue.ts";
import { useConnection } from "@/lib/connection.ts";
import { money, time } from "@/lib/format.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import { outbox, useOutboxItems } from "@/lib/outbox.ts";
import { basketStore, type Basket, type BasketLine } from "./basket.ts";

interface HeldSale {
  id: string; createdAt: string; total: number; userName: string | null; shiftId: string;
  lines: { id: string; productId: string; productName: string; qty: number; uom: string; factorToStockUom: number; unitPriceMdram: number; taxRateBp: number; discountAmount: number; priceOverridden: boolean }[];
  discountTotal: number; discountReason: string | null;
}

async function toBasket(id: string, createdAt: string, lines: HeldSale["lines"], discount: number, discountReason: string | null, resumedShiftId: string | null): Promise<Basket> {
  const out: BasketLine[] = [];
  for (const l of lines) {
    const p = await getCachedProduct(l.productId);
    out.push({
      id: l.id, productId: l.productId, name: l.productName, uom: l.uom, factorToStockUom: l.factorToStockUom, decimalPlaces: p?.decimalPlaces ?? 3,
      catalogueMdram: p ? p.sellPriceMdram * l.factorToStockUom : l.unitPriceMdram, unitPriceMdram: l.unitPriceMdram, taxRateBp: l.taxRateBp, qty: l.qty,
      discountAmount: l.discountAmount, priceOverridden: l.priceOverridden, trackStock: p?.trackStock ?? false, stockQty: p?.stockQty ?? 0,
    });
  }
  return { id, createdAt, lines: out, saleDiscount: discount, discountReason, reauthGrant: null, overrideReason: null, resumedShiftId };
}

export function HeldSheet({ open, onOpenChange, shiftId, basketEmpty }: { open: boolean; onOpenChange: (o: boolean) => void; shiftId: string | null; basketEmpty: boolean }) {
  const connection = useConnection();
  const qc = useQueryClient();
  const outboxItems = useOutboxItems();
  const local = outboxItems.filter((i) => i.kind === "sale" && i.isParkedBasket && i.state !== "parked");
  const server = useQuery({
    queryKey: ["sales", "held"],
    enabled: open && connection === "online",
    queryFn: () => http.get<{ items: HeldSale[] }>("/sales", { query: { status: "HELD", limit: 50 } }),
  });

  const resumeLocal = async (id: string) => {
    const item = await outbox.take(id);
    if (!item) return;
    const body = item.body as SaleBody;
    const lines = await Promise.all(body.lines.map(async (l) => ({ ...l, productName: (await getCachedProduct(l.productId))?.name ?? "" })));
    basketStore.replace(await toBasket(body.id, body.createdAt, lines, body.saleDiscount, body.discountReason ?? null, null));
    onOpenChange(false);
  };

  const resumeServer = async (sale: HeldSale) => {
    if (!shiftId) return;
    try {
      const resumed = await http.post<HeldSale>(`/sales/${sale.id}/resume`, { shiftId });
      basketStore.replace(await toBasket(resumed.id, resumed.createdAt, resumed.lines, resumed.discountTotal, resumed.discountReason, shiftId));
      void qc.invalidateQueries({ queryKey: ["sales", "held"] });
      onOpenChange(false);
    } catch (err) {
      toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network"));
    }
  };

  const voidServer = async (sale: HeldSale) => {
    try {
      await http.post(`/sales/${sale.id}/void`);
      void qc.invalidateQueries({ queryKey: ["sales", "held"] });
    } catch (err) {
      toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network"));
    }
  };

  const serverItems = (server.data?.items ?? []).filter((s) => !local.some((l) => l.id === s.id));
  const empty = !local.length && !serverItems.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("till.held")} description={t("till.heldHint")}>
      {empty ? (
        <EmptyState icon={PauseCircle} title={t("till.heldEmpty")} className="py-6" />
      ) : (
        <ul className="divide-y divide-border">
          {local.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{i.label}</div>
                <div className="text-sm text-muted-foreground">{time(i.enqueuedAt)}</div>
              </div>
              <Button size="md" disabled={!basketEmpty} onClick={() => void resumeLocal(i.id)}>{t("till.resume")}</Button>
            </li>
          ))}
          {serverItems.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{s.lines[0]?.productName}{s.lines.length > 1 ? ` +${s.lines.length - 1}` : ""}</div>
                <div className="tabular text-sm text-muted-foreground">{time(s.createdAt)} · {s.userName} · {money(s.total)}</div>
              </div>
              <Button variant="ghost" size="md" onClick={() => void voidServer(s)}>{t("till.voidBasket")}</Button>
              <Button size="md" disabled={!basketEmpty || !shiftId} onClick={() => void resumeServer(s)}>{t("till.resume")}</Button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
