// Cron: seed-drops — posts 1–3 agent-authored bear thesis Drops per run
// Schedule: 0 15 * * 1-5 (3pm UTC, weekdays — after markets open)
// Route: /api/cron/seed-drops
//
// Flow per run:
//   1. Load agent profile IDs from DB (grzly_quant, grzly_macro, grzly_flow)
//   2. Pick tickers from curated pool that have no active agent Drop
//   3. Fetch financial context from Finnhub for each
//   4. Generate a credible bear thesis via Claude Haiku (persona-specific)
//   5. Insert Drop directly via service role, then generate lore
//
// Drops per run: max 2 (keeps feed from feeling flooded at launch)
// Time horizon: 30 days (gives enough time for real resolution data)

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getLatestClose, validateTicker } from '@/lib/polygon'
import { getCompanyNews, getBasicFinancials } from '@/lib/finnhub'
import { generateCreationLore } from '@/lib/lore'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const MODEL = 'claude-haiku-4-5-20251001'
const DROPS_PER_RUN = 2
const TIME_HORIZON = '30 days'
const HORIZON_DAYS = 30

// ─── Agent personas ───────────────────────────────────────────

const AGENTS = [
  {
    username: 'grzly_quant',
    focus: 'deteriorating fundamentals: earnings misses, bloated valuations (P/E, P/S, EV/Revenue), declining gross margins, cash burn rate, rising debt. Always cite a specific financial metric.',
  },
  {
    username: 'grzly_macro',
    focus: 'macro and structural headwinds: interest rate sensitivity, sector rotation risk, regulatory threats, competitive disruption, declining addressable market, or geopolitical exposure.',
  },
  {
    username: 'grzly_flow',
    focus: 'market structure signals: elevated short interest, insider selling patterns, options put/call skew, momentum deterioration, technical breakdown levels, or institutional distribution.',
  },
] as const

// ─── Ticker pool ─────────────────────────────────────────────
// Well-known names new users will recognise immediately.
// Deliberately includes a mix of mega-cap and high-profile speculative names.

const TICKER_POOL = [
  'TSLA', 'NVDA', 'AAPL', 'AMZN', 'META', 'GOOGL', 'MSFT',
  'PLTR', 'COIN', 'MSTR', 'SNAP', 'UBER', 'DASH', 'RIVN',
  'LCID', 'SQ', 'PINS', 'RBLX', 'HOOD', 'SOFI',
]

// ─── Thesis generation ────────────────────────────────────────

async function generateThesis(
  ticker: string,
  companyName: string,
  agentFocus: string,
  financialContext: string,
): Promise<string | null> {
  const prompt = `You are a short-seller analyst publishing a bear thesis on the GRZLY platform.
Your analytical focus: ${agentFocus}

Write a bear thesis on $${ticker} (${companyName}).

Available context:
${financialContext}

Requirements:
- 250–450 characters (MUST be at least 250 characters)
- Analytical and specific — reference real numbers or named risks where possible
- First person, declarative voice
- No hashtags, no emojis, no disclaimers
- Do not say "I believe" or "I think" — state the case directly
- Do not give financial advice
- End with the core reason you are short

Return only the thesis text. Nothing else.`.trim()

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = (response.content[0] as { type: string; text: string }).text.trim()
    // Must pass the 200 char minimum enforced by POST /api/drops
    return text.length >= 200 ? text : null
  } catch (err) {
    console.error(`[Cron: seed-drops] Thesis generation failed for ${ticker}:`, err)
    return null
  }
}

// ─── Route ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const startTime = Date.now()
  console.log('[Cron: seed-drops] Starting...')

  // ─── Load agent IDs ───────────────────────────────────────
  const agentUsernames = AGENTS.map(a => a.username)
  const { data: agentProfiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, username')
    .in('username', agentUsernames)

  if (profileError || !agentProfiles || agentProfiles.length === 0) {
    console.error('[Cron: seed-drops] Failed to load agent profiles:', profileError?.message)
    return NextResponse.json({ error: 'Agent profiles not found' }, { status: 500 })
  }

  const agentMap = new Map(agentProfiles.map(p => [p.username as string, p.id as string]))

  // ─── Find tickers with no active agent Drop ───────────────
  const { data: existingAgentDrops } = await supabase
    .from('drops')
    .select('ticker')
    .in('created_by', [...agentMap.values()])
    .in('status', ['active', 'extended'])

  const coveredTickers = new Set((existingAgentDrops ?? []).map(d => d.ticker as string))
  const available = TICKER_POOL.filter(t => !coveredTickers.has(t))

  if (available.length === 0) {
    console.log('[Cron: seed-drops] All pool tickers already have active agent drops.')
    return NextResponse.json({ message: 'All tickers covered', posted: 0 })
  }

  // Shuffle for variety
  const shuffled = available.sort(() => Math.random() - 0.5)
  const targets = shuffled.slice(0, DROPS_PER_RUN)

  const results: Array<{ ticker: string; agent: string; drop_id?: string; error?: string }> = []

  for (let i = 0; i < targets.length; i++) {
    const ticker = targets[i]
    const agent = AGENTS[i % AGENTS.length]
    const agentId = agentMap.get(agent.username)

    if (!agentId) {
      results.push({ ticker, agent: agent.username, error: 'Agent ID not found' })
      continue
    }

    try {
      // Validate ticker + get company name
      const validation = await validateTicker(ticker)
      if (!validation.valid) {
        results.push({ ticker, agent: agent.username, error: 'Ticker invalid' })
        continue
      }

      const companyName = validation.companyName ?? ticker

      // Fetch context in parallel
      const [baselinePrice, news, financials] = await Promise.all([
        getLatestClose(ticker),
        getCompanyNews(ticker, { days: 14, limit: 5 }).catch(() => []),
        getBasicFinancials(ticker).catch(() => null),
      ])

      // Build financial context string for the prompt
      const contextParts: string[] = []
      if (financials) {
        if (financials.pe_ratio)          contextParts.push(`P/E (TTM): ${financials.pe_ratio.toFixed(1)}`)
        if (financials.ps_ratio)          contextParts.push(`P/S: ${financials.ps_ratio.toFixed(1)}`)
        if (financials.gross_margin)      contextParts.push(`Gross margin: ${(financials.gross_margin * 100).toFixed(1)}%`)
        if (financials.revenue_growth_yoy) contextParts.push(`Revenue growth YoY: ${(financials.revenue_growth_yoy * 100).toFixed(1)}%`)
        if (financials.debt_to_equity)    contextParts.push(`D/E ratio: ${financials.debt_to_equity.toFixed(2)}`)
      }
      if (news.length > 0) {
        contextParts.push(`Recent headlines: ${news.slice(0, 3).map(n => n.headline).join(' | ')}`)
      }
      if (baselinePrice) {
        contextParts.push(`Current price: $${baselinePrice.toFixed(2)}`)
      }

      const financialContext = contextParts.length > 0
        ? contextParts.join('\n')
        : 'No financial data available — use general knowledge of this company.'

      // Generate thesis
      const thesis = await generateThesis(ticker, companyName, agent.focus, financialContext)
      if (!thesis) {
        results.push({ ticker, agent: agent.username, error: 'Thesis generation failed or too short' })
        continue
      }

      // Compute resolves_at
      const resolvesAt = new Date(Date.now() + HORIZON_DAYS * 24 * 60 * 60 * 1000).toISOString()

      // Insert drop directly (service role bypasses auth middleware)
      const { data: drop, error: insertError } = await supabase
        .from('drops')
        .insert({
          ticker,
          company_name: companyName,
          thesis,
          financial_metric: contextParts[0] ?? null, // first metric as the financial_metric field
          created_by: agentId,
          is_anonymous: false,
          status: 'active',
          time_horizon: TIME_HORIZON,
          resolves_at: resolvesAt,
          baseline_price: baselinePrice,
        })
        .select()
        .single()

      if (insertError || !drop) {
        console.error(`[Cron: seed-drops] Insert failed for ${ticker}:`, insertError)
        results.push({ ticker, agent: agent.username, error: insertError?.message ?? 'Insert failed' })
        continue
      }

      console.log(`[Cron: seed-drops] Posted $${ticker} as ${agent.username} (${drop.id})`)

      // Generate lore (non-blocking)
      try {
        const lore = await generateCreationLore(ticker, thesis, news.map(n => n.headline))
        await supabase.from('drops').update({ lore_narrative: lore.narrative }).eq('id', drop.id)
        await supabase.from('lore_events').insert({
          drop_id: drop.id,
          event_type: 'creation',
          narrative: lore.narrative,
          prompt_version: lore.promptVersion,
          model_used: lore.modelUsed,
        })
      } catch (loreErr) {
        console.error(`[Cron: seed-drops] Lore failed for ${ticker} (non-fatal):`, loreErr)
      }

      results.push({ ticker, agent: agent.username, drop_id: drop.id })

      // Stagger between drops
      if (i < targets.length - 1) {
        await new Promise(r => setTimeout(r, 1000))
      }
    } catch (err) {
      console.error(`[Cron: seed-drops] Unexpected error for ${ticker}:`, err)
      results.push({ ticker, agent: agent.username, error: String(err) })
    }
  }

  const posted = results.filter(r => r.drop_id).length
  const duration = Date.now() - startTime
  console.log(`[Cron: seed-drops] Done — ${posted}/${targets.length} posted, ${duration}ms`)

  return NextResponse.json({ posted, results, duration_ms: duration })
}
