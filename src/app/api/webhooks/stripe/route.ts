// POST /api/webhooks/stripe
// Handles Stripe webhook events to keep subscriptions table in sync

import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.supabase_user_id
      const customerId = session.customer as string
      const subscriptionId = session.subscription as string

      if (!userId) break

      // Fetch full subscription to get period end
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscription = await getStripe().subscriptions.retrieve(subscriptionId) as any

      await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: subscription.status,
          plan: 'pro',
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        }, { onConflict: 'user_id' })
      break
    }

    case 'customer.subscription.updated': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscription = event.data.object as any
      const customerId = subscription.customer as string

      const isActive = subscription.status === 'active' || subscription.status === 'trialing'

      await supabase
        .from('subscriptions')
        .update({
          stripe_subscription_id: subscription.id,
          status: subscription.status,
          plan: isActive ? 'pro' : 'free',
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        })
        .eq('stripe_customer_id', customerId)
      break
    }

    case 'customer.subscription.deleted': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscription = event.data.object as any
      const customerId = subscription.customer as string

      await supabase
        .from('subscriptions')
        .update({
          status: 'canceled',
          plan: 'free',
          stripe_subscription_id: null,
          current_period_end: null,
        })
        .eq('stripe_customer_id', customerId)
      break
    }

    default:
      // Unhandled event type — ignore
      break
  }

  return NextResponse.json({ received: true })
}
