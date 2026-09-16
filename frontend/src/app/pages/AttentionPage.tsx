/**
 * Ուշադրություն պահանջող — one list carrying every flag: negative stock, sync conflicts, cache
 * drift (FR-STK-05). Reading it is any session; clearing one is gated by the flag's type (§15.4).
 */
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { ConfirmSheet, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { problemMessage, t, type StringKey } from "@/i18n/t.ts";
import { dateTime } from "@/lib/format.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import { outbox, useOutboxItems } from "@/lib/outbox.ts";
import type { OutboxItem } from "@/lib/local-db.ts";
import { problemMessage as reasonFor } from "@/i18n/t.ts";
import { useState } from "react";
import { useSession } from "@/lib/session-store.ts";

interface Flag {
  id: string; type: string; sourceType: string; sourceId: string;
  productId: string | null; productName: string | null;
  customerId: string | null; customerName: string | null;
  sourceLabel: string | null; note: unknown; createdAt: string;
}

export function AttentionPage() {
  const session = useSession();
  const flags = useQuery({ queryKey: ["review-flags"], queryFn: () => http.get<{ items: Flag[] }>("/review-flags", { query: { resolved: "false", limit: 200 } }) });
  const canResolve = (type: string) => session?.user.role === "ADMIN" || (session?.user.role === "STOCK" && type === "INSUFFICIENT_STOCK");

  const resolve = async (id: string) => {
    try {
      await http.post(`/review-flags/${id}/resolve`);
      await flags.refetch();
      toast.success(t("attention.resolved"));
    } catch (err) {
      toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network"));
    }
  };

  const items = flags.data?.items ?? [];
  // Documents this device queued and the server refused for good (§14.4). They never leave the
  // device on their own, so this is the only place anyone can see or clear them.
  const parked = useOutboxItems().filter((i) => i.state === "parked");
  const [dismissing, setDismissing] = useState<OutboxItem | null>(null);
  return (
    <div className="mx-auto w-full max-w-3xl p-4 md:p-6">
      <h1 className="mb-4 text-2xl font-semibold">{t("attention.title")}</h1>
      {parked.length > 0 && (
        <section className="mb-4 rounded-xl bg-destructive-soft p-4">
          <h2 className="font-semibold text-destructive">{t("outbox.deviceTitle")}</h2>
          <p className="mb-2 text-sm">{t("outbox.deviceHint")}</p>
          <ul className="divide-y divide-border">
            {parked.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t(`outbox.kinds.${i.kind}` as StringKey)} · {i.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {dateTime(i.enqueuedAt)}{i.lastError ? ` · ${t("outbox.reason", { reason: reasonFor(i.lastError.type.split("/").pop() ?? "") })}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setDismissing(i)}>{t("outbox.dismiss")}</Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ConfirmSheet
        open={dismissing !== null}
        onOpenChange={(o) => { if (!o) setDismissing(null); }}
        title={t("outbox.dismissTitle")}
        description={t("outbox.dismissHint")}
        confirmLabel={t("outbox.dismissConfirm")}
        onConfirm={() => { const i = dismissing; setDismissing(null); if (i) void outbox.dismissParked(i.id); }}
      />
      {flags.data && items.length === 0 && parked.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={t("attention.empty")} hint={t("attention.emptyHint")} />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border">
          {items.map((f) => (
            <li key={f.id} className="flex flex-wrap items-start gap-3 p-4">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-attention-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t(`attention.types.${f.type}` as StringKey)}</p>
                <p className="text-sm text-muted-foreground">
                  {[f.productName, f.customerName, f.sourceLabel, dateTime(f.createdAt)].filter(Boolean).join(" · ")}
                </p>
              </div>
              {canResolve(f.type)
                ? <Button size="sm" variant="secondary" onClick={() => void resolve(f.id)}>{t("attention.resolve")}</Button>
                : <span className="text-sm text-muted-foreground">{t("attention.resolveAdmin")}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
