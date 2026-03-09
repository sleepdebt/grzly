// PATCH /api/profile — update the authenticated user's profile
// Fields: username, bio, avatar_url

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { username, bio, avatar_url } = body
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  // --- Username ---
  if (username !== undefined) {
    if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json(
        { error: 'Username must be 3–20 characters: letters, numbers, and underscores only.' },
        { status: 400 }
      )
    }
    // Check uniqueness (case-insensitive, excluding current user)
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .neq('id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 })
    }
    updates.username = username
  }

  // --- Bio ---
  if (bio !== undefined) {
    if (typeof bio !== 'string') {
      return NextResponse.json({ error: 'Bio must be a string.' }, { status: 400 })
    }
    if (bio.length > 200) {
      return NextResponse.json({ error: 'Bio must be 200 characters or less.' }, { status: 400 })
    }
    updates.bio = bio.trim() || null
  }

  // --- Avatar URL ---
  if (avatar_url !== undefined) {
    updates.avatar_url = avatar_url || null
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}
