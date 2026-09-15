/** Quick tiles: pinned first, then what actually sells (§6.1). A new worker sees something to tap. */
import { useEffect, useState } from "react";
import { quickTiles, useCatalogueVersion } from "@/lib/catalogue.ts";
import { moneyPlain } from "@/lib/format.ts";
import type { CachedProduct } from "@/lib/local-db.ts";
import { t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";

export function QuickTiles({ onPick, className, limit = 12 }: { onPick: (p: CachedProduct) => void; className?: string; limit?: number }) {
  const version = useCatalogueVersion();
  const [tiles, setTiles] = useState<CachedProduct[]>([]);
  useEffect(() => { void quickTiles(limit).then(setTiles); }, [version, limit]);
  if (!tiles.length) return <p className={cn("px-2 py-4 text-center text-sm text-muted-foreground", className)}>{t("till.tilesEmpty")}</p>;
  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", className)}>
      {tiles.map((p) => (
        <button key={p.id} onClick={() => onPick(p)} className="flex min-h-20 flex-col justify-between rounded-lg border border-border bg-card p-3 text-left shadow-xs transition-colors active:bg-muted">
          <span className="line-clamp-2 text-[0.95rem] font-medium leading-snug">{p.name}</span>
          <span className="tabular mt-1 text-sm text-muted-foreground">{moneyPlain(p.sellPriceMdram / 1000)} ֏ / {p.stockUom}</span>
        </button>
      ))}
    </div>
  );
}
