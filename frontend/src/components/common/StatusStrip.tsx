/**
 * The status strip: shift, person, connection (§6.1). Offline is calm, never an error
 * (§8.3) — the till keeps selling, and the strip says so.
 */
import { CloudOff, Wifi } from "lucide-react";
import { t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { useConnection } from "@/lib/connection.ts";
import { useSession } from "@/lib/session-store.ts";

export function StatusStrip({ className }: { className?: string }) {
  const session = useSession();
  const connection = useConnection();
  const offline = connection === "offline";
  const shiftOpen = Boolean(session?.session.shiftId);
  return (
    <div className={cn("safe-top border-b border-border bg-card/95 backdrop-blur", className)}>
      <div className="flex h-11 items-center gap-2 px-4 text-sm">
        <span className={cn("size-2 rounded-full", shiftOpen ? "bg-success" : "bg-muted-foreground/40")} aria-hidden />
        <span className="font-medium">{shiftOpen ? t("status.shiftOpen") : t("status.shiftClosed")}</span>
        <span className="text-muted-foreground">· {session?.user.name}</span>
        {session?.session.mode === "PRACTICE" && (
          <span className="ml-1 rounded-full bg-attention-soft px-2 py-0.5 text-xs font-medium text-attention-foreground">{t("status.practice")}</span>
        )}
        <span className="ml-auto flex items-center gap-1.5 text-muted-foreground" aria-label={offline ? t("status.offline") : t("status.online")}>
          {offline ? <CloudOff className="size-4" aria-hidden /> : <Wifi className="size-4" aria-hidden />}
        </span>
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
