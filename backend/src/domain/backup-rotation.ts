/**
 * Backup retention. PRD §19.2: grandfather-father-son with the generations stated — 24 hourly,
 * 14 daily, 8 weekly, 12 monthly on local disk; the USB drive carries dailies and monthlies only.
 *
 * Each generation keeps the newest backup of each of its most recent periods, counted in shop-local
 * time. A backup kept by any generation stays. Nothing here touches a file.
 */
import { businessDate, startOfWeek } from "@simon/shared";

export interface Generations { hourly: number; daily: number; weekly: number; monthly: number }

export const LOCAL_GENERATIONS: Generations = { hourly: 24, daily: 14, weekly: 8, monthly: 12 };
export const USB_GENERATIONS: Generations = { hourly: 0, daily: 14, weekly: 0, monthly: 12 };

export function retain(backups: ReadonlyArray<{ id: string; at: string }>, timeZone: string, gens: Generations = LOCAL_GENERATIONS): Set<string> {
  const newestFirst = [...backups].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const keep = new Set<string>(newestFirst.slice(0, gens.hourly).map((b) => b.id));
  const byPeriod = (count: number, key: (date: string) => string) => {
    const seen = new Set<string>();
    for (const b of newestFirst) {
      const k = key(businessDate(b.at, timeZone));
      if (seen.has(k)) continue;
      if (seen.size >= count) break;
      seen.add(k);
      keep.add(b.id);
    }
  };
  byPeriod(gens.daily, (d) => d);
  byPeriod(gens.weekly, startOfWeek);
  byPeriod(gens.monthly, (d) => d.slice(0, 7));
  return keep;
}
