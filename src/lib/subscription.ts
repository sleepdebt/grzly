// Pro gate utility — use this to check if a user has an active Pro subscription

import { createServiceRoleClient } from '@/lib/supabase/server'

export async function isProUser(userId: string): Promise<boolean> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('status, plan')
    .eq('user_id', userId)
    .single()

  return data?.plan === 'pro' && (data?.status === 'active' || data?.status === 'trialing')
}

export async function getSubscription(userId: string) {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data
}
