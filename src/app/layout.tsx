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
      <head>
        <script dangerouslySetInnerHTML={{ __html: `!function(t,e){var o,n,p,r;e.__SV||(window.posthog && window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="fi init Oi Fi ft Ii Ai Ri capture calculateEventProperties Ni register register_once register_for_session unregister unregister_for_session Hi getFeatureFlag getFeatureFlagPayload getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey cancelPendingSurvey canRenderSurvey canRenderSurveyAsync qi identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException startExceptionAutocapture stopExceptionAutocapture loadToolbar get_property getSessionProperty zi Li createPersonProfile setInternalOrTestUser Bi $i Wi opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing Mi debug bt ji getPageViewId captureTraceFeedback captureTraceMetric Si".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init('phc_VIdmarfBKKzLnnKrPnXHmm2rBXA42QhrBFRvwAa0EUI',{api_host:'https://us.i.posthog.com',defaults:'2026-01-30',person_profiles:'identified_only'})` }} />
      </head>
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
