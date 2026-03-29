// GET /api/v1/tickers/[ticker]
// Returns aggregate conviction data for a ticker — requires Pro API key
//
// Response includes:
//   ticker, company_name
//   drop counts: total, active, resolved, correct, incorrect
//   crowd_accuracy: correct / resolved (null if no resolved drops)
//   avg_conviction: mean conviction_score across active + extended drops
//   latest_drop_at: most recent drop timestamp
//   top_contributors: up to 5 contributors with the most correct drops on this ticker

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiKey } from '@/lib/v1-auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const auth = await requireApiKey(req)
  if (auth.error) return auth.error

  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()
  const supabase = createServiceRoleClient()

  const { data: drops, error } = await supabase
    .from('drops')
    .select(`
      id, status, outcome, conviction_score, created_at, company_name,
      creator:profiles!drops_created_by_fkey (
        username, display_name, avatar_url, accuracy_score
      )
    `)
    .eq('ticker', ticker)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!drops || drops.length === 0) {
    return NextResponse.json({ error: 'No drops found for ticker' }, { status: 404 })
  }

  // Aggregate counts
  const total      = drops.length
  const active     = drops.filter(d => d.status === 'active' || d.status === 'extended').length
  const resolved   = drops.filter(d => d.status === 'resolved' || d.status === 'archived').length
  const correct    = drops.filter(d => d.outcome === 'correct').length
  const incorrect  = drops.filter(d => d.outcome === 'incorrect').length

  const crowd_accuracy = resolved > 0 ? Math.round((correct / resolved) * 100) : null

  const activeDrops = drops.filter(d => d.conviction_score !== null && (d.status === 'active' || d.status === 'extended'))
  const avg_conviction = activeDrops.length > 0
    ? Math.round(activeDrops.reduce((sum, d) => sum + (d.conviction_score ?? 0), 0) / activeDrops.length)
    : null

  // Top contributors: contributors with most correct drops on this ticker
  const contributorMap = new Map<string, {
    username: string
    display_name: string | null
    avatar_url: string | null
    accuracy_score: number | null
    correct: number
    total: number
  }>()

  for (const drop of drops) {
    const creatorRaw = Array.isArray(drop.creator) ? drop.creator[0] : drop.creator
    const creator = creatorRaw as { username: string; display_name: string | null; avatar_url: string | null; accuracy_score: number | null } | null
    if (!creator) continue
    const key = creator.username
    if (!contributorMap.has(key)) {
      contributorMap.set(key, { ...creator, correct: 0, total: 0 })
    }
    const entry = contributorMap.get(key)!
    entry.total++
    if (drop.outcome === 'correct') entry.correct++
  }

  const top_contributors = [...contributorMap.values()]
    .sort((a, b) => b.correct - a.correct || b.total - a.total)
    .slice(0, 5)
    .map(({ username, display_name, avatar_url, accuracy_score, correct, total }) => ({
      username, display_name, avatar_url, accuracy_score,
      correct_drops_on_ticker: correct,
      total_drops_on_ticker: total,
    }))

  return NextResponse.json({
    ticker,
    company_name: drops[0].company_name ?? null,
    drops: { total, active, resolved, correct, incorrect },
    crowd_accuracy,
    avg_conviction,
    latest_drop_at: drops[0].created_at,
    top_contributors,
  })
}
