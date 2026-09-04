'use client'

interface TableLoadingStateProps {
  colSpan: number
  title?: string
  subtitle?: string
}

export function TableLoadingState({ colSpan, title = 'Loading records…', subtitle = 'Fetching the latest data, just a moment.' }: TableLoadingStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="tbl-empty-cell">
        <div className="tbl-empty-inner">
          <div className="tbl-loading-icon-wrap">
            <i className="lni lni-reload" />
          </div>
          <div className="tbl-empty-title">{title}</div>
          <div className="tbl-empty-sub">{subtitle}</div>
          <div className="tbl-loading-dots">
            <span className="tbl-loading-dot" />
            <span className="tbl-loading-dot" />
            <span className="tbl-loading-dot" />
          </div>
        </div>
      </td>
    </tr>
  )
}
