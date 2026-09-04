'use client'
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Sidebar, RailId } from '@/components/Sidebar'
import { refreshSession } from '@/lib/auth'
import { getSessionIdentity, setSessionIdentity } from '@/lib/session'

export default function AssessmentLayout({ children }: { children: React.ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [activeRail, setActiveRail] = useState<RailId>('assessment')
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()

  const currentPage = pathname.split('/').pop() ?? 'dashboard'

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
  }, [pathname])

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
          currentPage={currentPage}
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
