/**
 * Who is signed in right now, on which till (§15.4) — the live half of the Մուտքեր facet, beside
 * the audit trail that holds the rest (§6.11.1). It states when and where, and nothing else.
 *
 * `GET /sessions` is the shop-wide list; the rows are narrowed to one person here. A row that
 * carries a `userId` is matched on it, and one that does not falls back to the name it shows,
 * so the list degrades to "possibly too few" rather than to somebody else's sessions.
 */
import { useQuery } from "@tanstack/react-query";
import { Smartphone } from "lucide-react";
import { t } from "@/i18n/t.ts";
import { dateTime } from "@/lib/format.ts";
import { http } from "@/lib/http.ts";

interface SessionRow {
  id: string;
  userId?: string;
  userName: string | null;
  deviceLabel: string | null;
  devicePrefix: string | null;
  createdAt?: string;
  lastSeenAt: string;
}

export function SessionList({ userId, name }: { userId: string; name: string }) {
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => http.get<{ items: SessionRow[] }>("/sessions") });
  const mine = (sessions.data?.items ?? []).filter((s) => (s.userId ? s.userId === userId : s.userName === name));

  return (
    <section className="space-y-2">
      <h3 className="text-lg font-semibold">{t("settings.sessions")}</h3>
      {sessions.isPending && <p className="text-muted-foreground">{t("common.loading")}</p>}
      {sessions.isError && <p className="text-muted-foreground">{t("problems.network")}</p>}
      {sessions.data && mine.length === 0 && <p className="text-muted-foreground">{t("staff.noSessions")}</p>}
      {mine.length > 0 && (
        <ul className="divide-y divide-border rounded-md bg-card ring-1 ring-border shadow-sm">
          {mine.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
              <Smartphone className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {s.devicePrefix && <span className="tabular mr-2 rounded-xs bg-muted px-1.5 text-sm">{s.devicePrefix}</span>}
                  {s.deviceLabel}
                </div>
                <div className="tabular text-sm text-muted-foreground">
                  {s.createdAt ? `${dateTime(s.createdAt)} · ` : ""}
                  {t("settings.lastSeen", { time: dateTime(s.lastSeenAt) })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
