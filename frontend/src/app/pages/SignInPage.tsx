/**
 * Sign in: name and PIN on one screen (§16.2, J1 steps 1–2). The PIN is checked only by the server.
 *
 * **Nobody is listed.** The screen used to show every active person as a tile with a face, which
 * told anyone on the shop's Wi-Fi who works there and which of them hold the keys (§26.2). Now the
 * person says who they are, and a name that matches nobody fails exactly as a wrong PIN does, so
 * the screen cannot be used to find out. Neither field autocompletes: on a shared till the
 * browser's memory of past names would be the same list again.
 *
 * **One form, one request.** It was two steps because the PIN pad listened to the whole keyboard —
 * a hardware keyboard types PINs too — so a name typed beside it landed in both. The pad is gone
 * from this screen: once there is a name field, a tablet has already raised its keyboard, and a
 * numeric input raises the numeric one, so a second keypad only cost a third of the screen. Both
 * steps always posted together anyway, which is what keeps the unknown-name case indistinguishable.
 *
 * One centred card at every size — a phone, a tablet on the counter, the Mac app's window. The
 * ground is flat and the only colour is the rule above the card and the button below it: this is
 * the one screen a stranger sees, and it should look like the front door of a business.
 */
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { isValidPin, normalisePinInput, PIN_LENGTH } from "@simon/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { homePathFor } from "@/config/navigation.ts";
import { problemMessage, t } from "@/i18n/t.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import { sessionStore, useSession, type SessionState } from "@/lib/session-store.ts";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <main className="w-full max-w-sm">
        <header className="mb-6 flex items-center justify-center gap-2.5">
          <img src="/favicon.svg" alt="" width={36} height={36} className="rounded-lg" />
          <span className="text-xl font-semibold tracking-tight">{t("app.name")}</span>
        </header>
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {/* The card's one piece of colour, and the only thing on the screen that is brand. */}
          <div aria-hidden className="h-1 bg-primary" />
          <div className="p-6 sm:p-7">{children}</div>
        </section>
      </main>
    </div>
  );
}

export function SignInPage() {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoverOpen, setRecoverOpen] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  // A shop with nobody in it yet goes to the wizard instead (§7.1). Nothing here is anybody's name.
  const setup = useQuery({
    queryKey: ["setup", "status"],
    queryFn: () => http.get<{ needsOwner: boolean }>("/setup/status"),
    retry: false,
  });

  if (session) return <Navigate to={(location.state as { from?: string } | null)?.from ?? homePathFor(session.user)} replace />;
  if (setup.data?.needsOwner) return <Navigate to="/setup" replace />;

  const ready = name.trim().length > 0 && isValidPin(pin);

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await http.post<SessionState>("/auth/login", {
        name: name.trim(),
        pin,
        deviceId: sessionStore.deviceId(),
        deviceLabel: navigator.platform || "Till",
      });
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
      // The name is almost never the mistake, so only the PIN is cleared and it takes the cursor.
      setPin("");
      setReveal(false);
      pinRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame>
      <h1 className="text-lg font-semibold">{t("signIn.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("signIn.pickHint")}</p>

      <form className="mt-6" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div>
          <Label htmlFor="sign-in-name">{t("signIn.name")}</Label>
          <Input
            id="sign-in-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("signIn.namePlaceholder")}
            autoFocus
            autoComplete="off"
            autoCapitalize="words"
            spellCheck={false}
            enterKeyHint="next"
            className="h-touch-lg"
          />
        </div>

        <div className="mt-4">
          <Label htmlFor="sign-in-pin">{t("signIn.pin")}</Label>
          <div className="relative">
            <Input
              id="sign-in-pin"
              ref={pinRef}
              // Masked by default, and digits only whatever the keyboard or a paste sends.
              type={reveal ? "text" : "password"}
              value={pin}
              onChange={(e) => setPin(normalisePinInput(e.target.value))}
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="go"
              maxLength={PIN_LENGTH}
              className="h-touch-lg tabular pr-touch tracking-[0.35em]"
            />
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              aria-label={t(reveal ? "signIn.hidePin" : "signIn.showPin")}
              aria-pressed={reveal}
              className="absolute inset-y-0 right-0 inline-flex w-touch items-center justify-center rounded-r-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {reveal ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
            </button>
          </div>
        </div>

        {/*
          One message, whatever went wrong, so the screen never tells the two failures apart.
          No space is reserved for it: this form is never mid-task, so the shift when it appears
          costs nothing, and reserving the line left a visible hole under the resting screen.
        */}
        <div role="alert">
          {(error || setup.isError) && (
            <p className="mt-4 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
              {error ?? problemMessage("network")}
            </p>
          )}
        </div>

        <Button type="submit" size="lg" className="mt-5 w-full" disabled={!ready || busy}>
          {busy ? <Loader2 className="animate-spin" aria-label={t("common.loading")} /> : t("signIn.submit")}
        </Button>
      </form>

      <div className="mt-4 border-t border-border pt-3 text-center">
        <button
          type="button"
          onClick={() => setRecoverOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground"
        >
          <KeyRound className="size-4" aria-hidden /> {t("signIn.forgot")}
        </button>
      </div>
      <RecoverySheet open={recoverOpen} onOpenChange={setRecoverOpen} onRecovered={() => { setError(null); setPin(""); }} />
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
