/**
 * The setup wizard (§7.1, §27.35). Five questions, no jargon, skippable and resumable — every
 * answer is written as it is given, so closing the laptop halfway costs nothing.
 *
 * Q1 and Q2 arrive together because nothing can be written before there is somebody authorised to
 * have written it: the owner's own PIN at Q2 is the first admin account. The wizard ends by showing
 * two secrets once — the recovery code and the backup passphrase — and waiting while they are
 * written on paper.
 */
import { useQuery } from "@tanstack/react-query";
import { KeyRound, ShieldCheck, Store, UserPlus } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { isValidPin, normalisePinInput, PERMISSION_PRESETS, PIN_LENGTH, type Permission, type Role } from "@simon/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import { sessionStore, useSession } from "@/lib/session-store.ts";

interface SetupStatus { needsOwner: boolean; step: number; completedAt: string | null; taxRegimeSet: boolean }
interface Secrets { recoveryCode: string; backupPassphrase: string }

const QUESTIONS = 5;

/**
 * One centred card, the sign-in screen's shape (§7.1).
 *
 * The insets are folded into the padding rather than applied with `safe-top`, which *sets*
 * padding-top to the inset — 0px on any screen without a notch — and so silently cancelled the
 * top half of `py-10`, leaving the card hanging from the top edge while the bottom kept its
 * padding. `min-h-dvh` with `items-center` is safe for a card taller than the screen: the
 * container grows rather than clipping, which `h-dvh` would not.
 */
function Card({ children, icon: Icon, title, hint, step }: { children: React.ReactNode; icon: typeof Store; title: string; hint?: string; step?: number }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary"><Icon className="size-6" aria-hidden /></div>
          {step !== undefined && <span className="tabular text-sm text-muted-foreground">{t("wizard.progress", { n: step })}</span>}
        </div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {hint && <p className="mt-1 mb-6 text-muted-foreground">{hint}</p>}
        <div className={hint ? "" : "mt-6"}>{children}</div>
      </div>
    </div>
  );
}

function Choice({ options, onChoose, busy }: { options: Array<[string, string]>; onChoose: (value: string) => void; busy?: boolean }) {
  return (
    <div className="space-y-3">
      {options.map(([value, label]) => (
        <Button key={value} size="lg" variant="secondary" className="w-full justify-start text-left" disabled={busy} onClick={() => onChoose(value)}>{label}</Button>
      ))}
    </div>
  );
}

export function SetupPage() {
  const navigate = useNavigate();
  const session = useSession();
  const status = useQuery({ queryKey: ["setup", "status"], queryFn: () => http.get<SetupStatus>("/setup/status") });
  const [step, setStep] = useState<number | null>(null);
  const [secrets, setSecrets] = useState<Secrets | null>(null);
  // Shown the moment they exist and again at the end: a wizard abandoned after Q2 must not leave the
  // owner without the two pieces of paper he cannot be given a second time (§7.1, §16.2, §19.2).
  const [secretsWritten, setSecretsWritten] = useState(false);
  const [catalogue, setCatalogue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!status.data) return null;
  const { needsOwner, completedAt, taxRegimeSet } = status.data;
  if (!needsOwner && completedAt && !secrets) return <Navigate to="/sell" replace />;
  // Resuming needs the admin who started it: the account exists, so there is a real person to sign in.
  if (!needsOwner && !session) return <Navigate to="/sign-in" replace state={{ resumeSetup: true }} />;

  const current = step ?? (needsOwner ? 1 : Math.min(QUESTIONS, status.data.step + 1));

  const save = async (patch: Record<string, unknown>, nextStep: number) => {
    setBusy(true);
    setError(null);
    try {
      await http.patch("/settings", { ...patch, "setup.step": Math.max(status.data.step, nextStep - 1) });
      setStep(nextStep);
    } catch (err) {
      setError(problemMessage(err instanceof ApiProblem ? err.type : "network"));
    } finally {
      setBusy(false);
    }
  };

  if (current === 1) return <ShopName onDone={(name) => { setStep(2); sessionStorage.setItem("simon.setup.shopName", name); }} initial={sessionStorage.getItem("simon.setup.shopName") ?? ""} />;

  if (current === 2 && needsOwner) {
    return <Owner shopName={sessionStorage.getItem("simon.setup.shopName") ?? ""} onDone={(s) => { setSecrets(s); void status.refetch(); }} />;
  }

  // Between Q2 and Q3: write these two down before anything else happens.
  if (secrets && !secretsWritten) {
    return (
      <Card icon={ShieldCheck} title={t("setup.recoveryTitle")} hint={t("setup.recoveryHint")}>
        <Secrets secrets={secrets} />
        <Button size="lg" className="mt-6 w-full" onClick={() => { setSecretsWritten(true); setStep(3); }}>{t("setup.recoveryConfirm")}</Button>
      </Card>
    );
  }

  if (current === 2) return <Staff onDone={() => void save({}, 3)} busy={busy} />;

  if (current === 3) {
    return (
      <Card icon={Store} title={t("wizard.q3")} hint={t("wizard.q3Hint")} step={3}>
        <Choice busy={busy} options={[["pieces", t("wizard.q3Pieces")], ["measure", t("wizard.q3Measure")]]} onChoose={(v) => void save({ "setup.sellsByMeasure": v === "measure" }, 4)} />
        <SkipRow onSkip={() => void save({}, 4)} error={error} />
      </Card>
    );
  }

  if (current === 4) {
    return (
      <Card icon={Store} title={t("wizard.q4")} hint={t("wizard.q4Hint")} step={4}>
        <Choice busy={busy} options={[["yes", t("wizard.q4Yes")], ["no", t("wizard.q4No")]]} onChoose={(v) => void save({ "debt.enabled": v === "yes" }, 5)} />
        <SkipRow onSkip={() => void save({}, 5)} error={error} />
      </Card>
    );
  }

  if (current === 5) {
    return (
      <Card icon={Store} title={t("wizard.q5")} hint={t("wizard.q5Hint")} step={5}>
        <Choice
          busy={busy}
          options={[["import", t("wizard.q5Import")], ["as-you-sell", t("wizard.q5AsYouSell")]]}
          onChoose={(v) => { setCatalogue(v); void save({ "setup.catalogue": v, "setup.completedAt": new Date().toISOString() }, 6).then(() => setStep(6)); }}
        />
        <SkipRow onSkip={() => void save({ "setup.completedAt": new Date().toISOString() }, 6).then(() => setStep(6))} error={error} />
      </Card>
    );
  }

  // The last screen: the two secrets once more, what is still outstanding, and the way into the shop.
  const wantsImport = catalogue === "import";
  return (
    <Card icon={ShieldCheck} title={t("wizard.doneTitle")} hint={t("wizard.doneHint")}>
      {secrets && <Secrets secrets={secrets} />}
      {!taxRegimeSet && <p className="mt-4 rounded-lg bg-attention-soft p-3 text-sm text-attention-foreground">{t("wizard.taskTax")}</p>}
      <div className="mt-6">
        <Button size="lg" className="w-full" onClick={() => navigate(wantsImport ? "/import" : "/sell", { replace: true })}>
          {wantsImport ? t("wizard.goImport") : t("wizard.goSell")}
        </Button>
      </div>
    </Card>
  );
}

function Secrets({ secrets }: { secrets: Secrets }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold">{t("setup.recoveryTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("setup.recoveryHint")}</p>
        <p className="tabular mt-2 rounded-lg bg-muted p-4 text-center text-xl font-semibold tracking-wider">{secrets.recoveryCode}</p>
      </div>
      <div>
        <h2 className="font-semibold">{t("setup.passphraseTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("setup.passphraseHint")}</p>
        <p className="tabular mt-2 rounded-lg bg-muted p-4 text-center text-lg font-semibold tracking-wider">{secrets.backupPassphrase}</p>
      </div>
    </div>
  );
}

function SkipRow({ onSkip, error }: { onSkip: () => void; error: string | null }) {
  return (
    <>
      {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
      <button type="button" onClick={onSkip} className="mt-4 h-touch w-full text-muted-foreground">{t("wizard.skip")}</button>
    </>
  );
}

function ShopName({ initial, onDone }: { initial: string; onDone: (name: string) => void }) {
  const [name, setName] = useState(initial);
  return (
    <Card icon={Store} title={t("wizard.q1")} hint={t("wizard.q1Hint")} step={1}>
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onDone(name.trim()); }}>
        <Label htmlFor="shop">{t("setup.shopName")}</Label>
        <Input id="shop" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("setup.shopNamePlaceholder")} autoFocus />
        <Button type="submit" size="lg" className="mt-6 w-full" disabled={!name.trim()}>{t("wizard.next")}</Button>
      </form>
    </Card>
  );
}

/** Q2: the owner types their own PIN, and that account is what makes everything else reachable. */
function Owner({ shopName, onDone }: { shopName: string; onDone: (secrets: Secrets) => void }) {
  const [ownerName, setOwnerName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = shopName && ownerName.trim() && isValidPin(pin) && pin === pin2;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await http.post<{ user: { id: string }; recoveryCode: string; backupPassphrase: string }>("/setup/owner", { shopName, ownerName: ownerName.trim(), pin });
      // Sign in with the name and PIN just chosen, so the rest of the wizard has the owner behind it.
      const session = await http.post<{ token: string; user: { id: string; name: string; role: Role; permissions: Permission[] }; session: { id: string; mode: "LIVE" | "PRACTICE"; expiresAt: string; shiftId: string | null }; device: { id: string; prefix: string; label: string; lastSequence: number } }>(
        "/auth/login", { name: ownerName.trim(), pin, deviceLabel: t("app.name") },
      );
      sessionStore.set({ token: session.token, user: session.user, session: session.session, device: session.device });
      onDone({ recoveryCode: res.recoveryCode, backupPassphrase: res.backupPassphrase });
    } catch (err) {
      setError(problemMessage(err instanceof ApiProblem ? err.type : "network"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card icon={KeyRound} title={t("wizard.q2")} hint={t("wizard.q2Hint")} step={2}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid && !busy) void submit(); }}>
        <div>
          <Label htmlFor="owner">{t("setup.ownerName")}</Label>
          <Input id="owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} autoComplete="name" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="pin">{t("setup.ownerPin")}</Label>
            <Input id="pin" value={pin} onChange={(e) => setPin(normalisePinInput(e.target.value))} inputMode="numeric" type="password" autoComplete="new-password" className="tabular text-lg tracking-widest" />
          </div>
          <div>
            <Label htmlFor="pin2">{t("setup.ownerPinRepeat")}</Label>
            <Input id="pin2" value={pin2} onChange={(e) => setPin2(normalisePinInput(e.target.value))} inputMode="numeric" type="password" autoComplete="new-password" className="tabular text-lg tracking-widest" />
          </div>
        </div>
        {pin2.length >= PIN_LENGTH && pin !== pin2 && <p className="text-sm text-destructive" role="alert">{t("setup.pinMismatch")}</p>}
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={!valid || busy}>{t("wizard.next")}</Button>
      </form>
    </Card>
  );
}

/**
 * The rest of Q2: the people who will use it, added now or later. Most are one of the two
 * presets (§16.4) — the owner fine-tunes a person's jobs later on the staff screen — or a manager.
 */
const KINDS = ["cashier", "stock", "manager"] as const;
type Kind = (typeof KINDS)[number];
const bodyFor = (kind: Kind) => kind === "manager" ? { role: "MANAGER" as const } : { role: "EMPLOYEE" as const, permissions: [...PERMISSION_PRESETS[kind]] };

function Staff({ onDone, busy }: { onDone: () => void; busy: boolean }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [kind, setKind] = useState<Kind>("cashier");
  const [added, setAdded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    try {
      await http.post("/users", { name: name.trim(), pin, ...bodyFor(kind) });
      setAdded((a) => [...a, name.trim()]);
      setName("");
      setPin("");
    } catch (err) {
      setError(problemMessage(err instanceof ApiProblem ? err.type : "network"));
    }
  };

  return (
    <Card icon={UserPlus} title={t("wizard.q2")} hint={t("wizard.q2Hint")} step={2}>
      <div className="space-y-4">
        {added.length > 0 && <ul className="space-y-1 text-sm text-muted-foreground">{added.map((a) => <li key={a}>{t("wizard.q2Added", { name: a })}</li>)}</ul>}
        <div>
          <Label htmlFor="staff">{t("products.name")}</Label>
          <Input id="staff" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="staff-pin">{t("settings.pin")}</Label>
            <Input id="staff-pin" value={pin} onChange={(e) => setPin(normalisePinInput(e.target.value))} inputMode="numeric" type="password" className="tabular tracking-widest" />
          </div>
          <div>
            <Label>{t("wizard.q2Role")}</Label>
            <div className="flex gap-1">
              {KINDS.map((k) => (
                <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={cn("h-touch flex-1 rounded-lg border px-2 text-sm font-medium", kind === k ? "border-primary bg-primary-soft" : "border-border")}>
                  {k === "manager" ? t("settings.roles.MANAGER") : t(`staff.presets.${k}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button className="w-full" disabled={!name.trim() || !isValidPin(pin)} onClick={() => void add()}><UserPlus />{t("wizard.q2Add")}</Button>
        <Button size="lg" className="w-full" disabled={busy} onClick={onDone}>{t("wizard.next")}</Button>
      </div>
    </Card>
  );
}
