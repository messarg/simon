/**
 * Sign in: pick your name, type your PIN (§16.2, J1 steps 1–2). A shared till shows every
 * active person as a large tile; the PIN is checked only by the server.
 *
 * One centred card at every size — a phone, a tablet on the counter, the Mac app's window — so
 * the first thing anyone sees sits in the middle of the screen, not hanging from its top edge.
 */
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, KeyRound } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { PinPad } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import { sessionStore, useSession, type SessionState } from "@/lib/session-store.ts";

interface SignInUser { id: string; name: string; }

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full bg-primary-soft font-semibold text-accent-foreground", className)}>
      {name.slice(0, 1)}
    </span>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {/* A soft wash of the brand colour behind the card; decoration only. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[45dvh] bg-gradient-to-b from-primary-soft to-transparent" />
      <main className="w-full max-w-md">
        <header className="mb-5 flex items-center justify-center gap-3">
          <img src="/favicon.svg" alt="" width={44} height={44} className="rounded-xl shadow-md" />
          <span className="text-2xl font-semibold tracking-tight">{t("app.name")}</span>
        </header>
        <section className="rounded-2xl bg-card p-5 shadow-lg ring-1 ring-border sm:p-7">{children}</section>
      </main>
    </div>
  );
}

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

  if (session) return <Navigate to={(location.state as { from?: string } | null)?.from ?? "/sell"} replace />;
  if (users.error instanceof ApiProblem && users.error.type === "setup-required") return <Navigate to="/setup" replace />;

  const submit = async (pin: string) => {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await http.post<SessionState>("/auth/login", { userId: selected.id, pin, deviceId: sessionStore.deviceId(), deviceLabel: navigator.platform || "Till" });
      sessionStore.set(res);
      navigate("/sell", { replace: true });
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
    <Frame>
      {!selected ? (
        <>
          <h1 className="text-center text-xl font-semibold">{t("signIn.title")}</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">{t("signIn.pickHint")}</p>
          {/* Two per row, and an odd one out sits in the middle rather than under the left column. */}
          <ul className="mt-6 flex flex-wrap justify-center gap-3">
            {users.isPending && [0, 1].map((i) => (
              <li key={i} className="h-32 w-[calc(50%-0.375rem)] animate-pulse rounded-xl bg-muted" aria-hidden />
            ))}
            {users.data?.items.map((u) => (
              <li key={u.id} className="w-[calc(50%-0.375rem)]">
                <button
                  onClick={() => { setSelected(u); setError(null); }}
                  className="flex h-32 w-full flex-col items-center justify-center gap-3 rounded-xl border border-border bg-background px-2 text-lg font-medium transition-colors hover:border-primary/40 hover:bg-primary-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-primary-soft"
                >
                  <Avatar name={u.name} className="size-14 text-2xl" />
                  <span className="max-w-full truncate">{u.name}</span>
                </button>
              </li>
            ))}
          </ul>
          {users.isError && !(users.error instanceof ApiProblem && users.error.type === "setup-required") && (
            <div className="mt-6 text-center">
              <p className="mb-3 text-muted-foreground">{problemMessage("network")}</p>
              <Button variant="secondary" onClick={() => users.refetch()}>{t("common.retry")}</Button>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Who is signing in, and the way back to the list, on one row above the keypad. */}
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <Avatar name={selected.name} className="size-12 text-xl" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold leading-tight">{selected.name}</h1>
              <p className="truncate text-sm text-muted-foreground">{t("signIn.enterPin")}</p>
            </div>
            {/* Icon only on a phone, where the words would squeeze the name beside it. */}
            <button
              onClick={() => setSelected(null)}
              aria-label={t("signIn.switchUser")}
              title={t("signIn.switchUser")}
              className="inline-flex size-11 shrink-0 items-center justify-center gap-1.5 rounded-full text-sm font-medium text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:px-3"
            >
              <ArrowLeft className="size-5 sm:size-4" aria-hidden />
              <span className="hidden sm:inline">{t("signIn.switchUser")}</span>
            </button>
          </div>
          <div className="mt-5">
            <PinPad key={attempt} submitLabel={t("signIn.submit")} onSubmit={submit} busy={busy} error={error} />
          </div>
          <div className="mt-2 text-center">
            <button
              onClick={() => setRecoverOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <KeyRound className="size-4" aria-hidden /> {t("signIn.forgot")}
            </button>
          </div>
          <RecoverySheet open={recoverOpen} onOpenChange={setRecoverOpen} user={selected} onRecovered={() => { setError(null); setAttempt((a) => a + 1); }} />
        </>
      )}
    </Frame>
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
