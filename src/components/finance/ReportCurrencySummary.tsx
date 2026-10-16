'use client'

// The pinned per-currency summary under a report table (Transaction and
// Outstanding reports). One row per currency, the same labelled columns on
// every row, figures right-aligned so they line up across currencies. Never
// adds currencies together — each row stands alone.

export interface SummaryColumn<T> {
  label: string
  value: (row: T) => string
  key?: boolean   // the headline figure (e.g. Net, Total outstanding)
}

export function ReportCurrencySummary<T extends { currencyCode: string }>({ title, note, rows, columns }: {
  title: string
  note: string
  rows: T[]
  columns: SummaryColumn<T>[]
}) {
  return (
    <div className="rpt-sumtbl" role="region" aria-label={title}>
      <div className="rpt-sumtbl-hdr">
        <span className="rpt-sumtbl-title">{title}</span>
        <span className="rpt-sumtbl-note">{note}</span>
      </div>
      <div className="rpt-sumtbl-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Currency</th>
              {columns.map(c => <th key={c.label} scope="col" className={c.key ? 'key' : undefined}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.currencyCode}>
                <th scope="row">{r.currencyCode}</th>
                {columns.map(c => <td key={c.label} className={c.key ? 'key' : undefined}>{c.value(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
