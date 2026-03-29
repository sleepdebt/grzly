// seed-premium-user.mjs — creates the premium demo auth user + profile + subscription row
// Usage: node scripts/seed-premium-user.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://udxfxvczeoxumlupdmzk.supabase.co'
const SERVICE_ROLE_KEY = 'sb_secret_Lq6L_ZDeVWuSMEm05eJMRg_vQJk88We'

const EMAIL    = 'premium@grzly.com'
const PASSWORD = 'grzly_demo_2024!'
const USERNAME = 'premium_bear'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log('Creating premium demo user…')

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })

  if (authError) {
    if (authError.message.includes('already been registered')) {
      console.log('Auth user already exists — skipping auth creation.')
    } else {
      console.error('Auth error:', authError.message)
      process.exit(1)
    }
  } else {
    console.log(`Auth user created: ${authData.user.id}`)
  }

  // 2. Force-set password (ensures it's correct even if user pre-existed)
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) { console.error('List error:', listError.message); process.exit(1) }
  const user = users.find(u => u.email === EMAIL)
  if (!user) { console.error('Could not find user after creation'); process.exit(1) }
  const userId = user.id

  // Always reset password to ensure credentials are correct
  const { error: pwError } = await supabase.auth.admin.updateUserById(userId, {
    password: PASSWORD,
    email_confirm: true,
  })
  if (pwError) { console.error('Password reset error:', pwError.message); process.exit(1) }
  console.log('Password set.')

  // 3. Upsert profile
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    username: USERNAME,
    bio: 'Premium Vibelord. Access all features.',
    accuracy_score: 84.1,
    resolved_drop_count: 7,
    correct_drop_count: 6,
  }, { onConflict: 'id' })

  if (profileError) {
    console.error('Profile error:', profileError.message)
    process.exit(1)
  }

  // 4. Upsert subscription row (Pro, active, expires 1 year from now)
  const { error: subError } = await supabase.from('subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: 'cus_test_premium_bear',
    stripe_subscription_id: 'sub_test_premium_bear',
    status: 'active',
    plan: 'pro',
    current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  }, { onConflict: 'user_id' })

  if (subError) {
    console.error('Subscription error:', subError.message)
    process.exit(1)
  }

  console.log('\n✓ Premium demo user ready')
  console.log(`  Email:    ${EMAIL}`)
  console.log(`  Password: ${PASSWORD}`)
  console.log(`  Username: @${USERNAME}`)
  console.log(`  User ID:  ${userId}`)
  console.log(`  Plan:     Pro (active, expires +1 year)`)
}

main()
