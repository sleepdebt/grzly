-- Migration 002: Add live_price_change_pct to drops table
-- Denormalized current % change from baseline, refreshed daily by price-snapshot cron.
-- Lets the feed show live price movement without a Polygon call per card.

ALTER TABLE public.drops
  ADD COLUMN IF NOT EXISTS live_price_change_pct numeric(8, 4);

COMMENT ON COLUMN public.drops.live_price_change_pct IS
  'Denormalized current % change from baseline_price. Refreshed daily by price-snapshot cron at market close.';

-- Also add a unique constraint on price_snapshots(ticker, snapshot_date)
-- so the cron''s idempotent insert logic works correctly
ALTER TABLE public.price_snapshots
  DROP CONSTRAINT IF EXISTS price_snapshots_ticker_date_unique;

ALTER TABLE public.price_snapshots
  ADD CONSTRAINT price_snapshots_ticker_date_unique UNIQUE (ticker, snapshot_date);
