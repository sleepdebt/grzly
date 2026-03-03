// Sign-out handler
// Route: POST /auth/sign-out
//
// Called from a form (not a link) so it's a POST — prevents CSRF via link.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  return NextResponse.redirect(new URL('/', req.url), { status: 302 })
}
