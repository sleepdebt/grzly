'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <a href="/" className="inline-block font-mono font-bold text-2xl text-accent tracking-[0.08em] mb-2">
            GRZLY<span className="text-dim">.bear</span>
          </a>
          <p className="text-dim text-sm">Sign in to vote and drop theses.</p>
        </div>

        {/* Card */}
        <div className="relative bg-surface border border-border rounded-xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-accent via-accent-dim to-transparent" />

          <div className="p-6">
            <form onSubmit={handleSignIn} className="space-y-4">

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full bg-surface-2 border border-border text-text px-3.5 py-3 rounded-lg text-sm focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full bg-surface-2 border border-border text-text px-3.5 py-3 rounded-lg text-sm focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              {error && (
                <div className="px-4 py-3 rounded-lg bg-[rgba(255,60,60,0.08)] border border-[rgba(255,60,60,0.3)] text-[#ff8080] text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full py-3 bg-accent text-bg font-bold rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#d9ff1a] transition-colors mt-2"
              >
                {loading ? 'Signing in...' : 'Sign in →'}
              </button>

            </form>
          </div>
        </div>

        {/* Footer links */}
        <p className="text-center text-sm text-dim mt-6">
          New to GRZLY?{' '}
          <a href="/auth/sign-up" className="text-accent hover:underline">
            Create an account
          </a>
        </p>

        <p className="text-center text-[11px] text-muted mt-8 leading-relaxed px-4">
          By signing in you agree that GRZLY content is not financial advice and does not
          constitute a recommendation to buy or sell any security.
        </p>

      </div>
    </div>
  )
}
