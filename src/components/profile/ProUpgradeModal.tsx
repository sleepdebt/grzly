'use client'

interface ProUpgradeModalProps {
  onConfirm: () => void
  onClose: () => void
  loading: boolean
}

export default function ProUpgradeModal({ onConfirm, onClose, loading }: ProUpgradeModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-md mx-4 bg-surface border border-border rounded-lg p-6">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-text transition-colors text-lg leading-none"
        >
          ✕
        </button>

        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-widest bg-accent/10 text-accent border border-accent/25">
              PRO
            </span>
          </div>
          <h2 className="text-lg font-bold text-text">Unlock GRZLY Pro</h2>
          <p className="text-sm text-muted mt-1">
            Connect GRZLY to your AI tools and build on top of the bear book.
          </p>
        </div>

        {/* Features */}
        <ul className="space-y-3 mb-6">
          {[
            {
              title: 'REST API',
              desc: 'Programmatic access to drops, profiles, and leaderboard data via an authenticated v1 API.',
            },
            {
              title: 'MCP Server',
              desc: 'Connect GRZLY directly to Claude, Cursor, or any MCP-compatible AI tool — no code required.',
            },
            {
              title: 'API Key Management',
              desc: 'Generate and revoke up to 5 personal API keys from your profile.',
            },
          ].map(({ title, desc }) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 text-accent flex-shrink-0">↗</span>
              <div>
                <span className="text-sm font-semibold text-text">{title}</span>
                <p className="text-xs text-muted mt-0.5">{desc}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Price + CTA */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div>
            <span className="text-xl font-bold text-text font-mono">$9.99</span>
            <span className="text-xs text-muted ml-1">/ month</span>
          </div>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded border border-accent/40 bg-accent/5 text-accent text-sm font-mono font-bold tracking-wider hover:bg-accent/10 transition-colors disabled:opacity-50"
          >
            {loading ? 'Redirecting...' : 'Continue to checkout →'}
          </button>
        </div>

        <p className="text-[10px] text-muted mt-3 text-center">
          Cancel anytime. Billed monthly via Stripe.
        </p>
      </div>
    </div>
  )
}
