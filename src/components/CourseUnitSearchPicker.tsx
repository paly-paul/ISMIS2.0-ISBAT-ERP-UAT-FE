'use client'
import { useEffect, useRef, useState } from 'react'
import { useSearchCourseUnitsInfinite } from '@/hooks/academic/useCourseUnits'

export interface CourseUnitPickOption {
  value: string
  code: string
  name: string
  credits: number
}

interface CourseUnitSearchPickerProps {
  // Codes to hide from the results (e.g. course units already allocated to
  // some semester in ProgrammeModal) — filtered client-side against
  // whatever page is currently loaded, same as SearchSelect's own filtering,
  // just applied per fetched page instead of one preloaded array.
  excludeCodes?: string[]
  onSelect: (opt: CourseUnitPickOption) => void
  placeholder?: string
  disabled?: boolean
}

const PAGE_SIZE = 20

// Search-as-you-type + scroll-to-load-more course unit picker — replaces a
// SearchSelect fed by useAllCourseUnits' capped 1000-row snapshot (a
// confirmed live example of 1,500 real course units proved that cap
// silently drops anything past it, the same issue the course-units table
// page itself was already fixed for). SearchSelect has no async/paged mode
// of its own, so this is a small dedicated component instead — same
// "hand-roll the search+scroll dropdown per use case" pattern Payment
// Console's own student search box already uses (useSearchStudentsInfinite
// in usePaymentConsole.ts), not an extension to the shared SearchSelect.
export function CourseUnitSearchPicker({ excludeCodes = [], onSelect, placeholder = '— Select course unit —', disabled }: CourseUnitSearchPickerProps) {
  const [search, setSearch] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const [focused, setFocused] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setCommittedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!focused) return
    function handle(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setFocused(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [focused])

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching, isError,
  } = useSearchCourseUnitsInfinite(committedSearch, PAGE_SIZE, focused && !disabled)

  const items = (data?.pages.flatMap(p => p.items) ?? []).filter(u => !excludeCodes.includes(u.courseUnitCode))

  // Same scrollTop > 0 guard the other infinite-scroll dropdowns in this app
  // use — a plain distance-to-bottom check alone fires spuriously on a short
  // list right after a new page loads, even with no user interaction.
  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!hasNextPage || isFetchingNextPage) return
    const el = e.currentTarget
    if (el.scrollTop > 0 && el.scrollHeight - el.scrollTop - el.clientHeight < 48) fetchNextPage()
  }

  function pick(u: { courseUnitGuid: string; courseUnitCode: string; courseUnitName: string; maxCredits: number }) {
    onSelect({ value: u.courseUnitGuid, code: u.courseUnitCode, name: u.courseUnitName, credits: u.maxCredits })
    setSearch('')
    setCommittedSearch('')
    setFocused(false)
  }

  return (
    <div style={{ position: 'relative' }} ref={boxRef}>
      <div className="inp-wrap">
        <span className="inp-icon"><i className="lni lni-search-alt"></i></span>
        <input
          className="ctrl"
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setFocused(true)}
          disabled={disabled}
        />
      </div>
      {focused && (
        <div
          className="mt-1"
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
            background: 'var(--white)', border: '1.5px solid var(--b200)', borderRadius: 'var(--rsm)',
            boxShadow: 'var(--neu-out)', maxHeight: 220, overflowY: 'auto',
          }}
          onScroll={handleScroll}
        >
          {isFetching && items.length === 0 ? (
            <div className="text-g400 text-center" style={{ padding: 14, fontSize: 12.5 }}>Searching…</div>
          ) : isError ? (
            <div className="text-clr-red text-center" style={{ padding: 14, fontSize: 12.5 }}><i className="lni lni-warning"></i> Search failed. Please try again.</div>
          ) : items.length === 0 ? (
            <div className="text-g400 text-center" style={{ padding: 14, fontSize: 12.5 }}>
              {committedSearch ? 'No matching course units.' : 'No course units available.'}
            </div>
          ) : (
            <>
              {items.map(u => (
                <div
                  key={u.courseUnitGuid}
                  className="cursor-pointer px-3 py-2 hover:bg-b50 border-b border-g100 last:border-b-0"
                  onMouseDown={() => pick(u)}
                >
                  <div className="font-bold" style={{ fontSize: 12.5 }}>
                    <span className="font-mono text-b700">{u.courseUnitCode}</span> — {u.courseUnitName}
                  </div>
                  <div className="text-g500" style={{ fontSize: 11 }}>
                    {u.maxCredits} credit{u.maxCredits !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
              {isFetchingNextPage && (
                <div className="text-g400 text-center" style={{ padding: 10, fontSize: 11.5 }}>Loading more…</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
