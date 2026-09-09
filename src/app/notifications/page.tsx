'use client'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationsList, useUnreadCount } from '@/hooks/useNotifications'
import { notificationHref, notificationTypeLabel, notificationVisual, NotificationItem } from '@/lib/api/notifications'
import { timeAgo } from '@/lib/date'

const PAGE_SIZE = 20

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
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const unreadOnly = activeTab === 'unread'
  const { data: listResult, isLoading, isFetching } = useNotificationsList({ page, size: PAGE_SIZE, search, unreadOnly })
  const totalCount = listResult?.totalCount ?? 0
  const hasMore = items.length < totalCount

  // Infinite scroll observer setup
  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!sentinelRef.current) return
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isFetching && !isLoading) {
          setPage(p => p + 1)
        }
      },
      { rootMargin: '180px' }
    )

    observerRef.current.observe(sentinelRef.current)
    return () => observerRef.current?.disconnect()
  }, [hasMore, isFetching, isLoading])

  // Fallback scroll handler for container
  function handleContainerScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 180) {
      if (hasMore && !isFetching && !isLoading) {
        setPage(p => p + 1)
      }
    }
  }

  // Reset scroll to top when category changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [selectedCategory])

  // Derive categories with counts & unread indicators (preferring backend groups if present)
  const categories = useMemo(() => {
    if (listResult?.groups && Array.isArray(listResult.groups) && listResult.groups.length > 0) {
      return listResult.groups.map(g => {
        const typeCode = g.typeCode || (g.items?.[0]?.typeCode ?? '')
        const groupItems = g.items ?? []
        const count = g.totalCount ?? groupItems.length
        const unread = g.unreadCount ?? groupItems.filter(n => !n.isRead).length
        return {
          typeCode,
          label: g.groupName || notificationTypeLabel(typeCode),
          count,
          unreadCount: unread,
          visual: notificationVisual(typeCode),
        }
      })
    }

    const order: string[] = []
    const byType = new Map<string, NotificationItem[]>()
    for (const n of items) {
      if (!byType.has(n.typeCode)) {
        byType.set(n.typeCode, [])
        order.push(n.typeCode)
      }
      byType.get(n.typeCode)!.push(n)
    }

    return order.map(typeCode => {
      const group = byType.get(typeCode)!
      const unread = group.filter(n => !n.isRead).length
      return {
        typeCode,
        label: notificationTypeLabel(typeCode),
        count: group.length,
        unreadCount: unread,
        visual: notificationVisual(typeCode),
      }
    })
  }, [items, listResult?.groups])

  // Filter items for the selected category on the right panel
  const displayedItems = useMemo(() => {
    if (selectedCategory === 'all') return items
    return items.filter(n => n.typeCode === selectedCategory)
  }, [items, selectedCategory])

  // Total unread among currently loaded items
  const loadedUnreadCount = useMemo(() => items.filter(n => !n.isRead).length, [items])

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Reset to page 1 when search or tab changes
  useEffect(() => {
    setPage(1)
  }, [activeTab, search])

  // Append new items on infinite scroll page increment with deduplication
  useEffect(() => {
    if (!listResult) return
    const newItems = listResult.items ?? []
    setItems(prev => {
      if (page === 1) return newItems
      const existingGuids = new Set(prev.map(n => n.notificationGuid))
      const fresh = newItems.filter(n => !existingGuids.has(n.notificationGuid))
      return [...prev, ...fresh]
    })
  }, [listResult, page])

  useLayoutEffect(() => {
    const el = tabRefs.current[activeTab]
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [activeTab])

  function openNotification(n: NotificationItem) {
    if (!n.isRead) markRead.mutate(n.notificationGuid)
    router.push(notificationHref(n))
  }

  const activeCategoryMeta = useMemo(() => {
    if (selectedCategory === 'all') return null
    return categories.find(c => c.typeCode === selectedCategory) ?? null
  }, [categories, selectedCategory])

  return (
    <div id="page-notifications">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Notifications</div>
          <div className="pg-sub">Enquiries, payments, and academic updates across every module</div>
        </div>
        <button
          className="btn btn-neu"
          disabled={unreadCount === 0 || markAllRead.isPending}
          onClick={() => markAllRead.mutate()}
        >
          <i className="lni lni-checkmark-circle"></i> {markAllRead.isPending ? 'Marking…' : 'Mark all as read'}
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        {/* ── Two-Panel Master-Detail Layout ──────────────────────────── */}
        <div className="ntf-layout">
          {/* ── Left Sidebar (Categories / Groups Grid) ───────────────── */}
          <div className="ntf-sidebar">
            <div className="ntf-sidebar-hdr">
              <span>Groups ({categories.length})</span>
              <span className="badge badge-grey">{totalCount} total</span>
            </div>

            <div className="ntf-sidebar-list">
              {/* All Notifications Option */}
              <button
                type="button"
                className={`ntf-group-nav-item${selectedCategory === 'all' ? ' active' : ''}`}
                onClick={() => setSelectedCategory('all')}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: selectedCategory === 'all' ? 'rgba(255,255,255,0.2)' : 'var(--b100)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: selectedCategory === 'all' ? '#fff' : 'var(--b700)',
                    fontSize: 13,
                  }}
                >
                  <i className="lni lni-grid-alt" />
                </div>
                <div className="ntf-group-nav-title">All Notifications</div>
                <div className="flex items-center" style={{ gap: 6, flexShrink: 0 }}>
                  {loadedUnreadCount > 0 && (
                    <span className="badge badge-blue" style={{ fontSize: 10, padding: '1px 6px' }}>
                      {loadedUnreadCount} new
                    </span>
                  )}
                  <span className="badge badge-grey">{items.length}</span>
                </div>
              </button>

              {/* Categorized Groups */}
              {categories.map(cat => {
                const isSelected = selectedCategory === cat.typeCode
                return (
                  <button
                    key={cat.typeCode}
                    type="button"
                    className={`ntf-group-nav-item${isSelected ? ' active' : ''}`}
                    onClick={() => setSelectedCategory(cat.typeCode)}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--b100)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: isSelected ? '#fff' : 'var(--b700)',
                        fontSize: 13,
                      }}
                    >
                      <i className={`lni ${cat.visual.icon}`} />
                    </div>
                    <div className="ntf-group-nav-title">{cat.label}</div>
                    <div className="flex items-center" style={{ gap: 6, flexShrink: 0 }}>
                      {cat.unreadCount > 0 && (
                        <span className="badge badge-blue" style={{ fontSize: 10, padding: '1px 6px' }}>
                          {cat.unreadCount} new
                        </span>
                      )}
                      <span className="badge badge-grey">{cat.count}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Right Stream (Notifications for selected group) ───────── */}
          <div className="ntf-main">
            {/* Top Toolbar: Search + Filter Tabs */}
            <div className="ntf-main-header">
              <div className="inp-wrap" style={{ maxWidth: 280, width: '100%' }}>
                <span className="inp-icon"><i className="lni lni-search-alt"></i></span>
                <input
                  className="ctrl"
                  placeholder="Search notifications…"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                />
              </div>

              <div className="tab-bar" style={{ margin: 0, border: 'none' }}>
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
            </div>

            {/* Scrollable Notification Stream with Infinite Scroll */}
            <div
              ref={scrollContainerRef}
              className="ntf-main-body"
              onScroll={handleContainerScroll}
            >
              {/* Active Category Banner */}
              <div className="ntf-category-banner">
                <div className="flex items-center" style={{ gap: 10 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: 'var(--b100)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--b700)',
                      fontSize: 12,
                    }}
                  >
                    <i className={`lni ${activeCategoryMeta ? activeCategoryMeta.visual.icon : 'lni-grid-alt'}`} />
                  </div>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--b800)' }}>
                      {activeCategoryMeta ? activeCategoryMeta.label : 'All Notifications'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--g500)', marginLeft: 8 }}>
                      ({displayedItems.length} {displayedItems.length === 1 ? 'item' : 'items'})
                    </span>
                  </div>
                </div>

                {selectedCategory !== 'all' && (
                  <button
                    type="button"
                    className="btn btn-neu btn-xs"
                    onClick={() => setSelectedCategory('all')}
                    style={{ fontSize: 11.5 }}
                  >
                    View All
                  </button>
                )}
              </div>

              {/* Items List or Empty States */}
              {isLoading && page === 1 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 220 }}>
                  <span style={{ color: 'var(--g400)' }}>Loading notifications…</span>
                </div>
              ) : displayedItems.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '48px 24px' }}>
                  <div className="tbl-empty-icon-wrap">
                    <i className="lni lni-inbox" />
                  </div>
                  <div className="tbl-empty-title">
                    {search.trim()
                      ? 'No matching notifications'
                      : activeTab === 'unread'
                      ? "You're all caught up in this section"
                      : 'No notifications in this group'}
                  </div>
                  <div className="tbl-empty-sub">
                    {search.trim()
                      ? 'Try a different search term or select another category.'
                      : activeTab === 'unread'
                      ? 'There are no unread notifications right now.'
                      : 'New updates will appear here as they occur.'}
                  </div>
                </div>
              ) : (
                <div className="ntf-list">
                  {displayedItems.map((n, i) => {
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
              )}

              {/* Infinite scroll sentinel & Loading indicator */}
              <div ref={sentinelRef} style={{ padding: '8px 0', textAlign: 'center' }}>
                {isFetching && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--g400)', padding: '6px 12px' }}>
                    <i className="lni lni-spinner-arrow animate-spin" />
                    <span>Loading more notifications…</span>
                  </div>
                )}
                {!hasMore && items.length > 0 && displayedItems.length > 0 && (
                  <div style={{ fontSize: 11.5, color: 'var(--g400)', padding: '8px 0' }}>
                    Showing all {displayedItems.length} notifications
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
