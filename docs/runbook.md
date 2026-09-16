# Simon — operator runbook

For whoever keeps a shop's Simon running: the owner, or the person he telephones. Screens are
Armenian; this file is English, like the rest of the code.

Everything here is reachable from **Կարգավորումներ** (Settings) unless it says otherwise.

## 0. Installing a shop

Installation and the wizard are one sitting, in that order, with the owner present (§7.1).

1. **Certificate.** `scripts/dev-cert.sh simon.local 192.168.1.50` (the host's LAN address). There is
   no plain-HTTP deployment: TLS is what makes the phone camera work at all, and a warning every
   morning teaches people to tap through warnings (§16.6, §18). Install `docker/certs/simon.crt` on
   every till and phone that will open Simon.
2. **Start it.** `docker compose up -d --build`. Nginx serves the SPA and proxies `/api` to the API
   on one origin; the database, backups, the passphrase key file and the logs live in named volumes.
   Plug the USB drive in and point `SIMON_USB_PATH` at its mount before starting, if the shop has one.
3. **The wizard.** Open `https://simon.local/` and answer five questions: the shop's name; the owner's
   own name and PIN, then the staff; whether goods are sold by weight or length; whether the shop
   keeps a debt book; and whether there is a product list to import. It is skippable and resumable —
   every answer is saved as it is given, and reopening resumes where it stopped.
4. **Write down the two secrets.** The wizard shows the recovery code and the backup passphrase once,
   together, because they are the same instruction: write this on paper and keep it away from this
   computer. The passphrase can be re-displayed later; **the recovery code cannot**.
5. **The three settings installation sets** (§7.1): the tax regime, the price basis and the timezone.
   Settings → Տեղադրում. Until the regime is set a sale is refused rather than priced at a guess, and
   the wizard's last screen says so.
6. **Import, if there is a file.** Settings → Ներբեռնում, or the wizard's last button. Products and
   customers first, then opening stock and opening debts — the last with their **original dates**, so
   aging is right on day one.
7. **Install the app on the tills.** Open the address in Chrome on each phone and "Add to home
   screen": it opens full screen and starts without the network.

## 0.1 Practice mode

Anyone can turn on practice mode from **Ավելին → Փորձնական ռեժիմ**. It behaves exactly as normal and
writes to a second database that is deleted on the way out; receipts print watermarked ՓՈՐՁՆԱԿԱՆ and
the drawer never opens. Entry and exit are recorded in the real audit log, so "I was in practice
mode" is checkable. It is per person and per device — one worker practising does not put the shop
into practice mode — and it cannot be entered with a basket open.

## 1. Answer "is it healthy?" in one minute

Open **Կարգավորումներ → Ախտորոշում** and read it down the phone, or press **Պատճենել** and send it.
It carries the version, database size, when the last backup worked, whether a backup passphrase
exists, how many sales are still waiting on any till, and the three settings installation set — tax
regime, price basis, timezone. Two of those three fail silently when wrong, so rule them out first.

The owner also sees three alerts on **Գլխավոր** (Home), each saying what to do:

| Alert | Means | Do |
|---|---|---|
| Պահուստային պատճենը 24 ժամից ավել չի արվել | No successful backup in a day | §2 below |
| Պահեստի հաշվարկում անհամապատասխանություն | The stock ledger and the cached quantity disagree | Open **Ուշադրություն պահանջող**, send the list to support. **Do not "fix" the numbers by hand** — the ledger is the truth and the cache is rebuilt from it |
| N վաճառք մեկ ժամից ավել չի ուղարկվել | A till has sales queued | Check that till's Wi-Fi and leave the app open; the queue drains by itself |

## 2. Backups

Taken hourly while the shop is trading, once at every shift close, and daily even if nothing
happened. Local disk keeps 24 hourly, 14 daily, 8 weekly and 12 monthly copies; the USB drive
carries the dailies and monthlies.

- **Take one now:** Settings → Պահուստավորում → **Պահուստավորել հիմա**.
- **Nothing is being taken:** the passphrase is missing. Press **Ստեղծել գաղտնաբառ**, enter an admin
  PIN, and write the passphrase on paper. Without it a backup cannot be opened anywhere.
- **The paper is lost, and the shop PC still works:** **Ցույց տալ գաղտնաբառը** (admin PIN) re-displays
  it. Write it down before doing anything else.
- **Rotating the passphrase** re-encrypts only backups taken afterwards. **Every copy already on the
  USB drive still needs the old paper — keep it.**

Files live in `var/backups` on the host (or `SIMON_BACKUP_DIR`); the passphrase lives in
`var/keys/backup-passphrase.json` (or `SIMON_KEY_DIR`), which is **not** in the database, so a
stolen USB stick carries no way to decrypt itself.

## 3. Restore drill — do this once before go-live (§27.10)

Restoring is what makes a backup real. Practise it on a **different machine**, using **only the USB
drive and the paper**.

1. Install Node 22 and copy the Simon repository onto the replacement machine, then `npm install`.
2. Plug in the USB drive and pick the newest `simon-*.simonbak`.
3. Run, from the repository root:

   ```bash
   npm run restore -w backend -- --from /Volumes/USB/simon-20260916T200000Z.simonbak
   ```

   It asks for the passphrase, checks the decrypted file really is a Simon database, moves any
   existing database aside as `simon.db.before-restore-<timestamp>`, and writes the restored one in
   its place. The passphrase is saved into this machine's key file so backups continue under the
   same paper.
4. `npm run dev:api` and `npm run dev`, then sign in with a PIN from **that** database and check:
   yesterday's sales are there, the debt book balances, Ախտորոշում shows the database size.
5. Write down how long the whole thing took. That number is the shop's real recovery time.

If the passphrase is wrong or the file is damaged, the restore refuses and **leaves the existing
database untouched** — it never half-restores.

**One-click restore** (Settings → Պահուստավորում → **Վերականգնել այս պատճենից**, with an admin PIN)
is for the same machine: it stages the decrypted database and the swap happens when Simon is next
started, keeping the replaced file beside it.

## 4. Logs

`var/logs/simon.log` on the host (`SIMON_LOG_DIR`), one line per request: 10 MB per file, 10 files,
nothing older than 30 days. No PIN, token, customer name or phone is ever written. Send the newest
file with the diagnostics when support asks.

## 5. Day-to-day questions

- **"The till says it is offline."** Selling continues; the queue drains when the network returns.
  Printing, the drawer, receiving and returns need the server — they say so rather than guessing.
- **"A worker is locked out."** Settings → Աշխատակիցներ → **Բացել կողպումը** (admin), or wait 15 minutes.
- **"The only admin is locked out."** Sign-in → **Մոռացե՞լ եք** → the recovery code from setup. It is
  single-use and a new one is shown; write that down too.
- **"The figures on a report look wrong."** Every figure drills to the rows behind it: tap it. If a
  cost was typed wrongly, correct it on the receipt line (Ընդունում → Ուղղել ինքնարժեքը) — sale
  history is never rewritten, and the margin report then shows both the booked and the restated
  column.
