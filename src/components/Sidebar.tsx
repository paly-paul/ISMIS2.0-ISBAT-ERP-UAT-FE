'use client'
import { Dispatch, SetStateAction, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMenu } from '@/hooks/users/useMenu'
import { MenuNode } from '@/lib/api/users/menu'

export type RailId = 'admission' | 'academic' | 'finance' | 'student' | 'employee' | 'assessment' | 'config' | 'activity-log'

interface SidebarProps {
  panelOpen: boolean
  setPanelOpen: Dispatch<SetStateAction<boolean>>
  currentPage: string
  collapsedSections: Set<string>
  toggleCollapse: (id: string) => void
  activeRail: RailId
  setActiveRail: Dispatch<SetStateAction<RailId>>
}

interface RailDef {
  id: RailId
  name: string
  fallbackIcon: string
  footer: string
}

// name must match the top-level `name` field the menu API returns for that
// module — used to look the node up in the fetched tree.
const RAIL_DEFS: RailDef[] = [
  { id: 'admission', name: 'Admission', fallbackIcon: 'lni lni-clipboard', footer: 'S1 · Admission Service' },
  { id: 'academic', name: 'Academic', fallbackIcon: 'lni lni-graduation', footer: 'S2 · Academic Service' },
  { id: 'finance', name: 'Finance', fallbackIcon: 'lni lni-dollar', footer: 'S5 · Finance Service' },
  { id: 'student', name: 'Student', fallbackIcon: 'lni lni-user', footer: 'S10 · Student Service' },
  { id: 'employee', name: 'Employee', fallbackIcon: 'lni lni-briefcase', footer: 'S4 · Employee Service' },
  { id: 'assessment', name: 'Assessment', fallbackIcon: 'lni lni-pencil-alt', footer: 'S4 · Evaluation Lifecycle' },
  { id: 'config', name: 'Config', fallbackIcon: 'lni lni-cog', footer: 'S0 · Core Config' },
  { id: 'activity-log', name: 'Activity Log', fallbackIcon: 'lni lni-list', footer: 'S0 · Audit & Activity' },
]

// Cosmetic-only counters — the menu API carries no notion of these, so they
// stay local and are keyed by the leaf's url slug. Real permission data from
// the API still decides what's visible; this only decorates what's shown.
const BADGES: Record<string, { text: string; variant?: 'warn' | 'green' }> = {
  'enquiry-list': { text: '8' },
  'enquiry-followup': { text: '4', variant: 'warn' },
  payment: { text: '12' },
  filing: { text: '7', variant: 'warn' },
  vetting: { text: '5', variant: 'warn' },
  registration: { text: '3', variant: 'green' },
  'session-movement': { text: '1', variant: 'warn' },
  'odl-applications': { text: '7' },
  'odl-reconciliation': { text: '4', variant: 'warn' },
  'cw-qbank': { text: '3', variant: 'warn' },
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// The backend's `url` field is a bare slug ("permission-master"), not the
// full path ("/config/permission-master") docs/MENU_ROUTES_REFERENCE.md
// specified — confirmed via a real /me/menu response. A relative href would
// resolve against whatever page the user is currently on (e.g. clicking a
// Config item while on /academic/* would 404 at /academic/permission-master),
// so every leaf is resolved against its own module's route segment here.
// Still honours an absolute path if the backend ever does send one.
function resolveHref(url: string, railId: RailId): string {
  return url.startsWith('/') ? url : `/${railId}/${url}`
}

function idFromUrl(url: string): string {
  return url.split('/').filter(Boolean).pop()!
}

// Sidebar entries hidden from navigation without touching the backend menu
// tree or deleting the page itself — keyed by the same url-slug idFromUrl()
// resolves for every other leaf (BADGES above, sb-item's `active` state).
// Ledger Adjustments: commented out per request (2026-09-07) — that page is
// still a UI-only mock (see AdjustLedgerModal.tsx's own comment: no backing
// "ledger adjustment" endpoint exists in the API spec yet), so it stays out
// of the menu until there's something real behind it. The route/page are
// left in place, just unreachable from here.
const HIDDEN_ITEM_IDS = new Set<string>([
  'ledger-adjustments',
])

// Client-side reorder for Finance's own Payment Collection items, per
// request (2026-09-07) — the backend menu API decides sidebar order, so
// there's no static array to reorder in-place the way a hardcoded nav
// would; this re-sorts whichever children array these slugs turn up in
// instead. Listed items move to the front in this exact order; anything
// not listed here (a section header, another module's items, a future
// Finance page not yet accounted for) keeps its original relative order
// and simply follows after — a plain index lookup used as a stable-sort
// key achieves both at once.
const ORDER_PRIORITY = [
  'dashboard',
  'payment-console',
  'payment-console-adjustments',
  'nche-guild-payment',
  'advanced-payments',
  'discount-allocation',
  'payment-refund',
  'payment-history',
  'exchange-rates',
]

function orderIndex(item: MenuNode): number {
  if (!item.url) return ORDER_PRIORITY.length
  const i = ORDER_PRIORITY.indexOf(idFromUrl(item.url))
  return i === -1 ? ORDER_PRIORITY.length : i
}

// railId scopes ORDER_PRIORITY's re-sort to Finance only — several other
// modules have their own "Dashboard" leaf sharing the exact slug ORDER_
// PRIORITY matches on, and re-sorting every module just because Finance's
// own order was requested would silently reshuffle navigation nobody asked
// to change. The hide-filter has no such collision risk (HIDDEN_ITEM_IDS is
// currently Finance-only anyway) so it stays applied everywhere.
// Defends against the backend permission model occasionally granting the
// same page twice within one section's children (seen on the real /me/menu
// response for Config > Access Control > Permission Master, where
// mergeConfigSections' fallback leaf and the backend's own leaf land side by
// side) — the mock menu never has duplicates, so this only ever bites with
// NEXT_PUBLIC_RBAC_MOCK (or AUTH_MOCK) off. Compares resolveHref() output,
// not the raw url — the fallback uses an absolute path ("/config/
// permission-master") while the backend sends a bare slug
// ("permission-master"), so the raw strings differ even though both resolve
// to the identical href sbItem keys its <Link> on. Without deduping on the
// resolved value, two leaves collide on that key, which React logs as a
// duplicate-key error and can silently drop/duplicate the rendered item.
function dedupeByHref(children: MenuNode[], railId: RailId): MenuNode[] {
  const seen = new Set<string>()
  return children.filter(c => {
    if (!c.url) return true
    const href = resolveHref(c.url, railId)
    if (seen.has(href)) return false
    seen.add(href)
    return true
  })
}

function visibleChildren(children: MenuNode[], railId: RailId): MenuNode[] {
  const filtered = dedupeByHref(children, railId).filter(c => !c.url || !HIDDEN_ITEM_IDS.has(idFromUrl(c.url)))
  if (railId !== 'finance') return filtered
  // Array.prototype.sort is a stable sort in every engine this app ships
  // to (spec-guaranteed since ES2019) — items tied on orderIndex (i.e.
  // every unlisted one) keep the relative order the API sent them in.
  return filtered.sort((a, b) => orderIndex(a) - orderIndex(b))
}

export function Sidebar({ panelOpen, setPanelOpen, currentPage, collapsedSections, toggleCollapse, activeRail, setActiveRail }: SidebarProps) {
  const router = useRouter()
  const { data, isLoading, isError, refetch } = useMenu()
  const menu = data?.menu
  const isFallback = data?.isFallback ?? false

  // No route-warming effect here on purpose. A prior version fired
  // router.prefetch() for every route in the active module in one tight
  // loop — that's a no-op in `next dev` (prefetch is suppressed there, so it
  // looked harmless locally), but a production build issues each as a real
  // request, and even scoped to just one module (16+ routes under /academic
  // alone) that was enough to flood the Network tab and trip a
  // rate/concurrency limit on Vercel. next/link's own default auto-prefetch
  // turned out to cause the identical burst for the same reason (it fires
  // per-<Link> on viewport entry, not on hover), so every panel item below
  // is rendered with prefetch={false} instead — see sbItem().

  const moduleByName = useMemo(() => {
    const map = new Map<string, MenuNode>()
    menu?.forEach(n => map.set(n.name, n))
    return map
  }, [menu])

  function sbItem(item: MenuNode, railId: RailId) {
    const iconClass = item.icon ?? 'lni lni-dot'
    if (!item.url) {
      return (
        <span key={item.name} className="sb-item sb-item-disabled" aria-disabled="true" title="No page yet">
          <span className="sb-icon"><i className={iconClass}></i></span>
          {item.name}
          <span className="sb-badge sb-badge-soon">Soon</span>
        </span>
      )
    }
    const id = idFromUrl(item.url)
    const href = resolveHref(item.url, railId)
    const badge = BADGES[id]
    return (
      // prefetch={false} — next/link's default auto-prefetch fires for every
      // rendered <Link> as soon as it's in the viewport, not just on hover.
      // With ~15-20 items visible in one module's panel at once, that's the
      // same burst-of-requests problem the removed router.prefetch() loop
      // caused, just coming from Link's own built-in behavior instead. Only
      // the item the user actually points at needs warming.
      <Link key={href} href={href} prefetch={false} className={`sb-item${currentPage === id ? ' active' : ''}`}>
        <span className="sb-icon"><i className={iconClass}></i></span>
        {item.name}
        {badge && <span className={`sb-badge${badge.variant ? ' ' + badge.variant : ''}`}>{badge.text}</span>}
      </Link>
    )
  }

  function sbSection(moduleName: string, section: MenuNode, railId: RailId) {
    const id = `sc-${slug(moduleName)}-${slug(section.name)}`
    const collapsed = collapsedSections.has(id)
    return (
      <div key={id} className={`sb-collapse${collapsed ? ' closed' : ''}`}>
        <div className="sb-group-hdr" onClick={() => toggleCollapse(id)}>
          <span>{section.name}</span><span className="sb-chevron">{collapsed ? '▸' : '▾'}</span>
        </div>
        <div className="sb-collapse-body">
          {visibleChildren(section.children, railId).map(item => sbItem(item, railId))}
        </div>
      </div>
    )
  }

  function clickRail(rail: RailId) {
    if (activeRail === rail) {
      setPanelOpen(p => !p)
    } else {
      setActiveRail(rail)
      setPanelOpen(true)
      router.push(`/${rail}`)
    }
  }

  function renderRailSlot(def: RailDef) {
    if (isLoading) return <div key={def.id} className="rail-item rail-item-skeleton" aria-hidden="true" />
    if (isError) return null
    const node = moduleByName.get(def.name)
    if (!node) return null
    const icon = node.icon ?? def.fallbackIcon
    return (
      <div
        key={def.id}
        className={`rail-item${activeRail === def.id ? ' active' : ''}`}
        data-mod={def.id}
        onClick={() => clickRail(def.id)}
        style={{ cursor: 'pointer' }}
      >
        <span className="rail-icon"><i className={icon}></i></span>
        <span className="rail-label">{node.name}</span>
        {activeRail === def.id && panelOpen && <span className="rail-dot"></span>}
        <span className="rail-tooltip">{panelOpen && activeRail === def.id ? 'Hide panel' : node.name}</span>
      </div>
    )
  }

  function renderPanel(def: RailDef) {
    const node = moduleByName.get(def.name)
    if (!node) {
      return (
        <div className="sb-panel-noaccess">
          <i className="lni lni-lock"></i>
          <div className="sb-panel-error-title">No access to {def.name}</div>
          <div className="sb-panel-error-sub">You don&apos;t have permission to view this module.</div>
        </div>
      )
    }
    return (
      <>
        <div className="sb-panel-hdr">
          <div className="sb-panel-hdr-title">Module</div>
          <div className="sb-panel-hdr-name"><i className={node.icon ?? def.fallbackIcon}></i> {node.name}</div>
        </div>
        {visibleChildren(node.children, def.id).map(section => (section.children.length > 0 ? sbSection(node.name, section, def.id) : sbItem(section, def.id)))}
        <div className="sb-panel-footer">{def.footer}</div>
      </>
    )
  }

  const activeDef = RAIL_DEFS.find(d => d.id === activeRail)!

  // renderRailSlot(def) returns null for a module the user has no access to
  // (moduleByName.get(def.name) misses) — everything else here (the two
  // locked "Coming Soon" placeholders, the loading skeleton) always
  // renders something. Dividers used to be hardcoded between every pair of
  // slots regardless, so a null slot (e.g. no Config access) left two
  // .rail-dividers stacked back-to-back with nothing between them — a
  // visibly doubled line right above whatever module happened to follow
  // (confirmed live: Activity Log, when Config returned null). Built as a
  // {key, node} list and filtered first instead, so a divider only ever
  // renders between two slots that both actually rendered something.
  const railSlots: { key: string; node: React.ReactNode }[] = [
    { key: 'admission', node: renderRailSlot(RAIL_DEFS[0]) },
    { key: 'academic', node: renderRailSlot(RAIL_DEFS[1]) },
    { key: 'finance', node: renderRailSlot(RAIL_DEFS[2]) },
    { key: 'student', node: renderRailSlot(RAIL_DEFS[3]) },
    {
      key: 'attendance',
      node: (
        <div className="rail-item locked" data-mod="attendance">
          <span className="rail-icon"><i className="lni lni-alarm-clock"></i></span>
          <span className="rail-label">Attendance</span>
          <span className="rail-tooltip">Attendance · Coming Soon</span>
        </div>
      ),
    },
    {
      key: 'analytics',
      node: (
        <div className="rail-item locked" data-mod="analytics">
          <span className="rail-icon"><i className="lni lni-bar-chart"></i></span>
          <span className="rail-label">Analytics</span>
          <span className="rail-tooltip">Analytics · Coming Soon</span>
        </div>
      ),
    },
    { key: 'employee', node: renderRailSlot(RAIL_DEFS[4]) },
    { key: 'assessment', node: renderRailSlot(RAIL_DEFS[5]) },
    { key: 'config', node: renderRailSlot(RAIL_DEFS[6]) },
    { key: 'activity-log', node: renderRailSlot(RAIL_DEFS[7]) },
  ]
  const visibleRailSlots = railSlots.filter(s => s.node)

  return (
    <div className="sidebar">
      <div className="sb-rail bg-bg">
        {visibleRailSlots.map((slot, i) => (
          // display: contents keeps the wrapper out of .sb-rail's own flex
          // layout (flex column + gap) — its children (the divider, the
          // slot itself) participate directly as if there were no wrapper.
          <div key={slot.key} style={{ display: 'contents' }}>
            {i > 0 && <div className="rail-divider"></div>}
            {slot.node}
          </div>
        ))}
        <div className="rail-spacer"></div>
        {/* Admin (User & Role) — commented out per request, not deleted, in
            case a real backend-driven module takes its place later. Its
            settings-cog icon duplicated Config's own fallback icon, and
            Config now sits right above Assessment instead of trailing all
            the way at the bottom, so this locked placeholder no longer has
            a clear spot to live in.
        <div className="rail-divider"></div>
        <div className="rail-item locked" data-mod="userrole">
          <span className="rail-icon"><i className="lni lni-cog"></i></span>
          <span className="rail-label">Admin</span>
          <span className="rail-tooltip">User &amp; Role · Coming Soon</span>
        </div>
        */}
      </div>

      <div className={`sb-panel-shell${panelOpen ? ' open' : ''}`}>
        <div className={`sb-panel${panelOpen ? ' active' : ''}`}>
          {isLoading && (
            <div className="sb-panel-skeleton">
              <div className="sb-skel-line" style={{ width: '58%' }}></div>
              <div className="sb-skel-line" style={{ width: '82%' }}></div>
              <div className="sb-skel-line" style={{ width: '68%' }}></div>
              <div className="sb-skel-line" style={{ width: '74%' }}></div>
              <div className="sb-skel-line" style={{ width: '50%' }}></div>
            </div>
          )}
          {isError && (
            <div className="sb-panel-error">
              <i className="lni lni-warning"></i>
              <div className="sb-panel-error-title">Couldn&apos;t load menu</div>
              <div className="sb-panel-error-sub">Check your connection and try again.</div>
              <button className="btn btn-neu btn-sm" onClick={() => refetch()}>
                <i className="lni lni-reload"></i> Retry
              </button>
            </div>
          )}
          {!isLoading && !isError && isFallback && (
            <div className="sb-panel-fallback" title="Couldn't verify permissions from the server — showing the full navigation menu instead. Access shown here isn't confirmed.">
              <i className="lni lni-warning"></i>
              <span>Menu permissions unavailable — showing full navigation</span>
              <button className="sb-panel-fallback-retry" onClick={() => refetch()} aria-label="Retry loading real permissions">
                <i className="lni lni-reload"></i>
              </button>
            </div>
          )}
          {!isLoading && !isError && renderPanel(activeDef)}
        </div>
      </div>

      <button
        className="sb-toggle"
        onClick={() => setPanelOpen(p => !p)}
        aria-label={panelOpen ? 'Collapse menu' : 'Expand menu'}
      >
        <i className={`lni ${panelOpen ? 'lni-chevron-left' : 'lni-chevron-right'}`}></i>
      </button>
    </div>
  )
}
