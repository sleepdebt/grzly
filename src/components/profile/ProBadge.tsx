'use client'

// Displays PRO badge and upgrade/manage billing button on profile page

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import ProUpgradeModal from './ProUpgradeModal'

interface ProBadgeProps {
  isPro: boolean
  isOwner: boolean
}

export default function ProBadge({ isPro, isOwner }: ProBadgeProps) {
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  async function handleUpgrade() {
    setShowModal(false)
    startTransition(() => setLoading(true))
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (err) {
      console.error(err)
      startTransition(() => setLoading(false))
    }
  }

  async function handleManageBilling() {
    startTransition(() => setLoading(true))
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (err) {
      console.error(err)
      startTransition(() => setLoading(false))
    }
  }

  if (!isOwner) {
    // Non-owners: just show the badge if Pro
    if (!isPro) return null
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-widest bg-accent/10 text-accent border border-accent/25">
        PRO
      </span>
    )
  }

  // Owner view
  if (isPro) {
    return (
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-widest bg-accent/10 text-accent border border-accent/25">
          PRO
        </span>
        <button
          onClick={handleManageBilling}
          disabled={loading}
          className="text-xs text-muted hover:text-text transition-colors font-mono disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Manage billing'}
        </button>
      </div>
    )
  }

  return (
    <>
      {showModal && (
        <ProUpgradeModal
          onConfirm={handleUpgrade}
          onClose={() => setShowModal(false)}
          loading={loading}
        />
      )}
      <button
        onClick={() => setShowModal(true)}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-accent/40 bg-accent/5 text-accent text-xs font-mono font-bold tracking-wider hover:bg-accent/10 transition-colors disabled:opacity-50"
      >
        {loading ? 'Loading...' : '↑ Upgrade to Pro'}
      </button>
    </>
  )
}
