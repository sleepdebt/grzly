'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/

export default function SignUpPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function checkUsername(value: string) {
    if (!USERNAME_REGEX.test(value)) { setUsernameAvailable(null); return }
    setCheckingUsername(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', value.toLowerCase())
      .single()
    setUsernameAvailable(!data)
    setCheckingUsername(false)
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!USERNAME_REGEX.test(username)) {
      setError('Username must be 3–20 characters: letters, numbers, underscores only.')
      return
    }
    if (usernameAvailable === false) {
      setError('That username is taken.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: username.toLowerCase() } },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (authData.user && !authData.session) {
      setSuccess(true)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  if (success) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="relative bg-surface border border-border rounded-xl overflow-hidden text-center px-6 py-10">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-accent via-accent-dim to-transparent" />
            <div className="text-4xl mb-5">🐻</div>
            <h2 className="font-mono text-xl font-bold text-accent mb-3">Check your email</h2>
            <p className="text-dim text-sm leading-relaxed">
              We sent a confirmation link to{' '}
              <strong className="text-text">{email}</strong>.{' '}
              Click it to activate your account and join the bear council.
            </p>
            <a
              href="/auth/sign-in"
              className="inline-block mt-6 text-sm text-accent hover:underline"
            >
              ← Back to sign in
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <a href="/" className="inline-block font-mono font-bold text-2xl text-accent tracking-[0.08em] mb-2">
            GRZLY<span className="text-dim">.bear</span>
          </a>
          <p className="text-dim text-sm">Claim your Vibelord identity.</p>
        </div>

        {/* Card */}
        <div className="relative bg-surface border border-border rounded-xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-accent via-accent-dim to-transparent" />

          <div className="p-6">
            <form onSubmit={handleSignUp} className="space-y-4">

              {/* Username */}
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim text-sm pointer-events-none">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setUsernameAvailable(null) }}
                    onBlur={e => checkUsername(e.target.value)}
                    required
                    autoFocus
                    autoComplete="off"
                    placeholder="bearwhisperer"
                    maxLength={20}
                    className="w-full bg-surface-2 border border-border text-text pl-8 pr-3 py-3 rounded-lg text-sm focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div className="mt-1.5 text-xs">
                  {checkingUsername && <span className="text-muted">Checking...</span>}
                  {!checkingUsername && usernameAvailable === true && <span className="text-correct">✓ Available</span>}
                  {!checkingUsername && usernameAvailable === false && <span className="text-hot">✗ Already taken</span>}
                  {username && !USERNAME_REGEX.test(username) && (
                    <span className="text-muted">3–20 chars: letters, numbers, underscores</span>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full bg-surface-2 border border-border text-text px-3.5 py-3 rounded-lg text-sm focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="8+ characters"
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
                disabled={loading || !email || !password || !username || usernameAvailable === false}
                className="w-full py-3 bg-accent text-bg font-bold rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#d9ff1a] transition-colors mt-2"
              >
                {loading ? 'Creating account...' : 'Join the Bear Cult →'}
              </button>

            </form>
          </div>
        </div>

        {/* Footer links */}
        <p className="text-center text-sm text-dim mt-6">
          Already have an account?{' '}
          <a href="/auth/sign-in" className="text-accent hover:underline">
            Sign in
          </a>
        </p>

        <p className="text-center text-[11px] text-muted mt-8 leading-relaxed px-4">
          GRZLY content is not financial advice. By creating an account you confirm you
          understand that all content is general research and community opinion only.
        </p>

      </div>
    </div>
  )
}
