/**
 * Write-offs and stock adjustments (§13.5, §16.3), from the item in Պահեստ. A write-off carries a
 * coded reason. An adjustment needs an admin's PIN and a reason, because it changes the shelf
 * count without a document behind it. Both need the server (§14.5).
 */
import { useState } from "react";
import { toast } from "sonner";
import { parseQty, uuidv7 } from "@simon/shared";
import { Keypad, ReauthSheet } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { putProducts, type ApiProduct } from "@/lib/catalogue.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import type { CachedProduct } from "@/lib/local-db.ts";

const REASONS = ["DAMAGE", "EXPIRY", "THEFT", "INTERNAL_USE", "SAMPLE"] as const;

async function refreshProduct(id: string) {
  try { await putProducts([await http.get<ApiProduct>(`/products/${id}`)]); } catch { /* next sync */ }
}

export function WriteOffSheet({ product, open, onOpenChange, onDone }: { product: CachedProduct; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  // Remounted per opening by the parent's key.
  const [entry, setEntry] = useState("");
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [note, setNote] = useState("");
  const qty = parseQty(entry, product.decimalPlaces);
  const save = async () => {
    try {
      await http.post("/write-offs", { id: uuidv7(), productId: product.id, qty, reasonCode: reason, note: note.trim() || undefined });
      await refreshProduct(product.id);
      toast.success(t("stockOps.done"));
      onDone();
      onOpenChange(false);
    } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("stockOps.writeOffTitle")} description={product.name}>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {REASONS.map((r) => (
          <button key={r} onClick={() => setReason(r)} className={cn("h-touch rounded-lg border text-sm font-medium", reason === r ? "border-primary bg-primary-soft" : "border-border")}>{t(`stockOps.reasons.${r}`)}</button>
        ))}
      </div>
      <div className="mb-2 rounded-lg bg-muted px-4 py-2"><span className="text-sm text-muted-foreground">{t("stockOps.qty")}</span><div className="tabular text-3xl font-semibold">{entry || "0"} {product.stockUom}</div></div>
      <Label htmlFor="wo-note">{t("stockOps.note")}</Label>
      <Input id="wo-note" value={note} onChange={(e) => setNote(e.target.value)} className="mb-3" maxLength={200} />
      <Keypad value={entry} onChange={setEntry} allowDecimal={product.decimalPlaces > 0} maxDecimals={product.decimalPlaces} maxLength={7} />
      <Button size="xl" className="mt-3 w-full" disabled={!reason || !qty} onClick={() => void save()}>{t("stockOps.writeOff")}</Button>
    </Sheet>
  );
}

export function AdjustSheet({ product, open, onOpenChange, onDone }: { product: CachedProduct; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [entry, setEntry] = useState("");
  const [sign, setSign] = useState<1 | -1>(-1);
  const [note, setNote] = useState("");
  const [reauth, setReauth] = useState(false);
  const qty = parseQty(entry, product.decimalPlaces);
  const save = async (grant: string, reason: string) => {
    try {
      await http.post("/adjustments", { id: uuidv7(), productId: product.id, qtyDelta: sign * (qty ?? 0), note: note.trim() || undefined, reauthGrant: grant, reason });
      await refreshProduct(product.id);
      toast.success(t("stockOps.done"));
      onDone();
      onOpenChange(false);
    } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
  };
  return (
    <>
      <Sheet open={open && !reauth} onOpenChange={onOpenChange} title={t("stockOps.adjustTitle")} description={t("stockOps.adjustHint")}>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {([1, -1] as const).map((v) => (
            <button key={v} onClick={() => setSign(v)} className={cn("h-touch rounded-lg border font-medium", sign === v ? "border-primary bg-primary-soft" : "border-border")}>{v === 1 ? t("stockOps.add") : t("stockOps.subtract")}</button>
          ))}
        </div>
        <div className="mb-2 rounded-lg bg-muted px-4 py-2"><span className="text-sm text-muted-foreground">{t("stockOps.qty")}</span><div className="tabular text-3xl font-semibold">{(qty ?? 0) > 0 ? (sign < 0 ? "−" : "+") : ""}{entry || "0"} {product.stockUom}</div></div>
        <Label htmlFor="adj-note">{t("stockOps.note")}</Label>
        <Input id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} className="mb-3" maxLength={200} />
        <Keypad value={entry} onChange={setEntry} allowDecimal={product.decimalPlaces > 0} maxDecimals={product.decimalPlaces} maxLength={7} />
        <Button size="xl" className="mt-3 w-full" disabled={!qty} onClick={() => setReauth(true)}>{t("stockOps.adjust")}</Button>
      </Sheet>
      <ReauthSheet open={reauth} onOpenChange={setReauth} action="stockAdjustment" onGranted={(grant, reason) => void save(grant, reason)} />
    </>
  );
}
