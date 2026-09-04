'use client'

interface EmptyStateProps {
  colSpan: number
  title?: string
  subtitle?: string
  hasFilters?: boolean
  onClearFilters?: () => void
}

export function EmptyState({ colSpan, title, subtitle, hasFilters = false, onClearFilters }: EmptyStateProps) {
  const defaultTitle    = hasFilters ? 'No results found'    : 'No data yet'
  const defaultSubtitle = hasFilters
    ? 'No records match the active filters. Try adjusting or clearing them.'
    : 'There are no records to display at the moment.'

  return (
    <tr>
      <td colSpan={colSpan} className="tbl-empty-cell">
        <div className="tbl-empty-inner">
          <div className={`tbl-empty-icon-wrap${hasFilters ? ' filtered' : ''}`}>
            <i className={`lni lni-${hasFilters ? 'search' : 'inbox'}`} />
          </div>
          <div className="tbl-empty-title">{title ?? defaultTitle}</div>
          <div className="tbl-empty-sub">{subtitle ?? defaultSubtitle}</div>
          {hasFilters && onClearFilters && (
            <button className="btn btn-neu btn-sm" onClick={onClearFilters}>
              <i className="lni lni-close" /> Clear filters
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
