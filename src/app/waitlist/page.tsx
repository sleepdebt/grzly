// Waitlist landing page — pre-launch marketing, publicly accessible
// Route: /waitlist
// Visual spec: waitlist.html
// Root page.tsx redirects here when NEXT_PUBLIC_WAITLIST_MODE=true

import type { Metadata } from 'next'
import WaitlistForm from '@/components/WaitlistForm'

export const metadata: Metadata = {
  title: 'GRZLY — The Bears Are Organizing',
  description: 'GRZLY is where collective skepticism becomes public record. Publish short theses. Build conviction together. Track what the market does next.',
}

// Static preview drops (hardcoded — this is a marketing page, no DB needed)
const PREVIEW_DROPS = [
  {
    ticker: 'HOOD',
    thesis: 'Retail trading volumes structurally declining post-meme-stock era. No credible path to profitability at current CAC.',
    conviction: '91',
    votes: '512 votes',
    stripe: 'bg-hot',
  },
  {
    ticker: 'TSLA',
    thesis: 'Six consecutive quarters of automotive margin decline. BYD eating market share in every growth market outside the US.',
    conviction: '84',
    votes: '247 votes',
    stripe: 'bg-accent-dim',
  },
  {
    ticker: 'BYND',
    thesis: 'Restaurant partner exits accelerating. Retail velocity down 40% YoY. Cash runway under 12 months at current burn.',
    conviction: '88',
    votes: '341 votes',
    stripe: 'bg-swayze',
  },
]

export default function WaitlistPage() {
  return (
    <div className="min-h-screen bg-bg text-text overflow-x-hidden">

      {/* ── Inline nav (replaces main app nav on this page) ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-12 h-[64px] bg-bg/80 backdrop-blur-[12px] border-b border-white/[0.04]">
        <a href="/" className="font-mono font-bold text-[20px] tracking-[0.08em] text-accent">
          GRZLY<span className="text-[#444]">.</span>
        </a>
        <div className="text-[13px] text-[#444]">
          Early access ·{' '}
          <a href="/auth/sign-in" className="text-text-dim hover:text-text transition-colors">
            Sign in
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-[120px] pb-20">
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2"
          style={{
            top: '20%',
            width: 600,
            height: 400,
            background: 'radial-gradient(ellipse, rgba(200,255,0,0.04) 0%, transparent 70%)',
          }}
        />

        <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-accent/80 mb-6">
          ✦ Early Access · Invite Only
        </p>

        <h1 className="font-mono font-bold leading-[1.1] tracking-[-0.02em] mb-3"
            style={{ fontSize: 'clamp(36px, 6vw, 72px)' }}>
          The <span className="text-accent">bears</span><br />
          are <span className="text-hot">organizing.</span>
        </h1>

        <p className="text-text-dim leading-[1.7] max-w-[560px] mx-auto mb-12"
           style={{ fontSize: 'clamp(16px, 2vw, 20px)' }}>
          GRZLY is where collective skepticism becomes public record. Publish short theses. Build conviction together. Track what the market does next.
        </p>

        <WaitlistForm source="hero" />
      </section>

      {/* ── How it works ── */}
      <section className="max-w-[960px] mx-auto px-6 py-[100px]">
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent/70 mb-4">
          How it works
        </p>
        <h2 className="font-mono font-bold mb-12" style={{ fontSize: 'clamp(24px, 4vw, 36px)' }}>
          Conviction as a team sport.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              num: 'Step 01',
              title: 'Drop a Thesis',
              body: 'Identify a stock, asset, or trend you believe is overvalued, overhyped, or heading lower. Write a structured thesis backed by evidence. Set a time horizon. Publish it publicly.',
              tag: 'Your name. Your record.',
              barColor: '#c8ff00',
              tagBg: 'rgba(200,255,0,0.10)',
              tagColor: '#c8ff00',
            },
            {
              num: 'Step 02',
              title: 'Build Conviction',
              body: "The community votes bearish or skeptical. Votes are weighted by each voter's accuracy track record. A Vibelord with a 78% hit rate carries more signal than a first-timer. The conviction score updates live.",
              tag: 'Crowd-sourced. Accountability-weighted.',
              barColor: '#ff3c3c',
              tagBg: 'rgba(255,60,60,0.10)',
              tagColor: '#ff3c3c',
            },
            {
              num: 'Step 03',
              title: 'The Bear Book Decides',
              body: "When your Drop resolves, real market data settles it. Correct or incorrect — it's permanent. Your track record builds in public. The data doesn't forget.",
              tag: 'Permanent. Public. Honest.',
              barColor: '#ff9900',
              tagBg: 'rgba(255,153,0,0.10)',
              tagColor: '#ff9900',
            },
          ].map(step => (
            <div
              key={step.num}
              className="relative bg-surface border border-border rounded-[12px] px-6 py-7 overflow-hidden transition-colors hover:border-border-hl"
            >
              {/* Colored top bar */}
              <div
                className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: step.barColor }}
              />
              <p className="font-mono text-[11px] tracking-[0.1em] uppercase text-[#444] mb-4">
                {step.num}
              </p>
              <h3 className="font-mono font-bold text-[18px] text-text mb-3">{step.title}</h3>
              <p className="text-[13px] text-text-dim leading-[1.7] mb-4">{step.body}</p>
              <span
                className="inline-block px-[10px] py-[4px] rounded-full font-mono text-[11px] font-bold"
                style={{ background: step.tagBg, color: step.tagColor }}
              >
                {step.tag}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Manifesto ── */}
      <div className="border-t border-b border-border py-20 px-6 text-center">
        <div className="max-w-[680px] mx-auto">
          <p className="font-mono italic leading-[1.6] text-text-dim mb-6"
             style={{ fontSize: 'clamp(18px, 3vw, 26px)' }}>
            "Wall Street shorts behind closed doors, with insider info, and without accountability.{' '}
            <strong className="text-text not-italic">GRZLY flips that on its head.</strong>{' '}
            Open source. Internet-native. Crowd-coordinated. Think of it as protest through the markets."
          </p>
          <p className="font-mono text-[12px] text-[#444] tracking-[0.1em] uppercase">
            ✦ The GRZLY Thesis
          </p>
        </div>
      </div>

      {/* ── Live drops preview ── */}
      <section className="max-w-[960px] mx-auto px-6 py-[100px]">
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent/70 mb-4">
          Live on GRZLY
        </p>
        <h2 className="font-mono font-bold mb-8" style={{ fontSize: 'clamp(24px, 4vw, 36px)' }}>
          What the bears are watching.
        </h2>

        <div className="flex flex-col gap-3">
          {PREVIEW_DROPS.map(drop => (
            <div
              key={drop.ticker}
              className="relative flex items-center gap-5 bg-surface border border-border rounded-[10px] px-5 py-4 overflow-hidden hover:border-border-hl transition-colors"
            >
              {/* Left stripe */}
              <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${drop.stripe}`} />

              <span className="font-mono text-[16px] font-bold text-accent w-[60px] flex-shrink-0">
                ${drop.ticker}
              </span>
              <span className="flex-1 text-[13px] text-text-dim leading-[1.5]">
                {drop.thesis}
              </span>
              <span className="font-mono text-[20px] font-bold text-hot flex-shrink-0">
                {drop.conviction}%
              </span>
              <span className="font-mono text-[11px] text-[#444] flex-shrink-0 w-[60px] text-right">
                {drop.votes}
              </span>
            </div>
          ))}
        </div>

        <p className="text-center text-[13px] text-[#444] mt-5">
          These are real theses from real people. No personalized advice. Not financial recommendations. Just conviction on record.
        </p>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="relative text-center px-6 py-[100px]">
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2"
          style={{
            top: '30%',
            width: 500,
            height: 300,
            background: 'radial-gradient(ellipse, rgba(200,255,0,0.05) 0%, transparent 70%)',
          }}
        />

        <h2 className="font-mono font-bold leading-[1.1] mb-4"
            style={{ fontSize: 'clamp(28px, 5vw, 52px)' }}>
          The prophecy<br />is <span className="text-accent">open.</span>
        </h2>
        <p className="text-text-dim text-[16px] max-w-[480px] mx-auto mb-10 leading-[1.7]">
          GRZLY is in private beta. Join the waitlist and we'll bring you in before public launch.
        </p>

        <div className="flex justify-center">
          <WaitlistForm source="bottom" />
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border flex items-center justify-between flex-wrap gap-3 px-12 py-8 text-[12px] text-[#444]">
        <div className="font-mono font-bold text-accent tracking-[0.08em]">
          GRZLY<span className="text-[#444]">.</span>
        </div>
        <p className="max-w-[500px] leading-[1.6] text-center">
          GRZLY publishes community short conviction data for research and entertainment purposes only. Nothing on this platform constitutes financial advice, investment recommendations, or an offer to buy or sell securities. Not a registered investment advisor or broker-dealer. Users act on their own conviction through their own brokers.
        </p>
        <div>© 2026 GRZLY</div>
      </footer>

    </div>
  )
}
