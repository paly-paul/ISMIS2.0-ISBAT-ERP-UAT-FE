import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export function middleware(request: NextRequest) {
  // Coarse presence check only — this cannot validate the token, only whether
  // the cookie exists. Gate on erp_refresh, not erp_access: erp_access is a
  // short-lived *session* cookie (Expires: Session, ~15min JWT inside) that's
  // gone after any browser restart, while erp_refresh is long-lived (~1 week).
  // Redirecting on erp_access alone forced a fresh login far too often — once
  // erp_access was gone but erp_refresh was still valid, the client-side
  // silent-refresh fallback in academic/layout.tsx never got a chance to run.
  // Only bounce to /login when there's no refresh cookie at all (i.e. really
  // logged out). Only works while cookies are set same-origin (via the
  // next.config.mjs rewrite proxy); if NEXT_PUBLIC_API_GATEWAY_URL later points
  // cross-origin directly at the gateway, these cookies won't be visible here
  // and the guard becomes a no-op. Reactive 401 handling lives in
  // src/lib/api/client.ts. Skipped entirely in mock mode, since mock auth
  // never sets either cookie.
  if (!MOCK_AUTH && request.nextUrl.pathname.startsWith('/academic') && !request.cookies.has('erp_refresh')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const ua = request.headers.get('user-agent') ?? ''
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua)
  const response = NextResponse.next()
  response.headers.set('x-device-type', isMobile ? 'mobile' : 'desktop')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
