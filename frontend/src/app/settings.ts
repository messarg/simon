/**
 * Client settings: fetched from `/settings/client`, cached in IndexedDB, and read from the
 * cache when the server is unreachable (§14.4). With no cache at all the till refuses
 * rather than guesses — callers check `data` before pricing anything.
 */
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import type { ClientSettings } from "@simon/shared";
import { connection } from "@/lib/connection.ts";
import { http } from "@/lib/http.ts";
import { localDb } from "@/lib/local-db.ts";
import { useSession } from "@/lib/session-store.ts";

export type CachedSettings = ClientSettings & { updatedAt: string | null; fetchedAt: string };

export const settingsKey = ["settings", "client"] as const;

async function fetchSettings(): Promise<CachedSettings> {
  const db = await localDb();
  try {
    const fresh = await http.get<ClientSettings & { updatedAt: string | null }>("/settings/client", { timeoutMs: 4000 });
    const value = { ...fresh, fetchedAt: new Date().toISOString() };
    await db.put("settings", value, "client");
    connection.reportSuccess();
    return value;
  } catch (err) {
    const cached = (await db.get("settings", "client")) as CachedSettings | undefined;
    if (cached) return cached;
    throw err;
  }
}

export function useClientSettings() {
  const session = useSession();
  const query = useQuery({ queryKey: settingsKey, queryFn: fetchSettings, enabled: Boolean(session), staleTime: 5 * 60_000, refetchInterval: 5 * 60_000 });
  const data = query.data;
  useEffect(() => {
    if (!data) return;
    document.documentElement.dataset.textSize = data.textSize;
    connection.configure({ failureThreshold: data.connectionFailureThreshold, latencyMs: data.scanLatencyThresholdMs });
  }, [data]);
  return query;
}

export function isSettingsStale(s: CachedSettings | undefined) {
  if (!s) return false;
  return Date.now() - Date.parse(s.fetchedAt) > s.settingsStaleAfterMinutes * 60_000;
}
