// GET /api/v1/leaderboard
// Returns top users by accuracy score — requires Pro API key
//
// Query params:
//   limit       max 100 (default: 20)
//   min_resolved  minimum resolved drops for eligibility (default: 3)

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiKey } from '@/lib/v1-auth'

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req)
  if (auth.error) return auth.error

  const { searchParams } = new URL(req.url)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))
  const minResolved = Math.max(1, Number(searchParams.get('min_resolved') ?? 3))

  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, accuracy_score, drop_count, resolved_drop_count, correct_drop_count')
    .not('accuracy_score', 'is', null)
    .gte('resolved_drop_count', minResolved)
    .order('accuracy_score', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ leaderboard: data ?? [], min_resolved: minResolved })
}
