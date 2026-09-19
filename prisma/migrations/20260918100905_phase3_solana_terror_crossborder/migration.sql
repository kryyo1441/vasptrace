-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VaspRegistry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "fiuindRegistered" BOOLEAN NOT NULL,
    "hasIndiaNodalOfficer" BOOLEAN NOT NULL,
    "responseReliabilityScore" INTEGER NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT '',
    "leChannel" TEXT NOT NULL DEFAULT '',
    "leChannelUrl" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_VaspRegistry" ("fiuindRegistered", "hasIndiaNodalOfficer", "id", "name", "responseReliabilityScore") SELECT "fiuindRegistered", "hasIndiaNodalOfficer", "id", "name", "responseReliabilityScore" FROM "VaspRegistry";
DROP TABLE "VaspRegistry";
ALTER TABLE "new_VaspRegistry" RENAME TO "VaspRegistry";
CREATE UNIQUE INDEX "VaspRegistry_name_key" ON "VaspRegistry"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
