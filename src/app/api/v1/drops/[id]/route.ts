// GET /api/v1/drops/[id]
// Returns full drop detail — requires Pro API key

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiKey } from '@/lib/v1-auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiKey(req)
  if (auth.error) return auth.error

  const { id } = await params
  const supabase = createServiceRoleClient()

  const { data: drop, error } = await supabase
    .from('drops')
    .select(`
      *,
      creator:profiles!drops_created_by_fkey (
        username, display_name, avatar_url, accuracy_score
      ),
      lore_events (
        id, event_type, narrative, created_at
      )
    `)
    .eq('id', id)
    .single()

  if (error || !drop) {
    return NextResponse.json({ error: 'Drop not found' }, { status: 404 })
  }

  // Fetch supporting data
  const [priceHistory, shortInterest, redditPosts] = await Promise.all([
    supabase
      .from('price_snapshots')
      .select('snapshot_date, price')
      .eq('ticker', drop.ticker)
      .gte('snapshot_date', drop.created_at.slice(0, 10))
      .order('snapshot_date', { ascending: true }),

    supabase
      .from('short_interest')
      .select('short_pct_float, days_to_cover, settlement_date')
      .eq('ticker', drop.ticker)
      .order('settlement_date', { ascending: false })
      .limit(1)
      .single(),

    supabase
      .from('reddit_posts')
      .select('id, title, reddit_url, upvotes, subreddit, posted_at')
      .contains('tickers_mentioned', [drop.ticker])
      .order('posted_at', { ascending: false })
      .limit(10),
  ])

  return NextResponse.json({
    ...drop,
    price_history: priceHistory.data ?? [],
    short_interest: shortInterest.data ?? null,
    reddit_posts: redditPosts.data ?? [],
  })
}
