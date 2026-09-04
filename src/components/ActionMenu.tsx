'use client'
import { useRef, useState, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

interface ActionMenuProps {
  children: React.ReactNode
  tooltip?: string
}

// Viewport margin kept clear on every side when clamping the dropdown —
// deliberately more than the 6px gap below the trigger so a menu shoved
// against an edge still reads as "placed", not "clipped".
const EDGE_MARGIN = 16

export function ActionMenu({ children, tooltip = 'Actions' }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [showTip, setShowTip] = useState(false)
  // pos starts as the trigger's own center — just a first guess used to
  // measure the dropdown's natural size; the layout effect below replaces
  // it with a viewport-clamped left edge before anything paints.
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false })
  const [tipPos, setTipPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  function openMenu() {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: r.left + r.width / 2, ready: false })
    }
    setShowTip(false)
    setOpen(true)
  }

  // Centers the dropdown under the trigger by default, same as before, but
  // slides it back onto the screen whenever that would push it past the
  // left/right (or bottom) edge of the viewport — e.g. a row action button
  // sitting flush against the right side of the page, as on Student
  // Profile's banner. Runs before paint so there's no visible jump.
  useLayoutEffect(() => {
    if (!open || !dropdownRef.current || !triggerRef.current) return
    const menuRect = dropdownRef.current.getBoundingClientRect()
    const triggerRect = triggerRef.current.getBoundingClientRect()

    let left = triggerRect.left + triggerRect.width / 2 - menuRect.width / 2
    left = Math.min(left, window.innerWidth - EDGE_MARGIN - menuRect.width)
    left = Math.max(left, EDGE_MARGIN)

    let top = triggerRect.bottom + 6
    if (top + menuRect.height > window.innerHeight - EDGE_MARGIN) {
      // Not enough room below — flip above the trigger instead.
      top = triggerRect.top - 6 - menuRect.height
    }

    setPos(prev => (prev.left === left && prev.top === top && prev.ready ? prev : { top, left, ready: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pos.top, pos.left])

  function onMouseEnter() {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setTipPos({ top: r.top - 30, left: r.left + r.width / 2 })
      setShowTip(true)
    }
  }

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !dropdownRef.current?.contains(t))
        setOpen(false)
    }
    function updatePos() {
      if (!triggerRef.current) return
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: r.left + r.width / 2, ready: false })
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

  return (
    <div className="act-menu">
      <button
        ref={triggerRef}
        className={`btn btn-neu btn-sm act-trigger${open ? ' open' : ''}`}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onMouseEnter={onMouseEnter}
        onMouseLeave={() => setShowTip(false)}
      >
        <i className="lni lni-more-alt" style={{ fontSize: 15 }} />
      </button>

      {showTip && !open && createPortal(
        <div style={{
          position: 'fixed',
          top: tipPos.top,
          left: tipPos.left,
          transform: 'translateX(-50%)',
          background: 'var(--g900)',
          color: '#fff',
          fontSize: 11,
          fontWeight: 600,
          padding: '4px 9px',
          borderRadius: 'var(--rxs)',
          pointerEvents: 'none',
          zIndex: 10000,
          whiteSpace: 'nowrap',
          letterSpacing: '.02em',
        }}>
          {tooltip}
        </div>,
        document.body
      )}

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="act-menu-list"
          // pos.left/top are already the dropdown's final top-left corner
          // (clamped to the viewport by the layout effect above) — no
          // centering transform needed, unlike the tooltip below.
          style={{ position: 'fixed', top: pos.top, left: pos.left, visibility: pos.ready ? 'visible' : 'hidden' }}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>,
        document.body
      )}
    </div>
  )
}
