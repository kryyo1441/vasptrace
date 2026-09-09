-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordSalt" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'INVESTIGATOR',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Case" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "riskLevel" TEXT,
    "recommendedVaspId" TEXT,
    "traceResult" TEXT,
    "typologyFlags" TEXT,
    "confirmedByVaspResponse" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Case_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Case" ("address", "chain", "confirmedByVaspResponse", "createdAt", "id", "recommendedVaspId", "riskLevel", "status", "traceResult", "typologyFlags", "updatedAt") SELECT "address", "chain", "confirmedByVaspResponse", "createdAt", "id", "recommendedVaspId", "riskLevel", "status", "traceResult", "typologyFlags", "updatedAt" FROM "Case";
DROP TABLE "Case";
ALTER TABLE "new_Case" RENAME TO "Case";
CREATE INDEX "Case_createdById_idx" ON "Case"("createdById");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
