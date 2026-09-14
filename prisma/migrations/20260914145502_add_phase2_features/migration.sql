-- AlterTable
ALTER TABLE "Case" ADD COLUMN "vaspRespondedAt" DATETIME;
ALTER TABLE "Case" ADD COLUMN "vaspResponse" TEXT;

-- CreateTable
CREATE TABLE "IssuerRegistry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "issuerName" TEXT NOT NULL,
    "freezeProcess" TEXT NOT NULL,
    "requiresCourtOrder" BOOLEAN NOT NULL,
    "sourceUrl" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "caseId" TEXT,
    "detail" TEXT NOT NULL,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Watch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "lastSeenTimestamp" INTEGER,
    "lastCheckedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Watch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "watchId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "valueBaseUnits" TEXT NOT NULL,
    "assetSymbol" TEXT,
    "entityName" TEXT,
    "labelType" TEXT,
    "txTimestamp" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchAlert_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "Watch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "IssuerRegistry_symbol_key" ON "IssuerRegistry"("symbol");

-- CreateIndex
CREATE INDEX "AuditEvent_caseId_idx" ON "AuditEvent"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "Watch_address_chain_createdById_key" ON "Watch"("address", "chain", "createdById");

-- CreateIndex
CREATE UNIQUE INDEX "WatchAlert_watchId_txHash_toAddress_assetSymbol_key" ON "WatchAlert"("watchId", "txHash", "toAddress", "assetSymbol");
