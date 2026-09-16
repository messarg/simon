/**
 * Հաշվառում (§6.8): count the shelf while the shop keeps trading.
 *
 * Counting is blind — the person counting sees what they counted, not what the books say — and
 * the review shows only what differs, the costliest difference first. Approval is the owner's and
 * is the one step that changes stock (§13.4).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, ClipboardList, Pencil, Search, Tags } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { uuidv7 } from "@simon/shared";
import { ConfirmSheet, EmptyState, MoneyText, QuantitySheet } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { problemMessage, t, type StringKey } from "@/i18n/t.ts";
import { beep } from "@/lib/beep.ts";
import { findByBarcode, searchCatalogue, syncCatalogue } from "@/lib/catalogue.ts";
import { cn } from "@/lib/cn.ts";
import { useConnection } from "@/lib/connection.ts";
import { dateTime, qty as formatQty } from "@/lib/format.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import type { CachedProduct } from "@/lib/local-db.ts";
import { useScanner } from "@/lib/scanner.ts";
import { useSession } from "@/lib/session-store.ts";

interface Line {
  productId: string; productName: string; uom: string; decimalPlaces: number; barcodes: string[];
  countedQty: number | null; countedAt: string | null;
  expectedQty?: number; varianceQty?: number | null; varianceValue?: number | null;
}
interface Stocktake {
  id: string; status: "COUNTING" | "REVIEW" | "APPROVED" | "ABANDONED"; startedAt: string;
  progress: { total: number; counted: number };
  differing?: string[];
  summary?: { counted: number; uncounted: number; differing: number; shortage: number; surplus: number; net: number; withoutCost: number };
  lines: Line[];
}
interface HistoryRow { id: string; status: Stocktake["status"]; startedAt: string; approvedAt: string | null; lines: number; varianceTotal?: number }

const key = ["stocktakes", "current"] as const;

export function StocktakePage() {
  const qc = useQueryClient();
  const connection = useConnection();
  const session = useSession();
  const admin = session?.user.role === "ADMIN";
  const current = useQuery({ queryKey: key, queryFn: () => http.get<Stocktake | null>("/stocktakes/current"), enabled: connection === "online" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["stocktakes"] });

  if (connection === "offline") return <EmptyState icon={ClipboardList} title={t("stocktake.title")} hint={t("stocktake.offline")} className="flex-1" />;
  if (current.isPending) return null;
  const st = current.data;
  if (!st) return <StartView onStarted={refresh} admin={admin} />;
  return st.status === "COUNTING" ? <CountView st={st} onChange={refresh} /> : <ReviewView st={st} admin={admin} onChange={refresh} />;
}

function StartView({ onStarted, admin }: { onStarted: () => void; admin: boolean }) {
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => http.get<{ items: Array<{ id: string; name: string }> }>("/categories") });
  const history = useQuery({ queryKey: ["stocktakes", "history"], queryFn: () => http.get<{ items: HistoryRow[] }>("/stocktakes") });
  const [busy, setBusy] = useState(false);
  const start = async (categoryId: string | null) => {
    setBusy(true);
    try { await http.post("/stocktakes", { id: uuidv7(), categoryId }); onStarted(); }
    catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
    finally { setBusy(false); }
  };
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">{t("stocktake.title")}</h1>
      <section className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-border">
        <p className="text-muted-foreground">{t("stocktake.startHint")}</p>
        <Button size="lg" className="w-full" disabled={busy} onClick={() => void start(null)}><ClipboardList />{t("stocktake.whole")}</Button>
        {(categories.data?.items.length ?? 0) > 0 && (
          <>
            <p className="pt-1 text-sm font-medium text-muted-foreground">{t("stocktake.byCategory")}</p>
            <div className="flex flex-wrap gap-2">
              {categories.data!.items.map((c) => (
                <Button key={c.id} variant="secondary" disabled={busy} onClick={() => void start(c.id)}>{c.name}</Button>
              ))}
            </div>
          </>
        )}
      </section>
      <section className="rounded-xl bg-card p-4 ring-1 ring-border">
        <h2 className="mb-2 font-semibold">{t("stocktake.history")}</h2>
        {history.data?.items.length === 0 ? <p className="text-muted-foreground">{t("stocktake.emptyHistory")}</p> : (
          <ul className="divide-y divide-border">
            {history.data?.items.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-2">
                <span className="flex-1">{dateTime(h.startedAt)} · {t(`stocktake.statuses.${h.status}` as StringKey)}</span>
                {admin && h.status === "APPROVED" && h.varianceTotal !== undefined && <MoneyText amount={h.varianceTotal} signed className={cn("font-medium", h.varianceTotal < 0 && "text-attention-foreground")} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CountView({ st, onChange }: { st: Stocktake; onChange: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CachedProduct[]>([]);
  const [filter, setFilter] = useState<"uncounted" | "counted" | "all">("uncounted");
  const [counting, setCounting] = useState<Line | null>(null);
  const [finishing, setFinishing] = useState(false);
  const lines = useMemo(() => new Map(st.lines.map((l) => [l.productId, l])), [st.lines]);

  useEffect(() => {
    if (!query.trim()) return;
    const id = setTimeout(() => void searchCatalogue(query, 20).then(setResults), 60);
    return () => clearTimeout(id);
  }, [query]);
  const shownResults = query.trim() ? results : [];

  const save = async (productId: string, countedQty: number, mode: "set" | "add") => {
    try {
      await http.put(`/stocktakes/${st.id}/counts/${productId}`, { countedQty, mode });
      beep("ok");
      onChange();
    } catch (err) {
      beep("error");
      toast.error(err instanceof ApiProblem && err.type === "not-found" ? t("stocktake.notInCount") : problemMessage(err instanceof ApiProblem ? err.type : "network"));
    }
  };

  const openLine = useCallback((productId: string, fallback?: CachedProduct) => {
    const line = lines.get(productId);
    if (line) { setCounting(line); return; }
    // A product created after the count began can still be counted; the server decides.
    if (fallback) setCounting({ productId, productName: fallback.name, uom: fallback.stockUom, decimalPlaces: fallback.decimalPlaces, barcodes: fallback.barcodes, countedQty: null, countedAt: null });
  }, [lines]);

  // A scan while counting opens that product's count; a second scan of a piece item adds one.
  const onScan = useCallback(async (code: string) => {
    const p = await findByBarcode(code);
    if (!p) { beep("error"); toast.error(t("till.notFound", { code })); return; }
    const line = lines.get(p.id);
    if (line && line.decimalPlaces === 0 && line.countedQty !== null) { void save(p.id, 1000, "add"); toast(`${p.name} ${t("stocktake.addOne")}`); return; }
    openLine(p.id, p);
  }, [lines, openLine]); // eslint-disable-line react-hooks/exhaustive-deps
  useScanner(onScan, counting === null && !finishing);

  const shown = st.lines
    .filter((l) => filter === "all" || (filter === "counted" ? l.countedQty !== null : l.countedQty === null))
    .sort((a, b) => a.productName.localeCompare(b.productName));

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 p-4 pb-28 md:p-6">
      <div className="flex items-baseline gap-3">
        <h1 className="flex-1 text-2xl font-semibold">{t("stocktake.title")}</h1>
        <span className="tabular text-muted-foreground">{t("stocktake.progress", { counted: st.progress.counted, total: st.progress.total })}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full bg-primary transition-[width]" style={{ width: `${st.progress.total ? (st.progress.counted / st.progress.total) * 100 : 0}%` }} />
      </div>
      <p className="text-sm text-muted-foreground">{t("stocktake.blind")}</p>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("stocktake.searchHint")} className="pl-10" />
      </div>
      {shownResults.length > 0 && (
        <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-border">
          {shownResults.map((p) => (
            <li key={p.id}>
              <button className="flex min-h-touch w-full items-center px-4 py-2 text-left" onClick={() => { setQuery(""); openLine(p.id, p); }}>{p.name}</button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex rounded-lg bg-muted p-1">
        {(["uncounted", "counted", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn("h-touch flex-1 rounded-md text-sm font-medium", filter === f ? "bg-card shadow-xs" : "text-muted-foreground")}>{t(`stocktake.filters.${f}`)}</button>
        ))}
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border">
        {shown.map((l) => (
          <li key={l.productId}>
            <button className="flex min-h-touch-lg w-full items-center gap-3 px-4 py-2 text-left active:bg-muted" onClick={() => setCounting(l)}>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{l.productName}</div>
                <div className="tabular text-sm text-muted-foreground">{l.barcodes[0] ?? l.uom}</div>
              </div>
              {l.countedQty === null
                ? <span className="text-sm text-muted-foreground">{t("stocktake.notCounted")}</span>
                : <span className="tabular flex items-center gap-1 font-semibold"><CheckCircle2 className="size-4 text-success" aria-hidden />{formatQty(l.countedQty, l.decimalPlaces)} {l.uom}</span>}
            </button>
          </li>
        ))}
      </ul>

      <div className="safe-bottom fixed inset-x-0 bottom-16 z-20 border-t border-border bg-card/95 p-3 backdrop-blur md:bottom-0 md:left-60">
        <div className="mx-auto max-w-2xl">
          <Button size="lg" className="w-full" disabled={st.progress.counted === 0} onClick={() => setFinishing(true)}><ClipboardCheck />{t("stocktake.finish")}</Button>
        </div>
      </div>

      {counting && (
        <QuantitySheet
          key={counting.productId}
          open
          onOpenChange={(o) => { if (!o) setCounting(null); }}
          title={counting.productName}
          uom={counting.uom}
          decimalPlaces={counting.decimalPlaces}
          initial={counting.countedQty ?? 0}
          allowZero
          hidePieceHint
          confirmLabel={t("stocktake.setCount")}
          onConfirm={(q) => void save(counting.productId, q, "set")}
        />
      )}
      <ConfirmSheet
        open={finishing}
        onOpenChange={setFinishing}
        destructive={false}
        title={t("stocktake.finish")}
        description={t("stocktake.finishHint")}
        confirmLabel={t("stocktake.finish")}
        onConfirm={() => void http.post(`/stocktakes/${st.id}/review`).then(onChange, (err) => toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")))}
      >
        {st.progress.total - st.progress.counted > 0 && (
          <p className="rounded-lg bg-attention-soft p-3 text-sm text-attention-foreground">{t("stocktake.uncountedNote", { n: st.progress.total - st.progress.counted })}</p>
        )}
      </ConfirmSheet>
    </div>
  );
}

function ReviewView({ st, admin, onChange }: { st: Stocktake; admin: boolean; onChange: () => void }) {
  const [recount, setRecount] = useState<Line | null>(null);
  const [confirm, setConfirm] = useState<null | "approve" | "abandon">(null);
  const byId = new Map(st.lines.map((l) => [l.productId, l]));
  const differing = (st.differing ?? []).map((id) => byId.get(id)!).filter(Boolean);

  const act = async (path: "approve" | "abandon") => {
    try {
      await http.post(`/stocktakes/${st.id}/${path}`);
      if (path === "approve") { toast.success(t("stocktake.approved")); void syncCatalogue().catch(() => {}); }
      onChange();
    } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("stocktake.review")}</h1>
        <p className="text-muted-foreground">{t("stocktake.reviewHint")}</p>
      </div>

      {admin && st.summary && (
        <section className="grid grid-cols-3 gap-3">
          {([["shortage", -st.summary.shortage], ["surplus", st.summary.surplus], ["net", st.summary.net]] as const).map(([k, amount]) => (
            <div key={k} className="rounded-xl bg-card p-3 ring-1 ring-border">
              <div className="text-sm text-muted-foreground">{t(`stocktake.${k}`)}</div>
              <MoneyText amount={amount} signed className={cn("text-2xl font-bold", amount < 0 && "text-attention-foreground")} />
            </div>
          ))}
        </section>
      )}
      {admin && st.summary && st.summary.withoutCost > 0 && <p className="text-sm text-muted-foreground">{t("stocktake.withoutCost", { n: st.summary.withoutCost })}</p>}
      {st.progress.total > st.progress.counted && <p className="text-sm text-muted-foreground">{t("stocktake.uncountedNote", { n: st.progress.total - st.progress.counted })}</p>}

      {differing.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={t("stocktake.noDifferences")} hint={t("stocktake.noDifferencesHint")} className="rounded-xl bg-card ring-1 ring-border" />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-border">
          <table className="w-full min-w-max text-[0.95rem]">
            <thead>
              <tr className="border-b border-border text-sm text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">{t("reports.cols.productName")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("stocktake.expected")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("stocktake.onShelf")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("stocktake.difference")}</th>
                {admin && <th className="px-3 py-2 text-right font-medium">{t("stocktake.value")}</th>}
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {differing.map((l) => (
                <tr key={l.productId} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2">{l.productName}</td>
                  <td className="tabular px-3 py-2 text-right">{formatQty(l.expectedQty ?? 0, l.decimalPlaces)} {l.uom}</td>
                  <td className="tabular px-3 py-2 text-right">{formatQty(l.countedQty ?? 0, l.decimalPlaces)}</td>
                  <td className={cn("tabular px-3 py-2 text-right font-semibold", (l.varianceQty ?? 0) < 0 && "text-attention-foreground")}>
                    {(l.varianceQty ?? 0) > 0 ? "+" : ""}{formatQty(l.varianceQty ?? 0, l.decimalPlaces)}
                  </td>
                  {admin && <td className="px-3 py-2 text-right">{l.varianceValue === null || l.varianceValue === undefined ? "—" : <MoneyText amount={l.varianceValue} signed />}</td>}
                  <td className="px-2 py-1 text-right">
                    {st.status === "REVIEW" && <Button size="icon" variant="ghost" aria-label={t("stocktake.countTitle")} onClick={() => setRecount(l)}><Pencil /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {st.status === "REVIEW" && (admin ? (
        <div className="flex flex-wrap gap-2">
          <Button size="lg" className="flex-1" onClick={() => setConfirm("approve")}><ClipboardCheck />{t("stocktake.approve")}</Button>
          <Button size="lg" variant="ghost" onClick={() => setConfirm("abandon")}>{t("stocktake.abandon")}</Button>
        </div>
      ) : <p className="rounded-lg bg-muted p-3 text-muted-foreground">{t("stocktake.waitingApproval")}</p>)}

      {differing.length > 0 && (
        <Button asChild variant="soft"><Link to={`/labels?ids=${differing.map((l) => l.productId).join(",")}`}><Tags />{t("labels.title")}</Link></Button>
      )}

      {recount && (
        <QuantitySheet
          key={recount.productId}
          open
          onOpenChange={(o) => { if (!o) setRecount(null); }}
          title={recount.productName}
          uom={recount.uom}
          decimalPlaces={recount.decimalPlaces}
          initial={recount.countedQty ?? 0}
          allowZero
          hidePieceHint
          confirmLabel={t("stocktake.setCount")}
          onConfirm={(q) => void http.put(`/stocktakes/${st.id}/counts/${recount.productId}`, { countedQty: q, mode: "set" }).then(onChange, (err) => toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")))}
        />
      )}
      <ConfirmSheet
        open={confirm !== null}
        onOpenChange={(o) => { if (!o) setConfirm(null); }}
        title={confirm === "approve" ? t("stocktake.approveTitle") : t("stocktake.abandonTitle")}
        description={confirm === "approve" ? t("stocktake.approveHint") : t("stocktake.abandonHint")}
        confirmLabel={confirm === "approve" ? t("stocktake.approveConfirm") : t("stocktake.abandonConfirm")}
        destructive={confirm === "abandon"}
        onConfirm={() => { const c = confirm; setConfirm(null); if (c) void act(c); }}
      />
    </div>
  );
}
