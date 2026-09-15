/** A worker creates a customer — name and phone, nothing else (§6.13). A duplicate phone offers the existing record instead. */
import { useState } from "react";
import { uuidv7 } from "@simon/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { getCachedCustomer, putCustomers } from "@/lib/customers.ts";
import { useConnection } from "@/lib/connection.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import type { CachedCustomer } from "@/lib/local-db.ts";

export function CreateCustomerSheet({ open, onOpenChange, initialName, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; initialName?: string; onCreated: (c: CachedCustomer) => void }) {
  const connection = useConnection();
  // Remounted by the parent's key on each opening.
  const [name, setName] = useState(initialName ?? "");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<{ id: string; fullName: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const c = await http.post<CachedCustomer>("/customers", { id: uuidv7(), fullName: name.trim(), phone: phone.trim() || null }, { timeoutMs: 5000 });
      await putCustomers([c]);
      onCreated(c);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiProblem && err.type === "duplicate-phone") setExisting({ id: err.field<string>("customerId")!, fullName: err.field<string>("fullName") ?? null });
      else setError(problemMessage(err instanceof ApiProblem ? err.type : "network"));
    } finally {
      setBusy(false);
    }
  };

  const chooseExisting = async () => {
    if (!existing) return;
    const cached = await getCachedCustomer(existing.id);
    const c = cached ?? (await http.get<{ customer: CachedCustomer }>(`/customers/${existing.id}/ledger`)).customer;
    onCreated(c);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("debt.create")}>
      {connection === "offline" ? (
        <p className="rounded-lg bg-attention-soft p-4 text-attention-foreground">{t("problems.network")}</p>
      ) : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (name.trim()) void save(); }}>
          <div><Label htmlFor="cc-name">{t("debt.name")}</Label><Input id="cc-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="off" /></div>
          <div><Label htmlFor="cc-phone">{t("debt.phone")}</Label><Input id="cc-phone" value={phone} onChange={(e) => { setPhone(e.target.value); setExisting(null); }} inputMode="tel" className="tabular" maxLength={32} /></div>
          {existing && (
            <div className="rounded-lg bg-attention-soft p-3 text-attention-foreground">
              <p className="mb-2">{t("debt.duplicatePhone", { name: existing.fullName ?? "—" })}</p>
              <Button type="button" variant="attention" onClick={() => void chooseExisting()}>{t("debt.useExisting")}</Button>
            </div>
          )}
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" size="xl" className="w-full" disabled={busy || !name.trim()}>{t("common.save")}</Button>
        </form>
      )}
    </Sheet>
  );
}
