// POST /api/waitlist — join the pre-launch waitlist
// Public endpoint, no auth required

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  let body: { email?: string; source?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  const source = body.source === 'bottom' ? 'bottom' : 'hero'

  if (!email || !email.includes('@') || !email.includes('.')) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('waitlist_signups')
    .insert({ email, source })

  if (error) {
    // Unique constraint — already on the list
    if (error.code === '23505') {
      return NextResponse.json({ message: 'Already on the list.' }, { status: 409 })
    }
    console.error('[POST /api/waitlist] Insert failed:', error)
    return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
