-- Three tiers replace three roles (PRD §16.4). Hand-written: the role set is a CHECK constraint,
-- which only a table rebuild can change, and the rows have to be mapped on the way across.
--
--   ADMIN  → OWNER for the one who set the shop up (they hold the recovery code; failing that,
--            the earliest), MANAGER for every other admin.
--   STOCK  → EMPLOYEE with the stock preset:   sell, returns, debt, receive, stocktake,
--            writeoff, labels — everything the role allowed before.
--   WORKER → EMPLOYEE with the cashier preset: sell, returns, debt.
--
-- Nobody gains or loses a capability except the admins who become managers, who lose what is the
-- owner's alone. That is the change, not a side effect of it.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "recoveryCodeHash" TEXT,
    "role" TEXT NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TEXT,
    "coachMarksSeen" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TEXT NOT NULL,
    "avatar" BLOB,
    "avatarType" TEXT,
    "avatarUpdatedAt" TEXT,
    "phone" TEXT,
    "startedOn" TEXT,
    "note" TEXT,
    CHECK ("role" IN ('OWNER', 'MANAGER', 'EMPLOYEE')),
    CHECK (isActive IN (0, 1)),
    CHECK (failedAttempts >= 0)
) STRICT;
INSERT INTO "new_User" ("id", "name", "pinHash", "recoveryCodeHash", "role", "permissions", "isActive", "failedAttempts", "lockedUntil", "coachMarksSeen", "createdAt", "avatar", "avatarType", "avatarUpdatedAt", "phone", "startedOn", "note")
SELECT "id", "name", "pinHash",
    -- Only the owner carries a recovery code (§16.2); a manager has no use for one.
    CASE WHEN "id" = (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "recoveryCodeHash" IS NULL, "createdAt", "id" LIMIT 1) THEN "recoveryCodeHash" END,
    CASE
        WHEN "role" = 'ADMIN' AND "id" = (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "recoveryCodeHash" IS NULL, "createdAt", "id" LIMIT 1) THEN 'OWNER'
        WHEN "role" = 'ADMIN' THEN 'MANAGER'
        ELSE 'EMPLOYEE'
    END,
    CASE "role"
        WHEN 'STOCK' THEN '["sell","returns","debt","receive","stocktake","writeoff","labels"]'
        WHEN 'WORKER' THEN '["sell","returns","debt"]'
        ELSE '[]'
    END,
    "isActive", "failedAttempts", "lockedUntil", "coachMarksSeen", "createdAt", "avatar", "avatarType", "avatarUpdatedAt", "phone", "startedOn", "note"
FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
