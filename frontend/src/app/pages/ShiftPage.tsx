/** Հերթափոխ — open on a counted float, work, close on a denomination count (§6.6, J1, J4). */
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, Landmark, Printer, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { uuidv7 } from "@simon/shared";
import { EmptyState, Keypad, MoneyText } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { CashMovementSheet, type MovementType } from "@/features/shift/CashMovementSheet.tsx";
import { CloseShift } from "@/features/shift/CloseShift.tsx";
import { CashMovementsList } from "@/features/shift/CashMovementsList.tsx";
import { ShiftFiguresList } from "@/features/shift/ShiftFigures.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { useConnection } from "@/lib/connection.ts";
import { cn } from "@/lib/cn.ts";
import { dateTime, money, moneyPlain, time } from "@/lib/format.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import { outbox } from "@/lib/outbox.ts";
import { sessionStore } from "@/lib/session-store.ts";
import { useClientSettings } from "../settings.ts";
import { currentShiftKey, useCurrentShift, type ShiftReport } from "../shift.ts";

export function ShiftPage() {
  const connection = useConnection();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const settings = useClientSettings().data;
  const current = useCurrentShift();
  const [float, setFloat] = useState("");
  const [busy, setBusy] = useState(false);
  const [movement, setMovement] = useState<MovementType | null>(null);
  const [closing, setClosing] = useState(false);
  const [z, setZ] = useState<(ShiftReport & { printed: boolean }) | null>(null);

  useEffect(() => outbox.onResult((item) => { if (item.kind !== "sale" || !item.isParkedBasket) void qc.invalidateQueries({ queryKey: currentShiftKey }); }), [qc]);

  const report = current.data;
  const offlineCached = Boolean(report && !report.figures);

  const open = async () => {
    setBusy(true);
    try {
      const id = uuidv7();
      const r = await http.post<ShiftReport>("/shifts", { id, openingFloat: Number(float || "0") });
      sessionStore.patch((s) => ({ ...s, session: { ...s.session, shiftId: r.shift.id } }));
      await qc.invalidateQueries({ queryKey: currentShiftKey });
      setFloat("");
      navigate("/sell");
    } catch (err) {
      toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network"));
    } finally {
      setBusy(false);
    }
  };

  if (z) {
    return (
      <div className="mx-auto w-full max-w-lg p-4">
        <h1 className="mb-1 text-2xl font-semibold">{t("shift.zReport")}</h1>
        <p className="mb-4 text-muted-foreground">{z.shift.userName} · {dateTime(z.shift.openedAt)} – {z.shift.closedAt ? time(z.shift.closedAt) : ""}</p>
        <div className="rounded-xl border border-border bg-card p-4">
          <ShiftFiguresList figures={z.figures} />
          <div className="mt-2 border-t border-border pt-2">
            <div className="flex justify-between py-1"><span>{t("shift.counted")}</span><MoneyText amount={z.counted ?? 0} className="font-semibold" /></div>
            <div className="flex justify-between py-1"><span>{t("shift.difference")}</span><MoneyText amount={z.variance ?? 0} signed className="text-xl font-bold text-money-neutral" /></div>
          </div>
        </div>
        {z.lateArrivals.length > 0 && (
          <div className="mt-3 rounded-lg bg-muted p-3 text-sm">
            {z.lateArrivals.map((l) => <div key={l.sourceId} className="flex justify-between"><span>{t("shift.lateArrivals")}</span><MoneyText amount={l.amount} signed /></div>)}
          </div>
        )}
        <p className={cn("mt-4 flex items-center gap-2 rounded-lg p-3 text-sm", z.printed ? "bg-success-soft" : "bg-attention-soft text-attention-foreground")}>
          <Printer className="size-4 shrink-0" aria-hidden />{z.printed ? t("shift.zPrinted") : t("shift.zPrintFailed")}
        </p>
        <Button size="xl" className="mt-3 w-full" onClick={() => { sessionStore.set(null); qc.clear(); navigate("/sign-in", { replace: true }); }}>{t("shift.finish")}</Button>
      </div>
    );
  }

  if (current.isLoading) return null;

  if (!report) {
    if (connection === "offline") return <EmptyState icon={WifiOff} title={t("shift.openTitle")} hint={t("shift.onlineRequired")} className="flex-1" />;
    return (
      <div className="mx-auto w-full max-w-sm p-4">
        <h1 className="text-2xl font-semibold">{t("shift.openTitle")}</h1>
        <p className="mb-4 text-muted-foreground">{t("shift.openHint")}</p>
        <div className="mb-3 rounded-lg bg-card px-4 py-3 shadow-xs ring-1 ring-border">
          <div className="text-sm text-muted-foreground">{t("shift.openingFloat")}</div>
          <div className="tabular text-4xl font-semibold">{moneyPlain(Number(float || "0"))} ֏</div>
        </div>
        <Keypad value={float} onChange={setFloat} maxLength={8} />
        <div className="mt-3 grid gap-2">
          <Button size="xl" disabled={busy} onClick={() => void open()}>{t("shift.open")}</Button>
          <Button variant="secondary" size="lg" onClick={() => http.post("/cash-drawer/open", { purpose: "float" }).catch(() => toast.error(t("payment.drawerFailed")))}>{t("shift.openDrawer")}</Button>
        </div>
      </div>
    );
  }

  // A close begun earlier — on this till or before navigating away — resumes at the count (§11: CLOSING → OPEN only by cancelling).
  if (closing || report.shift.status === "CLOSING") {
    return (
      <CloseShift
        report={report}
        varianceNoteThreshold={settings?.varianceNoteThreshold ?? 500}
        onCancel={() => { setClosing(false); void qc.invalidateQueries({ queryKey: currentShiftKey }); }}
        onClosed={(r) => { setClosing(false); setZ(r); }}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("shift.current")}</h1>
        <p className="text-muted-foreground">{report.shift.userName} · {t("shift.since", { time: time(report.shift.openedAt) })}</p>
      </div>
      {offlineCached ? (
        <p className="rounded-lg bg-attention-soft p-3 text-attention-foreground">{t("shift.onlineRequired")}</p>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold">{t("shift.xReport")}</h2>
            <Button variant="ghost" size="sm" onClick={() => http.post("/print/x-report", { shiftId: report.shift.id }).then(() => toast.success(t("common.done"))).catch(() => toast.error(t("payment.printFailed")))}><Printer />{t("shift.printX")}</Button>
          </div>
          <ShiftFiguresList figures={report.figures} />
          {report.transfers.length > 0 && (
            <div className="mt-2 border-t border-border pt-2 text-sm text-muted-foreground">
              {report.transfers.map((tr) => <div key={tr.saleId + tr.at}>{tr.direction === "in" ? t("shift.transfersIn") : t("shift.transfersOut")} · {time(tr.at)}</div>)}
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" size="lg" className="h-touch-xl flex-col gap-1" onClick={() => setMovement("PAY_IN")}><ArrowDownToLine />{t("shift.payIn")}</Button>
        <Button variant="secondary" size="lg" className="h-touch-xl flex-col gap-1" onClick={() => setMovement("PAY_OUT")}><ArrowUpFromLine />{t("shift.payOut")}</Button>
        <Button variant="secondary" size="lg" className="h-touch-xl flex-col gap-1" onClick={() => setMovement("DROP")}><Landmark />{t("shift.drop")}</Button>
      </div>
      {!offlineCached && <CashMovementsList shiftId={report.shift.id} onChanged={() => void qc.invalidateQueries({ queryKey: currentShiftKey })} />}
      <Button size="xl" variant="soft" className="w-full" disabled={connection === "offline"} onClick={() => setClosing(true)}>
        {t("shift.close")} {report.figures ? `· ${money(report.figures.expected)}` : ""}
      </Button>
      {connection === "offline" && <p className="text-center text-sm text-muted-foreground">{t("shift.onlineRequired")}</p>}
      <CashMovementSheet key={movement ?? "none"} type={movement} shiftId={report.shift.id} onOpenChange={(o) => { if (!o) setMovement(null); }} />
    </div>
  );
}
