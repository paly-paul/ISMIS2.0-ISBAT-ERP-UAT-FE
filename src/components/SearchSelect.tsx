'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

type Opt = { value: string; label: string; disabled?: boolean }

interface SearchSelectProps {
  options: (string | Opt)[]
  value?: string
  onChange?: (val: string) => void
  onSearch?: (search: string) => void
  onOpenChange?: (open: boolean) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
  disabled?: boolean
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

export function SearchSelect({
  options,
  value,
  onChange,
  onSearch,
  onOpenChange,
  placeholder,
  className,
  style,
  disabled,
  isLoading = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
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
  const optsRef    = useRef<HTMLDivElement>(null)

  // With server-side search (onSearch) the options are only the current
  // search's results, and closing the dropdown resets the search — so an
  // option picked from a search drops out of `options` and the trigger fell
  // back to the placeholder. Remember the picked option to keep its label.
  const [picked, setPicked] = useState<Opt | null>(null)

  const current  = controlled ? value! : internal
  const selected = normalised.find(o => o.value === current) ?? (picked && picked.value === current ? picked : undefined)

  const searchTokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const visible = searchTokens.length > 0
    ? normalised.filter(o => {
        const labelLower = (o.label ?? '').toLowerCase()
        const valueLower = (o.value ?? '').toLowerCase()
        return searchTokens.every(token => labelLower.includes(token) || valueLower.includes(token))
      })
    : normalised

  function handleOptionsScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!hasNextPage || isFetchingNextPage || !onLoadMore) return
    const el = e.currentTarget
    if (el.scrollTop > 0 && el.scrollHeight - el.scrollTop - el.clientHeight < 48) onLoadMore()
  }

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
    onOpenChange?.(true)
  }

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    } else {
      setSearch('')
      onSearch?.('')
    }
  }, [open, onSearch])

  // Long option lists (e.g. DatePicker's year picker — 111 entries) always
  // rendered starting from the top on open, with no indication the currently
  // selected value was buried well below the fold — nothing scrolled to it.
  // Center the active option in the scrollable list as soon as the dropdown
  // (re)opens, scoped to the list's own scrollTop rather than
  // Element.scrollIntoView so it can't drag the page/modal underneath along
  // with it (the portal is position: fixed, but scrollIntoView still walks
  // every scrollable ancestor up the DOM, not just this list).
  useEffect(() => {
    if (!open) return
    const container = optsRef.current
    const activeEl = container?.querySelector<HTMLElement>('.fil-active')
    if (!container || !activeEl) return
    container.scrollTop = activeEl.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2
  }, [open])

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const t = e.target as Node
        if (!triggerRef.current?.contains(t) && !dropRef.current?.contains(t)) {
          setOpen(false)
          onOpenChange?.(false)
        }
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
  }, [open, onOpenChange])

  function select(val: string) {
    setPicked(normalised.find(o => o.value === val) ?? null)
    if (controlled) onChange?.(val)
    else { setInternal(val); onChange?.(val) }
    setOpen(false)
    onOpenChange?.(false)
  }

  function clear() {
    if (controlled) onChange?.('')
    else { setInternal(''); onChange?.('') }
    setOpen(false)
    onOpenChange?.(false)
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
              onChange={e => {
                const val = e.target.value
                setSearch(val)
                onSearch?.(val)
              }}
              onKeyDown={e => {
                if (e.key === 'Escape') { setOpen(false); onOpenChange?.(false) }
                if (e.key === 'Enter' && visible.length > 0) {
                  e.preventDefault()
                  const first = visible.find(o => !o.disabled)
                  if (first) select(first.value)
                }
              }}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="ss-opts" ref={optsRef} style={{ maxHeight: pos.maxHeight }} onScroll={handleOptionsScroll}>
            {isLoading
              ? <div className="ss-no-match"><i className="lni lni-spinner-arrow" /> Loading results…</div>
              : visible.length === 0
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
