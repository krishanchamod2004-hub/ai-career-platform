-- Lemon Squeezy billing integration.
--
-- 1. `billing_webhook_events` is the idempotency ledger. Lemon Squeezy retries a
--    delivery until it receives a 2xx, so the same payload can arrive several
--    times; the unique (provider, event_id) constraint is what makes a replay of
--    `subscription_created` a no-op instead of a second period extension.
--    `event_id` is a SHA-256 of the raw request body.
-- 2. Webhooks for renewals/cancellations do not carry our `custom_data`, so the
--    subscription is attributed by looking it up on `external_subscription_id`.
--    That lookup runs on every delivery and needs an index.

-- CreateTable
CREATE TABLE "billing_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "external_subscription_id" TEXT,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_webhook_events_provider_event_id_key" ON "billing_webhook_events"("provider", "event_id");

-- CreateIndex
CREATE INDEX "billing_webhook_events_event_name_processed_at_idx" ON "billing_webhook_events"("event_name", "processed_at");

-- CreateIndex
CREATE INDEX "subscriptions_external_subscription_id_idx" ON "subscriptions"("external_subscription_id");
