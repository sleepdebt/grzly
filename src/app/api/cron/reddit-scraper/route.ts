// Cron: Reddit scraper — fetch posts, extract tickers, upsert to DB
// Schedule: every 4 hours — see vercel.json
// Route: /api/cron/reddit-scraper
//
// What it does per run:
//   1. OAuth handshake (or use cached token)
//   2. Fetch hot posts from 5 subreddits (sequentially, ≤1 req/2s)
//   3. Extract ticker symbols from title + body
//   4. Upsert into reddit_posts (dedup by reddit_post_id)
//   5. Return per-subreddit stats + total upserted

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { scrapeAllSubreddits, RedditPost } from '@/lib/reddit'

// Batch size for Supabase upserts — avoids hitting payload limits
const UPSERT_BATCH_SIZE = 50

export async function GET(req: NextRequest) {
  // Verify cron secret — only Vercel Cron (or manual trigger with secret) allowed
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  console.log('[Cron: reddit-scraper] Starting scrape run...')

  // ─── Step 1: Scrape all subreddits ──────────────────────────
  const { posts, results } = await scrapeAllSubreddits()

  const totalFetched = results.reduce((sum, r) => sum + r.ticker_posts, 0)
  console.log(`[Cron: reddit-scraper] Scrape complete — ${totalFetched} ticker posts across ${results.length} subreddits`)

  if (posts.length === 0) {
    const errorCount = results.filter(r => r.error).length
    if (errorCount === results.length) {
      // All subs failed — likely a Reddit API outage
      console.error('[Cron: reddit-scraper] All subreddits failed — possible Reddit API outage')
      return NextResponse.json({
        success: false,
        message: 'All subreddits failed to fetch — possible Reddit API outage',
        results,
        duration_ms: Date.now() - startTime,
      }, { status: 503 })
    }

    // Some failed, some just had no ticker posts — still a "success"
    return NextResponse.json({
      success: true,
      upserted: 0,
      results,
      duration_ms: Date.now() - startTime,
    })
  }

  // ─── Step 2: Upsert to Supabase ─────────────────────────────
  const supabase = createServiceRoleClient()
  let totalUpserted = 0
  let totalErrors = 0

  // Map to Supabase schema column names
  const dbRows = posts.map((post: RedditPost) => ({
    reddit_post_id: post.reddit_post_id,
    subreddit: post.subreddit,
    title: post.title,
    body: post.body,
    upvotes: post.upvotes,
    comment_count: post.comment_count,
    author: post.author,
    reddit_url: post.reddit_url,
    posted_at: post.posted_at,
    tickers_mentioned: post.tickers_mentioned,
    scraped_at: new Date().toISOString(),
  }))

  // Batch upserts to avoid payload size limits
  for (let i = 0; i < dbRows.length; i += UPSERT_BATCH_SIZE) {
    const batch = dbRows.slice(i, i + UPSERT_BATCH_SIZE)

    const { error, data } = await supabase
      .from('reddit_posts')
      .upsert(batch, {
        onConflict: 'reddit_post_id',
        // Update these columns on conflict — keeps upvote/comment counts fresh
        ignoreDuplicates: false,
      })
      .select('reddit_post_id')

    if (error) {
      console.error(`[Cron: reddit-scraper] Upsert batch ${i}–${i + UPSERT_BATCH_SIZE} failed:`, error.message)
      totalErrors += batch.length
    } else {
      totalUpserted += data?.length ?? batch.length
    }
  }

  // ─── Step 3: Cleanup old posts ──────────────────────────────
  // Keep only last 30 days — avoids unbounded table growth
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { error: cleanupError } = await supabase
    .from('reddit_posts')
    .delete()
    .lt('posted_at', thirtyDaysAgo)

  if (cleanupError) {
    // Non-fatal — log and continue
    console.warn('[Cron: reddit-scraper] Cleanup query failed (non-fatal):', cleanupError.message)
  }

  // ─── Step 4: Update active Drop reddit_mention_counts ──────
  // This denormalizes mention counts into the drops table for fast feed rendering
  // Only update drops that have active status
  await updateDropMentionCounts(supabase, posts)

  const duration = Date.now() - startTime
  console.log(`[Cron: reddit-scraper] Done — ${totalUpserted} upserted, ${totalErrors} errors, ${duration}ms`)

  return NextResponse.json({
    success: true,
    upserted: totalUpserted,
    errors: totalErrors,
    results,         // per-subreddit breakdown
    duration_ms: duration,
  })
}

// ─── Mention count denormalization ──────────────────────────

/**
 * For each active Drop, count how many of the newly-scraped posts
 * mention its ticker and cache the count on the drops table.
 *
 * This avoids expensive COUNT queries on every page load.
 * Only updates if the count has actually changed.
 */
async function updateDropMentionCounts(
  supabase: ReturnType<typeof createServiceRoleClient>,
  scrapedPosts: RedditPost[]
): Promise<void> {
  // Build a map: ticker → mention count from this scrape run
  const mentionMap = new Map<string, number>()
  for (const post of scrapedPosts) {
    for (const ticker of post.tickers_mentioned) {
      mentionMap.set(ticker, (mentionMap.get(ticker) ?? 0) + 1)
    }
  }

  if (mentionMap.size === 0) return

  // Fetch active drops whose tickers appear in the mention map
  const tickers = Array.from(mentionMap.keys())
  const { data: activeDrops } = await supabase
    .from('drops')
    .select('id, ticker')
    .in('status', ['active', 'extended'])
    .in('ticker', tickers)

  if (!activeDrops || activeDrops.length === 0) return

  // Query actual 7-day rolling counts from the DB for accuracy
  // (the scrape map only reflects this run, not historic posts)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  for (const drop of activeDrops) {
    const { count } = await supabase
      .from('reddit_posts')
      .select('id', { count: 'exact', head: true })
      .contains('tickers_mentioned', [drop.ticker])
      .gte('posted_at', sevenDaysAgo)

    if (count !== null) {
      // Store as a simple integer column (add reddit_mention_count to drops table if not present)
      // NOTE: this column isn't in the base schema — add it as:
      // ALTER TABLE public.drops ADD COLUMN IF NOT EXISTS reddit_mention_count integer DEFAULT 0;
      await supabase
        .from('drops')
        .update({ reddit_mention_count: count })
        .eq('id', drop.id)
    }
  }
}
