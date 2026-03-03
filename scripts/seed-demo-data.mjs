// seed-demo-data.mjs — populates demo drops, profiles, votes, and reddit posts
// Usage: node scripts/seed-demo-data.mjs
//
// Covers every UI state:
//   • Normal active drop
//   • Hot drop (conviction ≥80%, ≥10 votes, <7 days to resolve)
//   • SWAYZE / extended drop
//   • Resolved correct  (outcome = correct,   green)
//   • Resolved incorrect (outcome = incorrect, red)
//   • Anonymous drop
//   • Multiple creators with accuracy scores

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = 'https://udxfxvczeoxumlupdmzk.supabase.co'
const SERVICE_ROLE_KEY  = 'sb_secret_Lq6L_ZDeVWuSMEm05eJMRg_vQJk88We'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─────────────────────────────────────────
// Helper
// ─────────────────────────────────────────
function daysFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString()
}
function daysAgo(n) {
  return daysFromNow(-n)
}

// ─────────────────────────────────────────
// 1. Secondary users
// ─────────────────────────────────────────
const SECONDARY_USERS = [
  { email: 'shortgod@grzly.com',     password: 'grzly_demo_2024!', username: 'shortgod',     bio: 'Former sell-side. I show my work.',         accuracy_score: 81.3 },
  { email: 'reaper@grzly.com',       password: 'grzly_demo_2024!', username: 'market_reaper', bio: '14 correct calls in a row. Counting.',       accuracy_score: 68.9 },
  { email: 'anon_bear@grzly.com',    password: 'grzly_demo_2024!', username: 'delta_hedge',   bio: 'Quant. I keep it anonymous mostly.',         accuracy_score: null },
]

async function ensureUser(email, password, username, bio, accuracy_score) {
  // Create auth user if missing
  const { data: listData } = await supabase.auth.admin.listUsers()
  let user = listData.users.find(u => u.email === email)

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (error) { console.error(`Auth error for ${email}:`, error.message); return null }
    user = data.user
    console.log(`  Created auth user: ${email}`)
  } else {
    console.log(`  Auth user exists: ${email}`)
  }

  // Upsert profile
  await supabase.from('profiles').upsert({
    id: user.id,
    username,
    bio,
    accuracy_score,
    drop_count: 0,
    resolved_drop_count: 0,
    correct_drop_count: 0,
  }, { onConflict: 'id' })

  return user
}

// ─────────────────────────────────────────
// 2. Drops
// ─────────────────────────────────────────
async function seedDrops(userMap) {
  const bearpilled   = userMap['bearpilled']
  const shortgod     = userMap['shortgod']
  const reaper       = userMap['market_reaper']
  const delta_hedge  = userMap['delta_hedge']

  const drops = [

    // ── HOT: MSTR ──────────────────────────────────────────────
    {
      ticker: 'MSTR',
      company_name: 'MicroStrategy Inc.',
      thesis: 'MSTR is trading at a 2.8x premium to its BTC NAV with no credible path to close that gap. When BTC corrects 20%+, the leverage amplifies losses — equity holders get wiped before the bonds. The convertible note overhang alone is a ticking clock.',
      financial_metric: 'NAV premium 2.8x | BTC holdings ~$15B vs market cap ~$42B | $3.2B convertible notes due 2027',
      evidence_links: [
        'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=MSTR',
        'https://bitcointreasuries.net/',
      ],
      time_horizon: '7 days',
      target_price: 185.00,
      baseline_price: 312.40,
      created_by: bearpilled,
      is_anonymous: false,
      status: 'active',
      created_at: daysAgo(3),
      resolves_at: daysFromNow(4),        // <7 days → qualifies for hot
      bearish_votes: 29,
      skeptical_votes: 4,
      total_votes: 33,
      raw_conviction_pct: 87.88,
      conviction_score: 85.2,
      reddit_mention_count: 47,
      lore_narrative: 'The bears smell blood. MSTR is a levered BTC bet wearing a software company\'s skin, and the market is finally starting to notice the seams.',
    },

    // ── ACTIVE: SMCI ──────────────────────────────────────────
    {
      ticker: 'SMCI',
      company_name: 'Super Micro Computer',
      thesis: 'SMCI delayed its 10-K again. Deloitte walked. The AI hype is masking a company with consistent inventory and revenue recognition questions. When auditors refuse to sign off, the thesis writes itself.',
      financial_metric: 'FY2024 10-K delayed | Auditor change (Deloitte → E&Y) | Short interest 14.2% of float',
      evidence_links: [
        'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=SMCI',
      ],
      time_horizon: '30 days',
      target_price: 28.00,
      baseline_price: 44.18,
      created_by: shortgod,
      is_anonymous: false,
      status: 'active',
      created_at: daysAgo(8),
      resolves_at: daysFromNow(22),
      bearish_votes: 18,
      skeptical_votes: 5,
      total_votes: 23,
      raw_conviction_pct: 78.26,
      conviction_score: 79.1,
      reddit_mention_count: 31,
      lore_narrative: 'When the auditors walk out the door, they take the credibility with them. SMCI has been living on borrowed time and borrowed narrative.',
    },

    // ── SWAYZE / EXTENDED: RIVN ────────────────────────────────
    {
      ticker: 'RIVN',
      company_name: 'Rivian Automotive',
      thesis: 'Rivian is burning $1.4B per quarter with no clear path to positive gross margin before 2026. The Amazon relationship is a ceiling on upside, not a floor on downside. At current burn rates they need to raise again within 12 months.',
      financial_metric: 'Q3 gross margin -44% | Cash burn $1.4B/qtr | ~$5.1B cash remaining | Amazon lock-up expiry overhang',
      evidence_links: [],
      time_horizon: '90 days',
      target_price: 8.50,
      baseline_price: 16.22,
      created_by: reaper,
      is_anonymous: false,
      status: 'extended',
      created_at: daysAgo(45),
      resolves_at: daysFromNow(20),          // original would have expired
      extended_at: daysAgo(5),
      extended_resolves_at: daysFromNow(20),
      swayze_reason: 'catalyst_delayed',
      was_extended: true,
      bearish_votes: 31,
      skeptical_votes: 11,
      total_votes: 42,
      raw_conviction_pct: 73.81,
      conviction_score: 71.4,
      reddit_mention_count: 19,
      lore_narrative: 'The bears extended — catalyst delayed, not cancelled. Amazon\'s lockup expiry got pushed. The thesis stands, the clock resets.',
    },

    // ── ACTIVE: BYND (low conviction / skeptical majority) ─────
    {
      ticker: 'BYND',
      company_name: 'Beyond Meat Inc.',
      thesis: 'Plant-based meat adoption has plateaued and BYND has no new catalyst. Revenue declining 5 quarters straight, gross margins barely positive, and the McDonald\'s McPlant is effectively dead. The brand is a zombie.',
      financial_metric: 'Revenue -$50M YoY | Gross margin 4.2% | Cash $152M | No meaningful partnership pipeline',
      evidence_links: [],
      time_horizon: '60 days',
      target_price: 3.50,
      baseline_price: 6.88,
      created_by: bearpilled,
      is_anonymous: false,
      status: 'active',
      created_at: daysAgo(12),
      resolves_at: daysFromNow(48),
      bearish_votes: 9,
      skeptical_votes: 13,
      total_votes: 22,
      raw_conviction_pct: 40.91,
      conviction_score: 38.7,
      reddit_mention_count: 8,
      lore_narrative: null,
    },

    // ── RESOLVED CORRECT: SNAP ────────────────────────────────
    {
      ticker: 'SNAP',
      company_name: 'Snap Inc.',
      thesis: 'Snap\'s DAU growth is stalling in every developed market. Their AR hardware bets are money pits. TikTok owns attention and they have no moat. The ad revenue per user is 3x below Meta and shows no signs of closing.',
      financial_metric: 'DAU growth <2% YoY in US/EU | R&D 74% of revenue | ARPU $3.10 vs META $13.40',
      evidence_links: [],
      time_horizon: '30 days',
      target_price: 8.00,
      baseline_price: 14.35,
      created_by: shortgod,
      is_anonymous: false,
      status: 'resolved',
      created_at: daysAgo(45),
      resolves_at: daysAgo(15),
      resolved_at: daysAgo(15),
      baseline_price: 14.35,
      resolution_price: 8.74,
      price_change_pct: -39.1,
      outcome: 'correct',
      was_extended: false,
      bearish_votes: 24,
      skeptical_votes: 6,
      total_votes: 30,
      raw_conviction_pct: 80.0,
      conviction_score: 82.3,
      reddit_mention_count: 0,
      bear_book_narrative: 'Called it clean. SNAP missed on DAU, missed on revenue, guided down again. The ad business is deteriorating exactly as predicted. This one goes in the book.',
    },

    // ── RESOLVED INCORRECT: TSLA ──────────────────────────────
    {
      ticker: 'TSLA',
      company_name: 'Tesla Inc.',
      thesis: 'Tesla\'s energy business hype is masking gross margin compression in auto. Cybertruck ramp is a disaster and the brand has been politically torched in Europe. Q1 numbers will be ugly.',
      financial_metric: 'Auto gross margin 14.6% | Cybertruck gross margin negative | EU delivery decline 20% YoY',
      evidence_links: [],
      time_horizon: '30 days',
      target_price: 150.00,
      baseline_price: 248.00,
      created_by: reaper,
      is_anonymous: false,
      status: 'resolved',
      created_at: daysAgo(50),
      resolves_at: daysAgo(20),
      resolved_at: daysAgo(20),
      resolution_price: 281.50,
      price_change_pct: 13.5,
      outcome: 'incorrect',
      was_extended: false,
      bearish_votes: 14,
      skeptical_votes: 18,
      total_votes: 32,
      raw_conviction_pct: 43.75,
      conviction_score: 41.2,
      reddit_mention_count: 0,
      bear_book_narrative: 'Wrong. Energy segment posted record margins and the market re-rated the whole company on it. Thesis wasn\'t wrong on Cybertruck — just wrong on what would drive the quarter.',
    },

    // ── ACTIVE ANONYMOUS: GME ─────────────────────────────────
    {
      ticker: 'GME',
      company_name: 'GameStop Corp.',
      thesis: 'GameStop\'s core business is irreversibly in decline. The Bitcoin treasury strategy is desperation cosplay. DFV coming back for attention doesn\'t change the fundamentals. The meme shield only delays the inevitable.',
      financial_metric: 'Revenue -$1.2B YoY | Store count declining | $4.1B BTC treasury at cost basis | Zero FCF',
      evidence_links: [],
      time_horizon: '90 days',
      target_price: 12.00,
      baseline_price: 28.40,
      created_by: delta_hedge,
      is_anonymous: true,          // anonymous drop — no creator shown
      status: 'active',
      created_at: daysAgo(6),
      resolves_at: daysFromNow(84),
      bearish_votes: 20,
      skeptical_votes: 15,
      total_votes: 35,
      raw_conviction_pct: 57.14,
      conviction_score: 55.8,
      reddit_mention_count: 62,
      lore_narrative: null,
    },

    // ── ACTIVE: CVNA (high conviction, longer horizon) ─────────
    {
      ticker: 'CVNA',
      company_name: 'Carvana Co.',
      thesis: 'Carvana\'s "profitability" is accounting theater. Gain-on-sale accounting from their ADESA loans is doing the heavy lifting. Real unit economics are still deeply negative. The debt load ($5.6B) at these rates means either dilution or default in the next 18 months.',
      financial_metric: 'Adjusted EBITDA positive but GAAP free cash flow negative | $5.6B debt | Avg rate 9.2% | Gain-on-sale 31% of "revenue"',
      evidence_links: [
        'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=CVNA',
      ],
      time_horizon: '180 days',
      target_price: 45.00,
      baseline_price: 182.50,
      created_by: bearpilled,
      is_anonymous: false,
      status: 'active',
      created_at: daysAgo(2),
      resolves_at: daysFromNow(178),
      bearish_votes: 11,
      skeptical_votes: 4,
      total_votes: 15,
      raw_conviction_pct: 73.33,
      conviction_score: 70.9,
      reddit_mention_count: 14,
      lore_narrative: null,
    },

  ]

  console.log('\nInserting drops…')
  const inserted = []
  for (const drop of drops) {
    const { data, error } = await supabase
      .from('drops')
      .insert({
        ticker:               drop.ticker,
        company_name:         drop.company_name ?? null,
        thesis:               drop.thesis,
        evidence_links:       drop.evidence_links ?? [],
        financial_metric:     drop.financial_metric ?? null,
        time_horizon:         drop.time_horizon,
        target_price:         drop.target_price ?? null,
        baseline_price:       drop.baseline_price ?? null,
        resolution_price:     drop.resolution_price ?? null,
        price_change_pct:     drop.price_change_pct ?? null,
        created_by:           drop.created_by,
        is_anonymous:         drop.is_anonymous ?? false,
        status:               drop.status ?? 'active',
        created_at:           drop.created_at,
        resolves_at:          drop.resolves_at,
        extended_at:          drop.extended_at ?? null,
        extended_resolves_at: drop.extended_resolves_at ?? null,
        swayze_reason:        drop.swayze_reason ?? null,
        outcome:              drop.outcome ?? null,
        was_extended:         drop.was_extended ?? false,
        resolved_at:          drop.resolved_at ?? null,
        bearish_votes:        drop.bearish_votes ?? 0,
        skeptical_votes:      drop.skeptical_votes ?? 0,
        total_votes:          drop.total_votes ?? 0,
        raw_conviction_pct:   drop.raw_conviction_pct ?? null,
        conviction_score:     drop.conviction_score ?? null,
        reddit_mention_count: drop.reddit_mention_count ?? 0,
        lore_narrative:       drop.lore_narrative ?? null,
        bear_book_narrative:  drop.bear_book_narrative ?? null,
        accuracy_weight:      1.0,
      })
      .select('id, ticker')
      .single()

    if (error) {
      console.error(`  ✗ ${drop.ticker}: ${error.message}`)
    } else {
      console.log(`  ✓ ${drop.ticker} (${drop.status}) — id ${data.id}`)
      inserted.push({ ...drop, id: data.id })
    }
  }
  return inserted
}

// ─────────────────────────────────────────
// 3. Votes for the demo user on a few drops
// ─────────────────────────────────────────
async function seedVotes(drops, demoUserId) {
  // bearpilled votes bearish on SMCI, RIVN, CVNA
  const voteTargets = ['SMCI', 'RIVN', 'CVNA', 'SNAP', 'GME']

  console.log('\nInserting demo user votes…')
  for (const ticker of voteTargets) {
    const drop = drops.find(d => d.ticker === ticker)
    if (!drop) continue

    const { error } = await supabase.from('votes').upsert({
      drop_id:   drop.id,
      user_id:   demoUserId,
      direction: 'bearish',
      voter_accuracy_at_vote: 72.4,
    }, { onConflict: 'drop_id,user_id' })

    if (error) {
      console.error(`  ✗ vote on ${ticker}: ${error.message}`)
    } else {
      console.log(`  ✓ bearish vote on ${ticker}`)
    }
  }
}

// ─────────────────────────────────────────
// 4. Reddit posts (for MSTR and GME)
// ─────────────────────────────────────────
async function seedRedditPosts(drops) {
  const mstr = drops.find(d => d.ticker === 'MSTR')
  const gme  = drops.find(d => d.ticker === 'GME')

  const posts = [
    {
      reddit_post_id: 'demo_mstr_001',
      subreddit:      'wallstreetbets',
      title:          'MSTR is basically a 3x leveraged Bitcoin ETF except you also take on Saylor risk',
      body:           'The NAV premium is insane. At current BTC prices you\'re paying $42B for $15B of bitcoin. The convertibles are going to crush equity holders.',
      upvotes:        4821,
      comment_count:  612,
      author:         'put_me_in_coach',
      reddit_url:     'https://reddit.com/r/wallstreetbets/comments/demo_mstr_001',
      posted_at:      daysAgo(2),
      tickers_mentioned: ['MSTR', 'BTC'],
    },
    {
      reddit_post_id: 'demo_mstr_002',
      subreddit:      'stocks',
      title:          'MSTR valuation deep dive — the NAV premium explained (and why it\'s dangerous)',
      body:           'Deep dive into MicroStrategy\'s balance sheet. The software business is worth basically nothing. You\'re paying pure BTC premium.',
      upvotes:        1203,
      comment_count:  88,
      author:         'balance_sheet_bro',
      reddit_url:     'https://reddit.com/r/stocks/comments/demo_mstr_002',
      posted_at:      daysAgo(4),
      tickers_mentioned: ['MSTR'],
    },
    {
      reddit_post_id: 'demo_gme_001',
      subreddit:      'wallstreetbets',
      title:          'GameStop is cosplaying as a Bitcoin treasury company and the apes are eating it up',
      body:           'They have no revenue, no growth, and are now buying Bitcoin. This is the last act.',
      upvotes:        9140,
      comment_count:  2341,
      author:         'short_everything',
      reddit_url:     'https://reddit.com/r/wallstreetbets/comments/demo_gme_001',
      posted_at:      daysAgo(1),
      tickers_mentioned: ['GME', 'MSTR'],
    },
    {
      reddit_post_id: 'demo_gme_002',
      subreddit:      'superstonk',
      title:          'GME Bitcoin strategy — bullish or desperate?',
      body:           null,
      upvotes:        340,
      comment_count:  198,
      author:         'diamond_hooves',
      reddit_url:     'https://reddit.com/r/superstonk/comments/demo_gme_002',
      posted_at:      daysAgo(3),
      tickers_mentioned: ['GME'],
    },
  ]

  console.log('\nInserting Reddit posts…')
  for (const post of posts) {
    const { error } = await supabase.from('reddit_posts').upsert(post, {
      onConflict: 'reddit_post_id',
    })
    if (error) {
      console.error(`  ✗ ${post.reddit_post_id}: ${error.message}`)
    } else {
      console.log(`  ✓ ${post.subreddit} — "${post.title.slice(0, 50)}…"`)
    }
  }
}

// ─────────────────────────────────────────
// 5. Update profile drop counts
// ─────────────────────────────────────────
async function updateProfileCounts(userMap) {
  const counts = {
    bearpilled:   { drop_count: 3, resolved_drop_count: 0, correct_drop_count: 0 },
    shortgod:     { drop_count: 2, resolved_drop_count: 1, correct_drop_count: 1 },
    market_reaper:{ drop_count: 2, resolved_drop_count: 1, correct_drop_count: 0 },
    delta_hedge:  { drop_count: 1, resolved_drop_count: 0, correct_drop_count: 0 },
  }

  console.log('\nUpdating profile counts…')
  for (const [username, c] of Object.entries(counts)) {
    const userId = userMap[username]
    if (!userId) continue
    const { error } = await supabase.from('profiles').update(c).eq('id', userId)
    if (error) {
      console.error(`  ✗ ${username}: ${error.message}`)
    } else {
      console.log(`  ✓ ${username}`)
    }
  }
}

// ─────────────────────────────────────────
// Main
// ─────────────────────────────────────────
async function main() {
  console.log('── GRZLY Demo Seed ──────────────────────')

  // Get demo user ID
  const { data: { users: allUsers } } = await supabase.auth.admin.listUsers()
  const demoUser = allUsers.find(u => u.email === 'demo@grzly.com')
  if (!demoUser) {
    console.error('Demo user not found. Run seed-demo-user.mjs first.')
    process.exit(1)
  }

  // Ensure secondary users
  console.log('\nEnsuring secondary users…')
  const userMap = { bearpilled: demoUser.id }
  for (const u of SECONDARY_USERS) {
    const user = await ensureUser(u.email, u.password, u.username, u.bio, u.accuracy_score)
    if (user) userMap[u.username] = user.id
  }

  // Seed drops
  const drops = await seedDrops(userMap)

  // Seed votes
  await seedVotes(drops, demoUser.id)

  // Seed Reddit posts
  await seedRedditPosts(drops)

  // Update profile stats
  await updateProfileCounts(userMap)

  console.log('\n── Done ─────────────────────────────────')
  console.log(`  ${drops.length} drops seeded`)
  console.log(`  Tickers: ${drops.map(d => d.ticker).join(', ')}`)
  console.log('\n  All secondary accounts use password: grzly_demo_2024!')
}

main().catch(err => { console.error(err); process.exit(1) })
