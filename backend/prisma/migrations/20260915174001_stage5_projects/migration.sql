-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000),
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "startDate" DATE NOT NULL,
    "dueDate" DATE,
    "budget" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "progress" SMALLINT NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Project_budget_nonnegative_check" CHECK ("budget" >= 0),
    CONSTRAINT "Project_progress_range_check" CHECK ("progress" BETWEEN 0 AND 100),
    CONSTRAINT "Project_date_range_check" CHECK ("dueDate" IS NULL OR "dueDate" >= "startDate")
);

-- CreateIndex
CREATE INDEX "Project_userId_archivedAt_status_name_id_idx" ON "Project"("userId", "archivedAt", "status", "name", "id");

-- CreateIndex
CREATE INDEX "Project_userId_clientId_archivedAt_idx" ON "Project"("userId", "clientId", "archivedAt");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
