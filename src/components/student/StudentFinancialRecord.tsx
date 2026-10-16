'use client'
import { useState } from 'react'
import { ScrollTable } from '@/components/ScrollTable'
import { useStudentStatement, useStudentFeeSummary } from '@/hooks/student/useStudentStatement'
import { getStudentStatementPdfUrl } from '@/lib/api/student/studentStatement'
import { PAYMENT_CATEGORY_LABELS } from '@/lib/api/finance/paymentConsole'

// Compact read-only view of a student's financial statement — same data
// (GET student statement + fee summary) as Finance > Student Statement,
// sized to sit inside a tab rather than own a whole page. Used by Dropout
// Rejoin's "Financial Record" tab.
function formatMoney(amount?: number | null): string {
  if (amount == null) return '—'
  const formatted = Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return amount < 0 ? `-${formatted}` : formatted
}

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

type Section = 'payments' | 'outstanding' | 'future'

export function StudentFinancialRecord({ studentGuid }: { studentGuid: string }) {
  const [section, setSection] = useState<Section>('payments')
  const { data: statement, isLoading, isError, error } = useStudentStatement(studentGuid)
  const { data: feeSummary } = useStudentFeeSummary(studentGuid)

  if (isLoading) return <div className="text-g400 text-center" style={{ padding: 24, fontSize: 12.5 }}>Loading financial statement…</div>
  if (isError || !statement) {
    return (
      <div className="empty">
        <div className="empty-icon"><i className="lni lni-warning"></i></div>
        <div className="empty-title">Couldn&apos;t Load Financial Record</div>
        <div className="empty-sub">{error instanceof Error && error.message && error.message !== 'not_found' ? error.message : 'No statement is available for this student.'}</div>
      </div>
    )
  }

  const payments = statement.paymentHistory ?? []
  const outstanding = statement.outstandingItems ?? []
  const future = statement.futurePayments ?? []
  const totalPaid = feeSummary?.amountPaid ?? payments.reduce((sum, p) => sum + (p.amount || 0), 0)
  const currentOutstanding = feeSummary?.pendingFee ?? outstanding.reduce((sum, o) => sum + (o.outstanding || 0), 0)
  const totalFuture = future.reduce((sum, f) => sum + (f.amountDue || 0), 0)
  const balanceDue = currentOutstanding - totalPaid

  const sections: { id: Section; label: string; icon: string; count: number }[] = [
    { id: 'payments', label: 'Payment History', icon: 'credit-cards', count: payments.length },
    { id: 'outstanding', label: 'Outstanding Items', icon: 'wallet', count: outstanding.length },
    { id: 'future', label: 'Future Payments', icon: 'alarm-clock', count: future.length },
  ]

  return (
    <>
      <div className="stat-grid-fluid mb-3">
        <div className="stat-card"><div className="stat-lbl">Total Paid</div><div className="stat-num">{formatMoney(totalPaid)}</div></div>
        <div className="stat-card"><div className="stat-lbl">Current Outstanding</div><div className="stat-num" style={{ color: 'var(--red)' }}>{formatMoney(currentOutstanding)}</div></div>
        <div className="stat-card"><div className="stat-lbl">Future Payments</div><div className="stat-num">{formatMoney(totalFuture)}</div></div>
        <div className="stat-card"><div className="stat-lbl">Balance Due (Current)</div><div className="stat-num" style={{ color: balanceDue <= 0 ? 'var(--green)' : 'var(--red)' }}>{formatMoney(balanceDue)}</div></div>
      </div>

      <div className="card">
        <div className="card-hdr" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            {sections.map(s => (
              <button key={s.id} className={`btn btn-sm ${section === s.id ? 'btn-primary' : 'btn-neu'}`} onClick={() => setSection(s.id)}>
                <i className={`lni lni-${s.icon}`}></i> {s.label} ({s.count})
              </button>
            ))}
          </div>
          <button className="btn btn-neu btn-sm" onClick={() => window.open(getStudentStatementPdfUrl(studentGuid), '_blank')}>
            <i className="lni lni-download"></i> PDF
          </button>
        </div>

        <ScrollTable>
          {section === 'payments' && (
            <table>
              <thead><tr><th>#</th><th>Payment Code</th><th>Date</th><th>Semester</th><th>Pay Type</th><th>Receipt</th><th style={{ textAlign: 'right' }}>Amount</th><th>Currency</th><th>Category</th></tr></thead>
              <tbody>
                {payments.length === 0
                  ? <tr><td colSpan={9} className="text-g400 text-center" style={{ padding: 16 }}>No payment history.</td></tr>
                  : payments.map((p, i) => (
                    <tr key={p.paymentGuid || i}>
                      <td>{p.slNo || i + 1}</td>
                      <td className="font-mono">{p.paymentCode || '—'}</td>
                      <td>{formatDate(p.payDate)}</td>
                      <td>{p.semesterName || '—'}</td>
                      <td>{p.payType || '—'}</td>
                      <td className="font-mono">{p.receipt || '—'}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{formatMoney(p.amount)}</td>
                      <td>{p.currencyName || '—'}</td>
                      <td>{PAYMENT_CATEGORY_LABELS[p.category] || 'Other'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
          {section === 'outstanding' && (
            <table>
              <thead><tr><th>#</th><th>Description</th><th>Semester</th><th>Category</th><th style={{ textAlign: 'right' }}>Outstanding</th><th>Currency</th></tr></thead>
              <tbody>
                {outstanding.length === 0
                  ? <tr><td colSpan={6} className="text-g400 text-center" style={{ padding: 16 }}>Fully settled — no outstanding items.</td></tr>
                  : outstanding.map((o, i) => (
                    <tr key={o.ledgerGuid || i}>
                      <td>{o.slNo || i + 1}</td>
                      <td>{o.description || 'Fee Assessment'}</td>
                      <td>{o.semesterName || '—'}</td>
                      <td>{PAYMENT_CATEGORY_LABELS[o.category] || 'Other'}</td>
                      <td className="font-mono" style={{ textAlign: 'right', color: 'var(--red)' }}>{formatMoney(o.outstanding)}</td>
                      <td>{o.currencyName || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
          {section === 'future' && (
            <table>
              <thead><tr><th>#</th><th>Description</th><th>Semester</th><th style={{ textAlign: 'right' }}>Amount Due</th><th>Currency</th></tr></thead>
              <tbody>
                {future.length === 0
                  ? <tr><td colSpan={5} className="text-g400 text-center" style={{ padding: 16 }}>No future payments scheduled.</td></tr>
                  : future.map((f, i) => (
                    <tr key={f.slNo || i}>
                      <td>{f.slNo || i + 1}</td>
                      <td>{f.description || '—'}</td>
                      <td>{f.semesterName || '—'}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{formatMoney(f.amountDue)}</td>
                      <td>{f.currencyName || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </ScrollTable>
      </div>
    </>
  )
}
