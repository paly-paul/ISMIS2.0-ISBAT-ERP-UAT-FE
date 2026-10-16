'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { flattenMenuPages, AppPage } from '@/lib/api/users/menu'
import { useMenu } from '@/hooks/users/useMenu'
import { getSessionIdentity } from '@/lib/session'

// App-wide 404 — "This page skipped class.": a week's timetable where the
// requested page is the one empty slot. Client-only: in the static S3 build
// this renders as 404.html, so the requested address is read from
// window.location after mount.
//
// RBAC: the "Or jump to" links, closest matches and page search only ever
// use the user's own menu (useMenu — the same /me/menu result the sidebar
// is built from). Signed-out visitors get no page list, and neither does a
// session whose menu failed to load (isFallback isn't permission-checked).

const EXTRA_PAGES: AppPage[] = [
  { name: 'My Profile', url: '/profile', module: 'Account', section: null },
  { name: 'Notifications', url: '/notifications', module: 'Account', section: null },
]

const DASHBOARD = '/academic/acad-dashboard'

// Mon–Thu × 3 periods; null is the slot the page should have been in.
type Slot = 'Lecture' | 'Lab' | 'Seminar' | 'Study' | null
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu']
const WEEK: Slot[][] = [
  ['Lecture', 'Lab', 'Seminar', 'Study'],
  ['Lab', null, 'Study', 'Lecture'],
  ['Study', 'Seminar', 'Lab', 'Lecture'],
]

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

const similarity = (a: string, b: string) => (!a || !b ? 0 : 1 - levenshtein(a, b) / Math.max(a.length, b.length))

// How close a typed address is to a real page: edit distance on the last
// path segment (against the page's slug and name), plus credit for shared
// words and for the same module.
function score(path: string, page: AppPage): number {
  const segs = path.split('/').filter(Boolean)
  const last = norm(segs[segs.length - 1] ?? '')
  if (!last) return 0
  const pageSegs = page.url.split('/').filter(Boolean)
  const slug = norm(pageSegs[pageSegs.length - 1] ?? '')
  const name = norm(page.name)
  let s = Math.max(similarity(last, slug), similarity(last, name))
  if (last.length >= 3 && (slug.includes(last) || name.includes(last))) s += 0.25
  const words = new Set(`${slug} ${name}`.split(' '))
  const lastWords = last.split(' ')
  s += 0.3 * (lastWords.filter(w => w.length > 2 && words.has(w)).length / lastWords.length)
  if (segs[0] && segs[0] === pageSegs[0]) s += 0.15
  return s
}

export default function NotFound() {
  const router = useRouter()
  const [path, setPath] = useState('')
  const [signedIn, setSignedIn] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const { data: menuResult, isLoading: menuLoading, isError: menuError } = useMenu(signedIn)
  const pagesAvailable = signedIn && !!menuResult && !menuResult.isFallback
  const pages = useMemo(
    () => (pagesAvailable && menuResult ? [...flattenMenuPages(menuResult.menu), ...EXTRA_PAGES] : []),
    [pagesAvailable, menuResult],
  )

  useEffect(() => {
    setPath(decodeURIComponent(window.location.pathname).replace(/\/+$/, '') || '/')
    setSignedIn(!!getSessionIdentity())
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '/' && searchRef.current && document.activeElement !== searchRef.current) { e.preventDefault(); searchRef.current.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Closest matches to the mistyped address, else the first pages of the
  // user's own menu — always 4 or fewer, always ones they can open.
  const matches = useMemo(() => {
    if (!path || pages.length === 0) return []
    return pages
      .map(p => ({ page: p, s: score(path, p) }))
      .filter(x => x.s >= 0.5)
      .sort((a, b) => b.s - a.s)
      .slice(0, 4)
      .map(x => x.page)
  }, [pages, path])
  const jumpLinks = matches.length > 0 ? matches : pages.filter(p => p.module !== 'Account').slice(0, 4)

  const results = useMemo(() => {
    const words = norm(query).split(' ').filter(Boolean)
    if (words.length === 0) return []
    return pages
      .filter(p => { const hay = norm(`${p.name} ${p.section ?? ''} ${p.module}`); return words.every(w => hay.includes(w)) })
      .slice(0, 6)
  }, [pages, query])

  // Home is the Academic dashboard when the user has it, otherwise the first
  // page of their own menu — never a module they can't open.
  const homeHref = !pagesAvailable || pages.some(p => p.url === DASHBOARD) ? DASHBOARD : pages[0]?.url ?? '/profile'
  const home = signedIn
    ? { href: homeHref, label: 'Back to dashboard' }
    : { href: '/login/staff', label: 'Sign in' }

  function goBack() {
    if (window.history.length > 1) router.back()
    else router.push(home.href)
  }

  return (
    <main className="nf">
      <div className="nf-shell">
      <header className="nf-brand">
        <span className="nf-brand-mark" aria-hidden="true">IS</span>
        <span className="nf-brand-name">ISBAT University ERP</span>
      </header>

      <div className="nf-stage">
        <section className="nf-copy" aria-labelledby="nf-title">
          <p className="nf-code">Error 404</p>
          <h1 id="nf-title" className="nf-title">This page skipped class.</h1>
          <p className="nf-lead">
            We couldn&rsquo;t find the page you were looking for. It may have moved, been renamed, or the link you followed is out of date.
          </p>
          {path && path !== '/' && <p className="nf-path">You tried <code>{path}</code></p>}

          <div className="nf-actions">
            <Link href={home.href} className="btn btn-primary nf-btn" prefetch={false}>{home.label}</Link>
            <button type="button" className="btn btn-neu nf-btn" onClick={goBack}>Go back</button>
          </div>

          <div className="nf-more">
            {!signedIn ? (
              <p className="nf-note">Sign in to see the pages you can open.</p>
            ) : !pagesAvailable ? (
              <p className="nf-note" aria-live="polite">
                {menuLoading
                  ? <><span className="nf-spinner" aria-hidden="true"></span> Loading your pages…</>
                  : (menuError || menuResult?.isFallback) && 'Your page list couldn’t be loaded right now.'}
              </p>
            ) : (
              <>
                {jumpLinks.length > 0 && (
                  <nav className="nf-jump" aria-label={matches.length > 0 ? 'Closest matches' : 'Your pages'}>
                    <span>{matches.length > 0 ? 'Did you mean' : 'Or jump to'}</span>
                    {jumpLinks.map(p => (
                      <Link key={p.url} href={p.url} prefetch={false} title={[p.module, p.section, p.name].filter(Boolean).join(' › ')}>{p.name}</Link>
                    ))}
                  </nav>
                )}
                <form className="nf-search" role="search" onSubmit={e => { e.preventDefault(); if (results[0]) router.push(results[0].url) }}>
                  <label htmlFor="nf-q" className="sr-only">Find a page</label>
                  <div className="nf-search-box">
                    <i className="lni lni-search-alt" aria-hidden="true"></i>
                    <input
                      id="nf-q"
                      ref={searchRef}
                      type="search"
                      autoComplete="off"
                      placeholder="Find a page you have access to…"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      aria-controls="nf-results"
                    />
                    <kbd aria-hidden="true">/</kbd>
                  </div>
                  {query.trim() && (
                    <ul id="nf-results" className="nf-results" aria-live="polite">
                      {results.length === 0 ? (
                        <li className="nf-results-empty">No page matches &ldquo;{query.trim()}&rdquo;.</li>
                      ) : results.map(p => (
                        <li key={p.url}>
                          <Link href={p.url} prefetch={false}>
                            <span className="nf-results-name">{p.name}</span>
                            <span className="nf-results-meta">{[p.module, p.section].filter(Boolean).join(' › ')}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </form>
              </>
            )}
          </div>
        </section>

        <div className="nf-week" aria-hidden="true">
          <div className="nf-week-days">{DAYS.map(d => <span key={d}>{d}</span>)}</div>
          <div className="nf-week-grid">
            {WEEK.flat().map((slot, i) => slot
              ? <span key={i} className={`nf-slot ${slot.toLowerCase()}`} style={{ '--i': i } as React.CSSProperties}>{slot}</span>
              : <span key={i} className="nf-slot nf-slot-missing" style={{ '--i': i } as React.CSSProperties}><b>404</b><small>Not found</small></span>)}
          </div>
        </div>
      </div>

      <footer className="nf-foot">Still stuck? Contact the ICT help desk.</footer>
      </div>
    </main>
  )
}
