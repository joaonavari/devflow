-- CreateEnum
CREATE TYPE "ProgressMode" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "progressMode" "ProgressMode" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000),
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "dueDate" DATE,
    "position" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMPTZ(3),
    "isClientVisible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Task_position_nonnegative_check" CHECK ("position" >= 0),
    CONSTRAINT "Task_completed_status_check" CHECK (
      ("status" = 'DONE' AND "completedAt" IS NOT NULL)
      OR ("status" <> 'DONE' AND "completedAt" IS NULL)
    )
);

-- CreateIndex
CREATE INDEX "Task_projectId_status_position_id_idx" ON "Task"("projectId", "status", "position", "id");

-- CreateIndex
CREATE INDEX "Task_projectId_priority_dueDate_idx" ON "Task"("projectId", "priority", "dueDate");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
