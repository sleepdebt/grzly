// Supabase Auth Middleware
//
// REQUIRED for Supabase SSR to work correctly in Next.js App Router.
// Without this, the server cannot read the user's session from cookies,
// and `supabase.auth.getUser()` will always return null on the server.
//
// What it does:
//   1. Intercepts every request
//   2. Refreshes the Supabase session if the access token is expired
//   3. Writes the refreshed token back to the response cookies
//
// Docs: https://supabase.com/docs/guides/auth/server-side/nextjs

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          )
        },
      },
    }
  )

  // Refresh session — IMPORTANT: do not add logic between createServerClient
  // and supabase.auth.getUser() or the session may not be refreshed correctly
  const { data: { user } } = await supabase.auth.getUser()

  // ─── Route protection ──────────────────────────────────────
  //
  // Everything is private by default. Only these paths are public.
  // API routes handle their own auth — never redirect them to sign-in.
  const { pathname } = request.nextUrl

  const isPublic =
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/') ||
    pathname === '/waitlist' ||
    pathname === '/faq'

  if (!isPublic && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth/sign-in'
    redirectUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Return the response with refreshed session cookies
  return supabaseResponse
}

// Run middleware on all routes except static assets and API routes
// that don't need auth (cron routes are protected by CRON_SECRET, not auth)
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/cron).*)',
  ],
}
