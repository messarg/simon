/**
 * Գլխավոր (§6.9): how the day went, answered from the doorway, and every figure tappable to the
 * events behind it (rule 3). Both directions of debt, and dead stock beside low stock.
 */
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, Sun } from "lucide-react";
import { Link } from "react-router";
import { businessDate } from "@simon/shared";
import { EmptyState, MoneyText } from "@/components/shared";
import { t, type StringKey } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { money } from "@/lib/format.ts";
import { http } from "@/lib/http.ts";
import { useClientSettings } from "../settings.ts";

interface Home {
  businessDate: string;
  today: { takings: number; salesCount: number; averageSale: number; returns: number; profit: number | null; revenueWithoutCost: number };
  receivables: { outstanding: number; customers: number; over90: number; overdue: number };
  payables: { outstanding: number; overdue: number };
  stock: { low: number; dead: number };
  attention: { openFlags: number };
  alerts: Array<{ type: string; count?: number; lastAt?: string | null; deviceLabel?: string }>;
}

/** A figure is a link: tapping it opens the events that produced it. */
function Figure({ label, amount, to, sub, tone }: { label: string; amount: number; to: string; sub?: string; tone?: "attention" }) {
  return (
    <Link to={to} className="block rounded-xl bg-card p-4 ring-1 ring-border shadow-sm transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
      <div className="text-sm text-muted-foreground">{label}</div>
      <MoneyText amount={amount} className={cn("text-3xl font-bold", tone === "attention" && "text-attention-foreground")} />
      {sub && <div className="mt-0.5 text-sm text-muted-foreground">{sub}</div>}
    </Link>
  );
}

export function HomePage() {
  const settings = useClientSettings().data;
  const today = businessDate(new Date(), settings?.timezone ?? "Asia/Yerevan");
  const home = useQuery({ queryKey: ["home"], queryFn: () => http.get<Home>("/home"), refetchInterval: 60_000 });
  const d = home.data;
  if (!d) return null;
  const period = `from=${today}&to=${today}`;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">{t("nav.home")}</h1>

      {d.alerts.map((a) => (
        <div key={`${a.type}-${a.deviceLabel ?? ""}`} className="flex items-start gap-3 rounded-xl bg-attention-soft p-4 text-attention-foreground ring-1 ring-attention">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {a.type === "backup-stale" && !a.lastAt ? t("home.alerts.backup-staleNever") : t(`home.alerts.${a.type}` as StringKey, { n: a.count ?? 0, device: a.deviceLabel ?? "" })}
            </p>
            {/* Never backed up means there is no passphrase yet, so the first step is a different one. */}
            <p className="text-sm">{t(`home.alerts.${a.type === "backup-stale" && !a.lastAt ? "backup-staleNever" : a.type}Do` as StringKey)}</p>
          </div>
          <Link to={a.type === "ledger-drift" ? "/attention" : "/settings"} className="shrink-0 text-sm font-medium underline">{t("attention.open")}</Link>
        </div>
      ))}

      <section aria-labelledby="today" className="space-y-3">
        <h2 id="today" className="text-sm font-semibold tracking-wide text-muted-foreground">{t("home.today")}</h2>
        {d.today.salesCount === 0 ? (
          <EmptyState icon={Sun} title={t("home.emptyTitle")} hint={t("home.emptyHint")} className="rounded-xl bg-card ring-1 ring-border shadow-sm" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Figure label={t("home.takings")} amount={d.today.takings} to={`/reports?r=sales&by=sale&${period}`} sub={t("home.salesCount", { n: d.today.salesCount })} />
            <Figure
              label={t("home.profit")}
              amount={d.today.profit ?? 0}
              to={`/reports?r=margin&${period}`}
              sub={d.today.revenueWithoutCost > 0 ? t("home.noCostBasis", { amount: money(d.today.revenueWithoutCost) }) : `${t("home.average")} ${money(d.today.averageSale)}`}
            />
            {d.today.returns > 0 && <Figure label={t("home.returns")} amount={d.today.returns} to={`/reports?r=voids-returns&${period}`} />}
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Figure
          label={t("home.receivable")}
          amount={d.receivables.outstanding}
          to="/customers"
          sub={`${t("home.people", { n: d.receivables.customers })}${d.receivables.over90 > 0 ? ` · ${t("home.receivableOf")} ${money(d.receivables.over90)}` : ""}`}
          tone={d.receivables.over90 > 0 ? "attention" : undefined}
        />
        <Figure
          label={t("home.payable")}
          amount={d.payables.outstanding}
          to="/suppliers"
          sub={d.payables.overdue > 0 ? `${t("home.payableOverdue")} ${money(d.payables.overdue)}` : undefined}
          tone={d.payables.overdue > 0 ? "attention" : undefined}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <CountTile label={t("home.lowStock")} n={d.stock.low} to="/products?filter=low-stock" />
        <CountTile label={t("home.deadStock")} n={d.stock.dead} to="/products?filter=dead-stock" />
        <CountTile label={t("home.attention")} n={d.attention.openFlags} to="/attention" />
      </section>
    </div>
  );
}

function CountTile({ label, n, to }: { label: string; n: number; to: string }) {
  return (
    <Link to={to} className="flex items-center justify-between rounded-xl bg-card p-4 ring-1 ring-border shadow-sm hover:bg-muted/50">
      <div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="tabular text-2xl font-semibold">{n}</div>
      </div>
      <ChevronLeft className="size-5 rotate-180 text-muted-foreground" aria-hidden />
    </Link>
  );
}
