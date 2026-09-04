'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

type Opt = { value: string; label: string }

interface MultiSelectProps {
  options: (string | Opt)[]
  value: string[]
  onChange: (vals: string[]) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

function normalise(raw: (string | Opt)[]): Opt[] {
  return raw.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
}

// Checkbox-driven sibling of SearchSelect — same trigger/portal-dropdown
// chrome (reuses .ss-trigger/.ss-drop/.ss-search/.ss-opts), but the option
// list is the checkbox pattern already used by FilterTh's column filters
// (.col-filter-select-all/.col-filter-opt-row), since that's the only
// multi-pick UI this app already has a shared, correct behavior for.
export function MultiSelect({ options, value, onChange, placeholder, className, style }: MultiSelectProps) {
  const normalised = normalise(options)

  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const [pos, setPos]       = useState({ top: 0, left: 0, width: 0 })

  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef    = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  const selected = normalised.filter(o => value.includes(o.value))

  const visible = search.trim()
    ? normalised.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : normalised

  const allVisibleChecked = visible.length > 0 && visible.every(o => value.includes(o.value))

  function openDrop() {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (open) inputRef.current?.focus()
    else setSearch('')
  }, [open])

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !dropRef.current?.contains(t))
        setOpen(false)
    }
    function updatePos() {
      if (!triggerRef.current) return
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    function onScroll() { requestAnimationFrame(updatePos) }
    const observer = new IntersectionObserver(
      ([entry]) => { if (!entry.isIntersecting) setOpen(false) },
      { threshold: 0 }
    )
    if (triggerRef.current) observer.observe(triggerRef.current)
    document.addEventListener('mousedown', handle)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('scroll', onScroll, true)
      observer.disconnect()
    }
  }, [open])

  function toggleOne(val: string) {
    onChange(value.includes(val) ? value.filter(v => v !== val) : [...value, val])
  }

  function toggleAll() {
    if (allVisibleChecked) onChange(value.filter(v => !visible.some(o => o.value === v)))
    else onChange([...new Set([...value, ...visible.map(o => o.value)])])
  }

  const isEmpty      = selected.length === 0
  const displayLabel = isEmpty
    ? (placeholder ?? '')
    : selected.length === 1
      ? selected[0].label
      : `${selected.length} selected`

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
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
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
          {visible.length > 0 && (
            <label className="col-filter-select-all">
              <input type="checkbox" checked={allVisibleChecked} onChange={toggleAll} />
              Select All
            </label>
          )}
          <div className="ss-opts">
            {visible.length === 0
              ? <div className="ss-no-match">No matches</div>
              : visible.map(o => (
                  <label
                    key={o.value}
                    className={`col-filter-opt-row${value.includes(o.value) ? ' fil-active' : ''}`}
                  >
                    <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggleOne(o.value)} />
                    {o.label}
                  </label>
                ))
            }
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
