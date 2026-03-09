// GET  /api/keys — list user's API keys
// POST /api/keys — generate a new API key (Pro only)

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { isProUser } from '@/lib/subscription'
import { generateApiKey, hashApiKey, getKeyPrefix } from '@/lib/api-key'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, last_used_at, created_at, revoked_at')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  return NextResponse.json({ keys: keys ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Pro gate
  const isPro = await isProUser(user.id)
  if (!isPro) {
    return NextResponse.json(
      { error: 'API keys require a Pro subscription' },
      { status: 403 }
    )
  }

  // Limit to 5 active keys per user
  const { count } = await supabase
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('revoked_at', null)

  if ((count ?? 0) >= 5) {
    return NextResponse.json(
      { error: 'Maximum of 5 active API keys allowed. Revoke an existing key first.' },
      { status: 400 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' && body.name.trim()
    ? body.name.trim().slice(0, 50)
    : 'Default'

  const key = generateApiKey()
  const keyHash = hashApiKey(key)
  const keyPrefix = getKeyPrefix(key)

  const serviceClient = createServiceRoleClient()
  const { error } = await serviceClient
    .from('api_keys')
    .insert({
      user_id: user.id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name,
    })

  if (error) {
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
  }

  // Return the plaintext key ONCE — it will never be shown again
  return NextResponse.json({ key, key_prefix: keyPrefix, name }, { status: 201 })
}
