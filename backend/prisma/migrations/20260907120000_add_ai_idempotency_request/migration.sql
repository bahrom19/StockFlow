-- CreateTable
CREATE TABLE "ai_idempotency_request" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "request_fingerprint" VARCHAR(64) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "response_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_idempotency_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_idempotency_request_company_id_user_id_idempotency_key_key" ON "ai_idempotency_request"("company_id", "user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "ai_idempotency_request_expires_at_idx" ON "ai_idempotency_request"("expires_at");

-- AddForeignKey
ALTER TABLE "ai_idempotency_request" ADD CONSTRAINT "ai_idempotency_request_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
