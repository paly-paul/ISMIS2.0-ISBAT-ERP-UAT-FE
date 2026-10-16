'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Query, QueryClient, QueryClientProvider, QueryKey, useQueryClient } from '@tanstack/react-query'
import { AuthError, refreshSession } from '@/lib/auth'
import { getSessionIdentity, setSessionIdentity, clearSessionIdentity } from '@/lib/session'
import { NotificationToastHost } from '@/components/NotificationToastHost'
import { useNotificationsHubBridge } from '@/hooks/useNotifications'
import { MENU_KEY } from '@/hooks/users/useMenu'
import { REPORT_JOBS_KEY } from '@/lib/reportDownloads'

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

// App-shell queries (sidebar menu, header bell/downloads/current intake)
// that survive page changes — they're on screen on every page, so dropping
// them would just refetch and flicker the shell on each click. Prefix match.
const SHELL_QUERY_KEYS: readonly QueryKey[] = [
  MENU_KEY,
  ['notifications'],
  REPORT_JOBS_KEY,
  ['intakes', 'current-academic'],
]

function isShellQuery(query: Query) {
  return SHELL_QUERY_KEYS.some(prefix => prefix.every((part, i) => query.queryKey[i] === part))
}

// Fresh data on every page change, per request (2026-10-15). With the
// app-wide staleTime: Infinity below, anything fetched once stayed cached
// until a mutation invalidated it, so other users' changes never showed up
// on navigation. On each pathname change:
//   - queries no longer observed (the previous page's) are dropped outright;
//   - queries the new page shares with the old one (still active, so kept
//     by react-query) are invalidated so they refetch once — skipping any
//     already fetching, so a page's own first load isn't sent twice.
// Rendered after {children} in Providers so its effect runs after the new
// page's — its queries are already subscribed by the time this sorts
// active/inactive.
function PageCacheReset() {
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const previousPathname = useRef(pathname)

  useEffect(() => {
    if (previousPathname.current === pathname) return
    previousPathname.current = pathname
    queryClient.removeQueries({ type: 'inactive', predicate: q => !isShellQuery(q) })
    queryClient.invalidateQueries({ type: 'active', predicate: q => !isShellQuery(q) && q.state.fetchStatus === 'idle' })
  }, [pathname, queryClient])

  return null
}

// Disables mouse wheel scrolling from unintentionally incrementing/decrementing
function NumberInputScrollPrevent() {
  useEffect(() => {
    const handleWheel = () => {
      const el = document.activeElement
      if (el instanceof HTMLInputElement && el.type === 'number') {
        el.blur()
      }
    }
    window.addEventListener('wheel', handleWheel, { passive: true })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  // App-wide "cache until invalidated" default — react-query's own default
  // staleTime is 0, which made every page's data stale the instant it
  // loaded, so simply navigating away and back (or refocusing the tab)
  // re-fetched it every time even though nothing had changed. staleTime:
  // Infinity here means a query only ever re-fetches when something
  // actually invalidates it: a mutation's own onSuccess (the established
  // pattern already used by ~74/76 mutation hooks in src/hooks — e.g.
  // useCourseUnits.ts's createCourseUnit invalidating COURSE_UNITS_KEY) or
  // this cache entry getting garbage-collected after sitting unused past
  // gcTime (react-query's own default: 5 minutes). Any individual hook can
  // still override this with its own staleTime — an explicit option always
  // wins over this default — so hooks like useNotificationsList (which
  // deliberately wants a short 5s staleTime to refetch on every dropdown
  // open) are unaffected.
  //
  // Trade-off worth knowing: a change made by a *different* logged-in user
  // won't show up while you stay on the same page — PageCacheReset above
  // clears page data on every navigation, so it does on the next page
  // change (or your own save on that same data).
  //
  // No automatic retries, anywhere. A failed request (403 forbidden, 404,
  // 400, 5xx) is shown to the user once and only re-sent when they click
  // Retry or something invalidates it — the client never re-asks the server
  // on its own. react-query's defaults otherwise retry 3× and, since a
  // failed query has no data and so always counts as stale, re-fire it on
  // every window focus, remount and reconnect, which hammered endpoints the
  // user has no permission for. A hook needing live updates must opt in
  // explicitly (refetchInterval / refetchOnWindowFocus), never inherit it.
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        retry: false,
        retryOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: {
        retry: false,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <SessionKeepAlive />
      <NotificationsBridge />
      <NumberInputScrollPrevent />
      {children}
      {/* After {children} on purpose — sibling effects run in tree order,
          so this sees the new page's queries already subscribed. */}
      <PageCacheReset />
      <NotificationToastHost />
    </QueryClientProvider>
  )
}
