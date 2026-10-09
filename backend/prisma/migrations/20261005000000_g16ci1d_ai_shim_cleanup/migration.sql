-- G16-CI-1D: remove the shim preconditions.
--
-- Sorts after 20260929130000_g16m_ai_schema_repair, so by the time this runs
-- the canonical PascalCase AiConversation / AiMessage / AiIdempotencyRequest
-- objects already exist and the end state matches schema.prisma exactly.
--
-- WHAT IS REMOVED
-- ---------------
-- The empty placeholder relations created by
-- 20260907110000_g16ci1d_ai_shim_precondition:
--     "companies", "users", "ai_conversation"
-- plus, when the three broken AI migrations replayed, the snake_case tables
-- they created:
--     "ai_conversations", "ai_messages", "ai_idempotency_request"
--
-- FAIL CLOSED — WHY
-- -----------------
-- A shim table holding data means something wrote to it. Dropping it would
-- destroy content that no other object references, and the correct resolution
-- depends on facts this migration cannot see. Rather than guess, it aborts
-- and requires manual review. This follows the precedent of
-- 20260925120000_g15_07_c1_provision_retained_earnings, which also refuses
-- to act automatically when a row would be destroyed.
--
-- The audit of ALL shim tables completes BEFORE the first DROP, so an abort
-- never leaves a partially cleaned-up schema regardless of transaction
-- behaviour.
--
-- NO CASCADE, NO UNKNOWN OBJECTS
-- ------------------------------
-- Drops are plain DROP TABLE ... without CASCADE. If any object outside the
-- shim set depends on these tables, the audit raises BEFORE that drop is
-- attempted, so dependent objects are never dropped automatically. The
-- DROP would fail on its own without CASCADE; the explicit check exists to
-- fail with a comprehensible message instead of a raw constraint error.
--
-- IDEMPOTENT: guarded by existence checks; a no-op on re-run.
--
-- DROP ORDER: children before parents ("ai_messages" before "ai_conversations")
-- so the FK from ai_messages.conversation_id resolves in order.

DO $$
DECLARE
    shim_tables text[] := ARRAY[
        'companies',
        'users',
        'ai_conversation',
        'ai_conversations',
        'ai_messages',
        'ai_idempotency_request'
    ];
    t          text;
    row_count  bigint;
    dependents text;
BEGIN
    -- ── Phase 1: audit every shim table. No DDL runs in this phase. ────────
    FOREACH t IN ARRAY shim_tables LOOP
        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = t
        ) THEN
            EXECUTE format('SELECT count(*) FROM %I', t) INTO row_count;

            IF row_count > 0 THEN
                RAISE EXCEPTION
                    'G16-CI-1D: shim table % holds % row(s). It must not be dropped automatically — resolve it manually, then re-run this migration.',
                    quote_ident(t),
                    row_count;
            END IF;

            -- Unexpected inbound foreign keys from outside the shim set.
            SELECT string_agg(DISTINCT conrelid::regclass::text, ', ')
            INTO dependents
            FROM pg_constraint
            WHERE contype = 'f'
              AND confrelid = t::regclass
              AND conrelid::regclass::text <> ALL (shim_tables);

            IF dependents IS NOT NULL THEN
                RAISE EXCEPTION
                    'G16-CI-1D: shim table % is referenced by foreign key(s) from % (outside the shim set). Refusing to drop.',
                    quote_ident(t),
                    dependents;
            END IF;
        END IF;
    END LOOP;

    -- ── Phase 2: every check passed. Drop children before parents. ────────
    DROP TABLE IF EXISTS "ai_messages";
    DROP TABLE IF EXISTS "ai_conversations";
    DROP TABLE IF EXISTS "ai_idempotency_request";
    DROP TABLE IF EXISTS "ai_conversation";
    DROP TABLE IF EXISTS "companies";
    DROP TABLE IF EXISTS "users";
END $$;
