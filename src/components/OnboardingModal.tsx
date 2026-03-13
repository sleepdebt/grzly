'use client'

// Onboarding modal — shown once after a new user creates an account.
// Triggered by ?welcome=true in the URL, which is set by the sign-up flow.
// Dismissed by completing the steps or clicking Skip.

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const STEPS = [
  {
    id: 'welcome',
    eyebrow: 'Welcome, Vibelord.',
    headline: 'Every bubble has its Cassandras.',
    body: `Someone always sees it. The overvalued stock. The story that doesn't add up. The CEO who keeps changing the subject.

They post about it. They do the math in public. And when it finally breaks — the people who called it have no record. No proof. No credit.

GRZLY changes that. Short the hype. Build your record.`,
    cta: 'How it works →',
  },
  {
    id: 'drops',
    eyebrow: 'Step 1 — The Drop',
    headline: 'Bear thesis. Public record. No excuses.',
    body: `A Drop is your structured short thesis: a ticker, your written argument, and a resolution window — 30 days to a year.

Once published, it's timestamped and on the record. You own it. No deleting it when you're wrong. No anonymity when you're right.

Publish the thesis. Let the market decide.`,
    cta: 'Next →',
    stat: { label: 'Put it on the record.', sub: 'Every Drop is timestamped and permanent' },
  },
  {
    id: 'conviction',
    eyebrow: 'Step 2 — The Pack',
    headline: 'The crowd votes. Accuracy weights it.',
    body: `Other Vibelords vote on every Drop — Bearish if they believe the thesis, Skeptical if they don't.

The Conviction Score isn't a headcount. It's accuracy-weighted: proven Vibelords carry more weight. When 800 people independently converge on the same ticker with 87% conviction, that's signal — not noise.

Everyone's a bear. Prove it.`,
    cta: 'Next →',
    stat: { label: 'Collective conviction.', sub: 'Individual accountability.' },
  },
  {
    id: 'bearbook',
    eyebrow: 'Step 3 — The Bear Book',
    headline: 'Where short ideas go to live or die.',
    body: `When a Drop's window closes, KEANU runs — Polygon pulls the price, the outcome resolves automatically. Correct or not, the record stands.

Every resolved Drop lives in the Bear Book permanently. Your accuracy compounds. The best Vibelords rise. Bad calls don't get buried quietly.

No trades. No money. The internet's bear book — and your name is in it.`,
    cta: 'Start dropping →',
    stat: { label: 'Auto-resolved by KEANU.', sub: 'Real price data. No disputes.' },
  },
]

export default function OnboardingModal() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (searchParams.get('welcome') === 'true') {
      setVisible(true)
    }
  }, [searchParams])

  function dismiss(goCreate = false) {
    setVisible(false)
    // Remove ?welcome=true from URL without a navigation
    const url = new URL(window.location.href)
    url.searchParams.delete('welcome')
    window.history.replaceState({}, '', url.toString())
    if (goCreate) router.push('/drops/create')
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      dismiss(true)
    }
  }

  if (!visible) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => dismiss()}
      />

      {/* Modal */}
      <div className="relative w-full max-w-[520px] bg-surface border border-border rounded-2xl overflow-hidden shadow-2xl">

        {/* Accent bar — progress */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-border">
          <div
            className="h-full bg-accent transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Skip */}
        <button
          onClick={() => dismiss()}
          className="absolute top-4 right-4 text-[11px] font-mono text-muted hover:text-text transition-colors"
        >
          Skip
        </button>

        <div className="px-8 pt-10 pb-8">

          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mb-6">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-[3px] rounded-full transition-all duration-300 ${
                  i <= step ? 'bg-accent' : 'bg-border'
                } ${i === step ? 'w-6' : 'w-3'}`}
              />
            ))}
          </div>

          {/* Eyebrow */}
          <p className="font-mono text-[11px] text-accent uppercase tracking-[0.15em] mb-3">
            {current.eyebrow}
          </p>

          {/* Headline */}
          <h2 className="text-[26px] font-bold text-text leading-[1.2] mb-5">
            {current.headline}
          </h2>

          {/* Body */}
          <div className="space-y-3 mb-6">
            {current.body.split('\n\n').map((para, i) => (
              <p key={i} className="text-[14px] text-text-dim leading-[1.7]">
                {para}
              </p>
            ))}
          </div>

          {/* Stat callout */}
          {current.stat && (
            <div className="flex items-center gap-4 px-4 py-3 bg-surface-2 border border-border rounded-[10px] mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
              <div>
                <p className="font-mono text-[12px] font-bold text-accent">{current.stat.label}</p>
                <p className="text-[11px] text-muted mt-0.5">{current.stat.sub}</p>
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="flex items-center justify-between">
            {step > 0 ? (
              <button
                onClick={() => setStep(s => s - 1)}
                className="text-[12px] font-mono text-muted hover:text-text transition-colors"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}
            <button
              onClick={next}
              className={`px-6 py-2.5 rounded-[8px] font-mono text-[13px] font-bold transition-colors ${
                isLast
                  ? 'bg-accent text-bg hover:bg-[#d9ff1a]'
                  : 'bg-surface-2 border border-border text-text hover:border-accent/50 hover:text-accent'
              }`}
            >
              {current.cta}
            </button>
          </div>

        </div>

        {/* Bottom lore line */}
        <div className="px-8 py-3 border-t border-border bg-surface-2">
          <p className="font-mono text-[10px] text-muted tracking-[0.1em] uppercase">
            ✦ Not financial advice · GRZLY is a prediction and reputation platform
          </p>
        </div>

      </div>
    </div>
  )
}
