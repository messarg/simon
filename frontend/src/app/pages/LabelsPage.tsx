/**
 * Պիտակներ (§18): shelf labels for goods — name, price and a Code128 code. Printed as an A4 sheet
 * on any office printer, or sent to a label printer when the shop has one.
 */
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, Printer, Tags } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { Barcode, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { money } from "@/lib/format.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import { printPage } from "@/lib/print.ts";

interface LabelItem { productId: string; name: string; priceDram: number; unit: string; barcode: string }

export function LabelsPage() {
  const [params] = useSearchParams();
  const ids = (params.get("ids") ?? "").split(",").filter(Boolean);
  const labels = useQuery({
    queryKey: ["labels", ids.join(",")],
    queryFn: () => http.get<{ items: LabelItem[]; printer: "console" | "zpl-tcp" }>("/labels", { query: { ids: ids.join(",") } }),
    enabled: ids.length > 0,
  });
  const [copies, setCopies] = useState<Record<string, number>>({});
  const count = (id: string) => copies[id] ?? 1;
  const setCount = (id: string, n: number) => setCopies((c) => ({ ...c, [id]: Math.max(0, Math.min(500, n)) }));

  if (!ids.length) return <EmptyState icon={Tags} title={t("labels.empty")} hint={t("labels.emptyHint")} className="flex-1" />;
  const items = labels.data?.items ?? [];
  const sheet = items.flatMap((l) => Array.from({ length: count(l.productId) }, (_, k) => ({ ...l, key: `${l.productId}-${k}` })));

  const sendToPrinter = async () => {
    try {
      const res = await http.post<{ printed: number }>("/print/labels", { items: items.filter((l) => count(l.productId) > 0).map((l) => ({ productId: l.productId, copies: count(l.productId) })) });
      toast.success(t("labels.printed", { n: res.printed }));
    } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4 md:p-6">
      <div className="print-hidden space-y-3">
        <h1 className="text-2xl font-semibold">{t("labels.title")}</h1>
        <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-border">
          {items.map((l) => (
            <li key={l.productId} className="flex items-center gap-3 px-4 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{l.name}</div>
                <div className="tabular text-sm text-muted-foreground">{l.barcode} · {money(l.priceDram)}</div>
              </div>
              <span className="text-sm text-muted-foreground">{t("labels.copies")}</span>
              <Button size="icon" variant="secondary" aria-label="−" onClick={() => setCount(l.productId, count(l.productId) - 1)}><Minus /></Button>
              <span className="tabular w-8 text-center font-semibold">{count(l.productId)}</span>
              <Button size="icon" variant="secondary" aria-label="+" onClick={() => setCount(l.productId, count(l.productId) + 1)}><Plus /></Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" disabled={sheet.length === 0} onClick={printPage}><Printer />{t("labels.print")}</Button>
          {labels.data?.printer === "zpl-tcp" && <Button size="lg" variant="secondary" disabled={sheet.length === 0} onClick={() => void sendToPrinter()}><Tags />{t("labels.printOnPrinter")}</Button>}
        </div>
        <p className="text-sm text-muted-foreground">{t("labels.sheetHint")}</p>
      </div>

      {/* An A4 sheet of 3 × 8 labels, 70 × 37 mm — the common stock in Yerevan stationery shops. */}
      <div className="print-area overflow-x-auto">
        <div className="mx-auto grid w-[210mm] grid-cols-3 gap-0 bg-white text-black shadow-sm print:shadow-none" style={{ gridAutoRows: "37mm" }}>
          {sheet.map((l) => (
            <div key={l.key} className="flex flex-col justify-between overflow-hidden border border-dashed border-neutral-300 px-[3mm] py-[2mm] print:border-transparent">
              <div className="line-clamp-2 text-[9pt] font-semibold leading-tight">{l.name}</div>
              <div className="tabular text-[14pt] font-bold leading-none">{money(l.priceDram)} <span className="text-[8pt] font-normal">/ {l.unit}</span></div>
              <div>
                <Barcode value={l.barcode} height={30} className="h-[11mm] w-full" />
                <div className="tabular text-center text-[7pt] tracking-wider">{l.barcode}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
