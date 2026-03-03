// OAuth / magic-link callback handler
// Route: /auth/callback
//
// Supabase redirects here after:
//   - Email confirmation link is clicked
//   - OAuth provider (Google, etc.) completes
//
// Exchanges the code for a session and redirects to the app.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)

  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  // Sanitise redirect — only allow relative paths
  const redirectTo = next.startsWith('/') ? next : '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }

    console.error('[Auth callback] exchangeCodeForSession failed:', error.message)
  }

  // Auth failed — redirect to sign-in with error
  return NextResponse.redirect(
    `${origin}/auth/sign-in?error=${encodeURIComponent('Authentication failed. Please try again.')}`
  )
}
