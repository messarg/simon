/**
 * Closing the shift (§6.6, J4) — the screen most likely to feel accusatory, so it is neutral:
 * count in stacks, see the difference as a number, add a note if it is large. One hard confirm,
 * because closing ends a period.
 */
import { AlertTriangle, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DENOMINATIONS } from "@simon/shared";
import { ActionBar, MoneyText } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { money, moneyPlain, time } from "@/lib/format.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import { useOutboxCounts } from "@/lib/outbox.ts";
import type { ShiftReport } from "@/app/shift.ts";
import { sessionStore } from "@/lib/session-store.ts";

interface OpenBasket { id: string; createdAt: string; total: number; firstItem: string | null }

export function CloseShift({ report, varianceNoteThreshold, onCancel, onClosed }: { report: ShiftReport; varianceNoteThreshold: number; onCancel: () => void; onClosed: (z: ShiftReport & { printed: boolean }) => void }) {
  const outboxCounts = useOutboxCounts();
  const [stage, setStage] = useState<"ack" | "count">(outboxCounts.pendingSales > 0 ? "ack" : "count");
  const [baskets, setBaskets] = useState<OpenBasket[]>([]);
  const [expected, setExpected] = useState<number | null>(report.shift.status === "CLOSING" ? report.figures.expected : null);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const counted = useMemo(() => DENOMINATIONS.reduce((a, d) => a + d * (counts[d] ?? 0), 0), [counts]);
  const variance = expected === null ? 0 : counted - expected;
  const noteNeeded = Math.abs(variance) >= varianceNoteThreshold;

  const begin = async () => {
    setBusy(true);
    try {
      const r = await http.post<ShiftReport>(`/shifts/${report.shift.id}/begin-close`, { unsyncedAtClose: outboxCounts.pendingSales });
      setBaskets([]);
      setExpected(r.figures.expected);
    } catch (err) {
      if (err instanceof ApiProblem && err.type === "shift-has-open-baskets") setBaskets(err.field<OpenBasket[]>("baskets") ?? []);
      else toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network"));
    } finally {
      setBusy(false);
    }
  };

  const voidBasket = async (id: string) => {
    try { await http.post(`/sales/${id}/void`); await begin(); } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
  };

  const cancel = async () => {
    if (expected !== null) { try { await http.post(`/shifts/${report.shift.id}/cancel-close`); } catch { /* stays CLOSING; next open resumes */ } }
    onCancel();
  };

  const close = async () => {
    setBusy(true);
    try {
      const z = await http.post<ShiftReport & { printed: boolean }>(`/shifts/${report.shift.id}/close`, {
        breakdown: DENOMINATIONS.filter((d) => counts[d]).map((d) => ({ value: d, count: counts[d] })), note: note.trim() || undefined, unsyncedAtClose: outboxCounts.pendingSales,
      });
      // The server revoked this session with the shift; keep it on screen until the worker leaves the Z-report.
      sessionStore.patch((s) => ({ ...s, endedByShiftClose: true }));
      onClosed(z);
    } catch (err) {
      toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network"));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  if (stage === "ack") {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <div className="flex gap-3 rounded-lg bg-attention-soft p-4 text-attention-foreground">
          <AlertTriangle className="size-6 shrink-0" aria-hidden />
          <p>{t("shift.unsynced", { n: outboxCounts.pendingSales })}</p>
        </div>
        <div className="grid gap-2">
          <Button size="xl" onClick={() => setStage("count")}>{t("shift.acknowledge")}</Button>
          <Button variant="secondary" size="lg" onClick={onCancel}>{t("shift.back")}</Button>
        </div>
      </div>
    );
  }

  if (expected === null) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 p-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("shift.close")}</h1>
          <p className="text-muted-foreground">{t("shift.closeIntro")}</p>
        </div>
        {baskets.length > 0 && (
          <div className="rounded-lg border border-attention bg-attention-soft p-4">
            <p className="mb-3 text-attention-foreground">{t("shift.openBaskets")}</p>
            <ul className="space-y-2">
              {baskets.map((b) => (
                <li key={b.id} className="flex items-center gap-3 rounded-lg bg-card p-2">
                  <div className="min-w-0 flex-1"><div className="font-medium">{b.firstItem}</div><div className="tabular text-sm text-muted-foreground">{time(b.createdAt)} · {money(b.total)}</div></div>
                  <Button variant="secondary" size="md" onClick={() => void voidBasket(b.id)}>{t("till.voidBasket")}</Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid gap-2">
          <Button size="xl" disabled={busy} onClick={() => void begin()}>{t("shift.close")}</Button>
          <Button variant="secondary" size="lg" onClick={onCancel}>{t("shift.back")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
      <div className="sticky top-(--strip-h) z-10 border-b border-border bg-card px-4 py-3 md:rounded-b-xl md:border-x md:px-6">
        <div className="flex items-baseline justify-between"><span className="text-muted-foreground">{t("shift.terms.expected")}</span><MoneyText amount={expected} className="text-2xl font-semibold" /></div>
        <div className="flex items-baseline justify-between"><span className="text-muted-foreground">{t("shift.counted")}</span><MoneyText amount={counted} className="text-2xl font-semibold" /></div>
        <div className="flex items-baseline justify-between"><span className="font-medium">{t("shift.difference")}</span><MoneyText amount={variance} signed className="text-3xl font-bold text-money-neutral" /></div>
      </div>
      <div className="flex-1 space-y-4 p-4 md:px-6">
        <div>
          <h2 className="mb-2 text-lg font-semibold">{t("shift.countTitle")}</h2>
          <ul className="space-y-2">
            {DENOMINATIONS.map((d) => {
              const c = counts[d] ?? 0;
              const set = (n: number) => setCounts((s) => ({ ...s, [d]: Math.max(0, n) }));
              return (
                // Note, stepper, subtotal — three columns that line up down the whole list.
                <li key={d} className="grid grid-cols-[1fr_auto_5.5rem] items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
                  <span className="tabular text-lg font-semibold">{moneyPlain(d)}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => set(c - 1)} disabled={c === 0} aria-label={`${d} −`}><Minus /></Button>
                    <Input
                      value={c ? String(c) : ""}
                      onChange={(e) => set(Number(e.target.value.replace(/\D/g, "").slice(0, 4) || "0"))}
                      inputMode="numeric"
                      placeholder="0"
                      className="tabular h-touch w-14 px-1 text-center text-lg"
                      aria-label={`${d}`}
                    />
                    <Button variant="ghost" size="icon" onClick={() => set(c + 1)} aria-label={`${d} +`}><Plus /></Button>
                  </div>
                  <MoneyText amount={d * c} symbol={false} className={cn("text-right", c === 0 && "text-muted-foreground")} />
                </li>
              );
            })}
          </ul>
        </div>
        {noteNeeded && (
          <div>
            <Label htmlFor="close-note">{t("shift.noteNeeded", { amount: money(variance) })}</Label>
            <Input id="close-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </div>
        )}
      </div>
      <ActionBar width="lg">
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" className="col-span-2" disabled={noteNeeded && !note.trim()} onClick={() => setConfirming(true)}>{t("shift.close")}</Button>
          <Button variant="secondary" onClick={() => void cancel()}>{t("common.cancel")}</Button>
          <Button variant="secondary" onClick={() => http.post("/cash-drawer/open", { purpose: "close" }).catch(() => toast.error(t("payment.drawerFailed")))}>{t("shift.openDrawer")}</Button>
        </div>
      </ActionBar>
      <Sheet open={confirming} onOpenChange={setConfirming} title={t("shift.confirmTitle")} description={t("shift.confirmHint")}>
        <div className="mb-4 rounded-lg bg-muted p-3">
          <div className="flex justify-between"><span>{t("shift.counted")}</span><MoneyText amount={counted} className="font-semibold" /></div>
          <div className="flex justify-between"><span>{t("shift.difference")}</span><MoneyText amount={variance} signed className="font-semibold text-money-neutral" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="lg" onClick={() => setConfirming(false)}>{t("common.cancel")}</Button>
          <Button size="lg" disabled={busy} onClick={() => void close()}>{t("shift.confirmClose")}</Button>
        </div>
      </Sheet>
    </div>
  );
}
