// Cron: pack-sentiment — nightly bearish sentiment score per active ticker
// Schedule: 0 12 * * * (noon UTC, after reddit-scraper at 10am)
// Route: /api/cron/pack-sentiment
//
// Per ticker:
//   1. Fetch last 7 days of Finnhub news headlines
//   2. Fetch last 7 days of Reddit post titles from our DB
//   3. Send to Claude Haiku: "Rate aggregate bearish sentiment 0–100"
//   4. Store result on all active drops for that ticker
//
// Requires migration 006_pack_sentiment.sql to be applied first.

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getCompanyNews } from '@/lib/finnhub'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// Haiku: cheap enough for nightly batch (one call per ticker)
const MODEL = 'claude-haiku-4-5-20251001'

// Stagger between tickers to avoid bursting Finnhub + Anthropic rate limits
const STAGGER_MS = 600

interface TickerResult {
  ticker: string
  score: number | null
  headlines: number
  reddit: number
  skipped?: boolean
  error?: string
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const startTime = Date.now()
  console.log('[Cron: pack-sentiment] Starting...')

  // ─── Step 1: Get unique active tickers ───────────────────────
  const { data: activeDrops, error: dropError } = await supabase
    .from('drops')
    .select('ticker')
    .in('status', ['active', 'extended'])

  if (dropError || !activeDrops) {
    console.error('[Cron: pack-sentiment] Failed to fetch drops:', dropError?.message)
    return NextResponse.json({ error: dropError?.message ?? 'Failed to fetch drops' }, { status: 500 })
  }

  const tickers = [...new Set(activeDrops.map(d => d.ticker as string))]
  console.log(`[Cron: pack-sentiment] ${tickers.length} unique tickers to process`)

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const results: TickerResult[] = []

  // ─── Step 2: Score each ticker ───────────────────────────────
  for (const ticker of tickers) {
    try {
      // Finnhub headlines (last 7 days, up to 10)
      const news = await getCompanyNews(ticker, { days: 7, limit: 10 })
      const newsLines = news.map(n => n.headline)

      // Reddit titles from our scraped posts (last 7 days, highest upvoted first)
      const { data: redditPosts } = await supabase
        .from('reddit_posts')
        .select('title')
        .contains('tickers_mentioned', [ticker])
        .gte('posted_at', sevenDaysAgo)
        .order('upvotes', { ascending: false })
        .limit(15)

      const redditLines = (redditPosts ?? []).map(p => p.title as string)
      const allContent = [...newsLines, ...redditLines]

      if (allContent.length < 3) {
        // Not enough signal to score — leave existing value unchanged
        results.push({ ticker, score: null, headlines: newsLines.length, reddit: redditLines.length, skipped: true })
        continue
      }

      // Build prompt — cap at 20 items to keep tokens low
      const contentBlock = allContent.slice(0, 20).join('\n')
      const prompt = `Rate the aggregate bearish sentiment in these recent headlines and posts about ${ticker} on a scale of 0 to 100. 0 = very bullish, 100 = very bearish. Return only a single integer, nothing else.\n\n${contentBlock}`

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 8,
        messages: [{ role: 'user', content: prompt }],
      })

      const raw = (response.content[0] as { type: string; text: string }).text.trim()
      const score = parseInt(raw, 10)

      if (isNaN(score)) {
        console.warn(`[Cron: pack-sentiment] ${ticker} — non-numeric response: "${raw}"`)
        results.push({ ticker, score: null, headlines: newsLines.length, reddit: redditLines.length, error: `Bad response: ${raw}` })
      } else {
        const clamped = Math.min(100, Math.max(0, score))

        await supabase
          .from('drops')
          .update({ pack_sentiment_score: clamped })
          .in('status', ['active', 'extended'])
          .eq('ticker', ticker)

        console.log(`[Cron: pack-sentiment] ${ticker} → ${clamped} (${newsLines.length} headlines, ${redditLines.length} reddit)`)
        results.push({ ticker, score: clamped, headlines: newsLines.length, reddit: redditLines.length })
      }
    } catch (err) {
      console.error(`[Cron: pack-sentiment] ${ticker} failed:`, err)
      results.push({ ticker, score: null, headlines: 0, reddit: 0, error: String(err) })
    }

    // Stagger to be respectful of rate limits
    await new Promise(r => setTimeout(r, STAGGER_MS))
  }

  const scored = results.filter(r => r.score !== null && !r.skipped).length
  const skipped = results.filter(r => r.skipped).length
  const errored = results.filter(r => r.error).length
  const duration = Date.now() - startTime

  console.log(`[Cron: pack-sentiment] Done — ${scored} scored, ${skipped} skipped, ${errored} errors, ${duration}ms`)

  return NextResponse.json({ success: true, scored, skipped, errored, duration_ms: duration, results })
}
