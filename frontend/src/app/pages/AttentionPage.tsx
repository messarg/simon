/**
 * Ուշադրություն պահանջող — one list carrying every flag: negative stock, sync conflicts, cache
 * drift (FR-STK-05). Reading it is any session; clearing one is gated by the flag's type (§15.4).
 */
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { problemMessage, t, type StringKey } from "@/i18n/t.ts";
import { dateTime } from "@/lib/format.ts";
import { ApiProblem, http } from "@/lib/http.ts";
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
  return (
    <div className="mx-auto w-full max-w-3xl p-4 md:p-6">
      <h1 className="mb-4 text-2xl font-semibold">{t("attention.title")}</h1>
      {flags.data && items.length === 0 ? (
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
