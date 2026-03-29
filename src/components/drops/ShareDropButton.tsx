'use client'

// ShareDropButton — copy link, copy embed code, share on X / Bluesky
// Shown on every drop detail page

import { useState } from 'react'
import { DropStatus, DropOutcome } from '@/types'

interface ShareDropButtonProps {
  dropId: string
  ticker: string
  companyName: string | null
  convictionScore: number | null
  status: DropStatus
  outcome: DropOutcome | null
  baseUrl: string
}

export default function ShareDropButton({
  dropId,
  ticker,
  companyName,
  convictionScore,
  status,
  outcome,
  baseUrl,
}: ShareDropButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<'link' | 'embed' | null>(null)
  const dropUrl   = `${baseUrl}/drops/${dropId}`
  const embedSrc  = `${baseUrl}/api/drops/${dropId}/card`
  const embedCode = `<iframe src="${embedSrc}" width="520" height="200" frameborder="0" style="border:1px solid #1f1f1f;border-radius:14px;overflow:hidden;"></iframe>`

  const shareText = (() => {
    const co = convictionScore !== null ? ` — ${Math.round(convictionScore)}% bearish conviction` : ''
    const co2 = companyName ? ` (${companyName})` : ''
    if (outcome === 'correct')   return `$${ticker} bear thesis ✓ Correct on GRZLY${co}. Not financial advice.`
    if (outcome === 'incorrect') return `$${ticker} bear thesis ✗ Incorrect on GRZLY. Not financial advice.`
    if (status === 'extended')   return `$${ticker}${co2} bear thesis SWAYZE'd on GRZLY${co}. Not financial advice.`
    return `$${ticker}${co2} bear thesis on GRZLY${co}. Not financial advice.`
  })()

  const xUrl    = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(dropUrl)}`
  const bskyUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(`${shareText} ${dropUrl}`)}`

  async function copyText(text: string, type: 'link' | 'embed') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    } catch { /* clipboard unavailable */ }
  }

  return (
    <div className="relative">
      {open && <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] border border-border text-[12px] font-mono text-muted hover:text-text-dim hover:border-border-hl transition-colors"
      >
        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        Share
      </button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 z-40 bg-surface border border-border-hl rounded-[10px] p-1.5 shadow-2xl w-[210px]">

          {/* Copy link */}
          <button
            onClick={() => copyText(dropUrl, 'link')}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-[7px] text-[12px] font-mono text-text-dim hover:bg-bg hover:text-text transition-colors"
          >
            {copied === 'link' ? (
              <svg width="13" height="13" fill="none" stroke="#c8ff00" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            )}
            {copied === 'link' ? 'Copied!' : 'Copy link'}
          </button>

          {/* Copy embed code */}
          <button
            onClick={() => copyText(embedCode, 'embed')}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-[7px] text-[12px] font-mono text-text-dim hover:bg-bg hover:text-text transition-colors"
          >
            {copied === 'embed' ? (
              <svg width="13" height="13" fill="none" stroke="#c8ff00" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            )}
            {copied === 'embed' ? 'Copied!' : 'Copy embed code'}
          </button>

          <div className="h-px bg-border mx-2 my-1" />

          {/* Share on X */}
          <a
            href={xUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-[7px] text-[12px] font-mono text-text-dim hover:bg-bg hover:text-text transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.738l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Share on X
          </a>

          {/* Share on Bluesky */}
          <a
            href={bskyUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-[7px] text-[12px] font-mono text-text-dim hover:bg-bg hover:text-text transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 600 530" fill="currentColor" aria-hidden>
              <path d="M300 130c-50-70-150-110-200-90-70 26-100 120-70 200 20 56 80 100 160 140-20-50-30-100-20-130 30 70 80 130 130 160 50-30 100-90 130-160 10 30 0 80-20 130 80-40 140-84 160-140 30-80 0-174-70-200-50-20-150 20-200 90z" />
            </svg>
            Share on Bluesky
          </a>

        </div>
      )}
    </div>
  )
}
