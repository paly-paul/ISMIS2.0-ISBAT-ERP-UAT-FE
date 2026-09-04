// Live-push transport for the notification bell (see notification-bell.md).
// A module-level singleton, not a React hook — there is exactly one
// connection for the whole tab regardless of how many components care about
// notifications (the header bell, the toast host, the notifications page),
// same "one app-wide instance" reasoning as client.ts's refreshInFlight
// dedup and providers.tsx's SessionKeepAlive interval.
import * as signalR from '@microsoft/signalr'
import { NotificationItem, pushSimulatedNotification } from './api/notifications'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// No real hub to talk to under mock auth — simulate a push on this cadence
// instead so the live-push UX (toast, badge bump, dropdown prepend) stays
// demoable without a backend. Real deployments never read this.
const MOCK_PUSH_INTERVAL_MS = 35_000

type NotificationHandler = (n: NotificationItem) => void
type ReconnectHandler = () => void

let connection: signalR.HubConnection | null = null
let mockTimer: ReturnType<typeof setInterval> | null = null
const notificationHandlers = new Set<NotificationHandler>()
const reconnectHandlers = new Set<ReconnectHandler>()

// Guards the whole "fetch unread-count, then connect" sequence (see
// startNotificationsSession below) so it runs exactly once per login, no
// matter how many times the bridge effect that calls it re-fires across
// navigations — re-running the fetch on every route change would drift
// toward the polling behaviour the doc explicitly rules out.
let sessionStarted = false

function emitNotification(n: NotificationItem) {
  notificationHandlers.forEach(h => h(n))
}

// Subscribe to live-pushed notifications. Returns an unsubscribe function —
// callers (useNotifications' hub-bridging effect) call this on unmount.
export function onNotification(handler: NotificationHandler): () => void {
  notificationHandlers.add(handler)
  return () => notificationHandlers.delete(handler)
}

// Fired after withAutomaticReconnect() re-establishes the connection. Per
// the doc: notifications pushed during the outage are gone from the
// socket's perspective, so this is the only thing that heals the badge —
// callers refetch unread-count (and page 1 of the list, if the dropdown is
// open) from here rather than trusting the socket to have caught them up.
export function onHubReconnected(handler: ReconnectHandler): () => void {
  reconnectHandlers.add(handler)
  return () => reconnectHandlers.delete(handler)
}

// Called once, after the initial unread-count fetch resolves — see the
// doc's "order matters" note in step 1. Safe to call more than once; a
// second call is a no-op while a connection/timer is already active.
export function connectNotificationsHub(): void {
  if (typeof window === 'undefined') return
  if (connection || mockTimer) return

  if (MOCK_AUTH) {
    mockTimer = setInterval(() => emitNotification(pushSimulatedNotification()), MOCK_PUSH_INTERVAL_MS)
    return
  }

  connection = new signalR.HubConnectionBuilder()
    // Same-origin via the /hubs/* rewrite in next.config.mjs — withCredentials
    // so the browser's httpOnly session cookie rides along, same reasoning
    // as client.ts's credentials:'include' on every REST call.
    .withUrl('/hubs/notifications', { withCredentials: true })
    .withAutomaticReconnect()
    .build()

  connection.on('notification', (n: NotificationItem) => emitNotification(n))
  connection.onreconnected(() => reconnectHandlers.forEach(h => h()))

  connection.start().catch(err => {
    console.warn('[notifications] hub failed to connect', err)
  })
}

// Per the doc: a stale connection keeps receiving pushes for the previous
// user until the cookie expires, so this must run on logout, not just tab
// close.
export function disconnectNotificationsHub(): void {
  if (mockTimer) {
    clearInterval(mockTimer)
    mockTimer = null
  }
  if (connection) {
    connection.stop().catch(() => {})
    connection = null
  }
}

// Orchestrates the doc's step-1 ordering: the unread-count fetch must
// resolve (or fail) before the hub connects, so a user with 12 unread
// notifications doesn't see the badge sit at 0 while the socket — which can
// only deliver what arrives from now on — opens first. `fetchUnreadCount`
// is supplied by the caller (useNotifications.ts's bridge hook) since it
// needs react-query's cache, not this module. Idempotent — safe to call on
// every navigation; only the first call after a login (or after
// endNotificationsSession() below) actually does anything.
export function startNotificationsSession(fetchUnreadCount: () => Promise<unknown>): void {
  if (sessionStarted) return
  sessionStarted = true
  fetchUnreadCount()
    .catch(() => {})
    .finally(() => connectNotificationsHub())
}

// Pairs with startNotificationsSession — called on logout so a later login
// in the same tab (different user) genuinely restarts the count-then-connect
// sequence instead of finding sessionStarted still true from before.
export function endNotificationsSession(): void {
  sessionStarted = false
  disconnectNotificationsHub()
}

// Dev/test aid — the header bell's "Simulate new notification" button calls
// this to fire one immediately rather than waiting out the mock interval.
// No-op for real (non-mock) sessions.
export function triggerSimulatedNotification(): void {
  if (!MOCK_AUTH) return
  emitNotification(pushSimulatedNotification())
}
