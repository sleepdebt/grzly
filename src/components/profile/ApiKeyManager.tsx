'use client'

// API key management UI — shown on Pro users' own profiles
// Allows generating, naming, and revoking API keys

import { useState, useEffect, useCallback } from 'react'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  last_used_at: string | null
  created_at: string
}

export default function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  const fetchKeys = useCallback(async () => {
    const res = await fetch('/api/keys')
    const data = await res.json()
    setKeys(data.keys ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchKeys() }, [fetchKeys])

  async function handleGenerate() {
    if (generating) return
    setGenerating(true)
    setRevealedKey(null)
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName || 'Default' }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setRevealedKey(data.key)
      setNewKeyName('')
      await fetchKeys()
    } catch (err) {
      console.error(err)
    } finally {
      setGenerating(false)
    }
  }

  async function handleRevoke(id: string) {
    if (revoking) return
    setRevoking(id)
    try {
      await fetch(`/api/keys/${id}`, { method: 'DELETE' })
      setKeys(prev => prev.filter(k => k.id !== id))
    } finally {
      setRevoking(null)
    }
  }

  async function handleCopy() {
    if (!revealedKey) return
    await navigator.clipboard.writeText(revealedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-8 pt-8 border-t border-border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-mono text-[13px] font-bold text-text uppercase tracking-widest">API Keys</h2>
          <p className="text-[12px] text-muted mt-0.5">Use these to access the GRZLY REST API and MCP server.</p>
        </div>
      </div>

      {/* Revealed key banner */}
      {revealedKey && (
        <div className="mb-4 p-4 bg-accent/5 border border-accent/25 rounded-[10px]">
          <p className="text-[11px] font-mono text-accent font-bold mb-2 uppercase tracking-wider">
            Copy this key now — it will not be shown again.
          </p>
          <div className="flex items-center gap-3">
            <code className="flex-1 text-[12px] font-mono text-text bg-surface-2 px-3 py-2 rounded break-all">
              {revealedKey}
            </code>
            <button
              onClick={handleCopy}
              className="text-[11px] font-mono px-3 py-2 rounded border border-border hover:border-accent/40 text-muted hover:text-accent transition-colors whitespace-nowrap"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => setRevealedKey(null)}
            className="mt-2 text-[11px] text-muted hover:text-text transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Generate new key */}
      <div className="flex gap-2 mb-5">
        <input
          type="text"
          value={newKeyName}
          onChange={e => setNewKeyName(e.target.value)}
          placeholder="Key name (optional)"
          maxLength={50}
          className="flex-1 bg-surface border border-border rounded-[8px] px-3 py-2 text-[13px] font-mono text-text placeholder-muted focus:outline-none focus:border-accent/50 transition-colors"
        />
        <button
          onClick={handleGenerate}
          disabled={generating || keys.length >= 5}
          className="px-4 py-2 rounded-[8px] bg-accent text-bg text-[12px] font-mono font-bold hover:bg-accent/90 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {generating ? 'Generating...' : '+ Generate key'}
        </button>
      </div>

      {/* Key list */}
      {loading ? (
        <p className="text-[12px] text-muted font-mono">Loading...</p>
      ) : keys.length === 0 ? (
        <p className="text-[12px] text-muted font-mono">No API keys yet.</p>
      ) : (
        <div className="space-y-2">
          {keys.map(key => (
            <div
              key={key.id}
              className="flex items-center justify-between px-4 py-3 bg-surface border border-border rounded-[10px]"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] text-text font-bold">{key.name}</span>
                  <code className="text-[11px] font-mono text-muted">{key.key_prefix}...</code>
                </div>
                <div className="text-[11px] text-muted mt-0.5">
                  Created {new Date(key.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {key.last_used_at && (
                    <> · Last used {new Date(key.last_used_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleRevoke(key.id)}
                disabled={revoking === key.id}
                className="text-[11px] font-mono text-muted hover:text-hot transition-colors disabled:opacity-50"
              >
                {revoking === key.id ? 'Revoking...' : 'Revoke'}
              </button>
            </div>
          ))}
        </div>
      )}

      {keys.length >= 5 && (
        <p className="mt-2 text-[11px] text-muted font-mono">Maximum of 5 keys reached. Revoke one to generate a new key.</p>
      )}

      <p className="mt-4 text-[11px] text-muted">
        API docs: <code className="font-mono">grzly.vercel.app/api/v1</code> · Use <code className="font-mono">Authorization: Bearer grzly_sk_...</code>
      </p>
    </div>
  )
}
