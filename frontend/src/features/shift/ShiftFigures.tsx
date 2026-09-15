/** §12.5's terms, each on its own line, so the drawer can be checked by a person. */
import { MoneyText } from "@/components/shared";
import { t } from "@/i18n/t.ts";
import type { ShiftFigures as Figures } from "@/app/shift.ts";

export function ShiftFiguresList({ figures }: { figures: Figures }) {
  const rows: Array<[string, number, string]> = [
    [t("shift.terms.openingFloat"), figures.openingFloat, ""],
    [t("shift.terms.cashSales"), figures.cashSales, "+"],
    [t("shift.terms.repayments"), figures.repayments, "+"],
    [t("shift.terms.payIns"), figures.payIns, "+"],
    [t("shift.terms.refunds"), figures.refunds, "−"],
    [t("shift.terms.payOuts"), figures.payOuts, "−"],
    [t("shift.terms.drops"), figures.drops, "−"],
  ];
  return (
    <dl className="divide-y divide-border">
      {rows.map(([label, value, sign]) => (
        <div key={label} className="flex items-center justify-between py-2">
          <dt className="text-muted-foreground"><span className="tabular inline-block w-4">{sign}</span>{label}</dt>
          <dd><MoneyText amount={value} className="font-medium" /></dd>
        </div>
      ))}
      <div className="flex items-center justify-between py-3">
        <dt className="text-lg font-semibold">{t("shift.terms.expected")}</dt>
        <dd><MoneyText amount={figures.expected} className="text-2xl font-bold" /></dd>
      </div>
      <div className="flex items-center justify-between py-2 text-sm">
        <dt className="text-muted-foreground">{t("shift.terms.cardSales")} · {t("shift.terms.salesCount")} {figures.salesCount}</dt>
        <dd><MoneyText amount={figures.cardSales} /></dd>
      </div>
    </dl>
  );
}
