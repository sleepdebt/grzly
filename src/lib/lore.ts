// ============================================================
// GRZLY Lore Engine
// Generates AI narrative on Drop state transitions.
// ALL lore generation must happen server-side only.
// ALL generations must be logged to lore_events.
// NEVER break a Drop state transition due to lore failure.
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import { DropOutcome, LoreEventType, SwayzeReason } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const MODEL = process.env.ANTHROPIC_LORE_MODEL ?? 'claude-haiku-4-5-20251001'
const PROMPT_VERSION = process.env.LORE_PROMPT_VERSION ?? 'v1.0'

// Tone instruction injected into every lore prompt
const TONE_INSTRUCTION = `
You are the voice of GRZLY — a dark, ritualistic collective of bears who identify overvalued, overhyped, and corrupt companies.
Your tone is: mythological, internet-native, terse, dramatic. Think Dune crossed with WallStreetBets.
Write in second-person present tense. Maximum 3 sentences. Do not use hashtags or emojis.
Never give financial advice. Never use the word "crash". Avoid clichés like "dead cat bounce".
`.trim()

// Fallback templates — used when the API call fails
// MUST cover all event types so state transitions never break
const FALLBACKS: Record<LoreEventType, string> = {
  creation: 'A new prophecy has been inscribed in the book of bears. The thesis stands. The clock begins.',
  conviction_surge: 'The council speaks with one voice. Conviction has crossed the threshold. The bears are organizing.',
  extension: 'The prophecy endures beyond its horizon. The thesis remains intact. The reckoning is delayed — not cancelled.',
  resolution: 'The Drop has resolved. The Bear Book records what the market confirmed. Another chapter closes.',
}

// ─── Prompt builders ─────────────────────────────────────────

function buildCreationPrompt(ticker: string, thesis: string, newsHeadlines: string[]): string {
  const headlines = newsHeadlines.length
    ? `Recent headlines: ${newsHeadlines.slice(0, 3).join(' | ')}`
    : ''
  return `
${TONE_INSTRUCTION}

A new short thesis has been published on $${ticker}.

Thesis: "${thesis}"
${headlines}

Write 2–4 sentences of mythological narrative framing this thesis. Do not quote the thesis directly.
`.trim()
}

function buildConvictionSurgePrompt(ticker: string, convictionPct: number, totalVotes: number): string {
  return `
${TONE_INSTRUCTION}

The $${ticker} Drop has crossed the conviction threshold.
${convictionPct.toFixed(0)}% of ${totalVotes} voters are bearish. The bears have spoken.

Write 2–3 sentences of narrative celebrating this collective conviction surge.
`.trim()
}

function buildExtensionPrompt(ticker: string, reason: SwayzeReason, originalThesis: string): string {
  const reasonText: Record<SwayzeReason, string> = {
    catalyst_delayed: 'the catalyst has been delayed — the thesis remains unchanged',
    timing_off: 'the timing was off but the fundamental argument is intact',
    new_information: 'new information has emerged that extends the timeline',
  }
  return `
${TONE_INSTRUCTION}

The $${ticker} Drop has been extended by its creator. Reason: ${reasonText[reason]}.
Original thesis: "${originalThesis.slice(0, 200)}"

Write 2–3 sentences of narrative about the extension — the prophecy endures, the reckoning is merely delayed.
`.trim()
}

function buildResolutionPrompt(
  ticker: string,
  outcome: DropOutcome,
  priceChangePct: number,
  thesisSummary: string
): string {
  const outcomeText = {
    correct: `The bears were right. $${ticker} fell ${Math.abs(priceChangePct).toFixed(1)}% from baseline.`,
    incorrect: `The bears were wrong. $${ticker} moved ${priceChangePct > 0 ? 'up' : 'only'} ${Math.abs(priceChangePct).toFixed(1)}% from baseline.`,
    inconclusive: `The outcome was inconclusive — data unavailable or the Drop was cancelled.`,
  }

  return `
${TONE_INSTRUCTION}

A Drop on $${ticker} has resolved.
${outcomeText[outcome]}
Original thesis: "${thesisSummary.slice(0, 200)}"

Write 2–4 sentences of Bear Book narrative reflecting on this outcome.
${outcome === 'correct' ? 'Tone: grave, vindicating, the bears are proven right.' : ''}
${outcome === 'incorrect' ? 'Tone: honest, stoic, the bears acknowledge defeat without self-pity.' : ''}
`.trim()
}

// ─── Core generation function ─────────────────────────────────

async function generateWithFallback(prompt: string, eventType: LoreEventType): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = response.content[0]
    const text = block.type === 'text' ? block.text.trim() : null
    if (text && text.length > 10) return text
  } catch (err) {
    console.error(`[Lore] Anthropic generation failed for ${eventType}:`, err)
  }
  return FALLBACKS[eventType]
}

// ─── Public API ───────────────────────────────────────────────

export interface LoreGenerationResult {
  narrative: string
  promptVersion: string
  modelUsed: string
  eventType: LoreEventType
}

export async function generateCreationLore(
  ticker: string,
  thesis: string,
  newsHeadlines: string[] = []
): Promise<LoreGenerationResult> {
  const prompt = buildCreationPrompt(ticker, thesis, newsHeadlines)
  const narrative = await generateWithFallback(prompt, 'creation')
  return { narrative, promptVersion: PROMPT_VERSION, modelUsed: MODEL, eventType: 'creation' }
}

export async function generateConvictionSurgeLore(
  ticker: string,
  convictionPct: number,
  totalVotes: number
): Promise<LoreGenerationResult> {
  const prompt = buildConvictionSurgePrompt(ticker, convictionPct, totalVotes)
  const narrative = await generateWithFallback(prompt, 'conviction_surge')
  return { narrative, promptVersion: PROMPT_VERSION, modelUsed: MODEL, eventType: 'conviction_surge' }
}

export async function generateExtensionLore(
  ticker: string,
  reason: SwayzeReason,
  originalThesis: string
): Promise<LoreGenerationResult> {
  const prompt = buildExtensionPrompt(ticker, reason, originalThesis)
  const narrative = await generateWithFallback(prompt, 'extension')
  return { narrative, promptVersion: PROMPT_VERSION, modelUsed: MODEL, eventType: 'extension' }
}

export async function generateResolutionLore(
  ticker: string,
  outcome: DropOutcome,
  priceChangePct: number,
  thesisSummary: string
): Promise<LoreGenerationResult> {
  const prompt = buildResolutionPrompt(ticker, outcome, priceChangePct, thesisSummary)
  const narrative = await generateWithFallback(prompt, 'resolution')
  return { narrative, promptVersion: PROMPT_VERSION, modelUsed: MODEL, eventType: 'resolution' }
}
