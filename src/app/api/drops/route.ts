// GET /api/drops — paginated feed
// POST /api/drops — create a new Drop

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getLatestClose, validateTicker } from '@/lib/polygon'
import { generateCreationLore } from '@/lib/lore'
import { CreateDropPayload, FeedParams } from '@/types'

// ─── GET — Feed ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sort = (searchParams.get('sort') ?? 'conviction') as FeedParams['sort']
  const horizon = searchParams.get('horizon') ? Number(searchParams.get('horizon')) : undefined
  const page = Number(searchParams.get('page') ?? 1)
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50)
  const offset = (page - 1) * limit

  const supabase = await createClient()

  let query = supabase
    .from('drops')
    .select(`
      *,
      creator:profiles!drops_created_by_fkey (
        username,
        display_name,
        avatar_url,
        accuracy_score
      )
    `, { count: 'exact' })
    .in('status', ['active', 'extended'])
    .range(offset, offset + limit - 1)

  if (horizon) {
    query = query.eq('time_horizon', `${horizon} days`)
  }

  switch (sort) {
    case 'conviction':
      query = query.order('conviction_score', { ascending: false, nullsFirst: false })
      break
    case 'recent':
      query = query.order('created_at', { ascending: false })
      break
    case 'expiring':
      query = query.order('resolves_at', { ascending: true })
      break
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    drops: data,
    total: count,
    page,
    limit,
  })
}

// ─── POST — Create Drop ───────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // Parse body
  let body: CreateDropPayload
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { ticker, thesis, evidence_links, financial_metric, time_horizon, target_price, is_anonymous } = body

  // Validate required fields
  if (!ticker || !thesis || !time_horizon) {
    return NextResponse.json({ error: 'ticker, thesis, and time_horizon are required' }, { status: 400 })
  }

  // Validate thesis length
  if (thesis.length < 200) {
    return NextResponse.json({ error: 'Thesis must be at least 200 characters' }, { status: 400 })
  }

  // Validate evidence requirement (must have financial_metric OR evidence_links)
  if (!financial_metric && (!evidence_links || evidence_links.length === 0)) {
    return NextResponse.json(
      { error: 'At least one piece of evidence is required: a financial metric or a source link' },
      { status: 400 }
    )
  }

  // Validate time horizon
  const validHorizons = ['7 days', '30 days', '90 days', '180 days']
  if (!validHorizons.includes(time_horizon)) {
    return NextResponse.json({ error: `time_horizon must be one of: ${validHorizons.join(', ')}` }, { status: 400 })
  }

  // Validate ticker via Polygon
  const tickerValidation = await validateTicker(ticker.toUpperCase())
  if (!tickerValidation.valid) {
    return NextResponse.json({ error: `Ticker ${ticker.toUpperCase()} not found on Polygon.io` }, { status: 400 })
  }

  // Fetch baseline price
  const baselinePrice = await getLatestClose(ticker.toUpperCase())

  // Compute resolves_at
  const horizonDays = parseInt(time_horizon.split(' ')[0])
  const resolvesAt = new Date(Date.now() + horizonDays * 24 * 60 * 60 * 1000).toISOString()

  // Insert the Drop
  const { data: drop, error: insertError } = await supabase
    .from('drops')
    .insert({
      ticker: ticker.toUpperCase(),
      company_name: tickerValidation.companyName ?? null,
      thesis,
      evidence_links: evidence_links ?? [],
      financial_metric: financial_metric ?? null,
      created_by: user.id,
      is_anonymous: is_anonymous ?? false,
      status: 'active',
      time_horizon,
      resolves_at: resolvesAt,
      target_price: target_price ?? null,
      baseline_price: baselinePrice,
    })
    .select()
    .single()

  if (insertError || !drop) {
    console.error('[POST /api/drops] Insert failed:', insertError)
    return NextResponse.json({ error: 'Failed to create Drop' }, { status: 500 })
  }

  // Generate lore (non-blocking — don't fail the request if lore fails)
  try {
    const lore = await generateCreationLore(ticker.toUpperCase(), thesis)

    // Update drop with lore narrative
    await supabase
      .from('drops')
      .update({ lore_narrative: lore.narrative })
      .eq('id', drop.id)

    // Log lore event
    await supabase
      .from('lore_events')
      .insert({
        drop_id: drop.id,
        event_type: 'creation',
        narrative: lore.narrative,
        prompt_version: lore.promptVersion,
        model_used: lore.modelUsed,
      })

    drop.lore_narrative = lore.narrative
  } catch (err) {
    console.error('[POST /api/drops] Lore generation failed (non-fatal):', err)
  }

  return NextResponse.json({ drop }, { status: 201 })
}
