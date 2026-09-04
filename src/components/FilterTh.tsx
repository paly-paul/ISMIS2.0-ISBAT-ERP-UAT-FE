'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface FilterThProps {
  label: string
  opts: string[]
  isOpen: boolean
  activeFilter: string[]
  onToggle: (e: React.MouseEvent) => void
  onSelect: (vals: string[]) => void
  onClear: () => void
  onClose: () => void
}

export function FilterTh({ label, opts, isOpen, activeFilter, onToggle, onSelect, onClear, onClose }: FilterThProps) {
  const [search, setSearch]   = useState('')
  const [pending, setPending] = useState<string[]>([])
  const [pos, setPos]         = useState({ top: 0, left: 0, minWidth: 0 })
  const thRef = useRef<HTMLTableCellElement>(null)

  useEffect(() => {
    if (isOpen && thRef.current) {
      const r = thRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, minWidth: Math.max(r.width, 210) })
      setPending([...activeFilter])
    }
    if (!isOpen) setSearch('')
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function updatePos() {
      if (!thRef.current) return
      const r = thRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, minWidth: Math.max(r.width, 210) })
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

  const meaningful = opts.filter(o => o && o !== '-' && o !== '—' && o.trim() !== '')

  const visible = search.trim()
    ? meaningful.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : meaningful

  const allVisibleChecked = visible.length > 0 && visible.every(o => pending.includes(o))

  function toggleOne(o: string) {
    setPending(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o])
  }

  function toggleAll() {
    if (allVisibleChecked) {
      setPending(prev => prev.filter(o => !visible.includes(o)))
    } else {
      setPending(prev => [...new Set([...prev, ...visible])])
    }
  }

  function handleOk() {
    if (pending.length === 0) return
    onSelect(pending)
  }

  const isActive = activeFilter.length > 0

  return (
    <th ref={thRef} className={`filterable${isActive ? ' th-active' : ''}`} onClick={onToggle}>
      {label}
      <i className={`lni lni-funnel th-fi${activeFilter.length ? ' fil-on' : ''}`} onClick={onToggle} />

      {isOpen && createPortal(
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
                <label key={o} className={`col-filter-opt-row${pending.includes(o) ? ' fil-active' : ''}`}>
                  <input type="checkbox" checked={pending.includes(o)} onChange={() => toggleOne(o)} />
                  {o}
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
