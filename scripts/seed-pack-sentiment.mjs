// seed-pack-sentiment.mjs — sets test pack_sentiment_score values on active drops
// Cycles through all four intensity levels so you can see every paw state on the feed.
// Usage: node scripts/seed-pack-sentiment.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://udxfxvczeoxumlupdmzk.supabase.co'
const SERVICE_ROLE_KEY = 'sb_secret_Lq6L_ZDeVWuSMEm05eJMRg_vQJk88We'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// One score per intensity level — cycles if there are more drops than levels
const TEST_SCORES = [
  { score: 82, label: 'Howling (76–100, red)' },
  { score: 63, label: 'Active  (51–75, orange)' },
  { score: 38, label: 'Stirring (26–50, gold)' },
  { score: 12, label: 'Quiet   (0–25, dim)' },
]

async function main() {
  const { data: drops, error } = await supabase
    .from('drops')
    .select('id, ticker')
    .in('status', ['active', 'extended'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch drops:', error.message)
    process.exit(1)
  }

  if (!drops || drops.length === 0) {
    console.log('No active drops found. Create some drops first, then re-run this script.')
    process.exit(0)
  }

  console.log(`Found ${drops.length} active drop(s) — assigning test scores...\n`)

  for (let i = 0; i < drops.length; i++) {
    const drop = drops[i]
    const { score, label } = TEST_SCORES[i % TEST_SCORES.length]

    const { error: updateError } = await supabase
      .from('drops')
      .update({ pack_sentiment_score: score })
      .eq('id', drop.id)

    if (updateError) {
      console.error(`  ✗ ${drop.ticker} (${drop.id}): ${updateError.message}`)
    } else {
      console.log(`  ✓ $${drop.ticker.padEnd(6)} → ${score}  ${label}`)
    }
  }

  console.log('\nDone. Refresh the feed to see the paw icons.')
}

main()
