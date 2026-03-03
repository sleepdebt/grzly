-- Migration 001: Add reddit_mention_count to drops table
-- Run this after the base schema (GRZLY_Schema.sql)
--
-- This column is denormalized for fast feed rendering.
-- It is refreshed every 4 hours by the reddit-scraper cron job.
-- Value = number of reddit posts mentioning this ticker in the last 7 days.

ALTER TABLE public.drops
  ADD COLUMN IF NOT EXISTS reddit_mention_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.drops.reddit_mention_count IS
  'Denormalized 7-day rolling Reddit mention count. Refreshed by reddit-scraper cron every 4h.';

-- Index for feed queries that might want to sort/filter by reddit signal
CREATE INDEX IF NOT EXISTS idx_drops_reddit_mention_count
  ON public.drops (reddit_mention_count DESC)
  WHERE status IN ('active', 'extended');
