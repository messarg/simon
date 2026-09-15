/**
 * Sign in: pick your name, type your PIN (§16.2, J1 steps 1–2). A shared till shows every
 * active person as a large tile; the PIN is checked only by the server.
 */
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, KeyRound } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { PinPad } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import { sessionStore, useSession, type SessionState } from "@/lib/session-store.ts";

interface SignInUser { id: string; name: string; }

export function SignInPage() {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [selected, setSelected] = useState<SignInUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [recoverOpen, setRecoverOpen] = useState(false);

  const users = useQuery({
    queryKey: ["auth", "users"],
    queryFn: () => http.get<{ items: SignInUser[] }>("/auth/users"),
    retry: false,
  });

  if (session) return <Navigate to={(location.state as { from?: string } | null)?.from ?? (session.user.role === "ADMIN" ? "/home" : "/sell")} replace />;
  if (users.error instanceof ApiProblem && users.error.type === "setup-required") return <Navigate to="/setup" replace />;

  const submit = async (pin: string) => {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await http.post<SessionState>("/auth/login", { userId: selected.id, pin, deviceId: sessionStore.deviceId(), deviceLabel: navigator.platform || "Till" });
      sessionStore.set(res);
      navigate(res.user.role === "ADMIN" ? "/home" : "/sell", { replace: true });
    } catch (err) {
      const p = err instanceof ApiProblem ? err : null;
      if (p?.type === "pin-incorrect" && typeof p.field("attemptsRemaining") === "number") setError(`${problemMessage(p.type)} · ${t("signIn.attemptsLeft", { n: p.field<number>("attemptsRemaining")! })}`);
      else if (p?.type === "account-locked") setError(t("signIn.locked", { n: p.field<number>("minutesRemaining") ?? 15 }));
      else if (p?.type === "too-many-attempts") setError(t("signIn.tooMany", { n: p.field<number>("retryAfterSeconds") ?? 60 }));
      else setError(problemMessage(p?.type ?? "network"));
      setAttempt((a) => a + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background px-4 py-8 safe-top safe-bottom">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="mb-8 flex items-center justify-center gap-3">
          <img src="/favicon.svg" alt="" width={40} height={40} className="rounded-xl" />
          <span className="text-2xl font-semibold">{t("app.name")}</span>
        </div>

        {!selected ? (
          <>
            <h1 className="mb-5 text-center text-xl font-semibold">{t("signIn.title")}</h1>
            <div className="grid grid-cols-2 gap-3">
              {users.data?.items.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { setSelected(u); setError(null); }}
                  className="flex h-28 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card text-lg font-medium shadow-sm transition-colors active:bg-muted"
                >
                  <span className="grid size-12 place-items-center rounded-full bg-primary-soft text-xl font-semibold text-accent-foreground">{u.name.slice(0, 1)}</span>
                  {u.name}
                </button>
              ))}
            </div>
            {users.isError && !(users.error instanceof ApiProblem && users.error.type === "setup-required") && (
              <div className="mt-6 text-center">
                <p className="mb-3 text-muted-foreground">{problemMessage("network")}</p>
                <Button variant="secondary" onClick={() => users.refetch()}>{t("common.retry")}</Button>
              </div>
            )}
          </>
        ) : (
          <>
            <button onClick={() => setSelected(null)} className="mb-4 flex h-touch items-center gap-2 self-start rounded-lg px-2 text-muted-foreground hover:bg-muted">
              <ArrowLeft className="size-5" aria-hidden /> {t("common.back")}
            </button>
            <div className="mb-2 text-center text-2xl font-semibold">{selected.name}</div>
            <PinPad key={attempt} label={t("signIn.enterPin")} onSubmit={submit} busy={busy} error={error} />
            <button onClick={() => setRecoverOpen(true)} className="mx-auto mt-5 flex h-touch items-center gap-2 px-3 text-sm text-muted-foreground">
              <KeyRound className="size-4" aria-hidden /> {t("signIn.forgot")}
            </button>
            <RecoverySheet open={recoverOpen} onOpenChange={setRecoverOpen} user={selected} onRecovered={() => { setError(null); setAttempt((a) => a + 1); }} />
          </>
        )}
      </div>
    </div>
  );
}

function RecoverySheet({ open, onOpenChange, user, onRecovered }: { open: boolean; onOpenChange: (o: boolean) => void; user: SignInUser; onRecovered: () => void }) {
  const [code, setCode] = useState("");
  const [newCode, setNewCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    try {
      const res = await http.post<{ recoveryCode: string }>("/auth/recover", { userId: user.id, recoveryCode: code });
      setNewCode(res.recoveryCode);
      onRecovered();
    } catch (err) {
      setError(problemMessage(err instanceof ApiProblem ? err.type : "network"));
    }
  };
  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setCode(""); setNewCode(null); setError(null); } }} title={t("signIn.recoveryTitle")} description={newCode ? undefined : t("signIn.recoveryHint")}>
      {newCode ? (
        <div>
          <p className="mb-3">{t("signIn.recoveryNew")}</p>
          <p className="tabular mb-5 rounded-lg bg-muted p-4 text-center text-2xl font-semibold tracking-wider">{newCode}</p>
          <Button className="w-full" size="lg" onClick={() => onOpenChange(false)}>{t("setup.recoveryConfirm")}</Button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <Label htmlFor="recovery">{t("signIn.recoveryTitle")}</Label>
          <Input id="recovery" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" className="tabular text-lg tracking-wider" />
          {error && <p className="mt-2 text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" className="mt-4 w-full" size="lg" disabled={code.length < 8}>{t("common.next")}</Button>
        </form>
      )}
    </Sheet>
  );
}
