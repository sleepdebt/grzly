// Shared auth helper for /api/v1/* routes
// Validates Bearer API key and returns user_id

import { NextRequest, NextResponse } from 'next/server'
import { extractBearerKey, validateApiKey } from '@/lib/api-key'

export async function requireApiKey(req: NextRequest): Promise<
  { userId: string; error?: never } |
  { userId?: never; error: NextResponse }
> {
  const key = extractBearerKey(req.headers.get('authorization'))
  if (!key) {
    return {
      error: NextResponse.json(
        { error: 'Missing Authorization header. Use: Authorization: Bearer grzly_sk_...' },
        { status: 401 }
      )
    }
  }

  const userId = await validateApiKey(key)
  if (!userId) {
    return {
      error: NextResponse.json(
        { error: 'Invalid or expired API key. Ensure your Pro subscription is active.' },
        { status: 401 }
      )
    }
  }

  return { userId }
}
