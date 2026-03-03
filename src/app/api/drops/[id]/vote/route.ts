// POST /api/drops/:id/vote — cast a conviction vote
// Votes are immutable — one per user per Drop, enforced at DB level

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { generateConvictionSurgeLore } from '@/lib/lore'
import { CastVotePayload } from '@/types'

// Conviction surge thresholds (for lore trigger)
const SURGE_CONVICTION_THRESHOLD = 75   // % bearish
const SURGE_VOTE_THRESHOLD = 25         // minimum votes

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // Parse body
  let body: CastVotePayload
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { direction } = body

  if (!direction || !['bearish', 'skeptical'].includes(direction)) {
    return NextResponse.json({ error: 'direction must be bearish or skeptical' }, { status: 400 })
  }

  // Verify Drop exists and is voteable
  const { data: drop, error: dropError } = await supabase
    .from('drops')
    .select('id, status, conviction_score, total_votes, lore_narrative, ticker')
    .eq('id', id)
    .single()

  if (dropError || !drop) {
    return NextResponse.json({ error: 'Drop not found' }, { status: 404 })
  }

  if (!['active', 'extended'].includes(drop.status)) {
    return NextResponse.json(
      { error: 'Voting is closed — this Drop has already resolved' },
      { status: 400 }
    )
  }

  // Get voter's current accuracy score (for weighted conviction)
  const { data: voterProfile } = await supabase
    .from('profiles')
    .select('accuracy_score')
    .eq('id', user.id)
    .single()

  const voterAccuracy = voterProfile?.accuracy_score ?? null

  // Insert vote (DB trigger recomputes conviction_score automatically)
  const { data: vote, error: voteError } = await supabase
    .from('votes')
    .insert({
      drop_id: id,
      user_id: user.id,
      direction,
      voter_accuracy_at_vote: voterAccuracy,
    })
    .select()
    .single()

  if (voteError) {
    // Unique constraint violation = already voted
    if (voteError.code === '23505') {
      return NextResponse.json({ error: 'You have already voted on this Drop' }, { status: 409 })
    }
    console.error('[POST /api/drops/:id/vote] Insert failed:', voteError)
    return NextResponse.json({ error: 'Failed to cast vote' }, { status: 500 })
  }

  // Fetch updated Drop to get new conviction score (trigger has fired)
  const { data: updatedDrop } = await supabase
    .from('drops')
    .select('conviction_score, raw_conviction_pct, bearish_votes, skeptical_votes, total_votes')
    .eq('id', id)
    .single()

  // Check for conviction surge (trigger lore regeneration)
  const newConviction = updatedDrop?.conviction_score ?? 0
  const newTotalVotes = updatedDrop?.total_votes ?? 0
  const previousConviction = drop.conviction_score ?? 0

  const crossedSurgeThreshold =
    newConviction >= SURGE_CONVICTION_THRESHOLD &&
    newTotalVotes >= SURGE_VOTE_THRESHOLD &&
    previousConviction < SURGE_CONVICTION_THRESHOLD

  if (crossedSurgeThreshold) {
    // Generate conviction surge lore (non-blocking)
    const serviceClient = createServiceRoleClient()
    generateConvictionSurgeLore(drop.ticker, newConviction, newTotalVotes)
      .then(async (lore) => {
        await serviceClient
          .from('drops')
          .update({ lore_narrative: lore.narrative })
          .eq('id', id)

        await serviceClient
          .from('lore_events')
          .insert({
            drop_id: id,
            event_type: 'conviction_surge',
            narrative: lore.narrative,
            prompt_version: lore.promptVersion,
            model_used: lore.modelUsed,
          })
      })
      .catch(err => console.error('[Vote] Conviction surge lore failed (non-fatal):', err))
  }

  return NextResponse.json({
    vote,
    conviction: updatedDrop,
    conviction_surge_triggered: crossedSurgeThreshold,
  }, { status: 201 })
}
