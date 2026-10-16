'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

type Opt = { value: string; label: string }

interface MultiSelectProps {
  options: (string | Opt)[]
  value: string[]
  onChange: (vals: string[]) => void
  onSearch?: (search: string) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
  isLoading?: boolean
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
}

function normalise(raw: (string | Opt)[]): Opt[] {
  const unique = new Map<string, Opt>()
  raw.forEach(o => {
    const option = typeof o === 'string' ? { value: o, label: o } : o
    if (!unique.has(option.value)) unique.set(option.value, option)
  })
  return [...unique.values()]
}

// Checkbox-driven sibling of SearchSelect — same trigger/portal-dropdown
// chrome (reuses .ss-trigger/.ss-drop/.ss-search/.ss-opts), but the option
// list is the checkbox pattern already used by FilterTh's column filters
// (.col-filter-select-all/.col-filter-opt-row), since that's the only
// multi-pick UI this app already has a shared, correct behavior for.
export function MultiSelect({ options, value, onChange, onSearch, placeholder, className, style, isLoading = false, hasNextPage = false, isFetchingNextPage = false, onLoadMore }: MultiSelectProps) {
  const normalised = normalise(options)

  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const [pos, setPos]       = useState({ top: 0, left: 0, width: 0 })

  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef    = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  // With server-side search (onSearch) the options are only the current
  // search's results — remember every option seen so values picked from an
  // earlier search keep their label once they drop out of `options`.
  const seenRef = useRef(new Map<string, Opt>())
  normalised.forEach(o => seenRef.current.set(o.value, o))
  const selected = value.map(v => seenRef.current.get(v)).filter((o): o is Opt => !!o)

  const visible = search.trim()
    ? normalised.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : normalised

  const allVisibleChecked = visible.length > 0 && visible.every(o => value.includes(o.value))

  function handleOptionsScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!hasNextPage || isFetchingNextPage || !onLoadMore) return
    const el = e.currentTarget
    if (el.scrollTop > 0 && el.scrollHeight - el.scrollTop - el.clientHeight < 48) onLoadMore()
  }

  function openDrop() {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (open) inputRef.current?.focus()
    else { setSearch(''); onSearch?.('') }
  }, [open, onSearch])

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
              onChange={e => { setSearch(e.target.value); onSearch?.(e.target.value) }}
              onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
              onClick={e => e.stopPropagation()}
            />
          </div>
          {!isLoading && visible.length > 0 && (
            <label className="col-filter-select-all">
              <input type="checkbox" checked={allVisibleChecked} onChange={toggleAll} />
              Select All
            </label>
          )}
          <div className="ss-opts" onScroll={handleOptionsScroll}>
            {isLoading
              ? <div className="ss-no-match"><i className="lni lni-spinner-arrow" /> Loading results…</div>
              : visible.length === 0
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
          {isFetchingNextPage && (
            <div className="ss-no-match" style={{ borderTop: '1px solid var(--g100)', background: 'var(--g50)' }}>
              Loading more…
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
