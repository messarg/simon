/**
 * The bar a screen pins to the bottom for its one main action — receiving's «Ընդունել», the
 * stocktake's «Ավարտել հաշվումը». It sits above the tab bar and beside the rail by reading the
 * shell's own measurements, so it cannot drift out of step with the navigation at any width.
 *
 * It reserves its own height in the flow — measured, since a hint line above the button makes it
 * taller — so the last field of a form is never left under it. Above the tab bar it needs no
 * safe-area padding of its own; the tab bar already has it.
 */
import { useCallback, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn.ts";

const widths = { lg: "max-w-lg", "2xl": "max-w-2xl", "3xl": "max-w-3xl" } as const;

/** `width` matches the page's own `max-w-*`, so the button lines up with the form above it. */
export function ActionBar({ children, width = "3xl" }: { children: ReactNode; width?: keyof typeof widths }) {
  const [height, setHeight] = useState(96);
  const measure = useCallback((bar: HTMLDivElement | null) => {
    if (!bar) return;
    const observer = new ResizeObserver(() => setHeight(bar.offsetHeight));
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <div aria-hidden style={{ height }} />
      <div
        ref={measure}
        className="fixed inset-x-0 bottom-(--tabbar-h) left-(--rail-w) z-20 border-t border-border bg-background/95 py-3 backdrop-blur lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        {/* The same side padding as the page (`p-4 md:p-6`), so the bar's edges meet the content's. */}
        <div className={cn("mx-auto w-full px-4 md:px-6", widths[width])}>{children}</div>
      </div>
    </>
  );
}
