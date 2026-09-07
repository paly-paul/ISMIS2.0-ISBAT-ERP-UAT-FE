import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationItem,
  NotificationListParams,
  NotificationListResult,
} from '@/lib/api/notifications'
import { onHubReconnected, onNotification, startNotificationsSession } from '@/lib/notificationsHub'

const UNREAD_COUNT_KEY = ['notifications', 'unread-count']
const LIST_KEY_BASE = ['notifications', 'list']
const PREVIEW_KEY = ['notifications', 'preview']
const PREVIEW_SIZE = 8

// Fetched once per login (see the hub bridge below for the "count, then
// connect" ordering) and never polled afterward — from then on the hub
// bridge is what keeps this fresh (a push bumps it by 1; a reconnect heals
// it with a fresh fetch). See notification-bell.md's "Never polled" rule.
export function useUnreadCount() {
  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: getUnreadCount,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

// Fetch-on-open, not cache-and-reuse — the doc is explicit that socket
// memory is incomplete after a refresh or a dropped connection, so the
// endpoint is the authoritative view every time. `enabled` lets the caller
// (Header's dropdown, the notifications page) mount this only while it's
// actually open/visible, matching "fetch every time the dropdown opens".
export function useNotificationsList(params: NotificationListParams, enabled = true) {
  return useQuery({
    queryKey: [...LIST_KEY_BASE, params],
    queryFn: () => getNotifications(params),
    enabled,
    staleTime: 5000,
  })
}

// Backs the header bell's hover dropdown. Unlike useNotificationsList above,
// this is deliberately NOT fetch-on-open — an earlier version fetched on
// every mouseenter, which showed up as an unwanted poll in the network tab.
// Fetched once per login (mirrors useUnreadCount's "count, then connect"
// timing below) and kept current entirely from there: a live push prepends
// itself directly (see useNotificationsHubBridge), a reconnect heals it with
// one refetch, and mark-read/mark-all-read trim it — hovering the bell never
// triggers a request of its own.
export function useNotificationsPreview() {
  return useQuery({
    queryKey: PREVIEW_KEY,
    queryFn: () => getNotifications({ page: 1, size: PREVIEW_SIZE, unreadOnly: true }),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => markNotificationRead(guid),
    onMutate: async (guid) => {
      await queryClient.cancelQueries({ queryKey: UNREAD_COUNT_KEY })
      await queryClient.cancelQueries({ queryKey: LIST_KEY_BASE })
      await queryClient.cancelQueries({ queryKey: PREVIEW_KEY })

      queryClient.setQueryData<number>(UNREAD_COUNT_KEY, old => Math.max(0, (old ?? 0) - 1))
      queryClient.setQueriesData<NotificationListResult>({ queryKey: LIST_KEY_BASE }, old =>
        old ? { ...old, items: old.items.map(n => (n.notificationGuid === guid ? { ...n, isRead: true } : n)) } : old,
      )
      queryClient.setQueryData<NotificationListResult>(PREVIEW_KEY, old =>
        old ? { items: old.items.filter(n => n.notificationGuid !== guid), totalCount: Math.max(0, old.totalCount - 1) } : old,
      )
    },
    // The response *is* the new badge value — set it directly rather than
    // refetching unread-count, per the doc. Every call site fires
    // .mutate() and navigates immediately without awaiting it, so a 404
    // (already read, or a double-click race) never blocks navigation or
    // shows an error — it just leaves the badge wherever it was, matching
    // "not an error worth showing the user".
    onSuccess: (remaining, guid) => {
      // Sometimes the backend response shape varies; only update if we got a valid number
      if (typeof remaining === 'number') {
        queryClient.setQueryData(UNREAD_COUNT_KEY, remaining)
      }
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.setQueryData(UNREAD_COUNT_KEY, 0)
      queryClient.setQueriesData<NotificationListResult>({ queryKey: LIST_KEY_BASE }, old =>
        old ? { ...old, items: old.items.map(n => ({ ...n, isRead: true })) } : old,
      )
      // Everything just became read — nothing left for the unread-only preview.
      queryClient.setQueryData<NotificationListResult>(PREVIEW_KEY, { items: [], totalCount: 0 })
    },
  })
}

// Mounted once, app-wide, from providers.tsx (same reasoning as
// SessionKeepAlive there). Owns the doc's full live-update lifecycle:
// count-then-connect on login, badge bump + list invalidation on push, and
// healing on reconnect. Not a per-component concern — the header bell, the
// toast host, and the notifications page all just read from the query cache
// this keeps up to date, via useUnreadCount/useNotificationsList above.
export function useNotificationsHubBridge(enabled: boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled) return

    startNotificationsSession(() =>
      queryClient.fetchQuery({ queryKey: UNREAD_COUNT_KEY, queryFn: getUnreadCount, staleTime: Infinity }),
    )
    // Seeds the bell's hover preview once per login — doesn't gate the hub
    // connect like the unread-count fetch above, it's just a starting point
    // for the prepend-on-push below to build on.
    queryClient.fetchQuery({
      queryKey: PREVIEW_KEY,
      queryFn: () => getNotifications({ page: 1, size: PREVIEW_SIZE, unreadOnly: true }),
      staleTime: Infinity,
    })

    const offNotification = onNotification(n => {
      queryClient.setQueryData<number>(UNREAD_COUNT_KEY, c => (c ?? 0) + 1)
      // Only actually refetches list queries currently mounted/observed
      // (i.e. the notifications page is open) — react-query skips inactive
      // ones, so this doesn't eagerly load a page nobody's looking at.
      queryClient.invalidateQueries({ queryKey: LIST_KEY_BASE })
      // The preview is always mounted (the header bell reads it regardless
      // of hover state) but deliberately isn't refetched — a push already
      // hands us the full item, so prepend it directly instead of spending
      // a request to re-fetch what we already have.
      queryClient.setQueryData<NotificationListResult>(PREVIEW_KEY, old =>
        old
          ? { items: [n, ...old.items].slice(0, PREVIEW_SIZE), totalCount: old.totalCount + 1 }
          : { items: [n], totalCount: 1 },
      )
    })

    const offReconnect = onHubReconnected(() => {
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY })
      queryClient.invalidateQueries({ queryKey: LIST_KEY_BASE })
      // Same "socket's view is incomplete after an outage" reasoning as the
      // two lines above — a real refetch here (not a prepend) is the only
      // way to heal whatever the preview missed while disconnected.
      queryClient.invalidateQueries({ queryKey: PREVIEW_KEY })
    })

    return () => {
      offNotification()
      offReconnect()
    }
  }, [enabled, queryClient])
}

// Subscribes directly to live hub pushes rather than diffing a polled query
// — used by NotificationToastHost, which needs the raw NotificationItem the
// instant it arrives to spawn a toast, not just a badge count.
export function useNotificationPush(handler: (n: NotificationItem) => void) {
  useEffect(() => onNotification(handler), [handler])
}

export type { NotificationItem, NotificationListParams, NotificationListResult }
