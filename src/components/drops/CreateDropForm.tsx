'use client'

// Drop creation form — 4-step flow
// Visual spec: drop_creation_ui.html
// Steps: 1) Target → 2) Thesis → 3) Terms → 4) Review + lore preview

import { useState, useEffect, useRef } from 'react'
import { CreateDropPayload } from '@/types'

type Step = 1 | 2 | 3 | 4
type EvidenceType = 'metric' | 'news' | 'link' | null

const HORIZONS = [
  { label: '7 days',   value: '7 days',   days: 7   },
  { label: '30 days',  value: '30 days',  days: 30  },
  { label: '90 days',  value: '90 days',  days: 90  },
  { label: '180 days', value: '180 days', days: 180 },
]

const LORE_PHRASES = [
  (t: string) => `The oracle has spoken. $${t} stands at the edge of the precipice — its fundamentals crumbling beneath the weight of its own overpromising. The collective conviction of the bears has been inscribed. What once seemed immovable now trembles.`,
  (t: string) => `In the annals of the Bear Cult, $${t} is marked. The thesis has been born in the fires of skepticism, forged by those who refuse to let hype go unchallenged. The prophecy is live.`,
  (t: string) => `$${t}: the signal appeared in the data before the crowd could see it. Now the Drop lives — a permanent record of conviction, a stake in the ground against the noise.`,
]

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
function fmtDateShort(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative w-10 h-[22px] rounded-full flex-shrink-0 transition-colors ${on ? 'bg-accent' : 'bg-border'}`}
    >
      <span className={`absolute top-[3px] w-4 h-4 bg-white rounded-full transition-all ${on ? 'left-[21px]' : 'left-[3px]'}`} />
    </button>
  )
}

export default function CreateDropForm() {
  const [step, setStep] = useState<Step>(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successDrop, setSuccessDrop] = useState<{ id: string; ticker: string; lore: string } | null>(null)

  // Step 1 — Target
  const [ticker, setTicker] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [tickerValidating, setTickerValidating] = useState(false)
  const [tickerValid, setTickerValid] = useState<boolean | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Step 2 — Thesis
  const [thesis, setThesis] = useState('')
  const [evidenceType, setEvidenceType] = useState<EvidenceType>(null)
  const [evidenceValue, setEvidenceValue] = useState('')
  const [evidenceLinks, setEvidenceLinks] = useState<string[]>([])
  const [linkInput, setLinkInput] = useState('')
  const [creatorNote, setCreatorNote] = useState('')

  // Step 3 — Terms
  const [horizon, setHorizon] = useState('90 days')
  const [resolvesAt, setResolvesAt] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() + 90); return d
  })
  const [targetPriceEnabled, setTargetPriceEnabled] = useState(false)
  const [targetPrice, setTargetPrice] = useState('')

  // Step 4 — Lore preview
  const [lorePreview, setLorePreview] = useState<string | null>(null)
  const [loreGenerating, setLoreGenerating] = useState(false)

  // ── Ticker validation with debounce ───────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (ticker.length === 0) { setTickerValid(null); setCompanyName(''); return }

    debounceRef.current = setTimeout(async () => {
      setTickerValidating(true)
      try {
        const res = await fetch(`/api/tickers/validate?ticker=${ticker}`)
        if (res.ok) {
          const data = await res.json()
          setTickerValid(data.valid)
          setCompanyName(data.companyName ?? '')
        } else {
          setTickerValid(false)
        }
      } catch {
        setTickerValid(false)
      }
      setTickerValidating(false)
    }, 600)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [ticker])

  // ── Horizon selection ─────────────────────────────────────────
  function selectHorizon(value: string, days: number) {
    setHorizon(value)
    const d = new Date(); d.setDate(d.getDate() + days); setResolvesAt(d)
  }

  // ── Step validation ───────────────────────────────────────────
  function validateStep(s: Step): string | null {
    if (s === 1) {
      if (!ticker) return 'Enter a ticker symbol.'
      if (!tickerValid) return `"${ticker}" is not a valid ticker. Check the symbol and try again.`
    }
    if (s === 2) {
      if (thesis.length < 200) return `Thesis needs at least 200 characters (${thesis.length} so far). Make your case.`
      if (!evidenceType) return 'Select at least one type of evidence to support your thesis.'
      if (evidenceType === 'link' && evidenceLinks.length === 0) return 'Add at least one source link.'
      if (evidenceType !== 'link' && !evidenceValue.trim()) return 'Fill in your evidence before continuing.'
    }
    return null
  }

  function goToStep(n: Step) {
    if (n > step) {
      const err = validateStep(step)
      if (err) { setError(err); return }
    }
    setError(null)
    if (n === 4) triggerLorePreview()
    setStep(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Lore preview (UI placeholder — real lore is server-generated) ──
  function triggerLorePreview() {
    setLorePreview(null)
    setLoreGenerating(true)
    setTimeout(() => {
      setLorePreview(LORE_PHRASES[Math.floor(Math.random() * LORE_PHRASES.length)](ticker))
      setLoreGenerating(false)
    }, 1800)
  }

  // ── Submit ────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true)
    setError(null)

    const payload: CreateDropPayload & { creator_note?: string } = {
      ticker,
      thesis,
      financial_metric: (evidenceType === 'metric' || evidenceType === 'news') ? evidenceValue : undefined,
      evidence_links: evidenceType === 'link' && evidenceLinks.length > 0 ? evidenceLinks : undefined,
      time_horizon: horizon as CreateDropPayload['time_horizon'],
      target_price: targetPriceEnabled && targetPrice ? parseFloat(targetPrice) : null,
      is_anonymous: isAnonymous,
      creator_note: creatorNote || undefined,
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
        return
      }
      setSuccessDrop({
        id: data.drop.id,
        ticker: data.drop.ticker,
        lore: data.drop.lore_narrative ?? lorePreview ?? 'The prophecy is written.',
      })
    } catch {
      setError('Network error — please try again')
    }
    setSubmitting(false)
  }

  // ── Success screen ────────────────────────────────────────────
  if (successDrop) {
    return (
      <div className="text-center py-16">
        <div className="text-[56px] mb-6">🐻</div>
        <h2 className="font-mono text-2xl text-accent mb-3">Drop Published.</h2>
        <p className="text-dim text-sm max-w-[400px] mx-auto mb-8 leading-relaxed">
          Your thesis is now live. The lore has been written. Let conviction do the rest.
        </p>
        <div className="lore-block max-w-[520px] mx-auto text-left mb-8 p-6 rounded-xl border border-border bg-surface">
          <div className="font-mono text-[11px] text-accent tracking-[0.12em] uppercase mb-3">
            ${successDrop.ticker} · ACTIVE
          </div>
          <p className="text-sm text-dim italic leading-relaxed">{successDrop.lore}</p>
        </div>
        <div className="flex gap-3 justify-center">
          <a
            href={`/drops/${successDrop.id}`}
            className="px-7 py-3 bg-accent text-bg font-bold rounded-lg text-sm hover:bg-[#d9ff1a] transition-colors"
          >
            View Drop →
          </a>
          <a
            href="/"
            className="px-5 py-3 border border-border text-dim rounded-lg text-sm hover:border-[#3d3d3d] hover:text-text transition-colors"
          >
            Back to Feed
          </a>
        </div>
      </div>
    )
  }

  // ── Shared error callout ──────────────────────────────────────
  const ErrorCallout = () => error ? (
    <div className="mb-4 px-4 py-3 rounded-lg bg-[rgba(255,60,60,0.08)] border border-[rgba(255,60,60,0.3)] text-[#ff8080] text-sm">
      {error}
    </div>
  ) : null

  // ── Shared form nav ───────────────────────────────────────────
  function FormNav({ onBack, onNext, nextLabel, nextDisabled }: {
    onBack?: () => void
    onNext: () => void
    nextLabel: string
    nextDisabled?: boolean
  }) {
    return (
      <div className="flex justify-between items-center mt-10 pt-6 border-t border-border">
        {onBack ? (
          <button
            onClick={onBack}
            className="px-6 py-3 border border-border text-dim rounded-lg text-sm font-medium hover:border-[#3d3d3d] hover:text-text transition-colors"
          >
            ← Back
          </button>
        ) : <div />}
        <button
          onClick={onNext}
          disabled={nextDisabled}
          className="px-8 py-3 bg-accent text-bg font-bold rounded-lg text-sm disabled:bg-border disabled:text-dim disabled:cursor-not-allowed hover:bg-[#d9ff1a] transition-colors"
        >
          {nextLabel}
        </button>
      </div>
    )
  }

  return (
    <div>

      {/* ── Step tabs ── */}
      <div className="flex border border-border rounded-lg overflow-hidden mb-10">
        {([
          [1, 'Target'],
          [2, 'Thesis'],
          [3, 'Terms'],
          [4, 'Review'],
        ] as [Step, string][]).map(([s, label]) => (
          <div
            key={s}
            className={`flex-1 flex items-center gap-2.5 px-4 py-3 border-r border-border last:border-r-0 transition-colors ${
              step === s ? 'bg-surface-2' : 'bg-surface'
            }`}
          >
            <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold font-mono flex-shrink-0 transition-colors ${
              step > s ? 'bg-accent text-bg' : step === s ? 'bg-accent text-bg' : 'bg-border text-dim'
            }`}>
              {s}
            </div>
            <span className={`text-xs font-medium ${step === s ? 'text-text' : 'text-dim'}`}>{label}</span>
          </div>
        ))}
      </div>

      {/* ════════════════════════════════════════
          STEP 1 — TARGET
      ════════════════════════════════════════ */}
      {step === 1 && (
        <div>

          {/* Ticker */}
          <div className="mb-7">
            <label className="block text-[13px] font-semibold text-text tracking-[0.02em] mb-2">Ticker</label>
            <p className="text-xs text-dim mb-3 leading-relaxed">Enter the NYSE or NASDAQ ticker you're bearish on.</p>
            <div className="flex gap-3 items-center">
              <div className="relative w-[160px] flex-shrink-0">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-accent font-mono font-bold text-sm pointer-events-none">$</span>
                <input
                  type="text"
                  value={ticker}
                  onChange={e => setTicker(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                  placeholder="TSLA"
                  maxLength={6}
                  className="w-full bg-surface border border-border text-text pl-7 pr-3 py-3 rounded-lg font-mono font-bold text-[15px] tracking-[0.06em] focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div className={`flex-1 px-3.5 py-3 bg-surface border border-border rounded-lg text-sm ${
                companyName ? 'text-text' : 'text-dim italic'
              }`}>
                {tickerValidating
                  ? 'Validating...'
                  : companyName
                  ? companyName
                  : tickerValid === false
                  ? <span className="text-[#ff3c3c] not-italic">Ticker not found</span>
                  : '— enter ticker —'
                }
              </div>
            </div>
          </div>

          {/* Attribution */}
          <div className="mb-7">
            <label className="block text-[13px] font-semibold text-text tracking-[0.02em] mb-2">Attribution</label>
            <div className="flex items-center gap-3.5 px-4 py-3.5 bg-surface border border-border rounded-lg">
              <Toggle on={isAnonymous} onToggle={() => setIsAnonymous(!isAnonymous)} />
              <div>
                <div className="text-[13px] font-semibold text-text">
                  {isAnonymous ? 'Anonymous' : 'Attributed (default)'}
                </div>
                <div className="text-xs text-dim mt-0.5">
                  {isAnonymous
                    ? 'This Drop will NOT count toward your Vibelord accuracy score.'
                    : 'This Drop counts toward your Vibelord accuracy score.'}
                </div>
              </div>
            </div>
          </div>

          <ErrorCallout />
          <FormNav
            onNext={() => goToStep(2)}
            nextLabel="Thesis →"
            nextDisabled={!tickerValid}
          />
        </div>
      )}

      {/* ════════════════════════════════════════
          STEP 2 — THESIS
      ════════════════════════════════════════ */}
      {step === 2 && (
        <div>

          {/* Thesis textarea */}
          <div className="mb-7">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-semibold text-text">Your Thesis</label>
              <span className="text-xs text-muted font-mono">200–2000 chars</span>
            </div>
            <p className="text-xs text-dim mb-3 leading-relaxed">
              What's the argument? Be specific. Vague bearishness is noise — make your case.
            </p>
            <textarea
              value={thesis}
              onChange={e => setThesis(e.target.value)}
              placeholder={`e.g. NVDA's data center revenue growth is decelerating faster than consensus expects. Hyperscaler capex guidance has been revised down two quarters in a row, and inventory correction signals are visible in the supply chain. The current multiple of 35x forward earnings leaves zero room for a miss...`}
              rows={6}
              maxLength={2000}
              className="w-full bg-surface border border-border text-text px-3.5 py-3 rounded-lg text-sm leading-relaxed focus:outline-none focus:border-accent transition-colors resize-y"
            />
            <div className={`text-right text-[11px] mt-1 font-mono ${
              thesis.length > 1800 ? 'text-[#ff3c3c]' : thesis.length >= 200 ? 'text-accent-dim' : 'text-muted'
            }`}>
              {thesis.length} / 2000
            </div>
          </div>

          {/* Evidence chips */}
          <div className="mb-7">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-semibold text-text">Evidence</label>
              <span className="text-xs text-muted">At least one required</span>
            </div>
            <p className="text-xs text-dim mb-3 leading-relaxed">
              Support your thesis with at least one of the following.
            </p>
            <div className="flex gap-2.5 mb-4">
              {([
                ['metric', '📊', 'Financial Metric'],
                ['news',   '📰', 'News Event'],
                ['link',   '🔗', 'Source Link'],
              ] as [EvidenceType, string, string][]).map(([type, icon, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => { setEvidenceType(type); setEvidenceValue(''); setEvidenceLinks([]); setLinkInput('') }}
                  className={`flex-1 px-3.5 py-2.5 border rounded-lg text-center text-xs font-medium transition-all ${
                    evidenceType === type
                      ? 'border-accent text-accent bg-[rgba(200,255,0,0.05)]'
                      : 'border-border text-dim hover:border-[#3d3d3d] hover:text-text bg-surface'
                  }`}
                >
                  <span className="block text-lg mb-1">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
            {evidenceType === 'metric' && (
              <input
                type="text"
                value={evidenceValue}
                onChange={e => setEvidenceValue(e.target.value)}
                placeholder="e.g. P/E ratio 120x vs sector avg 22x"
                className="w-full bg-surface border border-border text-text px-3.5 py-3 rounded-lg text-sm focus:outline-none focus:border-accent transition-colors"
              />
            )}
            {evidenceType === 'news' && (
              <input
                type="text"
                value={evidenceValue}
                onChange={e => setEvidenceValue(e.target.value)}
                placeholder="e.g. Q3 earnings miss, CFO departure announced Oct 2025"
                className="w-full bg-surface border border-border text-text px-3.5 py-3 rounded-lg text-sm focus:outline-none focus:border-accent transition-colors"
              />
            )}
            {evidenceType === 'link' && (
              <div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={linkInput}
                    onChange={e => setLinkInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const url = linkInput.trim()
                        if (url && !evidenceLinks.includes(url)) {
                          setEvidenceLinks([...evidenceLinks, url])
                          setLinkInput('')
                        }
                      }
                    }}
                    placeholder="https://..."
                    className="flex-1 bg-surface border border-border text-text px-3.5 py-3 rounded-lg text-sm focus:outline-none focus:border-accent transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const url = linkInput.trim()
                      if (url && !evidenceLinks.includes(url)) {
                        setEvidenceLinks([...evidenceLinks, url])
                        setLinkInput('')
                      }
                    }}
                    disabled={!linkInput.trim()}
                    className="px-4 py-3 bg-surface border border-border text-dim rounded-lg text-sm font-medium hover:border-[#3d3d3d] hover:text-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
                {evidenceLinks.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {evidenceLinks.map((link, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-border rounded-lg">
                        <span className="text-[#555] text-xs flex-shrink-0">↗</span>
                        <span className="text-xs text-text-dim flex-1 truncate">{link}</span>
                        <button
                          type="button"
                          onClick={() => setEvidenceLinks(evidenceLinks.filter((_, j) => j !== i))}
                          className="text-[#555] hover:text-[#ff3c3c] text-xs transition-colors flex-shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Creator note */}
          <div className="mb-7">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-semibold text-text">Creator Note</label>
              <span className="text-xs text-muted">Optional · max 500 chars</span>
            </div>
            <p className="text-xs text-dim mb-3 leading-relaxed">
              Plain-text annotation displayed alongside the Drop — separate from the AI lore narrative, which is immutable.
            </p>
            <textarea
              value={creatorNote}
              onChange={e => setCreatorNote(e.target.value)}
              placeholder="Optional: context you want to add in your own words..."
              rows={2}
              maxLength={500}
              className="w-full bg-surface border border-border text-text px-3.5 py-3 rounded-lg text-sm focus:outline-none focus:border-accent transition-colors resize-none"
            />
            <div className="text-right text-[11px] mt-1 font-mono text-muted">{creatorNote.length} / 500</div>
          </div>

          <ErrorCallout />
          <FormNav
            onBack={() => goToStep(1)}
            onNext={() => goToStep(3)}
            nextLabel="Terms →"
          />
        </div>
      )}

      {/* ════════════════════════════════════════
          STEP 3 — TERMS
      ════════════════════════════════════════ */}
      {step === 3 && (
        <div>

          {/* Time horizon */}
          <div className="mb-7">
            <label className="block text-[13px] font-semibold text-text mb-2">Time Horizon</label>
            <p className="text-xs text-dim mb-3 leading-relaxed">
              Your Drop resolves automatically at this date. You get one extension (SWAYZE) before it closes.
            </p>
            <div className="flex gap-2.5 flex-wrap">
              {HORIZONS.map(h => (
                <button
                  key={h.value}
                  type="button"
                  onClick={() => selectHorizon(h.value, h.days)}
                  className={`px-5 py-2.5 border rounded-full text-[13px] font-medium font-mono transition-all ${
                    horizon === h.value
                      ? 'border-accent text-accent bg-[rgba(200,255,0,0.05)]'
                      : 'border-border text-dim hover:border-[#3d3d3d] hover:text-text bg-surface'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
            <div className="mt-3 text-xs text-dim font-mono">
              Resolves: <strong className="text-text">{fmtDate(resolvesAt)}</strong>
            </div>
          </div>

          {/* Target price */}
          <div className="mb-7">
            <label className="block text-[13px] font-semibold text-text mb-2">What Counts as Correct?</label>
            <p className="text-xs text-dim mb-3 leading-relaxed">
              Default: any net decline from your publish price = correct. Or set a specific price target.
            </p>
            <div className="flex items-center gap-2.5">
              <Toggle on={targetPriceEnabled} onToggle={() => setTargetPriceEnabled(!targetPriceEnabled)} />
              <span className="text-[13px] text-dim">
                {targetPriceEnabled
                  ? 'Correct only if price reaches or falls below target'
                  : 'Use default — any decline = correct'}
              </span>
            </div>
            {targetPriceEnabled && (
              <div className="flex items-center gap-3 mt-3.5">
                <span className="text-sm text-dim">Target price ($)</span>
                <input
                  type="text"
                  value={targetPrice}
                  onChange={e => setTargetPrice(e.target.value)}
                  placeholder="e.g. 180.00"
                  className="w-[160px] bg-surface border border-border text-text px-3.5 py-2.5 rounded-lg text-sm focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            )}
          </div>

          <ErrorCallout />
          <FormNav
            onBack={() => goToStep(2)}
            onNext={() => goToStep(4)}
            nextLabel="Review →"
          />
        </div>
      )}

      {/* ════════════════════════════════════════
          STEP 4 — REVIEW
      ════════════════════════════════════════ */}
      {step === 4 && (
        <div>

          {/* Target */}
          <div className="bg-surface border border-border rounded-xl p-5 mb-4">
            <h3 className="font-mono text-[11px] text-muted tracking-[0.12em] uppercase mb-3">Target</h3>
            <div className="font-mono text-[26px] font-bold text-accent">${ticker}</div>
            <div className="text-sm text-dim mt-1">{companyName}</div>
          </div>

          {/* Thesis */}
          <div className="bg-surface border border-border rounded-xl p-5 mb-4">
            <h3 className="font-mono text-[11px] text-muted tracking-[0.12em] uppercase mb-3">Thesis</h3>
            <p className="text-sm text-text leading-relaxed">
              {thesis.slice(0, 280)}{thesis.length > 280 ? '...' : ''}
            </p>
            {evidenceType && (
              <div className="mt-3 pt-3 border-t border-border">
                {evidenceType === 'link' ? (
                  <div className="space-y-1">
                    {evidenceLinks.map((link, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-dim font-mono">
                        <span className="text-[#555]">↗</span>
                        <span className="truncate">{link}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 border border-border rounded text-xs font-mono text-dim">
                    {evidenceType === 'metric' ? '📊' : '📰'} {evidenceValue}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Terms */}
          <div className="bg-surface border border-border rounded-xl p-5 mb-4">
            <h3 className="font-mono text-[11px] text-muted tracking-[0.12em] uppercase mb-3">Terms</h3>
            <div className="flex gap-5 flex-wrap">
              <span className="text-sm text-dim font-mono">Horizon: <strong className="text-text">{horizon}</strong></span>
              <span className="text-sm text-dim font-mono">Resolves: <strong className="text-text">{fmtDateShort(resolvesAt)}</strong></span>
              <span className="text-sm text-dim font-mono">
                Correct if: <strong className="text-text">
                  {targetPriceEnabled && targetPrice ? `price ≤ $${targetPrice}` : 'any decline'}
                </strong>
              </span>
              <span className="text-sm text-dim font-mono">Attribution: <strong className="text-text">{isAnonymous ? 'Anonymous' : 'Attributed'}</strong></span>
            </div>
          </div>

          {/* Lore preview */}
          <div className="bg-surface border border-border rounded-xl p-5 mb-4">
            <h3 className="font-mono text-[11px] text-muted tracking-[0.12em] uppercase mb-3">Lore Narrative</h3>
            <div className="lore-block rounded-lg p-5">
              <div className="font-mono text-[10px] text-accent tracking-[0.15em] uppercase mb-3">
                ✦ AI-generated · immutable after publish
              </div>
              {loreGenerating ? (
                <div className="text-sm text-muted italic flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 border-2 border-border border-t-accent rounded-full animate-spin" />
                  Generating lore narrative...
                </div>
              ) : (
                <p className="text-sm text-dim italic leading-relaxed">{lorePreview}</p>
              )}
            </div>
          </div>

          {/* Conviction + Bear Book info */}
          <div className="bg-surface border border-border rounded-xl p-5 mb-4">
            <h3 className="font-mono text-[11px] text-muted tracking-[0.12em] uppercase mb-2">Conviction Score</h3>
            <p className="text-sm text-muted">Starts at 0 votes. Conviction score populates once your Drop goes live.</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-5 mb-4">
            <h3 className="font-mono text-[11px] text-muted tracking-[0.12em] uppercase mb-2">Bear Book</h3>
            <p className="text-sm text-muted">This Drop will be archived here automatically on its resolution date.</p>
          </div>

          <p className="text-[11px] text-muted text-center leading-relaxed mt-5">
            By publishing, you confirm this Drop is your genuine research-based conviction.<br />
            GRZLY content is not financial advice. Not an offer to buy or sell securities.
          </p>

          {error && (
            <div className="mt-4 px-4 py-3 rounded-lg bg-[rgba(255,60,60,0.08)] border border-[rgba(255,60,60,0.3)] text-[#ff8080] text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-between items-center mt-6 pt-6 border-t border-border">
            <button
              onClick={() => goToStep(3)}
              className="px-6 py-3 border border-border text-dim rounded-lg text-sm font-medium hover:border-[#3d3d3d] hover:text-text transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || loreGenerating}
              className="px-10 py-3.5 bg-accent text-bg font-mono font-bold text-[15px] tracking-[0.05em] rounded-lg disabled:bg-border disabled:text-muted disabled:cursor-not-allowed hover:bg-[#d9ff1a] hover:-translate-y-px transition-all"
            >
              {submitting ? 'Publishing...' : '⚡ Publish Drop'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
