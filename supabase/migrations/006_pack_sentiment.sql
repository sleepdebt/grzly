-- Migration 006: Add pack_sentiment_score to drops table
-- Run after 005_drop_count_trigger.sql
--
-- Stores a 0–100 bearish sentiment score per drop (denormalized from the ticker).
-- Computed nightly by the pack-sentiment cron job via Claude Haiku sentiment
-- analysis on Finnhub news headlines + Reddit post titles for each ticker.
-- 0 = very bullish, 100 = very bearish.

ALTER TABLE public.drops
  ADD COLUMN IF NOT EXISTS pack_sentiment_score integer
  CHECK (pack_sentiment_score >= 0 AND pack_sentiment_score <= 100);

COMMENT ON COLUMN public.drops.pack_sentiment_score IS
  'Bearish sentiment score 0–100 computed nightly from news + Reddit via Claude Haiku. NULL = not yet computed.';
