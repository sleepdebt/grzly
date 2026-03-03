// Cron: resolve expired Drops
// Schedule: daily at 9:00 AM ET (14:00 UTC) — see vercel.json
// Route: /api/cron/resolve-drops

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getCloseOnDate } from '@/lib/polygon'
import { generateResolutionLore } from '@/lib/lore'
import { Drop, DropOutcome } from '@/types'

export async function GET(req: NextRequest) {
  // Verify this is a legit cron call from Vercel
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const now = new Date().toISOString()
  const today = now.split('T')[0]

  // Find Drops whose resolution date has passed
  const { data: expiredDrops, error } = await supabase
    .from('drops')
    .select('*')
    .in('status', ['active', 'extended'])
    .lte('resolves_at', now)

  if (error) {
    console.error('[Cron: resolve-drops] Query failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!expiredDrops || expiredDrops.length === 0) {
    return NextResponse.json({ message: 'No drops to resolve', resolved: 0 })
  }

  let resolved = 0
  const results: Array<{ id: string; ticker: string; outcome: DropOutcome; error?: string }> = []

  for (const drop of expiredDrops as Drop[]) {
    try {
      // For extended drops, use extended_resolves_at; otherwise resolves_at
      const resolutionDateStr = drop.extended_resolves_at
        ? drop.extended_resolves_at.split('T')[0]
        : drop.resolves_at.split('T')[0]

      // Fetch resolution price from Polygon
      const resolutionPrice = await getCloseOnDate(drop.ticker, resolutionDateStr)

      if (!resolutionPrice) {
        console.warn(`[Cron: resolve-drops] No price data for ${drop.ticker} on ${resolutionDateStr}`)
        results.push({ id: drop.id, ticker: drop.ticker, outcome: 'inconclusive', error: 'No price data' })
        continue
      }

      const baselinePrice = drop.baseline_price!
      const priceChangePct = ((resolutionPrice - baselinePrice) / baselinePrice) * 100

      // Determine outcome
      let outcome: DropOutcome
      if (drop.target_price !== null) {
        // Custom target: correct only if price reached or fell below target
        outcome = resolutionPrice <= drop.target_price ? 'correct' : 'incorrect'
      } else {
        // Default: any decline = correct
        outcome = resolutionPrice < baselinePrice ? 'correct' : 'incorrect'
      }

      // Generate Bear Book lore
      let bearBookNarrative: string | null = null
      try {
        const lore = await generateResolutionLore(drop.ticker, outcome, priceChangePct, drop.thesis)
        bearBookNarrative = lore.narrative

        // Log lore event
        await supabase.from('lore_events').insert({
          drop_id: drop.id,
          event_type: 'resolution',
          narrative: lore.narrative,
          prompt_version: lore.promptVersion,
          model_used: lore.modelUsed,
        })
      } catch (loreErr) {
        console.error(`[Cron: resolve-drops] Lore failed for ${drop.ticker} (non-fatal):`, loreErr)
      }

      // Update Drop to resolved/archived
      await supabase
        .from('drops')
        .update({
          status: 'archived',
          outcome,
          resolved_at: now,
          resolution_price: resolutionPrice,
          price_change_pct: parseFloat(priceChangePct.toFixed(4)),
          bear_book_narrative: bearBookNarrative,
        })
        .eq('id', drop.id)

      // Update creator's accuracy score (if not anonymous)
      if (drop.created_by && !drop.is_anonymous) {
        await supabase.rpc('recompute_accuracy_score', { p_user_id: drop.created_by })
      }

      // Send notification to creator
      if (drop.created_by) {
        const outcomeText = outcome === 'correct'
          ? `Your $${drop.ticker} Drop was correct — price declined ${Math.abs(priceChangePct).toFixed(1)}%.`
          : `Your $${drop.ticker} Drop was incorrect — price moved ${priceChangePct.toFixed(1)}%.`

        await supabase.from('notifications').insert({
          user_id: drop.created_by,
          drop_id: drop.id,
          type: 'drop_resolved',
          message: outcomeText,
        })
      }

      results.push({ id: drop.id, ticker: drop.ticker, outcome })
      resolved++
    } catch (err) {
      console.error(`[Cron: resolve-drops] Failed to resolve ${drop.ticker} (${drop.id}):`, err)
      results.push({ id: drop.id, ticker: drop.ticker, outcome: 'inconclusive', error: String(err) })
    }
  }

  return NextResponse.json({ resolved, results })
}
