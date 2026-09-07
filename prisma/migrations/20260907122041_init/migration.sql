-- CreateTable
CREATE TABLE "LabeledAddress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "labelType" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "source" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "VaspRegistry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "fiuindRegistered" BOOLEAN NOT NULL,
    "hasIndiaNodalOfficer" BOOLEAN NOT NULL,
    "responseReliabilityScore" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "riskLevel" TEXT,
    "recommendedVaspId" TEXT,
    "traceResult" TEXT,
    "typologyFlags" TEXT,
    "confirmedByVaspResponse" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "LabeledAddress_address_idx" ON "LabeledAddress"("address");

-- CreateIndex
CREATE UNIQUE INDEX "LabeledAddress_address_chain_key" ON "LabeledAddress"("address", "chain");

-- CreateIndex
CREATE UNIQUE INDEX "VaspRegistry_name_key" ON "VaspRegistry"("name");
