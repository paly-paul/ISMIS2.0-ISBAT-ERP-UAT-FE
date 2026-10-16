'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchStreamsInfinite, useStreamsByGuids } from '@/hooks/config/useStreams'

interface StreamMultiSearchPickerProps {
  value: string[]
  onChange: (vals: string[]) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

const PAGE_SIZE = 20

// Multi-pick sibling of ProgramSearchPicker/IntakeSearchPicker/
// FacultySearchPicker (2026-09-10) — same closed-button/portal-dropdown
// chrome, but checkbox-driven like MultiSelect (reusing its
// .col-filter-select-all/.col-filter-opt-row rows) instead of single-select.
// Replaces ProgrammeModal's Specialization(s) MultiSelect, which used to read
// off useStreams(isOpen)'s capped 1000-row snapshot, with real server search
// + scroll-to-load-more underneath (useSearchStreamsInfinite/getStreamsPaged)
// — confirmed live that GET /api/v1/academic/specializations genuinely
// supports page/pageSize/search together.
//
// Already-selected guids that have scrolled out of (or never entered) the
// currently loaded pages still need a label to show as a chip/trigger text —
// resolved via useStreamsByGuids, the same bounded batched-by-guid lookup
// IntakeSearchPicker's label resolution in ProgrammeModal uses.
export function StreamMultiSearchPicker({ value, onChange, placeholder = '— Select specialization(s) —', className, style }: StreamMultiSearchPickerProps) {
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
  } = useSearchStreamsInfinite(committedSearch, PAGE_SIZE, open)

  const seenGuids = new Set<string>()
  const items = (data?.pages.flatMap(p => p.items) ?? []).filter(s => {
    if (seenGuids.has(s.streamGuid)) return false
    seenGuids.add(s.streamGuid)
    return true
  })

  const selectedByGuid = useStreamsByGuids(value)

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!hasNextPage || isFetchingNextPage) return
    const el = e.currentTarget
    if (el.scrollTop > 0 && el.scrollHeight - el.scrollTop - el.clientHeight < 48) fetchNextPage()
  }

  function toggleOne(guid: string) {
    onChange(value.includes(guid) ? value.filter(v => v !== guid) : [...value, guid])
  }

  const allLoadedChecked = items.length > 0 && items.every(s => value.includes(s.streamGuid))
  function toggleAllLoaded() {
    if (allLoadedChecked) onChange(value.filter(v => !items.some(s => s.streamGuid === v)))
    else onChange([...new Set([...value, ...items.map(s => s.streamGuid)])])
  }

  const isEmpty = value.length === 0
  const displayLabel = isEmpty
    ? placeholder
    : value.length === 1
      ? (() => { const s = selectedByGuid.get(value[0]); return s ? `${s.streamCode} — ${s.streamName}` : '1 selected' })()
      : `${value.length} selected`

  return (
    <div style={{ position: 'relative', ...style }} className={className}>
      <button
        ref={triggerRef}
        type="button"
        className="ctrl ss-trigger"
        onClick={() => (open ? setOpen(false) : openDrop())}
      >
        <span className={`ss-label${isEmpty ? ' ss-placeholder' : ''}`}>{displayLabel}</span>
        {!isEmpty && (
          <span
            role="button"
            tabIndex={0}
            className="ss-clear"
            title="Clear all"
            aria-label="Clear all"
            onClick={e => { e.stopPropagation(); onChange([]) }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onChange([]) }
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
          {items.length > 0 && (
            <label className="col-filter-select-all">
              <input type="checkbox" checked={allLoadedChecked} onChange={toggleAllLoaded} />
              Select All {committedSearch ? 'Matching' : 'Loaded'}
            </label>
          )}
          <div className="ss-opts" ref={optsRef} style={{ maxHeight: pos.maxHeight }} onScroll={handleScroll}>
            {isFetching && items.length === 0 ? (
              <div className="ss-no-match">Searching…</div>
            ) : isError ? (
              <div className="ss-no-match"><i className="lni lni-warning"></i> Search failed. Please try again.</div>
            ) : items.length === 0 ? (
              <div className="ss-no-match">{committedSearch ? 'No matching specializations.' : 'No specializations available.'}</div>
            ) : (
              <>
                {items.map(s => (
                  <label
                    key={s.streamGuid}
                    className={`col-filter-opt-row${value.includes(s.streamGuid) ? ' fil-active' : ''}`}
                  >
                    <input type="checkbox" checked={value.includes(s.streamGuid)} onChange={() => toggleOne(s.streamGuid)} />
                    <span className="font-mono text-b700">{s.streamCode}</span> — {s.streamName}
                  </label>
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
