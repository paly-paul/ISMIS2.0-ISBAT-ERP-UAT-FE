'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthError, refreshSession } from '@/lib/auth'
import { getSessionIdentity, setSessionIdentity, clearSessionIdentity } from '@/lib/session'
import { NotificationToastHost } from '@/components/NotificationToastHost'
import { useNotificationsHubBridge } from '@/hooks/useNotifications'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Access-token TTL is confirmed at 15 minutes — refreshing every 5 (a third
// of that) leaves two spare attempts before expiry if one is missed (tab
// backgrounded, transient network blip).
const SESSION_REFRESH_INTERVAL_MS = 5 * 60 * 1000

// Single, app-wide proactive keep-alive. This used to be duplicated as a
// separate setInterval in every module layout (academic/admission/config/
// employee/finance/student) — but each of those layouts unmounts (and its
// interval is destroyed) on every navigation that crosses between top-level
// modules (e.g. /academic -> /admission), and the replacement interval on
// the new layout starts its countdown over from zero. A user who switches
// modules more often than the interval period could go an entire session
// with NONE of the six ever surviving long enough to actually fire —
// meaning the refresh API was never called at all, not just called late.
// Providers sits above every route in src/app/layout.tsx and never
// unmounts on client-side navigation for the life of the tab, so a single
// timer here always keeps running regardless of how the user navigates.
function SessionKeepAlive() {
  const pathname = usePathname()
  const router = useRouter()
  // Read via ref inside the interval callback rather than as a useEffect
  // dependency — depending on pathname directly would recreate the
  // interval (resetting its countdown) on every single page navigation,
  // reintroducing the exact bug this is fixing, just far more often.
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  useEffect(() => {
    if (MOCK_AUTH) return

    const interval = setInterval(() => {
      const p = pathnameRef.current
      // No session to refresh on public/login pages — skip rather than risk
      // a false-alarm redirect from a call that was never going to succeed.
      if (p === '/' || p.startsWith('/login')) return
      if (!getSessionIdentity()) return

      refreshSession()
        .then(result => {
          if (result.displayName) setSessionIdentity({ displayName: result.displayName })
        })
        .catch(err => {
          if (err instanceof AuthError) {
            clearSessionIdentity()
            router.replace('/login/staff')
          }
        })
    }, SESSION_REFRESH_INTERVAL_MS)

    return () => clearInterval(interval)
    // Deliberately no `pathname` dependency — see the note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  return null
}

// Starts the notifications hub bridge (unread-count fetch → hub connect →
// live updates, see useNotificationsHubBridge) once a session actually
// exists. `enabled` is re-derived on every pathname change the same way
// SessionKeepAlive's guard logic is, so this picks up right after login
// (the login flow's final redirect changes pathname) — but a fresh tab
// deep-linked straight into a protected page has no pathname change to
// react to: the layout's own mount-time auth-check populates
// sessionStorage identity *after* this component's first render, with no
// further pathname change to re-trigger the check. The short self-clearing
// poll below covers that gap without turning into a permanent interval —
// this is polling local sessionStorage, not the network, and stops the
// instant identity shows up (or after a few seconds regardless).
function NotificationsBridge() {
  const pathname = usePathname()
  const isPublicRoute = pathname === '/' || pathname.startsWith('/login')
  const [identityTick, setIdentityTick] = useState(0)
  const enabled = !isPublicRoute && !!getSessionIdentity()

  useEffect(() => {
    if (enabled || isPublicRoute) return
    let attempts = 0
    const interval = setInterval(() => {
      attempts++
      if (getSessionIdentity() || attempts >= 10) {
        clearInterval(interval)
        setIdentityTick(t => t + 1)
      }
    }, 500)
    return () => clearInterval(interval)
    // Deliberately excludes `enabled`/`identityTick` — this effect's own
    // job is to eventually flip them via setIdentityTick, re-running it on
    // every value change it produces would just restart the same poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isPublicRoute])

  // identityTick is otherwise unused — its only job is forcing a re-render
  // so `enabled` (read fresh from sessionStorage above) gets re-evaluated.
  void identityTick

  useNotificationsHubBridge(enabled)
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <SessionKeepAlive />
      <NotificationsBridge />
      {children}
      <NotificationToastHost />
    </QueryClientProvider>
  )
}
