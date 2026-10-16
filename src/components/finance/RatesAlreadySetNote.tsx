'use client'
import Link from 'next/link'

// Inline note under a Today's Exchange Rates bar, shown when "Set Exchange
// Rate" is clicked but every rate the bar tracks is already set for today —
// sits next to the button that was clicked instead of a page-level toast,
// and links to where a rate is actually corrected.
export function RatesAlreadySetNote({ codes, onDismiss }: { codes: string[]; onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="flex items-center gap-3"
      style={{
        width: '100%',
        padding: '10px 12px',
        borderRadius: 'var(--rxs)',
        background: 'var(--green-bg)',
        border: '1.5px solid var(--green-bd)',
        fontSize: 12.5,
        color: 'var(--g700)',
      }}
    >
      <span
        className="flex items-center justify-center"
        style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--green)', color: '#fff', flexShrink: 0 }}
      >
        <i className="lni lni-checkmark" style={{ fontSize: 11 }} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong className="text-g900">Today&apos;s {codes.join(' and ')} rates are already set.</strong>{' '}
        Corrections are made on the Exchange Rates page.
      </span>
      <Link href="/finance/exchange-rates" className="btn btn-neu btn-sm" style={{ gap: 5, flexShrink: 0 }}>
        Open Exchange Rates <i className="lni lni-arrow-right" style={{ fontSize: 11 }} />
      </Link>
      <button type="button" className="modal-close" onClick={onDismiss} aria-label="Dismiss" style={{ flexShrink: 0 }}>
        <i className="lni lni-close" style={{ fontSize: 13 }} />
      </button>
    </div>
  )
}
