/**
 * The status strip: shift, person, connection (§6.1). Offline is calm, never an error
 * (§8.3) — the till keeps selling, and the strip says so.
 */
import { CloudOff, Wifi } from "lucide-react";
import { Link } from "react-router";
import { t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { useConnection } from "@/lib/connection.ts";
import { useSession } from "@/lib/session-store.ts";
import { useOutboxCounts } from "@/lib/outbox.ts";
import { useCurrentShift } from "@/app/shift.ts";
import { ScreenHelp } from "@/components/shared/ScreenHelp.tsx";

export function StatusStrip({ className }: { className?: string }) {
  const session = useSession();
  const connection = useConnection();
  const offline = connection === "offline";
  const counts = useOutboxCounts();
  const shift = useCurrentShift().data;
  const shiftOpen = shift?.shift.status === "OPEN";
  return (
    <div className={cn("safe-top border-b border-border bg-card/95 backdrop-blur", className)}>
      <div className="flex h-11 items-center gap-2 px-4 text-sm">
        <span className={cn("size-2 rounded-full", shiftOpen ? "bg-success" : "bg-muted-foreground/40")} aria-hidden />
        <span className="font-medium">{shiftOpen ? t("status.shiftOpen") : t("status.shiftClosed")}</span>
        <span className="text-muted-foreground">· {session?.user.name}</span>
        {session?.session.mode === "PRACTICE" && (
          <span className="ml-1 rounded-full bg-attention-soft px-2 py-0.5 text-xs font-medium text-attention-foreground">{t("status.practice")}</span>
        )}
        {counts.pendingSales > 0 && (
          <span className="ml-auto rounded-full bg-attention-soft px-2 py-0.5 text-xs font-medium text-attention-foreground">{t("status.pending", { n: counts.pendingSales })}</span>
        )}
        {counts.needsAttention > 0 && (
          <Link to="/attention" aria-label={t("outbox.deviceTitle")} className="rounded-full bg-destructive-soft px-2 py-0.5 text-xs font-medium text-destructive">! {counts.needsAttention}</Link>
        )}
        <span className={cn("flex items-center gap-1.5 text-muted-foreground", counts.pendingSales === 0 && "ml-auto")} aria-label={offline ? t("status.offline") : t("status.online")}>
          {offline ? <CloudOff className="size-4" aria-hidden /> : <Wifi className="size-4" aria-hidden />}
        </span>
        <ScreenHelp />
      </div>
      {offline && (
        <div className="flex items-center gap-2 bg-attention-soft px-4 py-2 text-sm text-attention-foreground" role="status">
          <CloudOff className="size-4 shrink-0" aria-hidden />
          {t("status.offline")}
        </div>
      )}
    </div>
  );
}
