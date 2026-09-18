/**
 * The till — Վաճառել. PRD §6.1, J2. The single most important screen.
 *
 * Phone: the basket (newest at the top), then a bottom block that never scrolls away — total,
 * the three ways in, and ՎՃԱՐԵԼ. Wide screen: the basket on the left, tiles and payment on the
 * right. The HID scanner works whatever has focus, except a text field.
 */
import { can, type Permission } from "@simon/shared";
import { useSession } from "@/lib/session-store.ts";
import { Camera, CircleSlash, Clock, Grid3x3, PauseCircle, Percent, ScanLine, Search, Trash2, Undo2, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { EmptyState, MoneyText, QuantitySheet, ReauthSheet } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { DebtPanel } from "@/features/debt/DebtPanel.tsx";
import { ReturnsSheet } from "@/features/returns/ReturnsSheet.tsx";
import { basketStore, basketTotals, discountState, taxRateFor, useBasket, type BasketLine } from "@/features/till/basket.ts";
import { CameraSheet } from "@/features/till/CameraSheet.tsx";
import { completeSale, holdBasket } from "@/features/till/checkout.ts";
import { DiscountSheet } from "@/features/till/DiscountSheet.tsx";
import { HeldSheet } from "@/features/till/HeldSheet.tsx";
import { PaymentSheet } from "@/features/till/PaymentSheet.tsx";
import { PriceSheet } from "@/features/till/PriceSheet.tsx";
import { QuickAddSheet } from "@/features/till/QuickAddSheet.tsx";
import { QuickTiles } from "@/features/till/QuickTiles.tsx";
import { SearchResults, SearchSheet } from "@/features/till/SearchSheet.tsx";
import { BasketLineRow } from "@/features/till/BasketLineRow.tsx";
import { t } from "@/i18n/t.ts";
import { beep } from "@/lib/beep.ts";
import { findByBarcode } from "@/lib/catalogue.ts";
import { useConnection } from "@/lib/connection.ts";
import { Input } from "@/components/ui/input.tsx";
import type { CachedProduct } from "@/lib/local-db.ts";
import { useOutboxItems } from "@/lib/outbox.ts";
import { useScanner } from "@/lib/scanner.ts";
import { useClientSettings } from "../settings.ts";
import { useCurrentShift } from "../shift.ts";

const RECEIPT_NUMBER = /^[A-Z0-9]{2}-\d{1,9}$/;

/** One action above the basket: icon over label, equal width, never clipped and never scrolled. */
function TillAction({ icon: Icon, label, onClick, disabled }: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-touch flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[0.7rem] font-medium leading-tight text-muted-foreground transition-colors active:bg-muted disabled:opacity-40"
    >
      <Icon className="size-5" aria-hidden />
      <span className="line-clamp-1">{label}</span>
    </button>
  );
}

export function TillPage() {
  const basket = useBasket();
  const settings = useClientSettings().data;
  const shiftQuery = useCurrentShift();
  const shift = shiftQuery.data?.shift;
  const shiftOpen = shift?.status === "OPEN";
  const connection = useConnection();
  const outboxItems = useOutboxItems();
  const parkedHere = outboxItems.filter((i) => i.isParkedBasket && i.state !== "parked").length;

  // A job not granted is absent from the till, not greyed out (§5.1, §16.4). The server refuses anyway.
  const session = useSession();
  const may = (p: Permission) => !!session && can(session.user, p);
  const takesReturns = may("returns");

  const [highlight, setHighlight] = useState<string | null>(null);
  const [qtyLine, setQtyLine] = useState<BasketLine | null>(null);
  const [priceLine, setPriceLine] = useState<BasketLine | null>(null);
  const [sheet, setSheet] = useState<null | "search" | "tiles" | "camera" | "pay" | "held" | "discount" | "returns" | "reauth">(null);
  const [quickAdd, setQuickAdd] = useState<{ barcode: string | null; name?: string } | null>(null);
  const [returnNumber, setReturnNumber] = useState<string | null>(null);
  const [inlineQuery, setInlineQuery] = useState("");

  useEffect(() => { void basketStore.load(); }, []);

  const add = useCallback((p: CachedProduct) => {
    if (!settings) return;
    if (p.decimalPlaces > 0) {
      const line = basketStore.add(p, taxRateFor(settings), 0);
      basketStore.remove(line.id);
      setQtyLine({ ...line, qty: 1000 });
      return;
    }
    const line = basketStore.add(p, taxRateFor(settings));
    setHighlight(line.id + line.qty);
    beep("ok");
  }, [settings]);

  const onScan = useCallback(async (code: string) => {
    if (RECEIPT_NUMBER.test(code) && takesReturns) { setReturnNumber(code); setSheet("returns"); return; }
    const p = await findByBarcode(code);
    if (p && p.isActive) add(p);
    else { beep("error"); setQuickAdd({ barcode: code }); }
  }, [add, takesReturns]);

  useScanner(onScan, sheet === null && !qtyLine && !priceLine && !quickAdd);

  if (!settings) {
    return <EmptyState icon={CircleSlash} title={t("till.noSettingsTitle")} hint={t("till.noSettingsHint")} className="flex-1" />;
  }

  const totals = basketTotals(basket, settings);
  const hasLines = basket.lines.length > 0;

  const remove = (lineId: string) => {
    const removed = basketStore.remove(lineId);
    if (!removed) return;
    toast(t("till.lineRemoved", { name: removed.line.name }), { duration: 5000, action: { label: t("common.undo"), onClick: () => basketStore.restore(removed.line, removed.index) } });
  };

  const startPayment = () => {
    if (!shiftOpen) { toast.error(t("payment.noShift")); return; }
    if (settings.taxRegime === null) { toast.error(t("till.taxNotSet")); return; }
    if (settings.strictNegativeStock) {
      const short = basket.lines.find((l) => l.trackStock && l.stockQty - l.qty * l.factorToStockUom < 0);
      if (short) { toast.error(t("problems.insufficient-stock-strict"), { description: short.name }); return; }
    }
    const d = discountState(basket, settings);
    if (d.aboveCap && !basket.reauthGrant) {
      if (connection === "online") { setSheet("reauth"); return; }
      if (d.aboveCeiling) { toast.error(t("till.beyondCeiling", { pct: settings.offlineDiscountCeilingBp / 100 })); return; }
    }
    setSheet("pay");
  };

  const hold = async () => {
    if (!shiftOpen || !hasLines) return;
    await holdBasket(basket, settings, shift!.id);
    toast.success(t("till.basketHeld"));
  };

  const bottomActions = (
    <div className="grid grid-cols-3 gap-2">
      <Button variant="secondary" size="lg" onClick={() => setSheet("camera")}><Camera />{t("till.scan")}</Button>
      <Button variant="secondary" size="lg" onClick={() => setSheet("search")}><Search />{t("till.search")}</Button>
      <Button variant="secondary" size="lg" onClick={() => setSheet("tiles")}><Grid3x3 />{t("till.quick")}</Button>
    </div>
  );

  const payButton = (
    <Button size="xl" className="h-touch-xl w-full justify-between px-5 text-xl" disabled={!hasLines} onClick={startPayment}>
      <span>{t("till.pay")}</span>
      <MoneyText amount={totals.total} />
    </Button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-stretch gap-1 border-b border-border bg-card px-2 py-1.5">
          <TillAction icon={PauseCircle} label={`${t("till.held")}${parkedHere > 0 ? ` · ${parkedHere}` : ""}`} onClick={() => setSheet("held")} />
          {takesReturns && <TillAction icon={Undo2} label={t("till.returns")} onClick={() => { setReturnNumber(null); setSheet("returns"); }} />}
          <TillAction icon={Percent} label={t("till.discount")} disabled={!hasLines} onClick={() => setSheet("discount")} />
          <TillAction icon={Clock} label={t("till.hold")} disabled={!hasLines || !shiftOpen} onClick={() => void hold()} />
          <TillAction
            icon={Trash2}
            label={t("till.clear")}
            disabled={!hasLines}
            onClick={() => { const snapshot = basket; basketStore.clear(); toast(t("till.basketCleared"), { duration: 5000, action: { label: t("common.undo"), onClick: () => basketStore.replace(snapshot) } }); }}
          />
        </div>

        {!shiftQuery.isLoading && !shiftOpen && (
          <div className="m-3 flex flex-wrap items-center gap-3 rounded-lg bg-attention-soft p-3 text-attention-foreground">
            <Clock className="size-6 shrink-0 self-start" aria-hidden />
            <div className="min-w-48 flex-1">
              <div className="font-semibold">{t("till.noShiftTitle")}</div>
              <div className="text-sm">{t("till.noShiftHint")}</div>
            </div>
            <Button asChild size="md" variant="attention" className="w-full sm:w-auto"><Link to="/shift">{t("till.openShift")}</Link></Button>
          </div>
        )}
        {settings.taxRegime === null && <div className="mx-3 mt-3 rounded-lg bg-attention-soft p-3 text-sm text-attention-foreground">{t("till.taxNotSet")}</div>}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {hasLines ? (
            <ul className="bg-card">
              {basket.lines.map((l) => (
                <BasketLineRow key={l.id} line={l} highlight={highlight === l.id + l.qty} onTap={() => setQtyLine(l)} onLongPress={() => setPriceLine(l)} onRemove={() => remove(l.id)} />
              ))}
            </ul>
          ) : (
            <div className="p-3 md:p-6">
              <div className="mb-4 flex items-center gap-3 text-muted-foreground">
                <ScanLine className="size-7 text-primary" aria-hidden />
                <div>
                  <div className="font-semibold text-foreground">{t("till.emptyTitle")}</div>
                  <div className="text-sm">{t("till.emptyHint")}</div>
                </div>
              </div>
              <div className="md:hidden"><QuickTiles onPick={add} /></div>
            </div>
          )}
        </div>

        <div className="sticky bottom-(--tabbar-h) z-20 space-y-2 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
          {(totals.discountTotal > 0 || totals.roundingAdjustment !== 0) && (
            <div className="tabular flex justify-between px-1 text-sm text-muted-foreground">
              {totals.discountTotal > 0 && <span>{t("till.discount")} −{totals.discountTotal}</span>}
              {totals.roundingAdjustment !== 0 && <span>±{totals.roundingAdjustment}</span>}
            </div>
          )}
          {bottomActions}
          {payButton}
        </div>
      </section>

      <aside className="hidden w-[20rem] shrink-0 flex-col border-l border-border bg-muted/40 md:flex lg:w-[24rem] xl:w-[27rem]">
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={inlineQuery} onChange={(e) => setInlineQuery(e.target.value)} placeholder={t("till.searchPlaceholder")} className="pl-10" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {inlineQuery.trim() ? <SearchResults query={inlineQuery} onPick={(p) => { add(p); setInlineQuery(""); }} /> : <QuickTiles onPick={add} limit={18} />}
        </div>
        <div className="space-y-3 border-t border-border bg-card p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-medium text-muted-foreground">{t("till.total")}</span>
            <MoneyText amount={totals.total} className="text-5xl font-bold" />
          </div>
          {totals.taxTotal > 0 && <div className="tabular text-right text-sm text-muted-foreground">ԱԱՀ {totals.taxTotal}</div>}
          <Button variant="secondary" size="lg" className="w-full" onClick={() => setSheet("camera")}><Camera />{t("till.scan")}</Button>
          {payButton}
        </div>
      </aside>

      {qtyLine && (
        <QuantitySheet
          open
          onOpenChange={(o) => { if (!o) setQtyLine(null); }}
          title={qtyLine.name}
          uom={qtyLine.uom}
          decimalPlaces={qtyLine.decimalPlaces}
          initial={qtyLine.qty}
          unitPriceMdram={qtyLine.unitPriceMdram}
          onConfirm={(qty) => {
            if (basket.lines.some((l) => l.id === qtyLine.id)) basketStore.setQty(qtyLine.id, qty);
            else basketStore.restore({ ...qtyLine, qty }, 0);
            setHighlight(qtyLine.id + qty);
            beep("ok");
          }}
        />
      )}
      <PriceSheet key={priceLine?.id ?? "none"} line={priceLine} onOpenChange={(o) => { if (!o) setPriceLine(null); }} onConfirm={(price, reason) => { basketStore.setPrice(priceLine!.id, price); basketStore.setOverrideReason(reason); }} />
      <SearchSheet open={sheet === "search"} onOpenChange={(o) => setSheet(o ? "search" : null)} onPick={add} onAddNew={(name) => setQuickAdd({ barcode: null, name })} />
      <Sheet open={sheet === "tiles"} onOpenChange={(o) => setSheet(o ? "tiles" : null)} title={t("till.quick")}>
        <div className="max-h-[60dvh] overflow-y-auto"><QuickTiles limit={24} onPick={(p) => { add(p); setSheet(null); }} /></div>
      </Sheet>
      <CameraSheet open={sheet === "camera"} onOpenChange={(o) => setSheet(o ? "camera" : null)} onScan={(c) => void onScan(c)} />
      <QuickAddSheet key={quickAdd ? `${quickAdd.barcode}-${quickAdd.name ?? ""}` : "closed"} open={quickAdd !== null} onOpenChange={(o) => { if (!o) setQuickAdd(null); }} barcode={quickAdd?.barcode ?? null} initialName={quickAdd?.name} onCreated={add} />
      <HeldSheet open={sheet === "held"} onOpenChange={(o) => setSheet(o ? "held" : null)} shiftId={shiftOpen ? shift!.id : null} basketEmpty={!hasLines} />
      <DiscountSheet key={sheet === "discount" ? "discount-open" : "discount-closed"} open={sheet === "discount"} onOpenChange={(o) => setSheet(o ? "discount" : null)} subtotal={totals.subtotal} current={basket.saleDiscount} onApply={(a, r) => basketStore.setDiscount(a, r)} />
      <ReturnsSheet key={sheet === "returns" ? `returns-${returnNumber ?? ""}` : "returns-closed"} open={sheet === "returns"} onOpenChange={(o) => setSheet(o ? "returns" : null)} shiftId={shiftOpen ? shift!.id : null} initialNumber={returnNumber} />
      <ReauthSheet
        open={sheet === "reauth"}
        onOpenChange={(o) => setSheet(o ? "reauth" : null)}
        action="discount"
        description={t("till.overCap", { pct: settings.maxDiscountBp / 100 })}
        onGranted={(grant, reason) => { basketStore.setGrant(grant, reason); setSheet("pay"); }}
      />
      <PaymentSheet
        open={sheet === "pay"}
        onOpenChange={(o) => setSheet(o ? "pay" : null)}
        total={totals.total}
        onComplete={(payments, debt) => completeSale(basketStore.get(), settings, shift!.id, payments, debt)}
        renderDebt={settings.debtBookEnabled && may("debt") ? ({ debtAmount, onBack, onChosen }) => <DebtPanel debtAmount={debtAmount} settings={settings} onBack={onBack} onComplete={onChosen} /> : undefined}
      />
    </div>
  );
}
