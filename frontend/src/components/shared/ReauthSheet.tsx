/**
 * Admin re-authentication. PRD §16.3. Sits over the basket, never replaces it. Returns a
 * single-use grant for one action; the PIN never leaves this request.
 */
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { useConnection } from "@/lib/connection.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import { cn } from "@/lib/cn.ts";
import { PinPad } from "./PinPad.tsx";

export type ReauthAction = "discount" | "priceOverride" | "priceChange" | "stockAdjustment" | "blindReturn" | "repaymentReversal" | "noSaleDrawer" | "creditLimitOverride";

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
  const users = useQuery({ queryKey: ["auth", "users"], queryFn: () => http.get<{ items: { id: string; name: string }[] }>("/auth/users"), enabled: open && connection === "online" });
  const [adminId, setAdminId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const reset = (o: boolean) => { onOpenChange(o); if (!o) { setAdminId(null); setReason(""); setError(null); } };

  const submit = async (pin: string) => {
    if (!adminId) return;
    if (requireReason && !reason.trim()) { setError(t("reauth.reasonLabel")); setAttempt((a) => a + 1); return; }
    setBusy(true);
    try {
      const res = await http.post<{ grant: string }>("/auth/reauth", { adminUserId: adminId, pin, action }, { keepSessionOn401: true });
      onGranted(res.grant, reason.trim());
      reset(false);
    } catch (err) {
      setError(problemMessage(err instanceof ApiProblem ? err.type : "network"));
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
          {!adminId ? (
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">{t("reauth.chooseAdmin")}</p>
              <div className="grid grid-cols-2 gap-2">
                {users.data?.items.map((u) => (
                  <button key={u.id} onClick={() => setAdminId(u.id)} className={cn("flex h-touch-lg items-center gap-2 rounded-lg border border-border bg-card px-3 font-medium active:bg-muted")}>
                    <ShieldCheck className="size-5 text-primary" aria-hidden /> {u.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <PinPad key={attempt} label={t("reauth.pin")} onSubmit={submit} busy={busy} error={error} />
          )}
        </div>
      )}
    </Sheet>
  );
}
