// Cron: daily price snapshot — records EOD closing price for every active Drop ticker
// Schedule: 4:30 PM ET (21:30 UTC) Mon–Fri — see vercel.json
// Route: /api/cron/price-snapshot
//
// Why this exists:
//   The Drop detail page shows a price chart from Drop creation → today.
//   Rather than calling Polygon on every page load (expensive + rate limits),
//   we snapshot EOD prices once daily and serve them from the DB.
//   This also gives us the data needed for Drop resolution.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getCloseOnDate } from '@/lib/polygon'

// Stagger Polygon requests so we don't burst the rate limit
// 5 tickers/sec is well within Polygon Starter limits
const STAGGER_MS = 250

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const startTime = Date.now()
  const today = new Date().toISOString().split('T')[0]   // YYYY-MM-DD

  // ─── Step 1: Get all tickers with active/extended Drops ──────
  const { data: activeDrops, error: dropError } = await supabase
    .from('drops')
    .select('ticker')
    .in('status', ['active', 'extended'])

  if (dropError) {
    console.error('[Cron: price-snapshot] Failed to fetch active drops:', dropError.message)
    return NextResponse.json({ error: dropError.message }, { status: 500 })
  }

  if (!activeDrops || activeDrops.length === 0) {
    return NextResponse.json({ message: 'No active Drops — nothing to snapshot', snapshotted: 0 })
  }

  // Deduplicate tickers — multiple Drops can target the same company
  const tickers = [...new Set(activeDrops.map(d => d.ticker as string))]
  console.log(`[Cron: price-snapshot] Snapshotting ${tickers.length} tickers for ${today}`)

  // ─── Step 2: Check which tickers already have a snapshot today ─
  // Avoids duplicate work if the cron fires twice (Vercel at-least-once guarantee)
  const { data: existingSnapshots } = await supabase
    .from('price_snapshots')
    .select('ticker')
    .eq('snapshot_date', today)
    .in('ticker', tickers)

  const alreadySnapshotted = new Set((existingSnapshots ?? []).map(s => s.ticker as string))
  const tickersToFetch = tickers.filter(t => !alreadySnapshotted.has(t))

  if (tickersToFetch.length === 0) {
    return NextResponse.json({
      message: `All ${tickers.length} tickers already snapshotted for ${today}`,
      snapshotted: 0,
      skipped: tickers.length,
    })
  }

  // ─── Step 3: Fetch EOD close from Polygon + insert ───────────
  let snapshotted = 0
  let failed = 0
  const failures: Array<{ ticker: string; error: string }> = []

  for (const ticker of tickersToFetch) {
    try {
      const price = await getCloseOnDate(ticker, today)

      if (price === null) {
        // Market might have been closed (holiday) — not an error
        console.warn(`[Cron: price-snapshot] No close price for ${ticker} on ${today} (holiday?)`)
        failures.push({ ticker, error: 'No price returned — possible market holiday' })
        failed++
        await sleep(STAGGER_MS)
        continue
      }

      const { error: insertError } = await supabase
        .from('price_snapshots')
        .insert({
          ticker,
          price,
          snapshot_date: today,
          source: 'polygon',
        })

      if (insertError) {
        // Unique constraint on (ticker, snapshot_date) — safe to ignore if already exists
        if (insertError.code !== '23505') {
          console.error(`[Cron: price-snapshot] Insert failed for ${ticker}:`, insertError.message)
          failures.push({ ticker, error: insertError.message })
          failed++
        }
      } else {
        snapshotted++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[Cron: price-snapshot] Unexpected error for ${ticker}:`, msg)
      failures.push({ ticker, error: msg })
      failed++
    }

    await sleep(STAGGER_MS)
  }

  // ─── Step 4: Update denormalized price_change_pct on active Drops ─
  // So the feed can show current % change without a Polygon call per card
  await updateLivePriceChanges(supabase, today)

  const duration = Date.now() - startTime
  console.log(`[Cron: price-snapshot] Done — ${snapshotted} snapshotted, ${failed} failed, ${duration}ms`)

  return NextResponse.json({
    date: today,
    snapshotted,
    skipped: alreadySnapshotted.size,
    failed,
    failures: failures.length > 0 ? failures : undefined,
    duration_ms: duration,
  })
}

// ─── Update live price change on active Drops ───────────────

/**
 * After snapshotting, refresh the live_price_change_pct on each active Drop.
 * This is denormalized so the feed can display "currently down X%" without
 * a per-card Polygon call.
 */
async function updateLivePriceChanges(
  supabase: ReturnType<typeof createServiceRoleClient>,
  today: string
): Promise<void> {
  // Fetch all active drops with their baseline prices
  const { data: drops } = await supabase
    .from('drops')
    .select('id, ticker, baseline_price')
    .in('status', ['active', 'extended'])
    .not('baseline_price', 'is', null)

  if (!drops || drops.length === 0) return

  // Fetch today's snapshots for those tickers
  const tickers = [...new Set(drops.map(d => d.ticker as string))]
  const { data: snapshots } = await supabase
    .from('price_snapshots')
    .select('ticker, price')
    .eq('snapshot_date', today)
    .in('ticker', tickers)

  if (!snapshots || snapshots.length === 0) return

  const priceMap = new Map(snapshots.map(s => [s.ticker as string, s.price as number]))

  // Batch updates
  for (const drop of drops) {
    const currentPrice = priceMap.get(drop.ticker)
    if (currentPrice === undefined || !drop.baseline_price) continue

    const changePct = ((currentPrice - drop.baseline_price) / drop.baseline_price) * 100

    await supabase
      .from('drops')
      .update({ live_price_change_pct: parseFloat(changePct.toFixed(4)) })
      .eq('id', drop.id)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
