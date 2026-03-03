'use client'

// Drop creation form — 4-step flow
// Full visual spec in drop_creation_ui.html
// Steps: 1) Target (ticker) → 2) Thesis → 3) Terms → 4) Review + lore preview

import { useState } from 'react'
import { CreateDropPayload } from '@/types'

type Step = 1 | 2 | 3 | 4

const HORIZONS = [
  { label: '7 days', value: '7 days' },
  { label: '1 month', value: '30 days' },
  { label: '3 months', value: '90 days' },
  { label: '6 months', value: '180 days' },
]

export default function CreateDropForm() {
  const [step, setStep] = useState<Step>(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loreLoading, setLoreLoading] = useState(false)
  const [successDrop, setSuccessDrop] = useState<{ id: string; lore: string } | null>(null)

  // Form state
  const [ticker, setTicker] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [thesis, setThesis] = useState('')
  const [financialMetric, setFinancialMetric] = useState('')
  const [evidenceLinks, setEvidenceLinks] = useState('')
  const [horizon, setHorizon] = useState('30 days')
  const [targetPrice, setTargetPrice] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)

  // Ticker validation
  const [tickerValidating, setTickerValidating] = useState(false)
  const [tickerValid, setTickerValid] = useState<boolean | null>(null)

  async function handleTickerChange(value: string) {
    const upper = value.toUpperCase().replace(/[^A-Z]/g, '')
    setTicker(upper)
    setTickerValid(null)
    setCompanyName('')

    if (upper.length >= 1) {
      setTickerValidating(true)
      const res = await fetch(`/api/tickers/validate?ticker=${upper}`)
      if (res.ok) {
        const data = await res.json()
        setTickerValid(data.valid)
        if (data.companyName) setCompanyName(data.companyName)
      }
      setTickerValidating(false)
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    setLoreLoading(true)

    const payload: CreateDropPayload = {
      ticker,
      thesis,
      financial_metric: financialMetric || undefined,
      evidence_links: evidenceLinks
        ? evidenceLinks.split('\n').map(l => l.trim()).filter(Boolean)
        : undefined,
      time_horizon: horizon as CreateDropPayload['time_horizon'],
      target_price: targetPrice ? parseFloat(targetPrice) : null,
      is_anonymous: isAnonymous,
    }

    try {
      const res = await fetch('/api/drops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to create Drop')
        setSubmitting(false)
        setLoreLoading(false)
        return
      }

      setSuccessDrop({
        id: data.drop.id,
        lore: data.drop.lore_narrative ?? 'The prophecy is being written...',
      })
    } catch (err) {
      setError('Network error — please try again')
    }

    setSubmitting(false)
    setLoreLoading(false)
  }

  // Success screen
  if (successDrop) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">🐻</div>
        <h2 className="text-xl font-semibold mb-2">The Drop is live.</h2>
        <p className="text-muted text-sm mb-6 italic border-l-2 border-accent pl-4 text-left">
          {successDrop.lore}
        </p>
        <div className="flex gap-3 justify-center">
          <a
            href={`/drops/${successDrop.id}`}
            className="px-4 py-2 bg-accent text-bg font-semibold rounded text-sm hover:opacity-90"
          >
            View Drop →
          </a>
          <a href="/" className="px-4 py-2 border border-border text-muted rounded text-sm hover:text-text">
            Back to Feed
          </a>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 text-xs text-muted">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold ${
              step === s ? 'bg-accent text-bg' : step > s ? 'bg-surface-2 text-muted' : 'bg-surface text-muted'
            }`}>
              {s}
            </div>
            {s < 4 && <div className={`w-8 h-px ${step > s ? 'bg-accent' : 'bg-border'}`} />}
          </div>
        ))}
        <span className="ml-2">
          {step === 1 && 'Target'}
          {step === 2 && 'Thesis'}
          {step === 3 && 'Terms'}
          {step === 4 && 'Review'}
        </span>
      </div>

      {/* Step 1: Target */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Ticker Symbol</label>
            <input
              type="text"
              value={ticker}
              onChange={e => handleTickerChange(e.target.value)}
              placeholder="TSLA"
              maxLength={5}
              className="w-full bg-surface border border-border rounded px-3 py-2 font-mono text-lg uppercase focus:outline-none focus:border-accent transition-colors"
            />
            {tickerValidating && <p className="text-xs text-muted mt-1">Validating...</p>}
            {tickerValid === true && (
              <p className="text-xs text-correct mt-1">✓ {companyName}</p>
            )}
            {tickerValid === false && (
              <p className="text-xs text-hot mt-1">Ticker not found. Check the symbol and try again.</p>
            )}
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!tickerValid}
            className="w-full py-2.5 bg-accent text-bg font-semibold rounded text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            Continue →
          </button>
        </div>
      )}

      {/* Step 2: Thesis */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium">Short Thesis</label>
              <span className={`text-xs ${thesis.length >= 200 ? 'text-correct' : 'text-muted'}`}>
                {thesis.length} / 2000 chars (200 min)
              </span>
            </div>
            <textarea
              value={thesis}
              onChange={e => setThesis(e.target.value)}
              placeholder="Make the case. What's wrong with this company? Be specific."
              rows={6}
              maxLength={2000}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Financial Metric (optional but recommended)</label>
            <input
              type="text"
              value={financialMetric}
              onChange={e => setFinancialMetric(e.target.value)}
              placeholder="e.g. P/E ratio 120x vs sector avg 22x"
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Evidence Links (one per line)</label>
            <textarea
              value={evidenceLinks}
              onChange={e => setEvidenceLinks(e.target.value)}
              placeholder="https://sec.gov/..."
              rows={3}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Time Horizon</label>
            <div className="flex gap-2">
              {HORIZONS.map(h => (
                <button
                  key={h.value}
                  onClick={() => setHorizon(h.value)}
                  className={`flex-1 py-2 rounded text-sm transition-colors ${
                    horizon === h.value
                      ? 'bg-accent text-bg font-semibold'
                      : 'bg-surface border border-border text-muted hover:text-text'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="text-muted text-sm hover:text-text">← Back</button>
            <button
              onClick={() => setStep(3)}
              disabled={thesis.length < 200 || (!financialMetric && !evidenceLinks)}
              className="px-6 py-2 bg-accent text-bg font-semibold rounded text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Terms + Attribution */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={e => setIsAnonymous(e.target.checked)}
                className="mt-0.5 accent-accent"
              />
              <div>
                <div className="text-sm font-medium">Publish anonymously</div>
                <div className="text-xs text-muted mt-0.5">
                  Anonymous Drops do not count toward your Vibelord accuracy score.
                  Attribution builds your track record.
                </div>
              </div>
            </label>
          </div>

          <div className="bg-surface border border-border rounded p-4 text-xs text-muted space-y-2">
            <p>This Drop is general research and community opinion. It is not financial advice, not a recommendation to buy or sell any security, and does not constitute an offer or solicitation.</p>
            <p>You affirm that you have no undisclosed material non-public information about this company. GRZLY does not place or facilitate trades on your behalf.</p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={e => setTermsAccepted(e.target.checked)}
              className="mt-0.5 accent-accent"
            />
            <div className="text-sm">
              I understand this is not financial advice and I agree to GRZLY&apos;s Terms of Use.
            </div>
          </label>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="text-muted text-sm hover:text-text">← Back</button>
            <button
              onClick={() => setStep(4)}
              disabled={!termsAccepted}
              className="px-6 py-2 bg-accent text-bg font-semibold rounded text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
            >
              Review →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <div className="space-y-5">
          <div className="border border-border rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-muted text-xs uppercase tracking-wide">Ticker</span>
              <span className="font-mono font-bold">${ticker} — {companyName}</span>
            </div>
            <div>
              <span className="text-muted text-xs uppercase tracking-wide">Thesis</span>
              <p className="text-sm mt-1">{thesis.slice(0, 200)}{thesis.length > 200 ? '...' : ''}</p>
            </div>
            <div className="flex justify-between">
              <span className="text-muted text-xs uppercase tracking-wide">Horizon</span>
              <span className="text-sm">{horizon}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted text-xs uppercase tracking-wide">Attribution</span>
              <span className="text-sm">{isAnonymous ? 'Anonymous' : 'Public'}</span>
            </div>
          </div>

          {error && (
            <p className="text-hot text-sm">{error}</p>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep(3)} className="text-muted text-sm hover:text-text">← Back</button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2.5 bg-accent text-bg font-semibold rounded text-sm disabled:opacity-60 hover:opacity-90"
            >
              {submitting ? 'Publishing...' : 'Publish Drop →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
