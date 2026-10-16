'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchFacultiesInfinite } from '@/hooks/config/useFaculties'

export interface FacultyPickOption {
  facultyGuid: string
  facultyCode: string
  facultyName: string
}

interface FacultySearchPickerProps {
  // Label for the currently-selected faculty, shown in the closed trigger
  // button — same convention as SearchSelect's own displayLabel. Null while
  // nothing's picked (shows placeholder instead).
  selectedLabel: string | null
  onSelect: (faculty: FacultyPickOption) => void
  onClear: () => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

const PAGE_SIZE = 20

// Same closed-button/portal-dropdown chrome as SearchSelect/ProgramSearchPicker/
// IntakeSearchPicker (2026-09-10) — replaces ProgrammeModal/ViewProgrammeModal's
// plain SearchSelect over useFaculties()' capped 1000-row snapshot with real
// server search + scroll-to-load-more underneath, via
// useSearchFacultiesInfinite/getFacultiesPaged.
export function FacultySearchPicker({ selectedLabel, onSelect, onClear, placeholder = '— Select faculty —', className, disabled }: FacultySearchPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number }>({ top: 0, left: 0, width: 0, maxHeight: 200 })

  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const optsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setCommittedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  function calcPos() {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom - 10
    const spaceAbove = r.top - 10
    if (spaceBelow < 200 && spaceAbove > spaceBelow) {
      setPos({ bottom: window.innerHeight - r.top + 4, left: r.left, width: r.width, maxHeight: Math.min(spaceAbove - 40, 300) })
    } else {
      setPos({ top: r.bottom + 4, left: r.left, width: r.width, maxHeight: Math.min(spaceBelow - 40, 300) })
    }
  }

  function openDrop() {
    calcPos()
    setOpen(true)
  }

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    } else {
      setSearch('')
      setCommittedSearch('')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !dropRef.current?.contains(t)) setOpen(false)
    }
    function updatePos() { calcPos() }
    function onScroll() { requestAnimationFrame(updatePos) }
    document.addEventListener('mousedown', handle)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching, isError,
  } = useSearchFacultiesInfinite(committedSearch, PAGE_SIZE, open && !disabled)

  // De-duped by facultyGuid — same "don't trust server pagination blindly"
  // safety net ProgramSearchPicker/IntakeSearchPicker use.
  const seenGuids = new Set<string>()
  const items = (data?.pages.flatMap(p => p.items) ?? []).filter(f => {
    if (seenGuids.has(f.facultyGuid)) return false
    seenGuids.add(f.facultyGuid)
    return true
  })

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!hasNextPage || isFetchingNextPage) return
    const el = e.currentTarget
    if (el.scrollTop > 0 && el.scrollHeight - el.scrollTop - el.clientHeight < 48) fetchNextPage()
  }

  function pick(f: FacultyPickOption) {
    onSelect(f)
    setOpen(false)
  }

  function clear() {
    onClear()
    setOpen(false)
  }

  const isEmpty = !selectedLabel
  const clearable = !!selectedLabel

  return (
    <div style={{ position: 'relative' }} className={className}>
      <button
        ref={triggerRef}
        type="button"
        className="ctrl ss-trigger"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openDrop())}
      >
        <span className={`ss-label${isEmpty ? ' ss-placeholder' : ''}`}>{selectedLabel ?? placeholder}</span>
        {clearable && !disabled && (
          <span
            role="button"
            tabIndex={0}
            className="ss-clear"
            title="Clear selection"
            aria-label="Clear selection"
            onClick={e => { e.stopPropagation(); clear() }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); clear() }
            }}
          >
            <i className="lni lni-close" />
          </span>
        )}
        <i
          className="lni lni-chevron-down ss-chevron"
          style={{ transform: open ? 'rotate(180deg)' : undefined }}
        />
      </button>

      {open && typeof window !== 'undefined' && createPortal(
        <div
          ref={dropRef}
          className="ss-drop"
          style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, minWidth: pos.width, width: 'max-content', maxWidth: Math.max(pos.width, 360), zIndex: 9999 }}
        >
          <div className="ss-search">
            <input
              ref={inputRef}
              className="ctrl"
              style={{ fontSize: 12, height: 28, padding: '4px 8px' }}
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="ss-opts" ref={optsRef} style={{ maxHeight: pos.maxHeight }} onScroll={handleScroll}>
            {isFetching && items.length === 0 ? (
              <div className="ss-no-match">Searching…</div>
            ) : isError ? (
              <div className="ss-no-match"><i className="lni lni-warning"></i> Search failed. Please try again.</div>
            ) : items.length === 0 ? (
              <div className="ss-no-match">{committedSearch ? 'No matching faculties.' : 'No faculties available.'}</div>
            ) : (
              <>
                {items.map(f => (
                  <div
                    key={f.facultyGuid}
                    className="col-filter-opt"
                    onClick={() => pick({ facultyGuid: f.facultyGuid, facultyCode: f.facultyCode, facultyName: f.facultyName })}
                  >
                    <span className="font-mono text-b700">{f.facultyCode}</span> — {f.facultyName}
                  </div>
                ))}
                {isFetchingNextPage && (
                  <div className="ss-no-match">Loading more…</div>
                )}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
