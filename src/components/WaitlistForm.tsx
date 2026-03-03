'use client'

// WaitlistForm — email capture form for the pre-launch waitlist landing page
// source='hero'   → full success lore card
// source='bottom' → inline success text

import { useState } from 'react'

interface WaitlistFormProps {
  source: 'hero' | 'bottom'
}

export default function WaitlistForm({ source }: WaitlistFormProps) {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      setError('Enter a valid email address.')
      return
    }
    setLoading(true)
    setError(null)

    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source }),
    })

    setLoading(false)

    // 201 success or 409 already on list — both show the success state
    if (res.ok || res.status === 409) {
      setSuccess(true)
      return
    }

    const data = await res.json().catch(() => ({}))
    setError(data.error ?? 'Something went wrong. Try again.')
  }

  // ── Success states ──────────────────────────────────────────────────────────

  if (success && source === 'hero') {
    return (
      <div className="max-w-[460px] w-full mx-auto text-center">
        <div className="font-mono text-[13px] text-accent italic leading-[1.7] px-5 py-5 border border-accent/15 rounded-[10px] bg-accent/[0.03] mb-3">
          "Another bear joins the council. The prophecy grows stronger. Your name is inscribed — the Bear Book will know you when the time comes."
        </div>
        <p className="text-[12px] text-[#444]">You're on the list. We'll be in touch before launch.</p>
      </div>
    )
  }

  if (success && source === 'bottom') {
    return (
      <p className="font-mono text-[14px] text-accent py-4">
        ✦ You're on the list. The Bear Book will know you.
      </p>
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-[460px] w-full mx-auto">
      <form onSubmit={handleSubmit}>
        <div className="flex gap-2.5 mb-5">
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(null) }}
            placeholder="your@email.com"
            className={`flex-1 bg-surface border rounded-lg px-[18px] py-[14px] text-[14px] text-text placeholder-[#444] outline-none transition-colors focus:border-accent ${
              error ? 'border-hot' : 'border-border-hl'
            }`}
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-accent text-bg font-mono font-bold text-[13px] tracking-[0.04em] px-7 py-[14px] rounded-lg whitespace-nowrap hover:bg-[#d9ff1a] hover:-translate-y-px transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Joining...' : 'Join the Bear Cult →'}
          </button>
        </div>
        {error && (
          <p className="text-[12px] text-hot text-center -mt-2">{error}</p>
        )}
      </form>

      {source === 'hero' && !error && (
        <p className="text-[12px] text-[#444] text-center">
          No trades. No financial advice. Just conviction on record.
        </p>
      )}
      {source === 'bottom' && !error && (
        <p className="text-[12px] text-[#444] text-center mt-3">
          No trades executed. Not a broker. Not financial advice.
        </p>
      )}
    </div>
  )
}
