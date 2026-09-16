/**
 * Ախտորոշում (§19.5): what support asks for first, readable down the phone by someone who does not
 * know what a log is, with a copy button and a file to send. Nothing leaves the shop by itself (§1).
 */
import { useQuery } from "@tanstack/react-query";
import { ClipboardCopy, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { t, type StringKey } from "@/i18n/t.ts";
import { downloadText } from "@/lib/csv.ts";
import { dateTime } from "@/lib/format.ts";
import { http } from "@/lib/http.ts";

interface Diagnostics {
  version: string; now: string; uptimeSeconds: number;
  database: { bytes: number | null; walBytes: number | null; lastCheckpointAt: string | null; checkpointAgeSeconds: number | null };
  backup: { passphraseSet: boolean; lastOkAt: string | null; lastOkSizeBytes: number | null; lastFailureAt: string | null; lastFailureError: string | null; destination: string };
  queues: { salesWaiting: number; parked: number; oldestAt: string | null; devices: Array<{ prefix: string; label: string; salesWaiting: number; parked: number; lastSeenAt: string | null }> };
  ledgerDriftFlags: number;
  installation: { taxRegime: string | null; priceBasis: string; timezone: string };
  fiscal: { device: string; since: string | null; pending: number };
  labelPrinter: "console" | "zpl-tcp";
}

const mb = (bytes: number | null) => (bytes === null ? "—" : `${(bytes / 1_048_576).toFixed(1)} MB`);
const hours = (seconds: number) =>
  seconds >= 3600
    ? `${Math.floor(seconds / 3600)} ${t("diagnostics.hoursShort")} ${Math.floor((seconds % 3600) / 60)} ${t("diagnostics.minutesShort")}`
    : `${Math.floor(seconds / 60)} ${t("diagnostics.minutesShort")}`;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular text-right font-medium">{value}</dd>
    </div>
  );
}

export function DiagnosticsSection({ Section }: { Section: (p: { title: string; hint?: string; children: React.ReactNode }) => React.ReactElement }) {
  const q = useQuery({ queryKey: ["diagnostics"], queryFn: () => http.get<Diagnostics>("/diagnostics"), refetchInterval: 60_000 });
  const d = q.data;
  if (!d) return <Section title={t("diagnostics.title")}><p className="text-muted-foreground">{t("common.loading")}</p></Section>;

  const asText = [
    `Simon ${d.version}`,
    `${t("diagnostics.uptime")}: ${hours(d.uptimeSeconds)}`,
    `${t("diagnostics.database")}: ${mb(d.database.bytes)} (WAL ${mb(d.database.walBytes)})`,
    `${t("diagnostics.walAge")}: ${d.database.lastCheckpointAt ? dateTime(d.database.lastCheckpointAt) : t("diagnostics.none")}`,
    `${t("diagnostics.lastBackup")}: ${d.backup.lastOkAt ? dateTime(d.backup.lastOkAt) : t("diagnostics.none")} · ${t("backup.passphrase")}: ${d.backup.passphraseSet ? "+" : "-"}`,
    `${t("diagnostics.lastFailure")}: ${d.backup.lastFailureAt ? `${dateTime(d.backup.lastFailureAt)} ${d.backup.lastFailureError ?? ""}` : t("diagnostics.none")}`,
    `${t("diagnostics.queues")}: ${d.queues.salesWaiting} · ${t("diagnostics.parked")}: ${d.queues.parked}`,
    `${t("diagnostics.driftFlags")}: ${d.ledgerDriftFlags}`,
    `${t("diagnostics.fiscal")}: ${d.fiscal.device} · ${d.fiscal.pending}`,
    `${t("diagnostics.regime")}: ${d.installation.taxRegime ?? t("settings.notSet")} · ${t("diagnostics.basis")}: ${d.installation.priceBasis} · ${t("diagnostics.timezone")}: ${d.installation.timezone}`,
    ...d.queues.devices.map((x) => `${x.prefix} ${x.label}: ${x.salesWaiting}/${x.parked} · ${x.lastSeenAt ? dateTime(x.lastSeenAt) : "—"}`),
  ].join("\n");

  return (
    <Section title={t("diagnostics.title")} hint={t("diagnostics.hint")}>
      <dl className="divide-y divide-border text-[0.95rem]">
        <Row label={t("diagnostics.version")} value={d.version} />
        <Row label={t("diagnostics.uptime")} value={hours(d.uptimeSeconds)} />
        <Row label={t("diagnostics.database")} value={`${mb(d.database.bytes)} · WAL ${mb(d.database.walBytes)}`} />
        <Row label={t("diagnostics.walAge")} value={d.database.lastCheckpointAt ? dateTime(d.database.lastCheckpointAt) : t("diagnostics.none")} />
        <Row label={t("diagnostics.lastBackup")} value={d.backup.lastOkAt ? dateTime(d.backup.lastOkAt) : t("diagnostics.none")} />
        {d.backup.lastFailureAt && <Row label={t("diagnostics.lastFailure")} value={`${dateTime(d.backup.lastFailureAt)} · ${d.backup.lastFailureError ?? ""}`} />}
        <Row label={t("diagnostics.queues")} value={`${d.queues.salesWaiting} · ${t("diagnostics.parked")} ${d.queues.parked}`} />
        <Row label={t("diagnostics.driftFlags")} value={String(d.ledgerDriftFlags)} />
        <Row label={t("diagnostics.regime")} value={d.installation.taxRegime ? t(`settings.regimes.${d.installation.taxRegime}` as StringKey) : t("settings.notSet")} />
        <Row label={t("diagnostics.basis")} value={t(`settings.bases.${d.installation.priceBasis}` as StringKey)} />
        <Row label={t("diagnostics.timezone")} value={d.installation.timezone} />
        <Row label={t("diagnostics.fiscal")} value={d.fiscal.device === "none" ? t("diagnostics.fiscalNone") : `${d.fiscal.device} · ${t("diagnostics.fiscalPending", { n: d.fiscal.pending })}`} />
        <Row label={t("diagnostics.labelPrinter")} value={t(`diagnostics.labelPrinters.${d.labelPrinter}` as StringKey)} />
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" className="flex-auto sm:flex-none" onClick={() => { void navigator.clipboard?.writeText(asText); toast.success(t("diagnostics.copied")); }}><ClipboardCopy />{t("diagnostics.copy")}</Button>
        <Button variant="secondary" className="flex-auto sm:flex-none" onClick={() => downloadText(`simon-diagnostics-${d.now.slice(0, 10)}.txt`, asText)}><FileDown />{t("diagnostics.save")}</Button>
      </div>
    </Section>
  );
}
