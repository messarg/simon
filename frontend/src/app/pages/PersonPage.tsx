/**
 * Աշխատակիցներ — one person, and what happened while they were signed in (§6.11.1).
 *
 * Four facets, none of them new: each is one or more of §20.2's reports with this person already
 * chosen, over a period that defaults to this month. It defines no figure of its own, because
 * §6.10 lists the catalogue once and a number that cannot be got from there does not belong here.
 *
 * §6.6's tone rule applies in full. Variance is shown in the report's own neutral words, in both
 * directions; nothing is ranked, scored, coloured by performance, or compared between people. The
 * page answers *what happened* — **why** is a conversation between two people who know each other,
 * and Simon is not a party to it.
 *
 * It is `ADMIN`-only and reached from Աշխատակիցներ, the staff list (`pages/StaffPage.tsx`).
 *
 * Above the facets sit the details the shop keeps about the person themselves — phone, the day
 * they started, a free note — which the owner would otherwise keep in a notebook. They are shown
 * only here and in the editor, and never on the sign-in tiles: that list is drawn before anyone
 * has signed in (§15.4, §26.2) and carries a name and a face and nothing else.
 */
import { useQuery } from "@tanstack/react-query";
import { businessDate, periodRange } from "@simon/shared";
import { ArrowLeft, CalendarDays, Clock, KeyRound, Pencil, Phone, ReceiptText, StickyNote, Warehouse, type LucideIcon } from "lucide-react";
import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Avatar } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { PeriodPicker } from "@/features/reports/PeriodPicker.tsx";
import { ReportSection } from "@/features/reports/ReportSection.tsx";
import type { ReportName } from "@/features/reports/types.ts";
import { PersonEditor, type EditorTarget } from "@/features/staff/PersonEditor.tsx";
import { SessionList } from "@/features/staff/SessionList.tsx";
import { staffKey, type StaffUser } from "@/features/staff/types.ts";
import { t, type StringKey } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { dateLabel } from "@/lib/format.ts";
import { http } from "@/lib/http.ts";
import { useClientSettings } from "../settings.ts";

type FacetKey = "sales" | "stock" | "shift" | "access";

interface Facet {
  key: FacetKey;
  icon: LucideIcon;
  reports: readonly ReportName[];
  /** The live session list (§15.4) belongs to one facet only. */
  sessions?: boolean;
}

/** §6.11.1's table, in its order. Every entry names a report that §20.2 already lists. */
const FACETS: readonly Facet[] = [
  { key: "sales", icon: ReceiptText, reports: ["sales", "discounts", "voids-returns"] },
  { key: "stock", icon: Warehouse, reports: ["movements-by-person", "write-offs"] },
  { key: "shift", icon: Clock, reports: ["z-reports", "cash-out-by-person"] },
  { key: "access", icon: KeyRound, reports: ["audit"], sessions: true },
];

export function PersonPage() {
  const { id = "" } = useParams();
  const settings = useClientSettings().data;
  const today = businessDate(new Date(), settings?.timezone ?? "Asia/Yerevan");
  const [params, setParams] = useSearchParams();

  const thisMonth = periodRange("month", today);
  const period = { from: params.get("from") ?? thisMonth.from, to: params.get("to") ?? thisMonth.to };
  const facet = FACETS.find((f) => f.key === params.get("facet")) ?? FACETS[0];

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v === undefined || v === "") next.delete(k); else next.set(k, v); }
    setParams(next, { replace: true });
  };

  // The staff list is the source: §6.11.1 adds no endpoint of its own, and this shares the
  // Settings screen's cache, so arriving from it draws immediately.
  const users = useQuery({ queryKey: staffKey, queryFn: () => http.get<{ items: StaffUser[] }>("/users") });
  const person = users.data?.items.find((u) => u.id === id);

  const [editing, setEditing] = useState<EditorTarget>(null);

  const tabs = useRef<HTMLButtonElement[]>([]);
  const move = (e: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "Home" ? -index : e.key === "End" ? FACETS.length - 1 - index : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = (index + step + FACETS.length) % FACETS.length;
    set({ facet: FACETS[next].key });
    tabs.current[next]?.focus();
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6">
      <Link
        to="/staff"
        className="inline-flex h-touch items-center gap-2 rounded-md px-2 -ml-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-5" aria-hidden />
        {t("staff.backToList")}
      </Link>

      <header className="rounded-md bg-card p-4 ring-1 ring-border shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={person?.name ?? "?"} userId={id} avatarUpdatedAt={person?.avatarUpdatedAt} className="size-16 text-2xl sm:size-20 sm:text-3xl" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold">{person?.name ?? t("common.loading")}</h1>
            <p className="text-muted-foreground">
              {person ? t(`settings.roles.${person.role}` as StringKey) : ""}
              {person && !person.isActive ? ` · ${t("settings.inactiveUser")}` : ""}
            </p>
          </div>
          {person && (
            <Button variant="secondary" className="shrink-0" onClick={() => setEditing(person)}>
              <Pencil />{t("common.edit")}
            </Button>
          )}
        </div>

        {/* What the shop keeps about the person, not about their work — stated plainly, never
            ranked or scored (§6.6). Empty fields say so rather than leaving a gap to guess at. */}
        {person && (
          <dl className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
            <Detail icon={Phone} label={t("staff.phone")} value={person.phone ?? null} href={person.phone ? `tel:${person.phone}` : undefined} />
            <Detail icon={CalendarDays} label={t("staff.startedOn")} value={person.startedOn ? dateLabel(person.startedOn) : null} />
            <Detail icon={StickyNote} label={t("staff.note")} value={person.note ?? null} className="sm:col-span-3" />
          </dl>
        )}
      </header>

      {/* The period is stated, because the page claims nothing beyond it (§6.11.1). */}
      <PeriodPicker today={today} value={period} onChange={(p) => set({ from: p.from, to: p.to })} />

      {/* Real tabs: one stop in the tab order, arrows between them, and the chosen one in the URL. */}
      <div role="tablist" aria-label={t("staff.facets")} className="flex flex-wrap gap-2">
        {FACETS.map((f, i) => {
          const Icon = f.icon;
          const selected = f.key === facet.key;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              id={`facet-${f.key}`}
              ref={(el) => { if (el) tabs.current[i] = el; }}
              aria-selected={selected}
              aria-controls="facet-panel"
              tabIndex={selected ? 0 : -1}
              onKeyDown={(e) => move(e, i)}
              onClick={() => set({ facet: f.key })}
              className={cn(
                "inline-flex h-touch flex-auto items-center justify-center gap-2 whitespace-nowrap rounded-md border px-4 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-primary bg-primary-soft text-accent-foreground" : "border-border bg-card text-muted-foreground",
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              {t(`staff.facetNames.${f.key}` as StringKey)}
            </button>
          );
        })}
      </div>

      <div id="facet-panel" role="tabpanel" aria-labelledby={`facet-${facet.key}`} tabIndex={-1} className="space-y-6">
        {facet.reports.map((name) => (
          <ReportSection key={name} name={name} from={period.from} to={period.to} userId={id} />
        ))}
        {facet.sessions && person && <SessionList userId={id} name={person.name} />}
      </div>

      {/* Stated once, at the foot: this is evidence to be read, not a verdict to be acted on. */}
      <p className="border-t border-border pt-3 text-sm text-muted-foreground">{t("staff.toneNote")}</p>

      <PersonEditor target={editing} onClose={() => setEditing(null)} onSaved={() => void users.refetch()} />
    </div>
  );
}

/** One personal detail. A phone number is tappable, because the reason to read it is to ring it. */
function Detail({ icon: Icon, label, value, href, className }: { icon: LucideIcon; label: string; value: string | null; href?: string; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden />
        {label}
      </dt>
      <dd className="mt-0.5 break-words">
        {value === null ? (
          <span className="text-muted-foreground">{t("staff.detailEmpty")}</span>
        ) : href ? (
          <a href={href} className="tabular inline-flex min-h-touch items-center font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{value}</a>
        ) : (
          <span className="font-medium">{value}</span>
        )}
      </dd>
    </div>
  );
}
