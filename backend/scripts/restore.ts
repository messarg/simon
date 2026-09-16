/**
 * Restore a Simon backup onto this machine. PRD §19.2, §27.10.
 *
 *   npm run restore -w backend -- --from /Volumes/USB/simon-20260916T200000Z.simonbak
 *
 * Needs the backup file and the passphrase the owner wrote down — nothing from the machine that
 * took it. The database being replaced is kept beside the new one, never deleted, and the
 * passphrase is written into this host's key file so backups continue under the same paper.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { databaseFile } from "../src/lib/config.ts";
import { restoreFromFile, writePassphrase } from "../src/services/backup.service.ts";

const args = process.argv.slice(2);
const valueOf = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };

const from = valueOf("--from");
const to = valueOf("--to") ?? databaseFile("LIVE");
const keepPassphrase = !args.includes("--no-keep-passphrase");

if (!from) {
  console.error("Usage: npm run restore -w backend -- --from <backup.simonbak> [--to <simon.db>] [--no-keep-passphrase]");
  process.exit(2);
}

const passphrase = process.env.SIMON_RESTORE_PASSPHRASE ?? await (async () => {
  const rl = createInterface({ input: stdin, output: stdout });
  try { return await rl.question("Backup passphrase: "); } finally { rl.close(); }
})();

try {
  restoreFromFile(from, passphrase, to);
  if (keepPassphrase) writePassphrase(passphrase);
  console.log(`Restored ${from}\n      to ${to}`);
  console.log("Start Simon and sign in with the PINs that database holds.");
} catch (err) {
  console.error(`Restore failed: ${err instanceof Error ? err.message : String(err)}`);
  console.error("The existing database was left untouched.");
  process.exit(1);
}
