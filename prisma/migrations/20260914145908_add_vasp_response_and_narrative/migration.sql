-- AlterTable
ALTER TABLE "Case" ADD COLUMN "narrativeDraft" TEXT;
ALTER TABLE "Case" ADD COLUMN "narrativeDraftedAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WatchAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "watchId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "valueBaseUnits" TEXT NOT NULL,
    "assetSymbol" TEXT NOT NULL DEFAULT '',
    "entityName" TEXT,
    "labelType" TEXT,
    "txTimestamp" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchAlert_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "Watch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WatchAlert" ("assetSymbol", "createdAt", "entityName", "id", "labelType", "toAddress", "txHash", "txTimestamp", "valueBaseUnits", "watchId") SELECT coalesce("assetSymbol", '') AS "assetSymbol", "createdAt", "entityName", "id", "labelType", "toAddress", "txHash", "txTimestamp", "valueBaseUnits", "watchId" FROM "WatchAlert";
DROP TABLE "WatchAlert";
ALTER TABLE "new_WatchAlert" RENAME TO "WatchAlert";
CREATE UNIQUE INDEX "WatchAlert_watchId_txHash_toAddress_assetSymbol_key" ON "WatchAlert"("watchId", "txHash", "toAddress", "assetSymbol");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
