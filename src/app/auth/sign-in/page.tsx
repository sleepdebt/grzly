'use client'

// Sign-in page
// Route: /auth/sign-in
//
// Supports: email/password login
// On success: redirects to ?redirectTo param or /

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
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="font-mono font-bold text-2xl mb-2">
            GRZLY<span className="text-accent">.</span>
          </div>
          <p className="text-muted text-sm">Sign in to vote and drop theses.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="block text-xs text-muted uppercase tracking-wide font-semibold mb-1.5">
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
              className="w-full bg-surface border border-border rounded px-3 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs text-muted uppercase tracking-wide font-semibold">
                Password
              </label>
              {/* TODO: add forgot password flow */}
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full bg-surface border border-border rounded px-3 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {error && (
            <p className="text-hot text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-2.5 bg-accent text-bg font-semibold rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {loading ? 'Signing in...' : 'Sign in →'}
          </button>
        </form>

        {/* Sign up link */}
        <p className="text-center text-sm text-muted mt-6">
          New to GRZLY?{' '}
          <a href="/auth/sign-up" className="text-accent hover:underline">
            Create an account
          </a>
        </p>

        {/* Disclaimer */}
        <p className="text-center text-xs text-muted mt-8 leading-relaxed">
          By signing in, you agree that GRZLY content is not financial advice and does not
          constitute a recommendation to buy or sell any security.
        </p>

      </div>
    </div>
  )
}
