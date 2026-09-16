/**
 * Կարգավորումներ (§6.11): the few things that differ between shops, each explained. The three
 * installation settings are marked as such. Users, devices and sessions live here too (§16).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Plus, Smartphone, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { Role } from "@simon/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { BackupSection } from "@/features/control/BackupSection.tsx";
import { DiagnosticsSection } from "@/features/control/DiagnosticsSection.tsx";
import { Toggle } from "@/features/products/ProductEditor.tsx";
import { problemMessage, t, type StringKey } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { dateTime } from "@/lib/format.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import { settingsKey } from "../settings.ts";

type Settings = Record<string, unknown>;

function Section({ title, hint, children, onSave, dirty }: { title: string; hint?: string; children: ReactNode; onSave?: () => void; dirty?: boolean }) {
  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-border md:p-5">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex-1"><h2 className="text-lg font-semibold">{title}</h2>{hint && <p className="text-sm text-muted-foreground">{hint}</p>}</div>
        {onSave && <Button size="sm" disabled={!dirty} onClick={onSave}>{t("common.save")}</Button>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Choice<T extends string | number>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <button key={String(v)} type="button" onClick={() => onChange(v)} className={cn("h-touch rounded-lg border px-4 font-medium", value === v ? "border-primary bg-primary-soft text-accent-foreground" : "border-border")}>{label}</button>
      ))}
    </div>
  );
}

function NumberField({ label, value, onChange, scale = 1 }: { label: string; value: number; onChange: (v: number) => void; scale?: number }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input inputMode="decimal" className="tabular max-w-48" value={String(value / scale)} onChange={(e) => { const n = Number(e.target.value.replace(",", ".")); if (Number.isFinite(n)) onChange(Math.round(n * scale)); }} />
    </div>
  );
}

export function SettingsPage() {
  const remote = useQuery({ queryKey: ["settings", "admin"], queryFn: () => http.get<Settings>("/settings") });
  if (!remote.data) return null;
  // Keyed on the saved version: a save or a refetch starts the draft from what the server holds.
  return <SettingsForm key={String(remote.data.updatedAt)} saved={remote.data} refetch={remote.refetch} />;
}

function SettingsForm({ saved, refetch }: { saved: Settings; refetch: () => Promise<unknown> }) {
  const qc = useQueryClient();
  const remote = { data: saved, refetch };
  const [draft, setDraft] = useState<Settings>(saved);
  const set = (key: string) => (v: unknown) => setDraft((d) => ({ ...d, [key]: v }));
  const dirty = (keys: string[]) => keys.some((k) => remote.data && draft[k] !== remote.data[k]);
  const save = async (keys: string[]) => {
    const patch = Object.fromEntries(keys.filter((k) => draft[k] !== remote.data?.[k]).map((k) => [k, draft[k]]));
    try {
      await http.patch("/settings", patch);
      await Promise.all([remote.refetch(), qc.invalidateQueries({ queryKey: settingsKey })]);
      toast.success(t("settings.saved"));
    } catch (err) {
      toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network"));
    }
  };
  const s = draft;
  const INSTALL = ["tax.regime", "tax.priceBasis", "tax.rateBp", "shop.timezone"];
  const SHOP = ["shop.name", "shop.address"];
  const SELL = ["discount.maxBp", "offline.discountCeilingBp", "cash.roundingStep", "stock.strictNegative"];
  const DEBT = ["debt.enabled", "debt.defaultLimit", "offline.debtCap", "debt.strictLimit"];
  const SHIFT = ["shift.varianceNoteThreshold", "ui.textSize"];
  const STOCK = ["reorder.safetyDays", "backup.destination"];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">{t("nav.settings")}</h1>

      <Section title={t("settings.installation")} hint={t("settings.installationHint")} onSave={() => void save(INSTALL)} dirty={dirty(INSTALL)}>
        <div>
          <Label>{t("settings.taxRegime")}</Label>
          {s["tax.regime"] === null && <p className="mb-2 rounded-lg bg-attention-soft p-2 text-sm text-attention-foreground">{t("till.taxNotSet")}</p>}
          <Choice value={(s["tax.regime"] as string) ?? ""} options={(["VAT", "TURNOVER", "MICRO"] as const).map((r) => [r, t(`settings.regimes.${r}`)])} onChange={set("tax.regime")} />
        </div>
        <div>
          <Label>{t("settings.priceBasis")}</Label>
          <Choice value={s["tax.priceBasis"] as string} options={(["INCLUSIVE", "EXCLUSIVE"] as const).map((b) => [b, t(`settings.bases.${b}`)])} onChange={set("tax.priceBasis")} />
        </div>
        {s["tax.regime"] === "VAT" && <NumberField label={t("settings.taxRate")} value={s["tax.rateBp"] as number} scale={100} onChange={set("tax.rateBp")} />}
        <div>
          <Label>{t("settings.timezone")}</Label>
          <Input className="max-w-64" value={s["shop.timezone"] as string} onChange={(e) => set("shop.timezone")(e.target.value)} />
        </div>
      </Section>

      <Section title={t("settings.shop")} onSave={() => void save(SHOP)} dirty={dirty(SHOP)}>
        <div><Label>{t("settings.shopName")}</Label><Input value={s["shop.name"] as string} onChange={(e) => set("shop.name")(e.target.value)} /></div>
        <div><Label>{t("settings.address")}</Label><Input value={s["shop.address"] as string} onChange={(e) => set("shop.address")(e.target.value)} /></div>
      </Section>

      <Section title={t("settings.selling")} onSave={() => void save(SELL)} dirty={dirty(SELL)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField label={t("settings.maxDiscount")} value={s["discount.maxBp"] as number} scale={100} onChange={set("discount.maxBp")} />
          <NumberField label={t("settings.offlineDiscount")} value={s["offline.discountCeilingBp"] as number} scale={100} onChange={set("offline.discountCeilingBp")} />
        </div>
        <div><Label>{t("settings.cashRounding")}</Label><Choice value={s["cash.roundingStep"] as number} options={[[1, "—"], [10, "10"], [50, "50"], [100, "100"]]} onChange={set("cash.roundingStep")} /></div>
        <Toggle checked={s["stock.strictNegative"] as boolean} onChange={set("stock.strictNegative")} label={t("settings.strictStock")} />
      </Section>

      <Section title={t("settings.debt")} onSave={() => void save(DEBT)} dirty={dirty(DEBT)}>
        <Toggle checked={s["debt.enabled"] as boolean} onChange={set("debt.enabled")} label={t("settings.debtEnabled")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField label={t("settings.defaultLimit")} value={s["debt.defaultLimit"] as number} onChange={set("debt.defaultLimit")} />
          <NumberField label={t("settings.offlineDebtCap")} value={s["offline.debtCap"] as number} onChange={set("offline.debtCap")} />
        </div>
        <Toggle checked={s["debt.strictLimit"] as boolean} onChange={set("debt.strictLimit")} label={t("settings.strictLimit")} />
      </Section>

      <Section title={t("settings.shift")} onSave={() => void save(SHIFT)} dirty={dirty(SHIFT)}>
        <NumberField label={t("settings.varianceNote")} value={s["shift.varianceNoteThreshold"] as number} onChange={set("shift.varianceNoteThreshold")} />
        <div><Label>{t("settings.textSize")}</Label><Choice value={s["ui.textSize"] as string} options={(["normal", "large", "xlarge"] as const).map((k) => [k, t(`settings.sizes.${k}`)])} onChange={set("ui.textSize")} /></div>
      </Section>

      <Section title={t("settings.stock")} onSave={() => void save(STOCK)} dirty={dirty(STOCK)}>
        <div>
          <Label>{t("settings.safetyDays")}</Label>
          <p className="mb-2 text-sm text-muted-foreground">{t("settings.safetyDaysHint")}</p>
          <NumberField label="" value={s["reorder.safetyDays"] as number} onChange={set("reorder.safetyDays")} />
        </div>
        <div>
          <Label>{t("backup.destination")}</Label>
          <Choice value={s["backup.destination"] as string} options={(["LOCAL", "LOCAL+USB"] as const).map((k) => [k, t(`backup.destinations.${k}` as StringKey)])} onChange={set("backup.destination")} />
        </div>
      </Section>

      <UsersSection />
      <DevicesSection />
      <BackupSection Section={Section} />
      <DiagnosticsSection Section={Section} />
    </div>
  );
}

interface UserRow { id: string; name: string; role: Role; isActive: boolean; lockedUntil: string | null }

function UsersSection() {
  const users = useQuery({ queryKey: ["users"], queryFn: () => http.get<{ items: UserRow[] }>("/users") });
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);
  const [now] = useState(() => Date.now());
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("WORKER");
  const [pin, setPin] = useState("");
  const act = async (fn: () => Promise<unknown>) => {
    try { await fn(); await users.refetch(); toast.success(t("settings.saved")); } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
  };
  const openEditor = (u: UserRow | "new") => { setEditing(u); setName(u === "new" ? "" : u.name); setRole(u === "new" ? "WORKER" : u.role); setPin(""); };
  const submit = () => act(async () => {
    if (editing === "new") await http.post("/users", { name, role, pin });
    else if (editing) await http.patch(`/users/${editing.id}`, { name, role, ...(pin ? { pin } : {}) });
    setEditing(null);
  });
  return (
    <Section title={t("settings.users")}>
      <ul className="divide-y divide-border">
        {users.data?.items.map((u) => {
          const locked = u.lockedUntil !== null && Date.parse(u.lockedUntil) > now;
          return (
            <li key={u.id} className="flex flex-wrap items-center gap-2 py-2">
              <UserRound className="size-5 text-muted-foreground" aria-hidden />
              <button className="min-w-0 flex-1 text-left" onClick={() => openEditor(u)}>
                <div className={cn("font-medium", !u.isActive && "text-muted-foreground line-through")}>{u.name}</div>
                <div className="text-sm text-muted-foreground">{t(`settings.roles.${u.role}` as StringKey)}{locked ? ` · ${t("settings.locked")}` : ""}{!u.isActive ? ` · ${t("settings.inactiveUser")}` : ""}</div>
              </button>
              {locked && <Button size="sm" variant="attention" onClick={() => void act(() => http.post("/auth/unlock", { userId: u.id }))}><Lock />{t("settings.unlock")}</Button>}
              <Button size="sm" variant="ghost" onClick={() => void act(() => http.patch(`/users/${u.id}`, { isActive: !u.isActive }))}>{u.isActive ? t("settings.deactivate") : t("settings.activate")}</Button>
            </li>
          );
        })}
      </ul>
      <Button variant="soft" onClick={() => openEditor("new")}><Plus />{t("settings.addUser")}</Button>
      <Sheet open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }} title={editing === "new" ? t("settings.addUser") : (editing?.name ?? "")}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div><Label>{t("products.name")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <div><Label>{t("settings.role")}</Label><Choice value={role} options={(["WORKER", "STOCK", "ADMIN"] as const).map((r) => [r, t(`settings.roles.${r}`)])} onChange={setRole} /></div>
          <div><Label>{editing === "new" ? t("settings.pin") : t("settings.changePin")}</Label><Input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" type="password" autoComplete="new-password" className="tabular tracking-widest" /></div>
          <Button type="submit" size="lg" className="w-full" disabled={!name.trim() || (editing === "new" ? pin.length < 4 : pin.length > 0 && pin.length < 4)}>{t("common.save")}</Button>
        </form>
      </Sheet>
    </Section>
  );
}

interface DeviceRow { id: string; prefix: string; label: string; lastSeenAt: string | null; outboxDepth: number; isActive: boolean }
interface SessionRow { id: string; userName: string | null; deviceLabel: string | null; devicePrefix: string | null; lastSeenAt: string }

function DevicesSection() {
  const devices = useQuery({ queryKey: ["devices"], queryFn: () => http.get<{ items: DeviceRow[] }>("/devices") });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => http.get<{ items: SessionRow[] }>("/sessions") });
  const act = async (fn: () => Promise<unknown>) => {
    try { await fn(); await Promise.all([devices.refetch(), sessions.refetch()]); } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
  };
  return (
    <Section title={t("settings.devices")}>
      <ul className="divide-y divide-border">
        {devices.data?.items.map((d) => (
          <li key={d.id} className="flex items-center gap-3 py-2">
            <Smartphone className="size-5 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className={cn("font-medium", !d.isActive && "text-muted-foreground line-through")}><span className="tabular mr-2 rounded bg-muted px-1.5 text-sm">{d.prefix}</span>{d.label}</div>
              <div className="text-sm text-muted-foreground">{d.lastSeenAt ? t("settings.lastSeen", { time: dateTime(d.lastSeenAt) }) : ""}{d.outboxDepth ? ` · ${t("settings.pending", { n: d.outboxDepth })}` : ""}</div>
            </div>
            {d.isActive && <Button size="sm" variant="ghost" onClick={() => void act(() => http.patch(`/devices/${d.id}`, { isActive: false }))}>{t("settings.deactivate")}</Button>}
          </li>
        ))}
      </ul>
      <h3 className="pt-2 font-semibold">{t("settings.sessions")}</h3>
      <ul className="divide-y divide-border">
        {sessions.data?.items.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1"><div className="font-medium">{s.userName}</div><div className="text-sm text-muted-foreground">{s.devicePrefix} {s.deviceLabel} · {dateTime(s.lastSeenAt)}</div></div>
            <Button size="sm" variant="ghost" onClick={() => void act(() => http.post(`/sessions/${s.id}/revoke`))}>{t("settings.revoke")}</Button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
