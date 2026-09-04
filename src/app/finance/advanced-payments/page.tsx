'use client'
import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import { Pagination } from '@/components/Pagination'
import { TableSearch } from '@/components/TableSearch'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { NewAdvanceDepositModal } from '@/components/modals/finance/NewAdvanceDepositModal'
import { usePaymentAdvances, PaymentAdvance } from '@/hooks/finance/usePayments'
import { getStudentProfile } from '@/lib/api/finance/paymentConsole'
import { PAY_TYPE_LABELS } from '@/hooks/finance/usePaymentConsole'
import { formatDate } from '@/lib/date'

const PAGE_SIZE = 10
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as the academic
// master pages' / payment-history's search boxes.
const MIN_SEARCH_CHARS = 2

function fmtAmount(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function applicantName(a: { firstName: string | null; lastName: string | null } | undefined) {
  if (!a) return undefined
  return `${a.firstName ?? ''}${a.lastName ? ` ${a.lastName}` : ''}`.trim() || undefined
}

// balance/amount is all GetPaymentAdvances actually tells us about a
// deposit's drawdown state — there's no "applied to X ledger" detail
// anywhere in this API (that would require per-drawdown records the
// backend doesn't expose), so this is a genuinely derived status, not a
// real ledger reference. The old mock's "Applied To: Tuition S1 ✓" style
// labels implied more than the API can actually say.
function depositStatus(balance: number, amount: number): { label: string; badge: string } {
  if (balance <= 0) return { label: 'Fully Drawn', badge: 'badge-green' }
  if (balance >= amount) return { label: 'Available', badge: 'badge-blue' }
  return { label: 'Partially Drawn', badge: 'badge-amber' }
}

export default function Page() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showNewDeposit, setShowNewDeposit] = useState(false)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const { data, isLoading } = usePaymentAdvances(page, PAGE_SIZE)
  const rows = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // GetPaymentAdvances (get-payment-advances.md) carries applicationGuid/
  // studentGuid only — no student name, programme, or student number. Those
  // come from GetStudentProfile, resolved per row and scoped to just the
  // currently visible page (not the whole loaded dataset), same "one
  // parallel request per distinct id on this page, not the full table"
  // convention batch-management/page.tsx already uses for its own
  // per-row semester lookups.
  const applicationGuidsOnPage = useMemo(() => Array.from(new Set(rows.map(r => r.applicationGuid))), [rows])
  const profileQueries = useQueries({
    queries: applicationGuidsOnPage.map(applicationGuid => ({
      queryKey: ['payment-console', 'profile', applicationGuid],
      queryFn: () => getStudentProfile(applicationGuid),
      staleTime: Infinity,
      gcTime: Infinity,
      retry: false,
    })),
  })
  const profileByApplication = useMemo(() => {
    const map = new Map<string, { firstName: string | null; lastName: string | null; appRefNo: string; studentNum: string | null; programName: string | null }>()
    applicationGuidsOnPage.forEach((guid, i) => {
      const p = profileQueries[i]?.data
      if (p) map.set(guid, p)
    })
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationGuidsOnPage, profileQueries.map(q => q.dataUpdatedAt).join(',')])

  function studentLabel(r: PaymentAdvance) {
    const p = profileByApplication.get(r.applicationGuid)
    // No raw-guid fallback — an unresolved profile shows '—' rather than
    // the bare applicationGuid, which isn't a meaningful identifier here.
    return { name: applicantName(p) ?? p?.appRefNo ?? '—', ref: p?.studentNum ?? p?.appRefNo ?? '—' }
  }

  // The API has no name/student-no search param (get-payment-advances.md
  // takes only page/pageSize) — same "narrows the currently-loaded server
  // page only" convention as payment-history's own search, not a query
  // against the full 300+ row table.
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length < MIN_SEARCH_CHARS) return rows
    return rows.filter(r => {
      const s = studentLabel(r)
      return `${s.name} ${s.ref} ${r.advPaymentCode} ${r.receipt ?? ''}`.toLowerCase().includes(q)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, profileByApplication])

  // Empty below MIN_SEARCH_CHARS, matching TableSearch's own minChars gate on
  // when the dropdown is even allowed to open.
  const searchMatches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length < MIN_SEARCH_CHARS) return []
    return filteredRows.slice(0, 8).map(r => {
      const s = studentLabel(r)
      return { id: r.paymentAdvanceGuid, primary: s.name, secondary: `${s.ref} · ${r.advPaymentCode}` }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRows, search])

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Advanced Payments &amp; Deposits</div>
            <div className="pg-sub">Pre-payment deposits · Lock favorable exchange rates · Offset against future ledgers</div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowNewDeposit(true)}>
            <i className="lni lni-plus"></i> New Deposit
          </button>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-arrow-up-circle"></i></span> Active Deposit Accounts</div>
            <TableSearch
              className="w-56"
              placeholder="Search by name or student no… (this page)"
              value={search}
              onChange={setSearch}
              results={searchMatches}
              minChars={MIN_SEARCH_CHARS}
            />
          </div>
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th>Student</th><th>Deposit Code</th><th>Deposit Date</th>
                  <th>Deposited</th><th>Cur.</th><th>Method</th>
                  {/* Base Value (baseCurrency/baseAmount) commented out, not
                      removed — a real live sample (10-row page) had
                      baseCurrency: null on 8 of 10 rows despite baseAmount
                      always being populated, so the currency label can't be
                      shown reliably; showing a bare number with no unit
                      would be worse than not showing the column. Re-enable
                      if the backend starts populating baseCurrency
                      consistently. */}
                  {/* <th>Base Value</th> */}
                  {/* Programme and Status columns removed per request
                      (2026-09-01) — status.label is still computed below (it
                      colors the Remaining cell), and GetStudentProfile still
                      carries programName in profileByApplication, just
                      neither is rendered as its own column any more. */}
                  <th>Remaining</th><th>Receipt #</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={!!search} onClearFilters={() => setSearch('')} />
                    : null}
                {!isLoading && filteredRows.map(r => {
                  const s = studentLabel(r)
                  const status = depositStatus(r.balance, r.amount)
                  return (
                    <tr key={r.paymentAdvanceGuid}>
                      <td>
                        <strong>{s.name}</strong>
                        <div className="font-mono text-blue" style={{ fontSize: 11 }}>{s.ref}</div>
                      </td>
                      <td className="font-mono text-blue" style={{ fontSize: 12 }}>{r.advPaymentCode}</td>
                      <td>{formatDate(r.payDate)}</td>
                      <td className="font-bold">{fmtAmount(r.amount)}</td>
                      <td><span className="badge badge-gold">{r.currency?.currencyCode ?? '—'}</span></td>
                      <td>{PAY_TYPE_LABELS[r.payType] ?? `Type ${r.payType}`}</td>
                      {/* <td className="font-bold">{r.baseCurrency?.currencyCode ?? ''} {fmtAmount(r.baseAmount)}</td> */}
                      {/* balance is NOT in the deposit's own `currency` despite
                          get-payment-advances.md's wording ("what is still
                          undrawn") reading as if it were — confirmed on a
                          real live row: amount 46 (USD), balance 165600, a
                          ~3600x jump that only makes sense as a UGX (base
                          currency) figure, not $165,600 undrawn from a $46
                          deposit. So this is shown unitless rather than
                          mislabeled with r.currency.currencyCode (which
                          would have been actively wrong here) — baseCurrency
                          would be the correct label but is unreliable (see
                          the commented Base Value column above). */}
                      <td className={`font-bold ${status.label === 'Fully Drawn' ? 'text-muted' : 'text-amber'}`}>
                        {status.label === 'Fully Drawn' ? '—' : fmtAmount(r.balance)}
                      </td>
                      <td className="font-mono text-blue">{r.receipt ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="deposit accounts" onPageChange={setPage} />
        </div>
      </div>
      <NewAdvanceDepositModal isOpen={showNewDeposit} onClose={() => setShowNewDeposit(false)} showToast={showToast} />
      <Toast toast={toast} />
    </>
  )
}
