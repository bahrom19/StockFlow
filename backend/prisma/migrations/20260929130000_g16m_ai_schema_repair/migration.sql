-- G16-M-A1: corrective forward migration restoring the AI persistence tables.
--
-- WHY THIS MIGRATION EXISTS
-- -----------------------
-- The two original AI migrations (20260907120000_add_ai_conversations and
-- 20260907120000_add_ai_idempotency_request) are recorded in _prisma_migrations
-- as applied, but their SQL never ran against this database: they use
-- snake_case identifiers and reference objects that do not exist in this
-- schema ("companies", "users", "ai_conversation"). Production therefore has
-- AiConversation / AiMessage / AiIdempotencyRequest declared in schema.prisma
-- but physically absent, while AIModule/AIController serve four live endpoints.
--
-- Those two migrations are left untouched as historical records. Prisma will
-- not re-run them (their names are present in _prisma_migrations), so this
-- migration creates the canonical objects directly.
--
-- This file is generated from the CURRENT schema.prisma, which is the single
-- source of truth:
--   * PascalCase table names — the three models carry no @@map, so Prisma
--     expects "AiConversation", "AiMessage", "AiIdempotencyRequest".
--   * camelCase column names.
--   * conversationId is nullable from the outset, folding in the effect of
--     20260907160000_make_conversation_id_nullable rather than replaying it.
--
-- ADDITIVE ONLY: creates new tables and their indexes/FKs. No existing table
-- is altered and no existing row is read or written.
--
-- Referential actions are taken verbatim from schema.prisma:
--   AiConversation.companyId            -> Company        CASCADE
--   AiConversation.userId               -> User           CASCADE
--   AiMessage.conversationId            -> AiConversation CASCADE
--   AiIdempotencyRequest.conversationId -> AiConversation CASCADE (nullable)
-- AiIdempotencyRequest.companyId/userId are plain columns in schema.prisma with
-- no @relation, so no foreign key is created for them here.
--
-- Apply order: AiConversation, then AiMessage and AiIdempotencyRequest (both
-- reference it).

-- CreateTable
CREATE TABLE "AiConversation" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "toolCallsJson" JSONB,
    "toolCallId" VARCHAR(100),
    "toolName" VARCHAR(100),
    "tokenCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiIdempotencyRequest" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "conversationId" UUID,
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "requestFingerprint" VARCHAR(64) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "responsePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiIdempotencyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiConversation_companyId_userId_createdAt_idx" ON "AiConversation"("companyId", "userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AiConversation_companyId_createdAt_idx" ON "AiConversation"("companyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AiMessage_conversationId_createdAt_idx" ON "AiMessage"("conversationId", "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AiIdempotencyRequest_companyId_userId_idempotencyKey_key" ON "AiIdempotencyRequest"("companyId", "userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AiIdempotencyRequest_expiresAt_idx" ON "AiIdempotencyRequest"("expiresAt");

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiIdempotencyRequest" ADD CONSTRAINT "AiIdempotencyRequest_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
