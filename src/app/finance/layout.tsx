'use client'
import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Sidebar, RailId } from '@/components/Sidebar'
import { getSessionIdentity } from '@/lib/session'

// The proactive keep-alive refresh timer lives in src/app/providers.tsx now
// — a single app-wide interval, not one per module layout. See the note
// there for why: a per-layout interval is destroyed and restarted from zero
// on every cross-module navigation, which could mean it never survives long
// enough to fire at all for a user who switches modules frequently.

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [activeRail, setActiveRail] = useState<RailId>('finance')
  const profileRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()
  // This module never had a mount-time session check (unlike Academic), so
  // displayName was never read at all — Header.tsx defaults to the
  // hardcoded "Administrator" string whenever no displayName prop is
  // passed, which is what every page here was silently showing regardless
  // of who was actually logged in.
  const [displayName, setDisplayName] = useState<string | null>(null)

  const currentPage = pathname.split('/').pop() ?? 'dashboard'

  useEffect(() => {
    const identity = getSessionIdentity()
    if (identity) setDisplayName(identity.displayName)
  }, [])

  // Scroll to top on navigation — the sidebar panel is left as the user set
  // it (open/closed, collapsed sections) rather than being force-closed here.
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
