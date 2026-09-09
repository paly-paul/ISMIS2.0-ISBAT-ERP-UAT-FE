'use client'
import { useEffect, useRef, useState } from 'react'
import { useUnconvertedEnquiriesInfinite } from '@/hooks/admission/useApplicationPayments'
import { Enquiry } from '@/lib/api/admission/enquiry'

interface EnquirySearchPickerProps {
  intakeGuid: string
  // Label for the currently-selected enquiry (e.g. from a prior page's
  // ?enquiryGuid= handoff, where the full Enquiry record comes from a
  // separate useEnquiry(guid) fetch, not this picker's own paged list) —
  // shown in the closed box instead of raw search text once something's
  // actually selected. Null while nothing's selected or its label isn't
  // known yet.
  selectedLabel: string | null
  onSelect: (enquiry: Enquiry) => void
  onClear: () => void
  placeholder?: string
  disabled?: boolean
}

const PAGE_SIZE = 20

// Search-as-you-type + scroll-to-load-more Enquiry picker for the Payment
// page — replaces a SearchSelect fed by useUnconvertedEnquiries' capped
// pageSize=1000 snapshot of a single intake with real server pagination,
// same "hand-roll the search+scroll dropdown per use case" pattern
// CourseUnitSearchPicker and Payment Console's own student search box
// already use (SearchSelect has no async/paged mode of its own).
// searchTerm is CONFIRMED real server-side on this endpoint (2026-09-08,
// see getUnconvertedEnquiries) — debounced 300ms, same as
// CourseUnitSearchPicker, so it isn't fired on every keystroke. Reported bug
// (2026-09-09): typing a term didn't actually narrow the dropdown — traced
// to searchTerm+intakeGuid combined not being independently verified (see
// getUnconvertedEnquiries' own comment); the backend appears to silently
// drop the search half once both are sent together. Now re-filtered
// client-side on top of whatever the server sent back too (see the items
// derivation below), same safety-net convention this app's other
// unconfirmed-combination searches already use.
export function EnquirySearchPicker({ intakeGuid, selectedLabel, onSelect, onClear, placeholder = '-- Select Enquiry --', disabled }: EnquirySearchPickerProps) {
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
  } = useUnconvertedEnquiriesInfinite(intakeGuid, committedSearch, PAGE_SIZE, focused && !disabled)

  const rawItems = data?.pages.flatMap(p => p.items) ?? []
  const term = committedSearch
  // Re-filter client-side on top of whatever the server sent back — same
  // safety net this app's other list searches fall back on (e.g.
  // programme-master's own rows filter, useRepetitionTagSearch) for a
  // searchTerm param that's confirmed real on its own but whose behavior
  // combined with another filter (here, intakeGuid) isn't independently
  // verified (see getUnconvertedEnquiries' own comment). Without this,
  // a backend that silently drops the search half of that combination
  // shows the same unfiltered per-intake list back regardless of what was
  // typed, which is exactly the reported bug — the dropdown never actually
  // narrows as you type.
  const termLower = term.trim().toLowerCase()
  const items = termLower
    ? rawItems.filter(e => `${e.studentName} ${e.enquiryCode} ${e.mobile ?? ''} ${e.email ?? ''}`.toLowerCase().includes(termLower))
    : rawItems

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!hasNextPage || isFetchingNextPage) return
    const el = e.currentTarget
    if (el.scrollTop > 0 && el.scrollHeight - el.scrollTop - el.clientHeight < 48) fetchNextPage()
  }

  function pick(e: Enquiry) {
    onSelect(e)
    setSearch('')
    setCommittedSearch('')
    setFocused(false)
  }

  // Two-letter initials for the result-row avatar chips — falls back to '?'
  // when there's nothing to initial from.
  function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (!parts.length) return '?'
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }

  return (
    <div style={{ position: 'relative' }} ref={boxRef}>
      <div className="inp-wrap">
        <span className="inp-icon"><i className="lni lni-search-alt"></i></span>
        <input
          className="ctrl"
          type="text"
          placeholder={!intakeGuid ? '-- Select Intake First --' : placeholder}
          value={focused ? search : (search || selectedLabel || '')}
          onChange={e => { setSearch(e.target.value); if (selectedLabel) onClear() }}
          onFocus={() => setFocused(true)}
          disabled={disabled || !intakeGuid}
        />
      </div>
      {focused && (
        <div
          className="search-picker-dd mt-1"
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
            background: 'var(--white)', border: '1.5px solid var(--b200)', borderRadius: 'var(--rsm)',
            boxShadow: 'var(--neu-out)', maxHeight: 220, overflowY: 'auto',
          }}
          onScroll={handleScroll}
        >
          {isFetching && items.length === 0 ? (
            <div className="text-g400 text-center flex items-center justify-center gap-2" style={{ padding: 14, fontSize: 12.5 }}><i className="lni lni-reload"></i> Searching…</div>
          ) : isError ? (
            <div className="text-clr-red text-center" style={{ padding: 14, fontSize: 12.5 }}><i className="lni lni-warning"></i> Search failed. Please try again.</div>
          ) : items.length === 0 ? (
            <div className="text-g400 text-center" style={{ padding: 14, fontSize: 12.5 }}>
              {term ? 'No matching enquiries.' : 'No unconverted enquiries for this intake.'}
            </div>
          ) : (
            <>
              {items.map(e => (
                <div key={e.enquiryGuid} className="sp-row" onMouseDown={() => pick(e)}>
                  <span className="sp-avatar">{initials(e.studentName)}</span>
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="font-bold truncate" style={{ fontSize: 12.5 }}>
                      {e.studentName} <span className="font-mono text-b700">({e.enquiryCode})</span>
                    </span>
                    {/* Commented out for now (2026-09-09) — this endpoint's
                        response never actually carries mobile/email (see
                        getUnconvertedEnquiries' own comment: the shape looks
                        like a narrower projection than the full Enquiry DTO),
                        so every row rendered as a permanent "— · —" instead
                        of real data.
                    <span className="text-g500 truncate" style={{ fontSize: 11 }}>
                      {e.mobile || '—'} · {e.email || '—'}
                    </span>
                    */}
                  </span>
                </div>
              ))}
              {isFetchingNextPage && (
                <div className="text-g400 text-center" style={{ padding: 10, fontSize: 11.5 }}><i className="lni lni-reload"></i> Loading more…</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
