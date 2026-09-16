/** Default is today and changing it is one tap (§6.10, rule 9). */
import { PERIOD_PRESETS, periodRange } from "@simon/shared";
import { Input } from "@/components/ui/input.tsx";
import { t, type StringKey } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";

export interface Period { from: string; to: string }

export function PeriodPicker({ today, value, onChange }: { today: string; value: Period; onChange: (p: Period) => void }) {
  const active = PERIOD_PRESETS.find((p) => {
    const r = periodRange(p, today);
    return r.from === value.from && r.to === value.to;
  });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PERIOD_PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => onChange(periodRange(preset, today))}
          className={cn("h-10 rounded-lg border px-3 text-sm font-medium", active === preset ? "border-primary bg-primary-soft text-accent-foreground" : "border-border bg-card text-muted-foreground")}
        >
          {t(`reports.periods.${preset}` as StringKey)}
        </button>
      ))}
      <div className="flex items-center gap-1">
        <Input aria-label={t("reports.from")} type="date" value={value.from} max={value.to} onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} className="h-10 w-40 tabular" />
        <span className="text-muted-foreground">—</span>
        <Input aria-label={t("reports.to")} type="date" value={value.to} min={value.from} onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} className="h-10 w-40 tabular" />
      </div>
    </div>
  );
}
