// GET /api/v1/drops
// Returns paginated Bear Book feed — requires Pro API key
//
// Query params:
//   sort           conviction | recent | expiring  (default: conviction)
//   horizon        7 | 30 | 90 | 180
//   ticker         e.g. TSLA
//   status         active | extended | resolved | archived | all  (default: active,extended)
//   min_conviction minimum conviction score 0–100
//   page           (default: 1)
//   limit          max 50 (default: 20)

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiKey } from '@/lib/v1-auth'

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req)
  if (auth.error) return auth.error

  const { searchParams } = new URL(req.url)
  const sort = searchParams.get('sort') ?? 'conviction'
  const horizon = searchParams.get('horizon') ? Number(searchParams.get('horizon')) : undefined
  const ticker = searchParams.get('ticker')?.toUpperCase() || undefined
  const statusParam = searchParams.get('status') ?? 'active,extended'
  const minConviction = searchParams.get('min_conviction') ? Number(searchParams.get('min_conviction')) : undefined
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)))
  const offset = (page - 1) * limit

  const statuses = statusParam === 'all'
    ? ['active', 'extended', 'resolved', 'archived']
    : statusParam.split(',').map(s => s.trim())

  const supabase = createServiceRoleClient()

  let query = supabase
    .from('drops')
    .select(`
      id, ticker, company_name, thesis, time_horizon,
      conviction_score, raw_conviction_pct, total_votes, bearish_votes, skeptical_votes,
      status, outcome, resolves_at, extended_resolves_at, resolved_at,
      price_change_pct, baseline_price, target_price, created_at,
      creator:profiles!drops_created_by_fkey (
        username, display_name, avatar_url, accuracy_score
      )
    `, { count: 'exact' })
    .in('status', statuses)
    .range(offset, offset + limit - 1)

  if (horizon) query = query.eq('time_horizon', `${horizon} days`)
  if (ticker) query = query.eq('ticker', ticker)
  if (minConviction !== undefined) query = query.gte('conviction_score', minConviction)

  switch (sort) {
    case 'recent':   query = query.order('created_at', { ascending: false }); break
    case 'expiring': query = query.order('resolves_at', { ascending: true });  break
    default:         query = query.order('conviction_score', { ascending: false, nullsFirst: false })
  }

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    drops: data ?? [],
    pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
  })
}
