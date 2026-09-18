-- CreateEnum
CREATE TYPE "ProjectStageStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "PortalLink" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PortalLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStage" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "status" "ProjectStageStatus" NOT NULL DEFAULT 'PENDING',
    "position" INTEGER NOT NULL DEFAULT 0,
    "isClientVisible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProjectStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortalLink_projectId_key" ON "PortalLink"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalLink_tokenHash_key" ON "PortalLink"("tokenHash");

-- CreateIndex
CREATE INDEX "ProjectStage_projectId_position_id_idx" ON "ProjectStage"("projectId", "position", "id");

-- AddForeignKey
ALTER TABLE "PortalLink" ADD CONSTRAINT "PortalLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStage" ADD CONSTRAINT "ProjectStage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
