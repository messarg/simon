/**
 * Add someone, or change what is recorded about them (§6.17): the photograph, the name, their tier
 * and — for an employee — the jobs they may do (§16.4), a new PIN, and the three personal details
 * the shop keeps so that nobody keeps them in a separate notebook — a phone number, the day they
 * started, and a free note.
 *
 * What is offered follows `@simon/shared`'s staff policy, the same rule the server enforces: the
 * owner makes managers and employees, a manager makes employees, and nobody makes an owner or
 * changes the owner's standing. A manager editing their own record keeps their name, PIN and
 * details, and sees their tier as a fact rather than a choice.
 *
 * The name has to say who is signing in (§16.2), so a second active person with the same one is
 * refused — `duplicate-name` explains that here, in the field that caused it.
 *
 * There is no delete — rule 4. A person who sold anything is part of the books for as long as the
 * books are kept; taking their access away is `isActive`, and it lives on the list beside them.
 */
import { useState } from "react";
import { toast } from "sonner";
import { assignableRoles, canManage, isValidPin, normalisePermissions, normalisePinInput, Permission, PERMISSION_PRESETS, type Role } from "@simon/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import { useSession } from "@/lib/session-store.ts";
import { AvatarField } from "./AvatarField.tsx";
import type { StaffUser } from "./types.ts";

/** "new" is the person who does not exist yet; null is a closed sheet. */
export type EditorTarget = StaffUser | "new" | null;

export interface PersonEditorProps {
  target: EditorTarget;
  onClose: () => void;
  /** Refetch whatever drew the row — the list, the person's own page, or both. */
  onSaved: () => void;
}

const trimmed = (v: string) => (v.trim() === "" ? null : v.trim());
const samePermissions = (a: readonly Permission[], b: readonly Permission[]) => a.length === b.length && a.every((p) => b.includes(p));

export function PersonEditor({ target, onClose, onSaved }: PersonEditorProps) {
  const person = target === "new" || target === null ? null : target;
  return (
    <Sheet open={target !== null} onOpenChange={(o) => { if (!o) onClose(); }} title={target === "new" ? t("settings.addUser") : (person?.name ?? "")}>
      {/* Mounted per person, so the fields start from that row rather than being copied into
          state by an effect — opening the sheet on somebody else is a fresh form. */}
      {target !== null && <PersonForm key={person?.id ?? "new"} person={person} onClose={onClose} onSaved={onSaved} />}
    </Sheet>
  );
}

function PersonForm({ person, onClose, onSaved }: { person: StaffUser | null; onClose: () => void; onSaved: () => void }) {
  const session = useSession();
  const viewer = session ? { id: session.user.id, role: session.user.role } : { id: "", role: "EMPLOYEE" as Role };
  const offered = assignableRoles(viewer.role);
  // A new person is always someone the viewer may shape; an existing one only if the policy says so.
  const setsStanding = person ? canManage(viewer, { id: person.id, role: person.role }, "setRole") : offered.length > 0;

  const [name, setName] = useState(person?.name ?? "");
  const [role, setRole] = useState<Role>(person?.role ?? "EMPLOYEE");
  const [permissions, setPermissions] = useState<Permission[]>(person ? person.permissions : [...PERMISSION_PRESETS.cashier]);
  const [pin, setPin] = useState("");
  const [phone, setPhone] = useState(person?.phone ?? "");
  const [startedOn, setStartedOn] = useState(person?.startedOn ?? "");
  const [note, setNote] = useState(person?.note ?? "");
  const [avatarAt, setAvatarAt] = useState<string | null>(person?.avatarUpdatedAt ?? null);
  const [nameTaken, setNameTaken] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggle = (p: Permission) => setPermissions((cur) => normalisePermissions(cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setNameTaken(false);
    try {
      const details = { phone: trimmed(phone), startedOn: trimmed(startedOn), note: trimmed(note) };
      // Standing is sent only by someone allowed to set it: a manager saving their own record
      // must not look to the server like a manager trying to change their own tier.
      const standing = setsStanding ? { role, ...(role === "EMPLOYEE" ? { permissions } : {}) } : {};
      if (person) await http.patch(`/users/${person.id}`, { name: name.trim(), ...standing, ...(pin ? { pin } : {}), ...details });
      else await http.post("/users", { name: name.trim(), ...standing, pin, ...details });
      onSaved();
      onClose();
      toast.success(t("settings.saved"));
    } catch (err) {
      if (err instanceof ApiProblem && err.type === "duplicate-name") setNameTaken(true);
      toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network"));
    } finally {
      setBusy(false);
    }
  };

  const incomplete = !name.trim() || (person ? pin.length > 0 && !isValidPin(pin) : !isValidPin(pin));

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      {/* A photograph needs a row to hang on, so it is offered once the person exists. */}
      {person && (
        <AvatarField
          userId={person.id}
          name={name || person.name}
          avatarUpdatedAt={avatarAt}
          onChange={(at) => { setAvatarAt(at); onSaved(); }}
        />
      )}
      <div>
        <Label htmlFor="person-name">{t("products.name")}</Label>
        <Input
          id="person-name" value={name} autoFocus
          onChange={(e) => { setName(e.target.value); setNameTaken(false); }}
          aria-invalid={nameTaken || undefined} aria-describedby={nameTaken ? "person-name-taken" : undefined}
        />
        {nameTaken && <p id="person-name-taken" className="mt-1 text-sm text-destructive">{problemMessage("duplicate-name")}</p>}
      </div>

      <div>
        <Label>{t("settings.role")}</Label>
        {setsStanding ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("settings.role")}>
            {offered.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={role === r}
                onClick={() => setRole(r)}
                className={cn(
                  "h-touch flex-auto rounded-lg border px-4 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  role === r ? "border-primary bg-primary-soft text-accent-foreground" : "border-border",
                )}
              >
                {t(`settings.roles.${r}`)}
              </button>
            ))}
          </div>
        ) : (
          <p className="flex h-touch items-center rounded-lg bg-muted px-4 font-medium">
            {t(`settings.roles.${role}`)}
            {role === "OWNER" && <span className="ms-2 text-sm font-normal text-muted-foreground">{t("staff.ownerFixed")}</span>}
          </p>
        )}
        {role === "MANAGER" && <p className="mt-2 text-sm text-muted-foreground">{t("staff.managerHint")}</p>}
      </div>

      {role === "EMPLOYEE" && setsStanding && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("staff.can")}</legend>
          <p className="text-sm text-muted-foreground">{t("staff.canHint")}</p>
          {/* The two old roles, kept as starting points — most people are one or the other. */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PERMISSION_PRESETS) as Array<keyof typeof PERMISSION_PRESETS>).map((k) => {
              const preset = PERMISSION_PRESETS[k];
              const active = samePermissions(permissions, preset);
              return (
                <button
                  key={k} type="button" aria-pressed={active}
                  onClick={() => setPermissions([...preset])}
                  className={cn("h-10 rounded-full border px-4 text-sm font-medium", active ? "border-primary bg-primary-soft text-accent-foreground" : "border-border")}
                >
                  {t(`staff.presets.${k}`)}
                </button>
              );
            })}
          </div>
          <ul className="divide-y divide-border rounded-xl ring-1 ring-border">
            {Permission.options.map((p) => (
              <li key={p}>
                <label className="flex min-h-touch cursor-pointer items-center gap-3 px-3 py-2">
                  <input type="checkbox" className="size-5 accent-primary" checked={permissions.includes(p)} onChange={() => toggle(p)} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{t(`staff.permissions.${p}`)}</span>
                    <span className="block text-sm text-muted-foreground">{t(`staff.permissionHints.${p}`)}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <div>
        <Label htmlFor="person-pin">{person ? t("settings.changePin") : t("settings.pin")}</Label>
        <Input
          id="person-pin"
          value={pin}
          onChange={(e) => setPin(normalisePinInput(e.target.value))}
          inputMode="numeric"
          type="password"
          autoComplete="new-password"
          className="tabular tracking-widest"
        />
      </div>

      {/* The three details the shop would otherwise keep on paper. All optional. */}
      <div className="space-y-4 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">{t("staff.detailsHint")}</p>
        <div>
          <Label htmlFor="person-phone">{t("staff.phone")}</Label>
          <Input id="person-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="off" className="tabular" />
        </div>
        <div>
          <Label htmlFor="person-started">{t("staff.startedOn")}</Label>
          <Input id="person-started" type="date" value={startedOn} onChange={(e) => setStartedOn(e.target.value)} className="tabular max-w-60" />
        </div>
        <div>
          <Label htmlFor="person-note">{t("staff.note")}</Label>
          <Input id="person-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("staff.noteHint")} />
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={incomplete || busy}>{t("common.save")}</Button>
    </form>
  );
}
