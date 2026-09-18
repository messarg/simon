/**
 * Sign in: type your name, then your PIN (§16.2, J1 steps 1–2). The PIN is checked only by the
 * server.
 *
 * **Nobody is listed.** The screen used to show every active person as a tile with a face, which
 * told anyone on the shop's Wi-Fi who works there and which of them hold the keys (§26.2). Now the
 * person says who they are, and a name that matches nobody fails exactly as a wrong PIN does, so
 * the screen cannot be used to find out. The name field does not autocomplete: on a shared till
 * the browser's memory of past names would be the same list again.
 *
 * Two steps rather than one form, because the PIN pad listens to the whole keyboard — a hardware
 * keyboard types PINs too — and a name typed beside it would land in both.
 *
 * One centred card at every size — a phone, a tablet on the counter, the Mac app's window — so
 * the first thing anyone sees sits in the middle of the screen, not hanging from its top edge.
 */
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, KeyRound } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Avatar, PinPad } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { homePathFor } from "@/config/navigation.ts";
import { problemMessage, t } from "@/i18n/t.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import { sessionStore, useSession, type SessionState } from "@/lib/session-store.ts";

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
  const [typed, setTyped] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [recoverOpen, setRecoverOpen] = useState(false);

  // A shop with nobody in it yet goes to the wizard instead (§7.1). Nothing here is anybody's name.
  const setup = useQuery({
    queryKey: ["setup", "status"],
    queryFn: () => http.get<{ needsOwner: boolean }>("/setup/status"),
    retry: false,
  });

  if (session) return <Navigate to={(location.state as { from?: string } | null)?.from ?? homePathFor(session.user)} replace />;
  if (setup.data?.needsOwner) return <Navigate to="/setup" replace />;

  const submit = async (pin: string) => {
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await http.post<SessionState>("/auth/login", { name, pin, deviceId: sessionStore.deviceId(), deviceLabel: navigator.platform || "Till" });
      sessionStore.set(res);
      navigate((location.state as { from?: string } | null)?.from ?? homePathFor(res.user), { replace: true });
    } catch (err) {
      const p = err instanceof ApiProblem ? err : null;
      // The server does not say whether the name or the PIN was wrong, and neither does this.
      if (p?.type === "pin-incorrect") {
        const left = p.field<number>("attemptsRemaining");
        setError(typeof left === "number" ? `${t("signIn.wrong")} · ${t("signIn.attemptsLeft", { n: left })}` : t("signIn.wrong"));
      } else if (p?.type === "account-locked") setError(t("signIn.locked", { n: p.field<number>("minutesRemaining") ?? 15 }));
      else if (p?.type === "too-many-attempts") setError(t("signIn.tooMany", { n: p.field<number>("retryAfterSeconds") ?? 60 }));
      else setError(problemMessage(p?.type ?? "network"));
      setAttempt((a) => a + 1);
    } finally {
      setBusy(false);
    }
  };

  const toPin = () => { if (typed.trim()) { setName(typed.trim()); setError(null); } };

  return (
    <Frame>
      {name === null ? (
        <form onSubmit={(e) => { e.preventDefault(); toPin(); }}>
          <h1 className="text-center text-xl font-semibold">{t("signIn.title")}</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">{t("signIn.pickHint")}</p>
          <div className="mt-6">
            <Label htmlFor="sign-in-name">{t("signIn.name")}</Label>
            <Input
              id="sign-in-name"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={t("signIn.namePlaceholder")}
              autoFocus
              autoComplete="off"
              autoCapitalize="words"
              spellCheck={false}
              enterKeyHint="next"
              className="h-touch-lg text-lg"
            />
          </div>
          <Button type="submit" size="lg" className="mt-4 w-full" disabled={!typed.trim()}>
            {t("signIn.next")}<ArrowRight />
          </Button>
          {setup.isError && <p className="mt-4 text-center text-sm text-muted-foreground" role="alert">{problemMessage("network")}</p>}
        </form>
      ) : (
        <>
          {/* Who is signing in, as they typed it, and the way back on one row above the keypad. */}
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <Avatar name={name} className="size-12 text-xl" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold leading-tight">{name}</h1>
              <p className="truncate text-sm text-muted-foreground">{t("signIn.enterPin")}</p>
            </div>
            {/* Icon only on a phone, where the words would squeeze the name beside it. */}
            <button
              onClick={() => { setName(null); setError(null); }}
              aria-label={t("signIn.switchUser")}
              title={t("signIn.switchUser")}
              className="inline-flex size-11 shrink-0 items-center justify-center gap-1.5 rounded-md text-sm font-medium text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:px-3"
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
          <RecoverySheet open={recoverOpen} onOpenChange={setRecoverOpen} onRecovered={() => { setError(null); setAttempt((a) => a + 1); }} />
        </>
      )}
    </Frame>
  );
}

/** The owner's way back in (§16.2): the code on their paper says whose it is, so nobody is picked. */
function RecoverySheet({ open, onOpenChange, onRecovered }: { open: boolean; onOpenChange: (o: boolean) => void; onRecovered: () => void }) {
  const [code, setCode] = useState("");
  const [newCode, setNewCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    try {
      const res = await http.post<{ recoveryCode: string }>("/auth/recover", { recoveryCode: code });
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
