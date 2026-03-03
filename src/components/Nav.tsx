'use client'

// Global nav — 3-column layout matching feed_and_detail.html prototype
// Logo (lime mono) | center tabs with active state | right actions

import { usePathname } from 'next/navigation'

interface NavProps {
  user: { id: string } | null
  username: string | null
}

const NAV_TABS = [
  { href: '/', label: 'Feed' },
  { href: '/bear-book', label: 'Bear Book' },
  { href: '/faq', label: 'FAQ' },
]

export default function Nav({ user, username }: NavProps) {
  const pathname = usePathname()

  // Waitlist landing page has its own inline nav
  if (pathname === '/waitlist' || pathname.startsWith('/auth/')) return null

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg">
      <div className="max-w-5xl mx-auto px-8 h-[57px] flex items-center justify-between gap-8">

        {/* Logo */}
        <a
          href="/"
          className="font-mono font-bold text-xl tracking-[0.08em] text-accent shrink-0"
        >
          GRZLY<span className="text-[#555]">.</span>
        </a>

        {/* Center tabs */}
        <nav className="flex items-center gap-1">
          {NAV_TABS.map(({ href, label }) => {
            const active = pathname === href
            return (
              <a
                key={href}
                href={href}
                className={`px-4 py-[7px] rounded text-[13px] font-medium transition-colors border ${
                  active
                    ? 'text-text border-border bg-surface'
                    : 'text-text-dim hover:text-text border-transparent'
                }`}
              >
                {label}
              </a>
            )
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {user ? (
            <>
              <a
                href="/drops/create"
                className="px-[18px] py-2 bg-accent text-bg font-bold rounded text-[13px] tracking-[0.02em] hover:bg-[#d9ff1a] transition-colors"
              >
                Drop a thesis
              </a>
              {username && (
                <a
                  href={`/profile/${username}`}
                  className="w-8 h-8 rounded-full bg-surface-2 border border-border flex items-center justify-center font-mono text-xs text-accent font-bold hover:border-border-hl transition-colors"
                  title={`@${username}`}
                >
                  {username.slice(0, 2).toUpperCase()}
                </a>
              )}
              <form action="/auth/sign-out" method="POST">
                <button
                  type="submit"
                  className="text-text-dim hover:text-text transition-colors text-xs"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <a
                href="/auth/sign-in"
                className="text-text-dim hover:text-text transition-colors text-[13px]"
              >
                Sign in
              </a>
              <a
                href="/auth/sign-up"
                className="px-[18px] py-2 bg-accent text-bg font-bold rounded text-[13px] tracking-[0.02em] hover:bg-[#d9ff1a] transition-colors"
              >
                Join
              </a>
            </>
          )}
        </div>

      </div>
    </header>
  )
}
