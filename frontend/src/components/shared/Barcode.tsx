/** A Code128 barcode as crisp SVG, for shelf labels (§18). */
import { code128Bars } from "@simon/shared";

export function Barcode({ value, height = 40, className }: { value: string; height?: number; className?: string }) {
  let geometry: ReturnType<typeof code128Bars> | null = null;
  try { geometry = code128Bars(value); } catch { geometry = null; }
  if (!geometry) return null;
  const quiet = 10;
  const width = geometry.modules + quiet * 2;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={className} role="img" aria-label={value} shapeRendering="crispEdges">
      <rect width={width} height={height} fill="#fff" />
      {geometry.bars.map((b) => <rect key={b.x} x={b.x + quiet} width={b.width} height={height} fill="#000" />)}
    </svg>
  );
}
