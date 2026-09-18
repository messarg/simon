/**
 * Add someone, or change what is recorded about them (§6.11.1): the photograph, the name, the
 * role (§16.4), a new PIN, and the three personal details the shop keeps so that the owner does
 * not keep them in a separate notebook — a phone number, the day they started, and a free note.
 *
 * Those three are `ADMIN`-only and never leave this screen for the sign-in tiles: that list is
 * drawn before anyone has signed in (§15.4, §26.2), and it carries a name and a face and nothing
 * else.
 *
 * There is no delete — rule 4. A person who sold anything is part of the books for as long as the
 * books are kept; taking their access away is `isActive`, and it lives on the list beside them.
 */
import { useState } from "react";
import { toast } from "sonner";
import type { Role } from "@simon/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input, Label } from "@/components/ui/input.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { ApiProblem, http } from "@/lib/http.ts";
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

const ROLES: readonly Role[] = ["WORKER", "STOCK", "ADMIN"];
const trimmed = (v: string) => (v.trim() === "" ? null : v.trim());

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
  const [name, setName] = useState(person?.name ?? "");
  const [role, setRole] = useState<Role>(person?.role ?? "WORKER");
  const [pin, setPin] = useState("");
  const [phone, setPhone] = useState(person?.phone ?? "");
  const [startedOn, setStartedOn] = useState(person?.startedOn ?? "");
  const [note, setNote] = useState(person?.note ?? "");
  const [avatarAt, setAvatarAt] = useState<string | null>(person?.avatarUpdatedAt ?? null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const details = { phone: trimmed(phone), startedOn: trimmed(startedOn), note: trimmed(note) };
      if (person) await http.patch(`/users/${person.id}`, { name: name.trim(), role, ...(pin ? { pin } : {}), ...details });
      else await http.post("/users", { name: name.trim(), role, pin, ...details });
      onSaved();
      onClose();
      toast.success(t("settings.saved"));
    } catch (err) {
      toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network"));
    } finally {
      setBusy(false);
    }
  };

  const incomplete = !name.trim() || (person ? pin.length > 0 && pin.length < 4 : pin.length < 4);

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
        <Input id="person-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div>
        <Label>{t("settings.role")}</Label>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
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
      </div>
      <div>
        <Label htmlFor="person-pin">{person ? t("settings.changePin") : t("settings.pin")}</Label>
        <Input
          id="person-pin"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          inputMode="numeric"
          type="password"
          autoComplete="new-password"
          className="tabular tracking-widest"
        />
      </div>

      {/* The three details the owner would otherwise keep on paper. All optional. */}
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
