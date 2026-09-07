'use client'
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Sidebar, RailId } from '@/components/Sidebar'
import { refreshSession } from '@/lib/auth'
import { getSessionIdentity, setSessionIdentity } from '@/lib/session'

// Same auth-guard + layout-shell boilerplate every module layout carries
// (see AcademicLayout) — duplicated rather than shared for the same reason
// each of those duplicates it from one another: this page owns its own
// Sidebar/rail state too now.
//
// Notifications isn't itself scoped to one module (a single feed can point
// at Admission, Finance, Academic, ... entities), so there's no rail this
// page's own currentPage will ever match — the sidebar renders with nothing
// highlighted, same as landing on any page outside its tree. It defaults to
// the Academic rail so the panel isn't empty on arrival, matching the
// header logo's own "closest thing to a home screen" reasoning (see
// Header.tsx's hdr-badge comment).
export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [activeRail, setActiveRail] = useState<RailId>('academic')
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useLayoutEffect(() => {
    const identity = getSessionIdentity()
    if (identity) {
      setDisplayName(identity.displayName)
      setAuthChecked(true)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function check() {
      const identity = getSessionIdentity()
      if (identity) {
        setDisplayName(identity.displayName)
        setAuthChecked(true)
        return
      }

      try {
        const result = await refreshSession()
        if (cancelled) return
        if (result.displayName) setSessionIdentity({ displayName: result.displayName })
        setDisplayName(result.displayName ?? null)
        setAuthChecked(true)
      } catch {
        if (!cancelled) router.replace('/login/staff')
      }
    }

    check()

    return () => {
      cancelled = true
    }
  }, [router])

  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function toggleCollapse(id: string) {
    setCollapsedSections(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }

  if (!authChecked) {
    return (
      <div style={{ display: 'grid', placeContent: 'center', minHeight: '100vh' }}>
        <span
          style={{
            width: 28, height: 28,
            border: '3px solid var(--g100, #e2e2e2)',
            borderTopColor: 'var(--b500, #2E6BE6)',
            borderRadius: '50%',
            animation: 'spin 700ms linear infinite',
          }}
        />
      </div>
    )
  }

  return (
    <>
      <Header
        panelOpen={panelOpen}
        setPanelOpen={setPanelOpen}
        profileOpen={profileOpen}
        setProfileOpen={setProfileOpen}
        profileRef={profileRef}
        onSignOut={() => router.push('/')}
        displayName={displayName ?? undefined}
      />
      <div className="layout">
        <Sidebar
          panelOpen={panelOpen}
          setPanelOpen={setPanelOpen}
          currentPage="notifications"
          collapsedSections={collapsedSections}
          toggleCollapse={toggleCollapse}
          activeRail={activeRail}
          setActiveRail={setActiveRail}
        />
        <main className={`main${panelOpen ? ' panel-open' : ''}`}>
          {children}
        </main>
      </div>
    </>
  )
}
