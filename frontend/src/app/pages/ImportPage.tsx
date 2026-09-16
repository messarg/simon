/**
 * Ներբեռնում (§7.3, §19.1). Nobody will type in three thousand products, so the file the shop
 * already has comes in — with a preview first, per-row errors, and the guarantee that pressing the
 * button twice changes nothing the second time.
 *
 * A file with a bad row is refused whole: a half-built catalogue is worse than no catalogue,
 * because nobody can tell which half is missing.
 */
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, FileDown, FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { uuidv7 } from "@simon/shared";
import { Button } from "@/components/ui/button.tsx";
import { problemMessage, t, type StringKey } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { downloadText } from "@/lib/csv.ts";
import { dateTime } from "@/lib/format.ts";
import { ApiProblem, http } from "@/lib/http.ts";

type Kind = "PRODUCTS" | "CUSTOMERS" | "OPENING_STOCK" | "OPENING_DEBTS";
const KINDS: Kind[] = ["PRODUCTS", "CUSTOMERS", "OPENING_STOCK", "OPENING_DEBTS"];

interface ImportRow {
  rowNumber: number;
  status: "APPLIED" | "SKIPPED" | "FAILED";
  error?: string;
  preview: Record<string, string | number | null>;
}
interface ImportResult {
  id: string; kind: Kind; dryRun: boolean; rowCount: number;
  appliedCount: number; skippedCount: number; failedCount: number;
  duplicateOfBatchId: string | null; rows: ImportRow[];
}


/** `not-whole:price` → "«գին»՝ պետք է լինի ամբողջ թիվ". */
function errorMessage(code: string) {
  const [reason, column] = code.split(":");
  const columnLabel = column ? t(`imports.columns.${column}` as StringKey) : "";
  return t(`imports.errors.${reason}` as StringKey, { column: columnLabel });
}

export function ImportPage() {
  const [kind, setKind] = useState<Kind>("PRODUCTS");
  const [file, setFile] = useState<{ name: string; content: string; id: string } | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [applied, setApplied] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const history = useQuery({ queryKey: ["imports"], queryFn: () => http.get<{ items: Array<{ id: string; kind: Kind; startedAt: string; appliedCount: number; failedCount: number }> }>("/imports") });

  const reset = () => { setFile(null); setPreview(null); setApplied(null); if (input.current) input.current.value = ""; };
  const alreadyThere = preview?.rows.filter((r) => r.error === "already-imported").length ?? 0;

  const choose = async (chosen: File) => {
    const content = await chosen.text();
    const id = uuidv7();
    setFile({ name: chosen.name, content, id });
    setApplied(null);
    setBusy(true);
    try {
      setPreview(await http.post<ImportResult>("/imports", { id, kind, fileName: chosen.name, content, dryRun: true }));
    } catch (err) {
      setPreview(null);
      const problem = err instanceof ApiProblem ? err : null;
      toast.error(problem?.field("column") ? t("imports.columnMissing", { column: t(`imports.columns.${problem.field("column")}` as StringKey) }) : problemMessage(problem?.type ?? "network"));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const result = await http.post<ImportResult>("/imports", { id: file.id, kind, fileName: file.name, content: file.content });
      setApplied(result);
      setPreview(result);
      await history.refetch();
      if (result.failedCount === 0) toast.success(t("imports.done", { n: result.appliedCount }));
      else toast.error(t("imports.refused"));
    } catch (err) {
      toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("imports.title")}</h1>
        <p className="text-muted-foreground">{t("imports.hint")}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => { setKind(k); reset(); }}
            className={cn("min-h-touch-lg rounded-xl border px-3 py-2 text-left", kind === k ? "border-primary bg-primary-soft" : "border-border bg-card")}
          >
            <span className="block font-medium">{t(`imports.kinds.${k}` as StringKey)}</span>
            <span className="block text-sm text-muted-foreground">{t(`imports.kindHints.${k}` as StringKey)}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => input.current?.click()} disabled={busy}><Upload />{t("imports.choose")}</Button>
        <Button variant="ghost" onClick={() => downloadText(`${kind.toLowerCase()}-template.csv`, t(`imports.templates.${kind}` as StringKey), "text/csv;charset=utf-8")}><FileDown />{t("imports.template")}</Button>
        <input ref={input} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void choose(f); }} />
      </div>

      {file && <p className="text-sm text-muted-foreground">{t("imports.file", { name: file.name })}{busy ? ` · ${t("imports.checking")}` : ""}</p>}

      {preview && (
        <section className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-border">
          <h2 className="text-lg font-semibold">{applied ? t("common.done") : t("imports.preview")}</h2>
          <ul className="space-y-1 text-sm">
            <li>{t(applied ? "imports.done" : "imports.willApply", { n: applied ? applied.appliedCount : preview.appliedCount })}</li>
            {/* Already in the shop is a different thing from not applied because the file was refused. */}
            {alreadyThere > 0 && <li className="text-muted-foreground">{t("imports.willSkip", { n: alreadyThere })}</li>}
            {preview.failedCount > 0 && <li className="text-attention-foreground">{t("imports.failed", { n: preview.failedCount })}</li>}
            {preview.duplicateOfBatchId && <li className="text-muted-foreground">{t("imports.duplicateFile")}</li>}
          </ul>

          {preview.failedCount > 0 && (
            <p className="rounded-lg bg-attention-soft p-3 text-sm text-attention-foreground">
              {t("imports.refused")} <span className="block opacity-80">{t("imports.refusedWhy")}</span>
            </p>
          )}

          <ul className="divide-y divide-border">
            {preview.rows.slice(0, 40).map((row) => (
              <li key={row.rowNumber} className="py-2 text-sm">
                <div className="flex items-baseline gap-3">
                  <span className="tabular w-14 shrink-0 text-muted-foreground">{t("imports.row", { n: row.rowNumber })}</span>
                  <span className="min-w-0 flex-1 break-words">{Object.values(row.preview).filter((v) => v !== null && v !== "").join(" · ") || "—"}</span>
                  {row.status === "APPLIED" && <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />}
                </div>
                {row.error && (
                  <p className={cn("mt-0.5 pl-[4.25rem]", row.status === "FAILED" ? "text-destructive" : "text-muted-foreground")}>
                    {errorMessage(row.error)}
                  </p>
                )}
              </li>
            ))}
          </ul>

          {!applied && (
            <Button size="lg" className="w-full" disabled={busy || preview.failedCount > 0 || preview.appliedCount === 0} onClick={() => void apply()}>
              {busy ? t("imports.applying") : t("imports.apply")}
            </Button>
          )}
          {applied && <Button variant="secondary" className="w-full" onClick={reset}>{t("imports.choose")}</Button>}
        </section>
      )}

      {history.data && history.data.items.length > 0 && (
        <section className="rounded-xl bg-card p-4 ring-1 ring-border">
          <h2 className="mb-2 font-semibold">{t("imports.history")}</h2>
          <ul className="divide-y divide-border text-sm">
            {history.data.items.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-2">
                <FileSpreadsheet className="size-4 text-muted-foreground" aria-hidden />
                <span className="flex-1">{t(`imports.kinds.${b.kind}` as StringKey)} · {dateTime(b.startedAt)}</span>
                <span className="tabular">{b.appliedCount}</span>
                {b.failedCount > 0 && <span className="tabular text-destructive">{b.failedCount}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
