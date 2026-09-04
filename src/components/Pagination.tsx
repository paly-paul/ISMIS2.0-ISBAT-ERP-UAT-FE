'use client'
import { useEffect, useState } from 'react'

interface PaginationProps {
  page: number
  totalPages: number
  totalCount: number
  itemLabel?: string
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, totalCount, itemLabel = 'results', onPageChange }: PaginationProps) {
  // Controlled as a string, not a number — +e.target.value coerces '' to 0
  // and blocks clearing the field mid-edit, same convention used for every
  // other numeric input in this app.
  const [jumpTo, setJumpTo] = useState(String(page))

  // Keep the box in sync whenever the page changes some other way (Previous/
  // Next, or a page-resetting filter elsewhere on the page) so it doesn't
  // keep showing a stale number once it's no longer the current page.
  useEffect(() => { setJumpTo(String(page)) }, [page])

  if (totalCount === 0) return null

  function commitJump() {
    const n = Math.trunc(+jumpTo)
    // An out-of-range number (or a blank box) used to just get silently
    // discarded back to whatever page you were already on — which, typed
    // from page 1, reads as "I entered a number and it turned into 1" with
    // no indication why. Clamp into the valid range instead, so "Go to 99"
    // on a 5-page table lands on page 5 rather than bouncing back to page 1.
    if (!Number.isFinite(n)) { setJumpTo(String(page)); return }
    const clamped = Math.min(Math.max(n, 1), totalPages)
    if (clamped !== page) onPageChange(clamped)
    setJumpTo(String(clamped))
  }

  return (
    <div className="flex items-center justify-between mt-3" style={{ fontSize: 12.5, color: 'var(--g500)' }}>
      <span>Page {page} of {totalPages} · {totalCount.toLocaleString()} {itemLabel}</span>
      <div className="flex items-center gap-2">
        <button className="btn btn-neu btn-sm" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}>
          <i className="lni lni-chevron-left" /> Previous
        </button>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <span>Go to</span>
            <input
              type="text"
              inputMode="numeric"
              className="ctrl"
              style={{ width: 52, height: 28, padding: '2px 6px', textAlign: 'center', fontSize: 12.5 }}
              value={jumpTo}
              onChange={e => setJumpTo(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitJump() } }}
              onBlur={commitJump}
              aria-label="Go to page"
            />
          </div>
        )}
        <button className="btn btn-neu btn-sm" disabled={page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))}>
          Next <i className="lni lni-chevron-right" />
        </button>
      </div>
    </div>
  )
}
