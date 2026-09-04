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
    staleTime: 0,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => markNotificationRead(guid),
    // The response *is* the new badge value — set it directly rather than
    // refetching unread-count, per the doc. Every call site fires
    // .mutate() and navigates immediately without awaiting it, so a 404
    // (already read, or a double-click race) never blocks navigation or
    // shows an error — it just leaves the badge wherever it was, matching
    // "not an error worth showing the user".
    onSuccess: (remaining, guid) => {
      queryClient.setQueryData(UNREAD_COUNT_KEY, remaining)
      queryClient.setQueriesData<NotificationListResult>({ queryKey: LIST_KEY_BASE }, old =>
        old ? { ...old, items: old.items.map(n => (n.notificationGuid === guid ? { ...n, isRead: true } : n)) } : old,
      )
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

    const offNotification = onNotification(() => {
      queryClient.setQueryData<number>(UNREAD_COUNT_KEY, c => (c ?? 0) + 1)
      // Only actually refetches list queries currently mounted/observed
      // (i.e. the dropdown or the notifications page is open) — react-query
      // skips inactive ones, so this doesn't eagerly load a page nobody's
      // looking at.
      queryClient.invalidateQueries({ queryKey: LIST_KEY_BASE })
    })

    const offReconnect = onHubReconnected(() => {
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY })
      queryClient.invalidateQueries({ queryKey: LIST_KEY_BASE })
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
