'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationsList, useUnreadCount } from '@/hooks/useNotifications'
import { notificationHref, notificationVisual, NotificationItem } from '@/lib/api/notifications'
import { timeAgo } from '@/lib/date'

const PAGE_SIZE = 20

// Only All/Unread — the confirmed list endpoint only supports filtering by
// `search` and `unreadOnly` (see notification-bell.md's API table); there's
// no server-side "read only" counterpart, and filtering client-side would
// only ever cover whatever page happens to be loaded, unlike every other
// tab/filter here which is genuinely server-side. Dropped rather than
// faking a Read tab that quietly behaves differently from the other two.
type Tab = 'all' | 'unread'
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: 'lni-list' },
  { id: 'unread', label: 'Unread', icon: 'lni-envelope' },
]

export default function NotificationsPage() {
  const router = useRouter()
  const { data: unreadCount = 0 } = useUnreadCount()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const [activeTab, setActiveTab] = useState<Tab>('all')
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement>>>({})
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<NotificationItem[]>([])

  const unreadOnly = activeTab === 'unread'
  const { data: listResult, isLoading, isFetching } = useNotificationsList({ page, size: PAGE_SIZE, search, unreadOnly })
  const totalCount = listResult?.totalCount ?? 0
  const hasMore = items.length < totalCount

  // Debounce the raw input (~300ms per the doc) rather than a request per
  // keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Always reset to page 1 when the tab or the (debounced) search term
  // changes — "always reset to page=1 when the term changes" per the doc,
  // same for switching the unreadOnly filter.
  useEffect(() => {
    setPage(1)
  }, [activeTab, search])

  // Page 1 replaces what's shown; "load more" (page > 1) appends, carrying
  // the current search/unreadOnly forward — same shape as the header bell's
  // own dropdown.
  useEffect(() => {
    if (!listResult) return
    setItems(prev => (page === 1 ? listResult.items : [...prev, ...listResult.items]))
  }, [listResult, page])

  useLayoutEffect(() => {
    const el = tabRefs.current[activeTab]
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [activeTab])

  function openNotification(n: NotificationItem) {
    if (!n.isRead) markRead.mutate(n.notificationGuid)
    router.push(notificationHref(n))
  }

  return (
    <div id="page-notifications">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Notifications</div>
          <div className="pg-sub">Enquiries, payments, and academic updates across every module</div>
        </div>
        <button className="btn btn-neu" disabled={unreadCount === 0 || markAllRead.isPending} onClick={() => markAllRead.mutate()}>
          <i className="lni lni-checkmark-circle"></i> {markAllRead.isPending ? 'Marking…' : 'Mark all as read'}
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between" style={{ padding: '14px 18px 14px' }}>
          <div className="inp-wrap" style={{ maxWidth: 280, width: '100%' }}>
            <span className="inp-icon"><i className="lni lni-search-alt"></i></span>
            <input
              className="ctrl"
              placeholder="Search notifications…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>
        </div>
        <div className="tab-bar">
          {TABS.map(t => (
            <button
              key={t.id}
              ref={el => { if (el) tabRefs.current[t.id] = el }}
              className={`tab-btn${activeTab === t.id ? ' active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              <i className={`lni ${t.icon}`} /> {t.label}
              {t.id === 'unread' && <span className="badge badge-grey" style={{ marginLeft: 2 }}>{unreadCount}</span>}
            </button>
          ))}
          <span className="tab-indicator" style={{ left: indicator.left, width: indicator.width }} />
        </div>

        <div key={activeTab} className="tab-panel-in" style={{ padding: 18 }}>
          {isLoading && page === 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
              <span style={{ color: 'var(--g400)' }}>Loading notifications…</span>
            </div>
          ) : items.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '48px 24px' }}>
              <div className="tbl-empty-icon-wrap">
                <i className="lni lni-inbox" />
              </div>
              <div className="tbl-empty-title">
                {search.trim() ? 'No matching notifications' : activeTab === 'unread' ? "You're all caught up" : 'No notifications yet'}
              </div>
              <div className="tbl-empty-sub">
                {search.trim()
                  ? 'Try a different search term.'
                  : activeTab === 'unread'
                    ? 'There are no unread notifications right now.'
                    : 'New enquiries, payments, and updates will show up here as they happen.'}
              </div>
            </div>
          ) : (
            <>
              <div className="ntf-list">
                {items.map((n, i) => {
                  const visual = notificationVisual(n.typeCode)
                  return (
                    <button
                      key={n.notificationGuid}
                      className={`ntf-item${n.isRead ? '' : ' unread'}`}
                      style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                      onClick={() => openNotification(n)}
                    >
                      <span className={`ntf-dot ${visual.tone}`}><i className={`lni ${visual.icon}`}></i></span>
                      <span className="ntf-content">
                        <span className="ntf-top-row">
                          <span className="ntf-title">{n.title}</span>
                          {!n.isRead && <span className="ntf-unread-mark"></span>}
                          <span className="ntf-time">{timeAgo(n.createdDate)}</span>
                        </span>
                        <span className="ntf-body">{n.body}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center justify-between mt-3" style={{ fontSize: 12.5, color: 'var(--g500)' }}>
                <span>Showing {items.length} of {totalCount.toLocaleString()}</span>
                {hasMore && (
                  <button className="btn btn-neu btn-sm" disabled={isFetching} onClick={() => setPage(p => p + 1)}>
                    {isFetching ? 'Loading…' : 'Load more'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
