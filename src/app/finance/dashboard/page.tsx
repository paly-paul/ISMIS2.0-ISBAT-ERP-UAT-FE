'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { Toast } from '@/components/Toast'
import { Pagination } from '@/components/Pagination'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { usePaymentHistoryList } from '@/hooks/finance/usePaymentConsole'
import { formatDate } from '@/lib/date'

const PAGE_SIZE = 5

// payType.value → pill colour, same best-guess mapping as payment-history's
// own PAY_TYPE_PILLS (the API resolves the label itself via payType.name —
// this is cosmetic-only, not a confirmed contract from any spec).
const PAY_TYPE_PILLS: Record<number, string> = {
  1: 'pill-blue',   // Cash
  2: 'pill-amber',  // Cheque
  3: 'pill-cyan',   // Bank
  4: 'pill-purple', // Demand Draft
  5: 'pill-green',  // Online
}
function payTypePill(value: number) { return PAY_TYPE_PILLS[value] ?? 'pill-blue' }

const FEE_TYPE_BADGES: Record<string, string> = {
  'Admission Fee': 'badge-blue',
  'Registration Fee': 'badge-blue',
  'Tuition Fee': 'badge-green',
  'Semester Entry Fee': 'badge-amber',
  'NCHE Fee': 'badge-purple',
  'Guild Fee': 'badge-purple',
}
function feeTypeBadge(feeType: string) { return FEE_TYPE_BADGES[feeType] ?? 'badge-grey' }

function fmtAmount(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export default function Page() {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [page, setPage] = useState(1)

  function nav(id: string) { router.push('/finance/' + id) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // Recent Payments — the only section of this dashboard with a real
  // backing endpoint. GET .../payment-console/payment-history (the same
  // cross-application ledger /finance/payment-history's own table uses) has
  // no confirmed "today only" filter, so this shows the most recent rows
  // overall rather than genuinely scoping to today, same "narrow to what's
  // loaded, don't fabricate a filter the endpoint doesn't support"
  // convention as enquiry-list's own server-side pagination.
  const { data, isLoading } = usePaymentHistoryList(page, PAGE_SIZE)
  const rows = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Finance Dashboard</div>
            <div className="pg-sub">Real-time overview of fee collection and student financial status</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn btn-neu" onClick={() => nav('exchange-rates')}><i className="lni lni-world"></i> Exchange Rates</button>
            <button className="btn btn-primary btn-lg" onClick={() => nav('payment-console')}><i className="lni lni-credit-cards"></i> Collect Payment</button>
          </div>
        </div>

        {/* None of these four have a confirmed cross-application aggregate
            endpoint (they'd need a sum across every payment/application in
            the system, not just one page of rows) — shown as "—" rather
            than a fabricated number, same convention as payment-history's
            own Collected (UGX)/Collected (USD)/Avg. Payment Size tiles. */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-lbl">Collected Today</div>
            <div className="stat-num text-blue">—</div>
            <div className="stat-sub">No aggregate endpoint yet</div>
          </div>
          <div className="stat-card">
            <div className="stat-lbl">Students Fully Cleared</div>
            <div className="stat-num text-green">—</div>
            <div className="stat-sub">No aggregate endpoint yet</div>
          </div>
          <div className="stat-card">
            <div className="stat-lbl">Outstanding Balances</div>
            <div className="stat-num text-amber">—</div>
            <div className="stat-sub">No aggregate endpoint yet</div>
          </div>
          <div className="stat-card">
            <div className="stat-lbl">Access Blocked</div>
            <div className="stat-num text-red">—</div>
            <div className="stat-sub">No aggregate endpoint yet</div>
          </div>
        </div>

        <div className="g2">
          {/* Per-fee-type collected/target totals would need the same kind
              of cross-application aggregate the stat cards above don't have
              — no endpoint provides it, so this stays an honest empty state
              instead of four fabricated progress bars. */}
          <div className="card">
            <div className="card-hdr">
              <div className="card-title"><span className="ctitle-icon"><i className="lni lni-bar-chart"></i></span> Collection by Fee Type</div>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-2" style={{ minHeight: 180, color: 'var(--g400)' }}>
              <i className="lni lni-bar-chart" style={{ fontSize: 28 }}></i>
              <span style={{ fontSize: 'var(--fs-sm)' }}>No aggregate endpoint yet for per-fee-type collection totals</span>
            </div>
          </div>

          {/* Same gap — there's no cross-application "who owes money right
              now" list endpoint, only getOutstandingLedgers/
              getAllOutstandingLedgers, both scoped to one already-known
              application. */}
          <div className="card">
            <div className="card-hdr">
              <div className="card-title"><span className="ctitle-icon"><i className="lni lni-hourglass"></i></span> Pending Collections</div>
              <button className="btn btn-neu btn-sm" onClick={() => nav('payment-console')}>Collect →</button>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-2" style={{ minHeight: 180, color: 'var(--g400)' }}>
              <i className="lni lni-hourglass" style={{ fontSize: 28 }}></i>
              <span style={{ fontSize: 'var(--fs-sm)' }}>No cross-application outstanding-balance endpoint yet</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-credit-cards"></i></span> Recent Payments</div>
            <button className="btn btn-neu btn-sm" onClick={() => nav('payment-history')}>View All</button>
          </div>
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th>Receipt #</th><th>Date</th><th>Student</th><th>Programme</th><th>Fee Type</th>
                  <th>Amount Paid</th><th>Cur.</th><th>UGX Value</th><th>Method</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : rows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={false} onClearFilters={() => {}} />
                    : null}
                {!isLoading && rows.map((r, i) => (
                  <tr key={`${r.paymentGuid}-${r.feeType}-${i}`}>
                    <td className="text-blue font-bold font-mono">{r.receiptNo}</td>
                    <td className="text-muted">{formatDate(r.payDate)}</td>
                    <td><strong>{r.studentName ?? '—'}</strong></td>
                    <td>{r.programName ?? '—'}</td>
                    <td><span className={`badge ${feeTypeBadge(r.feeType)}`}>{r.feeType}</span></td>
                    <td className="text-green font-bold">{fmtAmount(r.amount)}</td>
                    <td><span className="badge badge-gold">{r.currencyCode}</span></td>
                    <td className="font-bold">{fmtAmount(r.ugxValue)}</td>
                    <td>{r.payType ? <span className={`pill ${payTypePill(r.payType.value)}`}>{r.payType.name}</span> : <span className="text-g400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="payments" onPageChange={setPage} />
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}
