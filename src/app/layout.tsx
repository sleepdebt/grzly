import type { Metadata } from 'next'
import { Space_Grotesk, Space_Mono } from 'next/font/google'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
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
  // metadataBase ensures og:image URLs are absolute — required for Slack, iMessage, etc.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://grzly.io'),
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

  // Fetch username + avatar for nav (if signed in)
  let username: string | null = null
  let avatarUrl: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single()
    username  = profile?.username   ?? null
    avatarUrl = profile?.avatar_url ?? null
  }

  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${spaceMono.variable}`}>
      <body className="bg-bg text-text font-sans antialiased">
        {/* Must be first in body — runs before paint to avoid theme flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('grzly-theme');if(t)document.documentElement.setAttribute('data-theme',t);})()` }} />
        <Nav user={user} username={username} avatarUrl={avatarUrl} />

        <main className="min-h-screen">
          {children}
        </main>

        <Footer />
      </body>
    </html>
  )
}
