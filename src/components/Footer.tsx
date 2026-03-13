import Image from 'next/image'
import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface">

      {/* Main footer row */}
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-0 sm:justify-between">

        {/* Left: brand */}
        <span className="font-bold tracking-tight text-accent text-sm">GRZLY</span>

        {/* Center: nav links */}
        <nav className="flex items-center gap-5 text-xs text-muted">
          <Link href="/terms"   className="hover:text-text transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-text transition-colors">Privacy</Link>
          <Link href="/bear-book" className="hover:text-text transition-colors">Bear Book</Link>
        </nav>

        {/* Right: copyright + Built in the Midwest */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted">© {new Date().getFullYear()} GRZLY</span>

          {/* Dark logo (shown by default, hidden in light mode via CSS) */}
          <Image
            src="/built-in-the-midwest.svg"
            alt="Built in the Midwest"
            width={121}
            height={16}
            className="midwest-logo-dark"
            priority={false}
          />
          {/* Light logo (hidden by default, shown in light mode via CSS) */}
          <Image
            src="/built-in-the-midwest-light.svg"
            alt="Built in the Midwest"
            width={121}
            height={16}
            className="midwest-logo-light"
            priority={false}
          />
        </div>
      </div>

      {/* Disclaimer row */}
      <div className="border-t border-border px-4 py-3 text-center text-xs text-muted/60">
        GRZLY is not a registered investment advisor. All content is general research and
        community opinion, not financial advice. Users execute trades independently through
        their own brokers.
      </div>

    </footer>
  )
}
