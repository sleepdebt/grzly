// POST /api/stripe/checkout
// Creates a Stripe Checkout session for the Pro plan upgrade

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe, STRIPE_PRO_PRICE_ID } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get or create Stripe customer
  const serviceClient = createServiceRoleClient()
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  const { data: existingSub } = await serviceClient
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  let customerId = existingSub?.stripe_customer_id

  if (!customerId) {
    const customer = await getStripe().customers.create({
      email: user.email,
      metadata: {
        supabase_user_id: user.id,
        username: profile?.username ?? '',
      },
    })
    customerId = customer.id
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://grzly.vercel.app'

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: STRIPE_PRO_PRICE_ID(), quantity: 1 }],
    success_url: `${appUrl}/profile/${profile?.username}?upgraded=1`,
    cancel_url: `${appUrl}/profile/${profile?.username}?upgrade=canceled`,
    metadata: {
      supabase_user_id: user.id,
    },
  })

  return NextResponse.json({ url: session.url })
}
