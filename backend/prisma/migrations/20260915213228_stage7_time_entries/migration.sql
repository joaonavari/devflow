-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "description" VARCHAR(1000),
    "workDate" DATE NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeEntry_projectId_workDate_createdAt_id_idx" ON "TimeEntry"("projectId", "workDate", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
