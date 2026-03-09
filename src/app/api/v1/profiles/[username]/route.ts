// GET /api/v1/profiles/[username]
// Returns public profile + drops — requires Pro API key

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiKey } from '@/lib/v1-auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const auth = await requireApiKey(req)
  if (auth.error) return auth.error

  const { username } = await params
  const supabase = createServiceRoleClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, drop_count, resolved_drop_count, correct_drop_count, accuracy_score, created_at')
    .eq('username', username)
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const includeDrops = searchParams.get('include_drops') !== 'false'

  if (!includeDrops) return NextResponse.json({ profile })

  const { data: drops } = await supabase
    .from('drops')
    .select('id, ticker, company_name, status, outcome, conviction_score, total_votes, time_horizon, resolves_at, resolved_at, price_change_pct, created_at')
    .eq('created_by', profile.id)
    .eq('is_anonymous', false)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ profile, drops: drops ?? [] })
}
