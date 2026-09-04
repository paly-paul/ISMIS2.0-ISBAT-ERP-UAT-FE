'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

// Sibling to FilterTh, not a variant of it — same shell (funnel-triggered
// portal dropdown, search box, Select All, staged pending selection,
// Reset/Cancel/OK footer) and the same multi-select interaction, but
// options are {value,label} guid pairs instead of FilterTh's plain display
// strings, since these drive a server query (GET /api/v1/students/filter,
// get-students-filter.md) rather than an Array.filter() over an
// already-loaded list. See useStudentsFilterMulti (useStudents.ts) for how
// a multi-value selection here — the endpoint only takes one guid per
// field — gets turned into real results: one request per combination of
// selected values, merged client-side.
interface GuidColumnFilterProps {
  label: string
  options: { value: string; label: string }[]
  isOpen: boolean
  activeFilter: string[]
  onToggle: (e: React.MouseEvent) => void
  onSelect: (vals: string[]) => void
  onClear: () => void
  onClose: () => void
  disabled?: boolean
  disabledHint?: string
}

export function GuidColumnFilter({ label, options, isOpen, activeFilter, onToggle, onSelect, onClear, onClose, disabled, disabledHint }: GuidColumnFilterProps) {
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState<string[]>([])
  const [pos, setPos] = useState({ top: 0, left: 0, minWidth: 0 })
  const thRef = useRef<HTMLTableCellElement>(null)

  useEffect(() => {
    if (isOpen && thRef.current) {
      const r = thRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, minWidth: Math.max(r.width, 220) })
      setPending([...activeFilter])
    }
    if (!isOpen) setSearch('')
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function updatePos() {
      if (!thRef.current) return
      const r = thRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, minWidth: Math.max(r.width, 220) })
    }
    function onScroll() { requestAnimationFrame(updatePos) }
    const observer = new IntersectionObserver(
      ([entry]) => { if (!entry.isIntersecting) onClose() },
      { threshold: 0 }
    )
    if (thRef.current) observer.observe(thRef.current)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('scroll', onScroll, true)
      observer.disconnect()
    }
  }, [isOpen, onClose])

  const visible = search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const allVisibleChecked = visible.length > 0 && visible.every(o => pending.includes(o.value))

  function toggleOne(v: string) {
    setPending(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  }

  function toggleAll() {
    const visibleValues = visible.map(o => o.value)
    if (allVisibleChecked) {
      setPending(prev => prev.filter(v => !visibleValues.includes(v)))
    } else {
      setPending(prev => [...new Set([...prev, ...visibleValues])])
    }
  }

  function handleOk() {
    if (pending.length === 0) return
    onSelect(pending)
  }

  const isActive = activeFilter.length > 0

  return (
    <th
      ref={thRef}
      className={`filterable${isActive ? ' th-active' : ''}`}
      onClick={disabled ? undefined : onToggle}
      title={disabled ? disabledHint : undefined}
      style={disabled ? { cursor: 'not-allowed', opacity: .6 } : undefined}
    >
      {label}
      <i className={`lni lni-funnel th-fi${isActive ? ' fil-on' : ''}`} onClick={disabled ? undefined : onToggle} />

      {isOpen && !disabled && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={e => { e.stopPropagation(); onClose() }} />
          <div
            className="col-filter-drop"
            style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.minWidth, zIndex: 9999, padding: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="col-filter-search">
              <input
                className="ctrl"
                style={{ fontSize: 12, height: 28, padding: '4px 8px' }}
                placeholder={`Search ${label}…`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            <label className="col-filter-select-all">
              <input type="checkbox" checked={allVisibleChecked} onChange={toggleAll} />
              Select All
            </label>

            <div className="col-filter-opts">
              {visible.map(o => (
                <label key={o.value} className={`col-filter-opt-row${pending.includes(o.value) ? ' fil-active' : ''}`}>
                  <input type="checkbox" checked={pending.includes(o.value)} onChange={() => toggleOne(o.value)} />
                  {o.label}
                </label>
              ))}
              {visible.length === 0 && (
                <div className="col-filter-no-match">No matches</div>
              )}
            </div>

            <div className="col-filter-footer">
              <button className="col-filter-btn col-filter-btn-reset" onClick={() => { setPending([]); onClear() }}>Reset</button>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="col-filter-btn col-filter-btn-cancel" onClick={onClose}>Cancel</button>
                <button
                  className="col-filter-btn col-filter-btn-ok"
                  disabled={pending.length === 0}
                  onClick={handleOk}
                >OK</button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </th>
  )
}
