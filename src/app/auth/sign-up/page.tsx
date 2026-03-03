'use client'

// Sign-up page
// Route: /auth/sign-up
//
// Creates account + profile row in one flow.
// Username is claimed here and becomes the Vibelord public identity.

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// Basic username rules: 3–20 chars, alphanumeric + underscores
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

  // Check username availability as user types (debounced via blur)
  async function checkUsername(value: string) {
    if (!USERNAME_REGEX.test(value)) {
      setUsernameAvailable(null)
      return
    }
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

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Profile is created by a DB trigger on auth.users insert (see schema notes)
        // Pass username as metadata so the trigger can use it
        data: { username: username.toLowerCase() },
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // 2. If email confirmation is disabled (dev), user is signed in immediately
    //    If enabled (prod), show success message and prompt to verify email
    if (authData.user && !authData.session) {
      // Email confirmation required
      setSuccess(true)
      setLoading(false)
      return
    }

    // Signed in immediately — go to feed
    router.push('/')
    router.refresh()
  }

  if (success) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="text-4xl mb-4">🐻</div>
          <h2 className="text-xl font-semibold mb-2">Check your email</h2>
          <p className="text-muted text-sm">
            We sent a confirmation link to <strong className="text-text">{email}</strong>.
            Click it to activate your account and join the bear council.
          </p>
          <a href="/auth/sign-in" className="inline-block mt-6 text-accent text-sm hover:underline">
            Back to sign in
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="font-mono font-bold text-2xl mb-2">
            GRZLY<span className="text-accent">.</span>
          </div>
          <p className="text-muted text-sm">Claim your Vibelord identity.</p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-4">

          {/* Username — claimed first, it's the public identity */}
          <div>
            <label className="block text-xs text-muted uppercase tracking-wide font-semibold mb-1.5">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">@</span>
              <input
                type="text"
                value={username}
                onChange={e => {
                  setUsername(e.target.value)
                  setUsernameAvailable(null)
                }}
                onBlur={e => checkUsername(e.target.value)}
                required
                autoFocus
                autoComplete="off"
                placeholder="bearwhisperer"
                maxLength={20}
                className="w-full bg-surface border border-border rounded pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            {checkingUsername && (
              <p className="text-xs text-muted mt-1">Checking...</p>
            )}
            {!checkingUsername && usernameAvailable === true && (
              <p className="text-xs text-correct mt-1">✓ Available</p>
            )}
            {!checkingUsername && usernameAvailable === false && (
              <p className="text-xs text-hot mt-1">✗ Already taken</p>
            )}
            {username && !USERNAME_REGEX.test(username) && (
              <p className="text-xs text-muted mt-1">3–20 chars: letters, numbers, underscores</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-muted uppercase tracking-wide font-semibold mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full bg-surface border border-border rounded px-3 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-muted uppercase tracking-wide font-semibold mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="8+ characters"
              className="w-full bg-surface border border-border rounded px-3 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {error && (
            <p className="text-hot text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password || !username || usernameAvailable === false}
            className="w-full py-2.5 bg-accent text-bg font-semibold rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {loading ? 'Creating account...' : 'Join the Bear Cult →'}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          Already have an account?{' '}
          <a href="/auth/sign-in" className="text-accent hover:underline">
            Sign in
          </a>
        </p>

        <p className="text-center text-xs text-muted mt-8 leading-relaxed">
          GRZLY content is not financial advice. By creating an account you confirm you
          understand that all content is general research and community opinion only.
        </p>

      </div>
    </div>
  )
}
