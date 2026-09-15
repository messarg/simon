/** Shift queries shared by the till (is a shift open?) and the shift screen. */
import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http.ts";
import { useSession } from "@/lib/session-store.ts";
import { getMeta, setMeta } from "@/lib/local-db.ts";

export interface ShiftFigures {
  openingFloat: number; cashSales: number; cardSales: number; salesCount: number; repayments: number; payIns: number;
  refunds: number; payOuts: number; drops: number; noSales: number; expected: number;
}

export interface ShiftReport {
  shift: { id: string; userId: string; userName: string; status: "OPEN" | "CLOSING" | "CLOSED"; openedAt: string; closedAt: string | null; openingFloat: number; unsyncedAtClose: number; notes: string; countedBreakdown: { value: number; count: number }[] | null };
  kind: "X" | "Z";
  figures: ShiftFigures;
  counted: number | null;
  variance: number | null;
  lateArrivals: { sourceType: string; sourceId: string; amount: number; arrivedAt: string }[];
  transfers: { saleId: string; direction: "in" | "out"; fromShiftId: string | null; toShiftId: string | null; at: string }[];
}

export const currentShiftKey = ["shifts", "current"] as const;

/** The open shift, cached per user so an offline till still knows it may sell (§14.5). */
export function useCurrentShift() {
  const session = useSession();
  return useQuery({
    queryKey: [...currentShiftKey, session?.user.id],
    enabled: Boolean(session),
    staleTime: 15_000,
    queryFn: async () => {
      const key = `shift.current.${session!.user.id}`;
      try {
        const report = await http.get<ShiftReport | null>("/shifts/current", { timeoutMs: 4000 });
        await setMeta(key, report ? { id: report.shift.id, status: report.shift.status, openedAt: report.shift.openedAt } : null);
        return report;
      } catch (err) {
        const cached = await getMeta<{ id: string; status: string; openedAt: string } | null>(key);
        if (cached === undefined) throw err;
        return cached ? ({ shift: { ...cached, userId: session!.user.id, userName: session!.user.name, openingFloat: 0, closedAt: null, unsyncedAtClose: 0, notes: "", countedBreakdown: null }, kind: "X", figures: null, counted: null, variance: null, lateArrivals: [], transfers: [], offline: true } as unknown as ShiftReport) : null;
      }
    },
  });
}
