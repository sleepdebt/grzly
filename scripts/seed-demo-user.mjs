// seed-demo-user.mjs — creates a demo auth user + profile in Supabase
// Usage: node scripts/seed-demo-user.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://udxfxvczeoxumlupdmzk.supabase.co'
const SERVICE_ROLE_KEY = 'sb_secret_Lq6L_ZDeVWuSMEm05eJMRg_vQJk88We'

const DEMO_EMAIL    = 'demo@grzly.com'
const DEMO_PASSWORD = 'grzly_demo_2024!'
const DEMO_USERNAME = 'bearpilled'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log('Creating demo user…')

  // 1. Create auth user via admin API
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,   // skip email verification
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

  // 2. Fetch the user ID (in case it already existed)
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) { console.error('List error:', listError.message); process.exit(1) }
  const user = users.find(u => u.email === DEMO_EMAIL)
  if (!user) { console.error('Could not find demo user after creation'); process.exit(1) }

  // 3. Upsert a profile row
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: user.id,
    username: DEMO_USERNAME,
    bio: 'I only go short. Thesis or silence.',
    accuracy_score: 72.4,
  }, { onConflict: 'id' })

  if (profileError) {
    console.error('Profile error:', profileError.message)
    process.exit(1)
  }

  console.log('\n✓ Demo user ready')
  console.log(`  Email:    ${DEMO_EMAIL}`)
  console.log(`  Password: ${DEMO_PASSWORD}`)
  console.log(`  Username: @${DEMO_USERNAME}`)
}

main()
