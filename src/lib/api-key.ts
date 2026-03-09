// API key utilities — generation, hashing, validation

import { createServiceRoleClient } from '@/lib/supabase/server'
import { isProUser } from '@/lib/subscription'
import { createHash, randomBytes } from 'crypto'

export function generateApiKey(): string {
  const random = randomBytes(32).toString('hex')
  return `grzly_sk_${random}`
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export function getKeyPrefix(key: string): string {
  return key.slice(0, 16)
}

/** Validate an API key — returns the user_id if valid, null otherwise */
export async function validateApiKey(key: string): Promise<string | null> {
  if (!key.startsWith('grzly_sk_')) return null

  const hash = hashApiKey(key)
  const supabase = createServiceRoleClient()

  const { data } = await supabase
    .from('api_keys')
    .select('user_id, revoked_at')
    .eq('key_hash', hash)
    .single()

  if (!data || data.revoked_at) return null

  // Update last_used_at (non-blocking)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('key_hash', hash)
    .then(() => {})

  // Verify user still has active Pro subscription
  const isPro = await isProUser(data.user_id)
  if (!isPro) return null

  return data.user_id
}

/** Extract API key from Authorization header: "Bearer grzly_sk_..." */
export function extractBearerKey(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7).trim()
}
