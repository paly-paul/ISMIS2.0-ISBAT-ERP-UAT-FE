'use client'
import { useState } from 'react'
import { ScrollTable } from '@/components/ScrollTable'
import { TableSearch } from '@/components/TableSearch'
import { useStudentStatementSearch, useStudentStatement, useStudentFeeSummary } from '@/hooks/student/useStudentStatement'
import { getStudentStatementPdfUrl } from '@/lib/api/student/studentStatement'
import { PAYMENT_CATEGORY_LABELS } from '@/lib/api/finance/paymentConsole'

// Ported from isbat_student_module.html's Student Statement page, then
// rewired to the real students/student-statement/*.md endpoints — search
// via /student-statement/search, the ledger itself via
// /student-statement/{studentGuid}. The real resource is header +
// paymentHistory[] + outstandingItems[], two separate lists rather than one
// flat "ledger row" with an actual/paid/balance triple per row like the old
// mock LEDGER_ROWS had — same split the Finance Payment Console already
// renders (Payment History card + Outstanding Balance list), so this page
// follows that same two-table pattern instead of forcing the real shape
// into the old mock table.
function sumByCurrency<T extends { currencyName: string | null; amount?: number; outstanding?: number }>(
  rows: T[],
  field: 'amount' | 'outstanding'
): string {
  const byCurrency = new Map<string, number>()
  for (const r of rows) {
    const cur = r.currencyName ?? '—'
    const val = (field === 'amount' ? r.amount : r.outstanding) ?? 0
    byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + val)
  }
  const parts = [...byCurrency.entries()].filter(([, v]) => v > 0).map(([cur, v]) => `${cur} ${v.toLocaleString()}`)
  return parts.join(' + ') || '—'
}

export default function Page() {
  const [term, setTerm] = useState('')
  const [selectedGuid, setSelectedGuid] = useState<string | null>(null)

  const {
    data: searchPages,
    isLoading: isSearching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useStudentStatementSearch(term)
  const matches = searchPages?.pages.flatMap(p => p.items) ?? []

  const { data: statement, isLoading: isStatementLoading, isError: isStatementError, error: statementError } = useStudentStatement(selectedGuid)
  const header = statement?.header
  const paymentHistory = statement?.paymentHistory ?? []
  const outstandingItems = statement?.outstandingItems ?? []

  const { data: feeSummary } = useStudentFeeSummary(selectedGuid)

  function handleSelect(guid: string) {
    setSelectedGuid(guid)
    const found = matches.find(m => m.studentGuid === guid)
    if (found) setTerm(found.studentName ?? '')
  }

  return (
    <div className="page active">
      <div className="pg-hdr">
        <div><div className="pg-title">Student Statement</div><div className="pg-sub">Fee ledger and payment history per student</div></div>
        <div className="flex gap-2">
          <button className="btn btn-neu btn-sm"><i className="lni lni-printer"></i> Print</button>
          <button className="btn btn-neu btn-sm" onClick={() => selectedGuid && window.open(getStudentStatementPdfUrl(selectedGuid), '_blank')} disabled={!selectedGuid}>
            <i className="lni lni-download"></i> PDF
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <TableSearch
          value={term}
          onChange={v => { setTerm(v); setSelectedGuid(null) }}
          placeholder="Search student by name or reg. no…"
          loading={isSearching}
          emptyLabel="No students found"
          // minChars={0} — clicking into the empty box opens the dropdown
          // straight away (browse-all results), same as the Finance Payment
          // Console's own student search, instead of waiting for a keystroke.
          minChars={0}
          results={matches.map(m => ({ id: m.studentGuid, primary: m.studentName ?? '—', secondary: [m.studentRegNo, m.programName].filter(Boolean).join(' · ') }))}
          onSelect={r => handleSelect(r.id)}
          onLoadMore={() => hasNextPage && fetchNextPage()}
          hasMore={hasNextPage}
          loadingMore={isFetchingNextPage}
        />
      </div>

      {!selectedGuid ? (
        <div className="empty">
          <div className="empty-icon"><i className="lni lni-files"></i></div>
          <div className="empty-title">No Student Loaded</div>
          <div className="empty-sub">Search for a student above and pick them from the results to view their fee ledger.</div>
        </div>
      ) : isStatementLoading ? (
        <div className="text-g400 text-center" style={{ padding: 24 }}>Loading statement…</div>
      ) : isStatementError || !header ? (
        <div className="text-clr-red text-center" style={{ padding: 24 }}><i className="lni lni-warning"></i> {statementError instanceof Error && statementError.message && statementError.message !== 'not_found' ? statementError.message : "Couldn't load this student's statement."}</div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }} className="text-xs">
              <div><span className="text-muted">Reg No: </span><span className="font-bold font-mono text-blue">{header.studentRegNo ?? '—'}</span></div>
              <div><span className="text-muted">Student Name: </span><span className="font-bold">{header.studentName ?? '—'}</span></div>
              <div><span className="text-muted">Batch: </span><span className="font-bold">{header.batchCode ?? '—'}</span></div>
              <div><span className="text-muted">Programme: </span><span className="font-bold">{header.programName ?? '—'}</span></div>
              <div><span className="text-muted">Semester: </span><span className="font-bold">{header.semesterName ?? '—'}</span></div>
            </div>
          </div>

          <div className="stats-row">
            <div className="stat-card"><div className="stat-lbl">Admission Type</div><div className="stat-num" style={{ fontSize: 18, color: 'var(--b700)' }}>{header.admissionTypeLabel ?? '—'}</div><div className="stat-sub">{header.appRefNo ?? '—'}</div></div>
            <div className="stat-card"><div className="stat-lbl">Total to Pay</div><div className="stat-num">{feeSummary?.totalAmountToPay.toLocaleString() ?? '—'}</div><div className="stat-sub">Overall charged</div></div>
            <div className="stat-card [--b700:var(--green)] [--b400:#34d399]"><div className="stat-lbl">Total Paid</div><div className="stat-num" style={{ color: 'var(--green)' }}>{feeSummary?.amountPaid.toLocaleString() ?? '—'}</div><div className="stat-sub up">{paymentHistory.length} payments</div></div>
            <div className="stat-card [--b700:var(--red)] [--b400:#f87171]"><div className="stat-lbl">Outstanding</div><div className="stat-num" style={{ color: 'var(--red)' }}>{feeSummary?.pendingFee.toLocaleString() ?? '—'}</div><div className="stat-sub warn">{outstandingItems.length} items</div></div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-hdr"><div className="card-title"><i className="lni lni-wallet"></i> Outstanding Balance</div><span className="badge badge-amber">{sumByCurrency(outstandingItems, 'outstanding')} outstanding</span></div>
            {outstandingItems.length === 0 ? (
              <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Fully settled — nothing outstanding.</div>
            ) : (
              <ScrollTable className="no-sticky-col">
                <table>
                  <thead><tr><th style={{ width: 56 }}>Sl. No</th><th>Category</th><th>Description</th><th>Currency</th><th>Outstanding</th></tr></thead>
                  <tbody>
                    {outstandingItems.map(o => (
                      <tr key={`${o.ledgerGuid ?? o.description}-${o.slNo}`}>
                        <td className="text-g500">{o.slNo}</td>
                        <td>{PAYMENT_CATEGORY_LABELS[o.category] ?? `Category ${o.category}`}</td>
                        <td>{o.description ?? '—'}</td>
                        <td>{o.currencyName ?? '—'}</td>
                        <td><strong style={{ color: 'var(--red)' }}>{o.outstanding.toLocaleString()}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollTable>
            )}
          </div>

          <div className="card">
            <div className="card-hdr"><div className="card-title"><i className="lni lni-files"></i> Payment History — {header.studentName}</div></div>
            {paymentHistory.length === 0 ? (
              <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No payment history for this student.</div>
            ) : (
              <ScrollTable className="no-sticky-col">
                <table>
                  <thead><tr><th style={{ width: 56 }}>Sl. No</th><th>Date</th><th>Category</th><th>Method</th><th>Currency</th><th>Amount</th><th>Receipt</th></tr></thead>
                  <tbody>
                    {paymentHistory.map(p => (
                      <tr key={p.paymentGuid}>
                        <td className="text-g500">{p.slNo}</td>
                        <td>{p.payDate.slice(0, 10)}</td>
                        <td>{PAYMENT_CATEGORY_LABELS[p.category] ?? `Category ${p.category}`}</td>
                        <td><span className="pill pill-blue">{p.payType ?? '—'}</span></td>
                        <td>{p.currencyName ?? '—'}</td>
                        <td className="text-green font-bold">{p.amount.toLocaleString()}</td>
                        <td className="font-mono text-blue">{p.receipt ?? p.paymentCode ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollTable>
            )}
          </div>
        </>
      )}
    </div>
  )
}
