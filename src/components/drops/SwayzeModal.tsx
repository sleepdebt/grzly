'use client'

// SwayzeModal — Drop extension modal
//
// Triggered by the "SWAYZE" button on the Drop detail page.
// Only visible to the Drop creator.
// One extension per Drop, ever — button is replaced with locked state after use.

import { useState, useEffect, useRef } from 'react'
import { SwayzeReason } from '@/types'

interface Reason {
  value: SwayzeReason
  label: string
  description: string
}

const REASONS: Reason[] = [
  {
    value: 'catalyst_delayed',
    label: 'Catalyst delayed',
    description: 'The event I was waiting for has been pushed back. My thesis is unchanged.',
  },
  {
    value: 'timing_off',
    label: 'Timing off — thesis intact',
    description: 'My fundamental argument holds. I misjudged the timeline.',
  },
  {
    value: 'new_information',
    label: 'New information extends timeline',
    description: 'Something has changed that gives the thesis more runway, not less.',
  },
]

interface SwayzeModalProps {
  dropId: string
  ticker: string
  currentResolvesAt: string
  onExtended: (newResolvesAt: string, reason: SwayzeReason) => void
  onClose: () => void
}

export interface SwayzeButtonProps {
  dropId: string
  ticker: string
  currentResolvesAt: string
  wasExtended: boolean
  isCreator: boolean
  onExtended?: (newResolvesAt: string, reason: SwayzeReason) => void
}

// ─── Modal ────────────────────────────────────────────────────

function Modal({ dropId, ticker, currentResolvesAt, onExtended, onClose }: SwayzeModalProps) {
  const [selectedReason, setSelectedReason] = useState<SwayzeReason | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function handleConfirm() {
    if (!selectedReason || loading) return
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/drops/${dropId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: selectedReason }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Failed to invoke SWAYZE. Please try again.')
      setLoading(false)
      return
    }

    onExtended(data.drop.extended_resolves_at, selectedReason)
  }

  const resolvesDate = new Date(currentResolvesAt).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="relative bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden">

        {/* Orange gradient top bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-swayze via-swayze/50 to-transparent" />

        <div className="p-6">

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono text-[11px] font-bold tracking-[0.15em] uppercase px-2.5 py-1 bg-swayze/15 text-swayze rounded border border-swayze/30">
                SWAYZE
              </span>
              <span className="font-mono font-bold text-text">${ticker}</span>
            </div>
            <h2 className="text-lg font-bold text-text mb-1.5">Invoke SWAYZE</h2>
            <p className="text-sm text-dim leading-relaxed">
              Extend your Drop beyond its original horizon. You can only do this once.
              Your reason is permanent and public.
            </p>
          </div>

          {/* Current resolution date */}
          <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-lg px-4 py-3 mb-6 text-sm">
            <span className="text-dim">Currently resolves:</span>
            <span className="font-mono text-text font-medium">{resolvesDate}</span>
            <span className="text-muted ml-auto text-xs">→ horizon doubles</span>
          </div>

          {/* Reason selection */}
          <p className="font-mono text-[10px] text-muted tracking-[0.12em] uppercase mb-3">
            Why are you extending? (required)
          </p>
          <div className="space-y-2 mb-6">
            {REASONS.map(reason => (
              <button
                key={reason.value}
                onClick={() => setSelectedReason(reason.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                  selectedReason === reason.value
                    ? 'border-swayze bg-swayze/10'
                    : 'border-border bg-surface hover:border-[#3d3d3d]'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-1">
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    selectedReason === reason.value ? 'border-swayze' : 'border-muted'
                  }`}>
                    {selectedReason === reason.value && (
                      <div className="w-1.5 h-1.5 rounded-full bg-swayze" />
                    )}
                  </div>
                  <span className="text-sm font-semibold text-text">{reason.label}</span>
                </div>
                <p className="text-xs text-dim ml-6 leading-relaxed">{reason.description}</p>
              </button>
            ))}
          </div>

          {/* Accuracy weight warning */}
          <div className="flex gap-3 items-start bg-swayze/5 border border-swayze/20 rounded-lg px-4 py-3 mb-6">
            <span className="text-swayze text-base flex-shrink-0 mt-px">⚠</span>
            <p className="text-xs text-dim leading-relaxed">
              If this Drop resolves correctly after extension, it counts at{' '}
              <strong className="text-text">0.85×</strong> accuracy weight instead of 1.0×.
              An on-time correct call is worth more.
            </p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-[rgba(255,60,60,0.08)] border border-[rgba(255,60,60,0.3)] text-[#ff8080] text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-border text-dim rounded-lg text-sm font-medium hover:border-[#3d3d3d] hover:text-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedReason || loading}
              className="flex-1 py-3 bg-swayze text-bg font-bold rounded-lg text-sm tracking-wide disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#ffaa2e] transition-colors"
            >
              {loading ? 'Invoking...' : '⚡ Invoke SWAYZE'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Public: SWAYZE Button + Modal controller ─────────────────

export default function SwayzeButton({
  dropId,
  ticker,
  currentResolvesAt,
  wasExtended,
  isCreator,
  onExtended,
}: SwayzeButtonProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [extended, setExtended] = useState(wasExtended)
  const [extendedReason, setExtendedReason] = useState<SwayzeReason | null>(null)

  if (!isCreator) return null

  if (extended) {
    return (
      <div className="relative border border-swayze/30 rounded-lg p-4 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-swayze/60 to-transparent" />
        <p className="font-mono text-[11px] text-swayze tracking-[0.12em] uppercase mb-1">
          SWAYZE invoked
        </p>
        {extendedReason && (
          <p className="text-xs text-dim">
            {REASONS.find(r => r.value === extendedReason)?.label}
          </p>
        )}
      </div>
    )
  }

  function handleExtended(newResolvesAt: string, reason: SwayzeReason) {
    setModalOpen(false)
    if (newResolvesAt) {
      setExtended(true)
      setExtendedReason(reason)
      onExtended?.(newResolvesAt, reason)
    }
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="w-full py-2.5 border border-swayze/60 text-swayze font-semibold rounded-lg text-sm tracking-wide hover:bg-swayze hover:text-bg hover:border-swayze transition-all text-center"
      >
        ⚡ Invoke SWAYZE
      </button>

      {modalOpen && (
        <Modal
          dropId={dropId}
          ticker={ticker}
          currentResolvesAt={currentResolvesAt}
          onExtended={handleExtended}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
