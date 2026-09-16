# Audit — §27.15 (vocabulary) and §27.16 (destructive actions)

Date: 2026-09-16 · Against: `development` at Phase 5 · Method: every user-facing string and every
write the client can make, read one at a time.

These two criteria cannot be met by a test alone, but neither is purely a matter of judgement:
most of §27.15 is mechanical, and §27.16 is an inventory. What could be automated now is
(`frontend/src/i18n/hy.test.ts`), so it cannot rot back.

## §27.15 — no screen exposes an internal term

**Rule** (§4.1): the user is never shown the right-hand column — not in a label, not in an error,
not in an export header. Named explicitly: *ledger*, *movement*, *allocation*, *idempotent*,
*reconciliation*, and the model names behind each notebook.

**Found and fixed — eight strings:**

| Where | Was | Now |
|:--|:--|:--|
| `products.lockedAfterMovements` | «քանի որ ապրանքն արդեն **շարժ** ունի» | «քանի որ ապրանքն արդեն վաճառվել կամ ընդունվել է» |
| `reports.actions.cashMovement.create` | «Դրամարկղի **շարժ**» | «Կանխիկի մուտք կամ ելք» |
| `help.screens.stock` | «**շարժի** պատմությունը» | «փոփոխությունների պատմությունը» |
| `attention.emptyHint` | «ուշացած **համաժամեցում**» (sync) | «ուշացած ուղարկում» |
| `reports.names.audit` | «Գործողությունների **մատյան**» (ledger) | «Գործողությունների պատմություն» |
| `products.emptyDead` | «Բոլոր ապրանքները **շարժվում** են» | «Բոլոր ապրանքները վաճառվում են» |
| `reports.hints.stock-turnover` | «Ինչ է **շարժվում** և ինչ՝ ոչ» | «Ինչն է վաճառվում և ինչը՝ ոչ» |
| `outbox.parkedHint` | «**սերվերը** չընդունեց» | «խանութի համակարգիչը չընդունեց» |

**Also fixed, under §4.2's rule that strings live in one file:** the four CSV templates and the
hour/minute abbreviations had been written inline in components, and two receipt-sheet lines
appended «֏» by hand instead of going through `formatDram`.

**One deliberate exception**, recorded rather than hidden: the diagnostics screen says
«Տվյալների բազա» (database). §19.5 specifies database size on that screen by name — it is
support's screen, read down the phone, and there is no shop word for the thing whose size matters.
It is exempted by key in the test, not by weakening the rule.

**Now enforced** by `frontend/src/i18n/hy.test.ts`: no forbidden term in any string, no Armenian
string literal outside the resource file, and a two-sentence explanation for every screen.

## §27.16 — destructive actions are undoable or confirmed, and routine ones are not

**Found and fixed — four actions that fired on a single tap:**

| Action | Was | Now |
|:--|:--|:--|
| Void somebody's parked basket | one tap, gone | confirmation naming what is lost |
| Deactivate a worker | one tap | confirmation naming the person |
| Deactivate a till | one tap | confirmation, warning about sales not yet sent from it |
| Sign a session out | one tap | confirmation saying the PIN will be needed again |
| Merge two customers | the browser's own `confirm()` | an in-app confirmation (§8.1's dialogs are Simon's, not Chrome's) |

**Already correct** — undoable: removing a basket line, clearing a basket (both 5-second undo).
Confirmed or gated: closing a shift (hard confirm), erasing a customer, reversing a repayment, a
cash movement or a supplier payment (admin PIN and a typed reason), stock adjustment (admin PIN and
a reason), write-off (a reason code), purchase return, cost correction, backup restore and
passphrase rotation (admin PIN, and the rotation screen says the old paper still opens old copies).

Retiring a barcode is deliberately unconfirmed: it is reversible, and it never stops a code
scanning — the labels already on the shelves do not know they were retired (§6.12).

**The other half of the criterion — no routine action is confirmed** — holds: completing a sale is
a single tap with no dialog (§6.2), and parking a basket, changing a quantity, taking a repayment,
opening a shift, printing, exporting and accepting a reorder suggestion have none either. The
receiving cost question and the price-override reason are not confirmations of routine actions:
§13.2 and §12.1 require both.

## One gap this audit surfaced, not yet closed

A **parked** outbox document — one the server refused for good (§14.4) — raises a toast and a
count in the status strip, but no screen lists them and `outbox.dismissParked` is never called.
The owner can see the consequence (a `ReviewFlag`) but not the queued document itself. It needs a
screen, and it is the one piece of §14.4 with no way in.
