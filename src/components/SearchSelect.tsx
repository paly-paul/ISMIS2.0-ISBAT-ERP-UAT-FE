'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

type Opt = { value: string; label: string; disabled?: boolean }

interface SearchSelectProps {
  options: (string | Opt)[]
  value?: string
  onChange?: (val: string) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
  disabled?: boolean
}

function normalise(raw: (string | Opt)[]): Opt[] {
  return raw.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
}

export function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
  className,
  style,
  disabled,
}: SearchSelectProps) {
  const normalised = normalise(options)

  const controlled = value !== undefined
  const [internal, setInternal] = useState<string>(() =>
    placeholder !== undefined ? '' : (normalised[0]?.value ?? '')
  )
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const [pos, setPos]       = useState<{ top?: number, bottom?: number, left: number, width: number, maxHeight: number }>({ top: 0, left: 0, width: 0, maxHeight: 200 })

  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef    = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  const current  = controlled ? value! : internal
  const selected = normalised.find(o => o.value === current)

  const visible = search.trim()
    ? normalised.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : normalised

  function calcPos() {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom - 10
    const spaceAbove = r.top - 10
    
    if (spaceBelow < 200 && spaceAbove > spaceBelow) {
      setPos({ 
        bottom: window.innerHeight - r.top + 4, 
        left: r.left, 
        width: r.width, 
        maxHeight: Math.min(spaceAbove - 40, 300) // -40 for search input
      })
    } else {
      setPos({ 
        top: r.bottom + 4, 
        left: r.left, 
        width: r.width, 
        maxHeight: Math.min(spaceBelow - 40, 300)
      })
    }
  }

  function openDrop() {
    calcPos()
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
      calcPos()
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

  function select(val: string) {
    if (controlled) onChange?.(val)
    else setInternal(val)
    setOpen(false)
  }

  function clear() {
    if (controlled) onChange?.('')
    else setInternal('')
    setOpen(false)
  }

  const displayLabel = selected?.label ?? placeholder ?? (normalised[0]?.label ?? '')
  const isEmpty      = !selected && placeholder !== undefined
  // Only a field built with a placeholder has a real "unselected" state to
  // clear back to — an uncontrolled select with no placeholder always
  // defaults to its first option (see `internal`'s initial state above), so
  // clearing it would have nowhere meaningful to land.
  const clearable = !!selected && placeholder !== undefined

  return (
    <div style={{ position: 'relative', ...style }} className={className}>
      <button
        ref={triggerRef}
        type="button"
        className="ctrl ss-trigger"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openDrop())}
      >
        <span className={`ss-label${isEmpty ? ' ss-placeholder' : ''}`}>{displayLabel}</span>
        {clearable && (
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
          // Never shrink narrower than the trigger, but let long option
          // labels (e.g. full programme names) grow the popup past it up to
          // a sane cap instead of hard-clipping — a fixed `width: pos.width`
          // here plus `.ss-drop`'s `overflow: hidden` was silently cutting
          // "Diploma in Networking" off mid-word rather than wrapping or
          // ellipsizing it.
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
          <div className="ss-opts" style={{ maxHeight: pos.maxHeight }}>
            {visible.length === 0
              ? <div className="ss-no-match">No matches</div>
              : visible.map(o => (
                  <div
                    key={o.value}
                    className={`col-filter-opt${current === o.value ? ' fil-active' : ''}${o.disabled ? ' fil-disabled' : ''}`}
                    onClick={() => { if (!o.disabled) select(o.value) }}
                    aria-disabled={o.disabled}
                  >
                    {o.label}
                  </div>
                ))
            }
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
