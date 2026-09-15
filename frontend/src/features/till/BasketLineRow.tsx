/**
 * One basket line: tap for the keypad, swipe to remove (with undo), long-press to override the
 * price (§6.1). Every gesture has a visible alternative in the keypad sheet, so nothing is
 * hidden behind a gesture only.
 */
import { AlertTriangle, Tag } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import { lineTotal } from "@simon/shared";
import { t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { money, moneyPlain, qty as formatQty } from "@/lib/format.ts";
import type { BasketLine } from "./basket.ts";

export interface BasketLineRowProps {
  line: BasketLine;
  highlight: boolean;
  onTap: () => void;
  onLongPress: () => void;
  onRemove: () => void;
}

const SWIPE_REMOVE_PX = 90;
const LONG_PRESS_MS = 550;

export function BasketLineRow({ line, highlight, onTap, onLongPress, onRemove }: BasketLineRowProps) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; moved: boolean; long: boolean } | null>(null);
  const timer = useRef<number | null>(null);

  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  const down = (e: PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, moved: false, long: false };
    timer.current = window.setTimeout(() => { if (start.current && !start.current.moved) { start.current.long = true; navigator.vibrate?.(30); onLongPress(); } }, LONG_PRESS_MS);
  };
  const move = (e: PointerEvent) => {
    if (!start.current) return;
    const mx = e.clientX - start.current.x;
    if (Math.abs(mx) > 8 || Math.abs(e.clientY - start.current.y) > 8) { start.current.moved = true; clear(); }
    if (mx < 0 && Math.abs(mx) > Math.abs(e.clientY - start.current.y)) setDx(Math.max(mx, -160));
  };
  const up = () => {
    clear();
    const s = start.current;
    start.current = null;
    if (!s) return;
    if (dx <= -SWIPE_REMOVE_PX) { setDx(0); onRemove(); return; }
    setDx(0);
    if (!s.moved && !s.long) onTap();
  };

  const total = lineTotal(line.qty, line.unitPriceMdram) - line.discountAmount;
  const afterSale = line.stockQty - line.qty * line.factorToStockUom;
  return (
    <li className="relative overflow-hidden border-b border-border last:border-b-0">
      <div className="absolute inset-y-0 right-0 flex items-center bg-destructive px-5 text-sm font-medium text-destructive-foreground" aria-hidden>
        {t("common.clear")}
      </div>
      <div
        role="button"
        tabIndex={0}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => { clear(); start.current = null; setDx(0); }}
        onKeyDown={(e) => { if (e.key === "Enter") onTap(); if (e.key === "Delete") onRemove(); }}
        onContextMenu={(e) => e.preventDefault()}
        style={{ transform: `translateX(${dx}px)` }}
        className={cn("relative flex min-h-touch-lg touch-pan-y select-none items-center gap-3 bg-card px-4 py-3 transition-transform", dx === 0 && "duration-150", highlight && "animate-line-in")}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[1.05rem] font-medium">{line.name}</div>
          <div className="tabular mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
            <span>{formatQty(line.qty, line.decimalPlaces)} {line.uom} × {moneyPlain(line.unitPriceMdram / 1000)}</span>
            {line.priceOverridden && <Tag className="size-3.5 text-attention-foreground" aria-label={t("till.priceTitle")} />}
            {line.trackStock && afterSale < 0 && (
              <span className="inline-flex items-center gap-1 text-attention-foreground"><AlertTriangle className="size-3.5" aria-hidden />{t("till.stockLeft", { qty: formatQty(Math.max(line.stockQty, 0), line.decimalPlaces) })}</span>
            )}
          </div>
        </div>
        <div className="tabular text-right text-lg font-semibold">{money(total)}</div>
      </div>
    </li>
  );
}
