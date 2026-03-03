// GET /api/drops/:id — Drop detail
// PATCH /api/drops/:id — SWAYZE extension (creator only)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateExtensionLore } from '@/lib/lore'
import { ExtendDropPayload, SwayzeReason } from '@/types'

const VALID_SWAYZE_REASONS: SwayzeReason[] = [
  'catalyst_delayed',
  'timing_off',
  'new_information',
]

// ─── GET — Drop detail ────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: drop, error } = await supabase
    .from('drops')
    .select(`
      *,
      creator:profiles!drops_created_by_fkey (
        username,
        display_name,
        avatar_url,
        accuracy_score
      ),
      lore_events (
        id, event_type, narrative, prompt_version, model_used, created_at
      )
    `)
    .eq('id', id)
    .single()

  if (error || !drop) {
    return NextResponse.json({ error: 'Drop not found' }, { status: 404 })
  }

  return NextResponse.json({ drop })
}

// ─── PATCH — SWAYZE extension ────────────────────────────────

export async function PATCH(
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
  let body: ExtendDropPayload
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { reason } = body

  if (!reason || !VALID_SWAYZE_REASONS.includes(reason)) {
    return NextResponse.json(
      { error: `reason must be one of: ${VALID_SWAYZE_REASONS.join(', ')}` },
      { status: 400 }
    )
  }

  // Fetch the Drop
  const { data: drop, error: fetchError } = await supabase
    .from('drops')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !drop) {
    return NextResponse.json({ error: 'Drop not found' }, { status: 404 })
  }

  // Verify ownership
  if (drop.created_by !== user.id) {
    return NextResponse.json({ error: 'Only the Drop creator can invoke SWAYZE' }, { status: 403 })
  }

  // Verify Drop is active (not already extended, resolved, or archived)
  if (drop.status !== 'active') {
    return NextResponse.json(
      { error: `SWAYZE can only be invoked on active Drops (current status: ${drop.status})` },
      { status: 400 }
    )
  }

  // Verify not already extended (one SWAYZE per Drop, ever)
  if (drop.was_extended) {
    return NextResponse.json({ error: 'SWAYZE has already been invoked on this Drop' }, { status: 400 })
  }

  // Compute new resolution date: current resolves_at + original time_horizon
  const originalHorizonDays = parseInt((drop.time_horizon as string).split(' ')[0])
  const currentResolvesAt = new Date(drop.resolves_at)
  const newResolvesAt = new Date(currentResolvesAt.getTime() + originalHorizonDays * 24 * 60 * 60 * 1000)

  // Update Drop
  const { data: updatedDrop, error: updateError } = await supabase
    .from('drops')
    .update({
      status: 'extended',
      was_extended: true,
      swayze_reason: reason,
      extended_at: new Date().toISOString(),
      extended_resolves_at: newResolvesAt.toISOString(),
      accuracy_weight: 0.85, // Applied if Drop resolves correctly after extension
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: 'Failed to invoke SWAYZE' }, { status: 500 })
  }

  // Generate extension lore (non-blocking)
  try {
    const lore = await generateExtensionLore(drop.ticker, reason, drop.thesis)

    await supabase
      .from('drops')
      .update({ lore_narrative: lore.narrative })
      .eq('id', id)

    await supabase
      .from('lore_events')
      .insert({
        drop_id: id,
        event_type: 'extension',
        narrative: lore.narrative,
        prompt_version: lore.promptVersion,
        model_used: lore.modelUsed,
      })
  } catch (err) {
    console.error('[PATCH /api/drops/:id] Lore generation failed (non-fatal):', err)
  }

  return NextResponse.json({ drop: updatedDrop })
}
