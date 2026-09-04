'use client'
import { useRef, useState, useEffect } from 'react'

interface ScrollTableProps {
  children: React.ReactNode
  className?: string
  filters?: Record<string, string[]>
  onResetFilters?: () => void
}

export function ScrollTable({ children, className, filters, onResetFilters }: ScrollTableProps) {
  const hasActiveFilters = filters ? Object.values(filters).some(v => v.length > 0) : false
  const ref = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  function check() {
    const el = ref.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    check()
    const el = ref.current
    const ro = new ResizeObserver(check)
    if (el) ro.observe(el)
    window.addEventListener('resize', check)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', check)
    }
  }, [])

  function scrollBy(dir: 'left' | 'right') {
    ref.current?.scrollBy({ left: dir === 'right' ? 240 : -240, behavior: 'smooth' })
  }

  return (
    <div className="tbl-scroll-host">
      {hasActiveFilters && onResetFilters && (
        <div className="tbl-filter-bar">
          <span className="tbl-filter-bar-label">
            <i className="lni lni-funnel"></i>
            {Object.values(filters!).filter(v => v.length).length} filter{Object.values(filters!).filter(v => v.length).length > 1 ? 's' : ''} active
          </span>
          <button className="tbl-filter-bar-reset" onClick={onResetFilters}>
            <i className="lni lni-close"></i> Reset all filters
          </button>
        </div>
      )}
      {canLeft && (
        <button className="tbl-arrow tbl-arrow-l" onClick={() => scrollBy('left')} aria-label="Scroll left">
          <i className="lni lni-chevron-left" />
        </button>
      )}
      <div ref={ref} className={`tbl-wrap${className ? ' ' + className : ''}`} onScroll={check}>
        {children}
      </div>
      {canRight && (
        <button className="tbl-arrow tbl-arrow-r" onClick={() => scrollBy('right')} aria-label="Scroll right">
          <i className="lni lni-chevron-right" />
        </button>
      )}
    </div>
  )
}
