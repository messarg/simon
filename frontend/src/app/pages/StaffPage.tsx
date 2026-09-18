/**
 * Աշխատակիցներ (§6.11.1) — the shop's people, as a destination of its own.
 *
 * It was a section of Կարգավորումներ, which put the one list the owner opens whenever anyone is
 * hired, locked out or let go behind a screen about discount caps and backup destinations. It is
 * `ADMIN`-only, and it is the only way in: there is no second copy of this list in Settings.
 *
 * Every person, with photograph, name, role (§16.4), phone, and whether they are active or locked
 * out. Tapping a person opens their page; the pencil opens the row itself. **There is no delete**
 * — rule 4: ten relations point at the row, and a person who sold anything is part of the books
 * for as long as the books are kept. Deactivating revokes their live sessions in the same
 * transaction (§16.3).
 *
 * §6.6's tone rule holds here too: nothing on this list is ranked, scored or compared.
 */
import { canManage, type StaffAction } from "@simon/shared";
import { useSession } from "@/lib/session-store.ts";
import { useQuery } from "@tanstack/react-query";
import { Lock, LockOpen, Pencil, Plus, UserRoundX } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Avatar, ConfirmSheet } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { PersonEditor, type EditorTarget } from "@/features/staff/PersonEditor.tsx";
import { isLockedOut, staffKey, type StaffUser } from "@/features/staff/types.ts";
import { problemMessage, t, type StringKey } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { ApiProblem, http } from "@/lib/http.ts";

export function StaffPage() {
  const users = useQuery({ queryKey: staffKey, queryFn: () => http.get<{ items: StaffUser[] }>("/users") });
  const [editing, setEditing] = useState<EditorTarget>(null);
  const [deactivating, setDeactivating] = useState<StaffUser | null>(null);
  const [now] = useState(() => Date.now());
  // Each row offers only what the server would accept for it (§6.17): a manager sees another
  // manager's name and state, and nothing to press.
  const session = useSession();
  const viewer = session ? { id: session.user.id, role: session.user.role } : null;
  const may = (u: StaffUser, action: StaffAction) => !!viewer && canManage(viewer, { id: u.id, role: u.role }, action);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await users.refetch();
      toast.success(t("settings.saved"));
    } catch (err) {
      toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network"));
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold">{t("nav.staff")}</h1>
          <p className="text-sm text-muted-foreground">{t("staff.listHint")}</p>
        </div>
        <Button className="shrink-0" onClick={() => setEditing("new")}><Plus />{t("settings.addUser")}</Button>
      </header>

      <ul className="space-y-2">
        {users.isPending && [0, 1, 2].map((i) => <li key={i} className="h-24 animate-pulse rounded-xl bg-muted" aria-hidden />)}
        {users.data?.items.map((u) => {
          const locked = isLockedOut(u, now);
          return (
            <li key={u.id} className="rounded-xl bg-card p-2 ring-1 ring-border shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={may(u, "view") ? `/staff/${u.id}` : "#"}
                  aria-disabled={!may(u, "view") || undefined}
                  onClick={(e) => { if (!may(u, "view")) e.preventDefault(); }}
                  className="flex min-h-touch min-w-48 flex-1 items-center gap-3 rounded-md p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar name={u.name} userId={u.id} avatarUpdatedAt={u.avatarUpdatedAt} className="size-12 text-xl" />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate font-medium", !u.isActive && "text-muted-foreground")}>{u.name}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {u.role === "EMPLOYEE" && u.permissions.length > 0
                        ? u.permissions.map((p) => t(`staff.permissions.${p}` as StringKey)).join(", ")
                        : t(`settings.roles.${u.role}` as StringKey)}
                      {u.phone ? ` · ${u.phone}` : ""}
                    </span>
                  </span>
                </Link>
                {/* State carries a word and an icon, never a colour alone. */}
                {!u.isActive && (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                    <UserRoundX className="size-4" aria-hidden />{t("settings.inactiveUser")}
                  </span>
                )}
                {locked && (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-attention-foreground">
                    <Lock className="size-4" aria-hidden />{t("settings.locked")}
                  </span>
                )}
                {locked && may(u, "edit") && (
                  <Button variant="attention" onClick={() => void act(() => http.post("/auth/unlock", { userId: u.id }))}>
                    <LockOpen />{t("settings.unlock")}
                  </Button>
                )}
                {may(u, "edit") && <Button size="icon" variant="ghost" aria-label={t("staff.editPerson", { name: u.name })} onClick={() => setEditing(u)}><Pencil /></Button>}
                {/* Taking access away confirms (below), so it can sit in the row — but it keeps a
                    gap from the pencil, because the two are one mis-tap apart. */}
                {may(u, "deactivate") && (
                  <Button
                    variant="ghost"
                    className="ms-1"
                    onClick={() => (u.isActive ? setDeactivating(u) : void act(() => http.patch(`/users/${u.id}`, { isActive: true })))}
                  >
                    {u.isActive ? t("settings.deactivate") : t("settings.activate")}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Taking someone's access away is not undoable from their side (§27.16). */}
      <ConfirmSheet
        open={deactivating !== null}
        onOpenChange={(o) => { if (!o) setDeactivating(null); }}
        title={t("settings.deactivateUserTitle", { name: deactivating?.name ?? "" })}
        description={t("settings.deactivateUserHint")}
        confirmLabel={t("settings.confirmDeactivate")}
        onConfirm={() => { const u = deactivating; setDeactivating(null); if (u) void act(() => http.patch(`/users/${u.id}`, { isActive: false })); }}
      />
      <PersonEditor target={editing} onClose={() => setEditing(null)} onSaved={() => void users.refetch()} />
    </div>
  );
}
