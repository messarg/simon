/**
 * Re-authentication. PRD §16.3. Sits over the basket, never replaces it. Returns a single-use
 * grant for one action; the PIN never leaves this request.
 *
 * The approver types their name and then their PIN, as at sign-in (§16.2) — there is no list of
 * who may approve, for the same reason there is no list of who may sign in. An owner or a manager
 * can approve; the backup actions only the owner. Someone who cannot fails exactly as a wrong PIN
 * does, so the sheet does not tell a cashier who holds which role.
 */
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { useConnection } from "@/lib/connection.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import { PinPad } from "./PinPad.tsx";

export type ReauthAction = "discount" | "priceOverride" | "priceChange" | "stockAdjustment" | "blindReturn" | "repaymentReversal" | "noSaleDrawer" | "creditLimitOverride" | "backupPassphrase" | "backupRestore";

/** Mirrors the server: these unlock what is the owner's alone (§16.4). */
const OWNER_ACTIONS: readonly ReauthAction[] = ["backupPassphrase", "backupRestore"];

export interface ReauthSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: ReauthAction;
  description?: string;
  requireReason?: boolean;
  onGranted: (grant: string, reason: string) => void;
}

export function ReauthSheet({ open, onOpenChange, action, description, requireReason = true, onGranted }: ReauthSheetProps) {
  const connection = useConnection();
  const [typed, setTyped] = useState("");
  const [approver, setApprover] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const reset = (o: boolean) => { onOpenChange(o); if (!o) { setTyped(""); setApprover(null); setReason(""); setError(null); } };

  const submit = async (pin: string) => {
    if (!approver) return;
    if (requireReason && !reason.trim()) { setError(t("reauth.reasonLabel")); setAttempt((a) => a + 1); return; }
    setBusy(true);
    try {
      const res = await http.post<{ grant: string }>("/auth/reauth", { name: approver, pin, action }, { keepSessionOn401: true });
      onGranted(res.grant, reason.trim());
      reset(false);
    } catch (err) {
      const type = err instanceof ApiProblem ? err.type : "network";
      setError(type === "pin-incorrect" ? t("reauth.notAdmin") : problemMessage(type));
      setAttempt((a) => a + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={reset} title={t("reauth.title")} description={description}>
      {connection === "offline" ? (
        <p className="rounded-lg bg-attention-soft p-4 text-attention-foreground">{t("reauth.offline")}</p>
      ) : (
        <div className="space-y-4">
          {requireReason && (
            <div>
              <Label htmlFor="reauth-reason">{t("reauth.reasonLabel")}</Label>
              <Input id="reauth-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reauth.reasonPlaceholder")} maxLength={200} />
            </div>
          )}
          {approver === null ? (
            <form onSubmit={(e) => { e.preventDefault(); if (typed.trim()) { setApprover(typed.trim()); setError(null); } }}>
              <Label htmlFor="reauth-name">{t("reauth.approverName")}</Label>
              <Input id="reauth-name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} enterKeyHint="next" />
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <ShieldCheck className="size-4 text-primary" aria-hidden />
                {OWNER_ACTIONS.includes(action) ? t("reauth.whoOwner") : t("reauth.who")}
              </p>
              <Button type="submit" size="lg" className="mt-3 w-full" disabled={!typed.trim()}>{t("signIn.next")}</Button>
            </form>
          ) : (
            <>
              <button type="button" onClick={() => { setApprover(null); setError(null); }} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                {approver}
              </button>
              <PinPad key={attempt} label={t("reauth.pin")} onSubmit={submit} busy={busy} error={error} />
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
