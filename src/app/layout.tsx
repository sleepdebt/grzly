import type { Metadata } from 'next'
import { Space_Grotesk, Space_Mono } from 'next/font/google'
import { createClient } from '@/lib/supabase/server'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    template: '%s — GRZLY',
    default: 'GRZLY — The bears are organizing.',
  },
  description:
    'Collective short conviction. Publish a short thesis, build community conviction, track outcomes. The Bear Book remembers everything.',
  openGraph: {
    title: 'GRZLY — The bears are organizing.',
    description: 'Collective short conviction platform. Not financial advice.',
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: 'GRZLY',
    type: 'website',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch username for profile link (if signed in)
  let username: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()
    username = profile?.username ?? null
  }

  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${spaceMono.variable}`}>
      <body className="bg-bg text-text font-sans antialiased">
        {/* Global nav */}
        <header className="fixed top-0 inset-x-0 z-50 border-b border-border bg-bg/80 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <a href="/" className="font-mono font-bold text-lg tracking-tight">
              GRZLY<span className="text-accent">.</span>
            </a>
            <nav className="flex items-center gap-6 text-sm text-muted">
              <a href="/" className="hover:text-text transition-colors">Feed</a>
              <a href="/bear-book" className="hover:text-text transition-colors">Bear Book</a>

              {user ? (
                <>
                  <a href="/drops/create" className="px-3 py-1.5 bg-accent text-bg font-semibold rounded hover:opacity-90 transition-opacity text-xs">
                    Drop a thesis
                  </a>
                  {username && (
                    <a href={`/profile/${username}`} className="hover:text-text transition-colors">
                      @{username}
                    </a>
                  )}
                  <form action="/auth/sign-out" method="POST">
                    <button type="submit" className="hover:text-text transition-colors text-xs">
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <a href="/auth/sign-in" className="hover:text-text transition-colors">
                    Sign in
                  </a>
                  <a href="/auth/sign-up" className="px-3 py-1.5 bg-accent text-bg font-semibold rounded hover:opacity-90 transition-opacity text-xs">
                    Join
                  </a>
                </>
              )}
            </nav>
          </div>
        </header>

        {/* Page content — offset for fixed nav */}
        <main className="pt-14 min-h-screen">
          {children}
        </main>

        {/* Persistent disclaimer */}
        <footer className="border-t border-border py-6 text-center text-xs text-muted">
          GRZLY is not a registered investment advisor. All content is general research and community opinion, not financial advice.
          Users execute trades independently through their own brokers.
        </footer>
      </body>
    </html>
  )
}
