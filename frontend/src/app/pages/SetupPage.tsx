/**
 * First run: the wizard's first two questions (§7.1) — the shop's name, and the owner with
 * their own PIN, which is the first ADMIN. It ends by showing the recovery code once. The
 * remaining questions, the backup passphrase and import arrive with the full wizard.
 */
import { ShieldCheck, Store } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { ApiProblem, http } from "@/lib/http.ts";

export function SetupPage() {
  const navigate = useNavigate();
  const status = useQuery({ queryKey: ["setup", "status"], queryFn: () => http.get<{ needsOwner: boolean }>("/setup/status") });
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  if (status.data && !status.data.needsOwner && !recoveryCode) return <Navigate to="/sign-in" replace />;

  const pinValid = /^\d{4,8}$/.test(pin);
  const canSubmit = shopName.trim() && ownerName.trim() && pinValid && pin === pin2 && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await http.post<{ recoveryCode: string }>("/setup/owner", { shopName, ownerName, pin });
      setRecoveryCode(res.recoveryCode);
    } catch (err) {
      setError(problemMessage(err instanceof ApiProblem ? err.type : "network"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-start justify-center bg-background px-4 py-10 safe-top">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        {recoveryCode ? (
          <>
            <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-attention-soft text-attention-foreground"><ShieldCheck className="size-7" aria-hidden /></div>
            <h1 className="text-2xl font-semibold">{t("setup.recoveryTitle")}</h1>
            <p className="mt-2 text-muted-foreground">{t("setup.recoveryHint")}</p>
            <p className="tabular my-6 rounded-lg bg-muted p-5 text-center text-2xl font-semibold tracking-wider">{recoveryCode}</p>
            <p className="mb-5 rounded-lg bg-attention-soft p-3 text-sm text-attention-foreground">{t("setup.taxPending")}</p>
            <Button size="lg" className="w-full" onClick={() => navigate("/sign-in", { replace: true })}>{t("setup.recoveryConfirm")}</Button>
          </>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); if (canSubmit) void submit(); }}>
            <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary"><Store className="size-7" aria-hidden /></div>
            <h1 className="text-2xl font-semibold">{t("setup.welcome")}</h1>
            <p className="mt-1 mb-6 text-muted-foreground">{t("setup.welcomeHint")}</p>
            <div className="space-y-4">
              <div>
                <Label htmlFor="shop">{t("setup.shopName")}</Label>
                <Input id="shop" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder={t("setup.shopNamePlaceholder")} autoFocus />
              </div>
              <div>
                <Label htmlFor="owner">{t("setup.ownerName")}</Label>
                <Input id="owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} autoComplete="name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="pin">{t("setup.ownerPin")}</Label>
                  <Input id="pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" type="password" autoComplete="new-password" className="tabular text-lg tracking-widest" />
                </div>
                <div>
                  <Label htmlFor="pin2">{t("setup.ownerPinRepeat")}</Label>
                  <Input id="pin2" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" type="password" autoComplete="new-password" className="tabular text-lg tracking-widest" />
                </div>
              </div>
              {pin2.length >= 4 && pin !== pin2 && <p className="text-sm text-destructive" role="alert">{t("setup.pinMismatch")}</p>}
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            </div>
            <Button type="submit" size="lg" className="mt-6 w-full" disabled={!canSubmit}>{t("common.next")}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
