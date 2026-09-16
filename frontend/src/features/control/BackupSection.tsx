/**
 * Պահուստավորում (§6.11, §19.2). The owner sees when the last copy worked, can take one now, can
 * read or change the passphrase with an admin PIN, and can restore from a copy on this machine.
 * The passphrase is shown only when asked for, and the screen says what rotation costs.
 */
import { useQuery } from "@tanstack/react-query";
import { HardDriveDownload, KeyRound, RefreshCw, ShieldCheck, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ReauthSheet } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { problemMessage, t, type StringKey } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { dateTime } from "@/lib/format.ts";
import { ApiProblem, http } from "@/lib/http.ts";

interface BackupRun { id: string; startedAt: string; destination: string; outcome: string; sizeBytes: number | null; error: string | null }
interface Backups {
  files: Array<{ name: string; at: string; sizeBytes: number }>;
  runs: BackupRun[];
  passphraseSet: boolean;
  usbConfigured: boolean;
  usbPresent: boolean;
}

// What a failed run's code means to the owner. Anything else is a system message: it is shown in full
// under diagnostics, for support, and the owner is pointed there instead of being shown English.
const failureKeys: Record<string, StringKey> = { "passphrase-not-set": "backup.passphraseMissing", "usb-not-present": "backup.usbMissing" };
const failureText = (error: string | null) => t(failureKeys[error ?? ""] ?? "backup.failedSeeDiagnostics");

const size = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function BackupSection({ Section }: { Section: (p: { title: string; hint?: string; children: React.ReactNode }) => React.ReactElement }) {
  const backups = useQuery({ queryKey: ["backups"], queryFn: () => http.get<Backups>("/backups") });
  const [busy, setBusy] = useState(false);
  const [reauthFor, setReauthFor] = useState<null | "reveal" | "rotate" | { restore: string }>(null);
  const [passphrase, setPassphrase] = useState<{ value: string; rotated: boolean } | null>(null);
  const [staged, setStaged] = useState(false);
  const d = backups.data;
  const latestFailures = (["LOCAL", "USB"] as const)
    .map((destination) => d?.runs.find((r) => r.destination === destination))
    .filter((r): r is BackupRun => r?.outcome === "FAILED")
    // A missing passphrase already has its own notice above; saying it twice is noise.
    .filter((r) => !(r.error === "passphrase-not-set" && !d?.passphraseSet));

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); await backups.refetch(); } catch (err) { toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network")); } finally { setBusy(false); }
  };

  const onGranted = (grant: string) => {
    const target = reauthFor;
    setReauthFor(null);
    if (target === "reveal") void act(async () => setPassphrase({ value: (await http.post<{ passphrase: string }>("/backup/passphrase/reveal", { reauthGrant: grant })).passphrase, rotated: false }));
    else if (target === "rotate") void act(async () => setPassphrase({ value: (await http.post<{ passphrase: string }>("/backup/passphrase/rotate", { reauthGrant: grant })).passphrase, rotated: true }));
    else if (target && "restore" in target) void act(async () => { await http.post("/backup/restore", { file: target.restore, reauthGrant: grant }); setStaged(true); });
  };

  const lastOk = d?.runs.find((r) => r.outcome === "OK");
  return (
    <Section title={t("backup.title")} hint={t("backup.hint")}>
      <div className={cn("rounded-lg p-3", lastOk ? "bg-muted" : "bg-attention-soft text-attention-foreground")}>
        <p className="font-medium">{lastOk ? t("backup.lastOk", { when: dateTime(lastOk.startedAt) }) : t("backup.never")}</p>
        <p className="text-sm">
          {lastOk?.sizeBytes ? `${size(lastOk.sizeBytes)} · ` : ""}
          {d?.passphraseSet ? t("backup.passphraseSet") : t("backup.passphraseMissing")}
          {d?.usbConfigured ? ` · ${d.usbPresent ? t("backup.usbOk") : t("backup.usbMissing")}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="soft" disabled={busy || !d?.passphraseSet} onClick={() => void act(async () => { await http.post("/backups"); toast.success(t("backup.done")); })}>
          <HardDriveDownload />{busy ? t("backup.running") : t("backup.runNow")}
        </Button>
        {d?.passphraseSet && <Button variant="secondary" onClick={() => setReauthFor("reveal")}><KeyRound />{t("backup.reveal")}</Button>}
        <Button variant="secondary" onClick={() => setReauthFor("rotate")}><RefreshCw />{d?.passphraseSet ? t("backup.rotate") : t("backup.create")}</Button>
      </div>
      <p className="text-sm text-muted-foreground">{t("backup.drill")}</p>

      {d && d.files.length > 0 && (
        <>
          <h3 className="pt-2 font-semibold">{t("backup.files")}</h3>
          <ul className="divide-y divide-border">
            {d.files.slice(0, 8).map((f) => (
              <li key={f.name} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="tabular text-sm">{dateTime(f.at)}</div>
                  <div className="text-sm text-muted-foreground">{size(f.sizeBytes)}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setReauthFor({ restore: f.name })}><Undo2 />{t("backup.restore")}</Button>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Only a destination whose latest run failed: a failure a later backup has fixed is history. */}
      {latestFailures.map((r) => (
        <p key={r.id} className="text-sm text-attention-foreground">{t("backup.failed")}: {failureText(r.error)}</p>
      ))}

      <ReauthSheet
        open={reauthFor !== null}
        onOpenChange={(o) => { if (!o) setReauthFor(null); }}
        action={reauthFor && typeof reauthFor === "object" ? "backupRestore" : "backupPassphrase"}
        requireReason={false}
        description={reauthFor && typeof reauthFor === "object" ? t("backup.restoreHint") : reauthFor === "rotate" ? t("backup.rotateWarning") : t("backup.revealHint")}
        onGranted={onGranted}
      />

      <Sheet open={passphrase !== null} onOpenChange={(o) => { if (!o) setPassphrase(null); }} title={t("backup.revealTitle")}>
        <div className="space-y-4">
          <p className="text-muted-foreground">{t("backup.revealHint")}</p>
          <p className="tabular rounded-lg bg-muted p-5 text-center text-xl font-semibold tracking-wider">{passphrase?.value}</p>
          {passphrase?.rotated && <p className="rounded-lg bg-attention-soft p-3 text-sm text-attention-foreground">{t("backup.rotateWarning")}</p>}
          <Button size="lg" className="w-full" onClick={() => setPassphrase(null)}><ShieldCheck />{t("common.done")}</Button>
        </div>
      </Sheet>

      <Sheet open={staged} onOpenChange={setStaged} title={t("backup.restoreTitle")}>
        <div className="space-y-4">
          <p className="rounded-lg bg-attention-soft p-3 text-attention-foreground">{t("backup.restoreStaged")}</p>
          <Button size="lg" className="w-full" onClick={() => setStaged(false)}>{t("common.done")}</Button>
        </div>
      </Sheet>
    </Section>
  );
}
