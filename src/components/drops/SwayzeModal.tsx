'use client'

// SwayzeModal — Drop extension modal
//
// Triggered by the "SWAYZE" button in the Drop detail sidebar.
// Only visible to the Drop creator.
// Requires exactly one reason to be selected before confirming.
// One extension per Drop, ever — the button is replaced after use.
//
// Visual spec: feed_and_detail.html — SWAYZE modal

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
  currentResolvesAt: string          // shown so creator knows what they're extending from
  onExtended: (newResolvesAt: string, reason: SwayzeReason) => void
}

interface SwayzeButtonProps {
  dropId: string
  ticker: string
  currentResolvesAt: string
  wasExtended: boolean                // if true, show locked state instead
  isCreator: boolean                  // if false, don't render at all
  onExtended: (newResolvesAt: string, reason: SwayzeReason) => void
}

// ─── Modal ────────────────────────────────────────────────────

function Modal({ dropId, ticker, currentResolvesAt, onExtended }: SwayzeModalProps & { onClose: () => void }) {
  const [selectedReason, setSelectedReason] = useState<SwayzeReason | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onExtended('', 'timing_off') // signals close without action
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onExtended])

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

    const newResolvesAt = data.drop.extended_resolves_at
    onExtended(newResolvesAt, selectedReason)
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onExtended('', 'timing_off') }}
    >
      <div className="bg-surface border border-border rounded-xl w-full max-w-md p-6 shadow-2xl">

        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 bg-swayze/15 text-swayze rounded font-semibold uppercase tracking-wide">
              SWAYZE
            </span>
            <span className="font-mono font-bold">${ticker}</span>
          </div>
          <h2 className="text-base font-semibold">Invoke SWAYZE</h2>
          <p className="text-sm text-muted mt-1">
            Extend your Drop beyond its original horizon. You can only do this once.
            Your reason is permanent and public.
          </p>
        </div>

        {/* Current resolution date */}
        <div className="bg-surface-2 rounded p-3 mb-5 text-sm">
          <span className="text-muted">Currently resolves: </span>
          <span className="font-mono">
            {new Date(currentResolvesAt).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric'
            })}
          </span>
          <span className="text-muted ml-2">→ will double the remaining horizon</span>
        </div>

        {/* Reason selection */}
        <p className="text-xs text-muted uppercase tracking-wide font-semibold mb-3">
          Why are you extending? (required)
        </p>
        <div className="space-y-2 mb-5">
          {REASONS.map(reason => (
            <button
              key={reason.value}
              onClick={() => setSelectedReason(reason.value)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedReason === reason.value
                  ? 'border-swayze bg-swayze/10'
                  : 'border-border hover:border-muted'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selectedReason === reason.value
                    ? 'border-swayze'
                    : 'border-muted'
                }`}>
                  {selectedReason === reason.value && (
                    <div className="w-1.5 h-1.5 rounded-full bg-swayze" />
                  )}
                </div>
                <span className="text-sm font-medium">{reason.label}</span>
              </div>
              <p className="text-xs text-muted ml-5">{reason.description}</p>
            </button>
          ))}
        </div>

        {/* Accuracy warning */}
        <div className="bg-surface-2 border border-border rounded p-3 mb-5 text-xs text-muted">
          ⚠️ If this Drop resolves correctly after extension, it will count at{' '}
          <strong className="text-text">0.85×</strong> accuracy weight instead of 1.0×.
          An on-time correct call is worth more.
        </div>

        {error && (
          <p className="text-hot text-sm mb-4">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => onExtended('', 'timing_off')}
            className="flex-1 py-2.5 border border-border text-muted rounded text-sm hover:text-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedReason || loading}
            className="flex-1 py-2.5 bg-swayze text-bg font-semibold rounded text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {loading ? 'Invoking...' : 'Invoke SWAYZE →'}
          </button>
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
      <div className="border border-swayze/30 rounded-lg p-3 text-center">
        <p className="text-xs text-swayze font-semibold">SWAYZE invoked</p>
        {extendedReason && (
          <p className="text-xs text-muted mt-0.5">
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
      onExtended(newResolvesAt, reason)
    }
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="w-full py-2.5 border border-swayze text-swayze font-semibold rounded text-sm hover:bg-swayze hover:text-bg transition-colors text-center"
      >
        Invoke SWAYZE
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
