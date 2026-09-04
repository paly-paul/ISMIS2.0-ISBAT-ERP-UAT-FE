'use client'
import { useMemo, useState } from 'react'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { SearchSelect } from '@/components/SearchSelect'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { Toast } from '@/components/Toast'
import { usePaymentHistoryList } from '@/hooks/finance/usePaymentConsole'
import type { PaymentHistoryListEntry } from '@/hooks/finance/usePaymentConsole'
import { formatDate } from '@/lib/date'
import { ViewPaymentReceiptModal } from '@/components/modals/finance/ViewPaymentReceiptModal'

const PAGE_SIZE = 10
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as the academic
// master pages' search boxes.
const MIN_SEARCH_CHARS = 2

const FEE_TYPES = ['Admission Fee', 'Registration Fee', 'Tuition Fee', 'Semester Entry Fee', 'NCHE Fee', 'Guild Fee']

// Explicit '' → 'All Fee Types' option, same convention as enquiry-list's
// channelOptions/intakeOptions, rather than relying on SearchSelect's own
// placeholder/isEmpty fallback — keeps '' a real, matchable option value.
const FEE_TYPE_OPTIONS = [{ value: '', label: 'All Fee Types' }, ...FEE_TYPES.map(f => ({ value: f, label: f }))]

const FEE_TYPE_BADGES: Record<string, string> = {
  'Admission Fee': 'badge-blue',
  'Registration Fee': 'badge-blue',
  'Tuition Fee': 'badge-green',
  'Semester Entry Fee': 'badge-amber',
  'NCHE Fee': 'badge-purple',
  'Guild Fee': 'badge-purple',
}
function feeTypeBadge(feeType: string) { return FEE_TYPE_BADGES[feeType] ?? 'badge-grey' }

// payType.value → pill colour. The API resolves the label itself
// (payType.name), so this is cosmetic-only — a best-guess mapping, same
// convention as payment-console's own PAY_TYPE_TO_RECEIPT_CATEGORY, not a
// confirmed contract from any spec.
const PAY_TYPE_PILLS: Record<number, string> = {
  1: 'pill-blue',   // Cash
  2: 'pill-amber',  // Cheque
  3: 'pill-cyan',   // Bank
  4: 'pill-purple', // Demand Draft
  5: 'pill-green',  // Online
}
function payTypePill(value: number) { return PAY_TYPE_PILLS[value] ?? 'pill-blue' }

function fmtAmount(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export default function Page() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [search, setSearch] = useState('')
  const [feeType, setFeeType] = useState('')
  const [page, setPage] = useState(1)

  // Row data (PaymentHistoryListEntry) already carries everything a receipt
  // reprint needs — no separate "get receipt" endpoint required. autoPrint
  // distinguishes the row's quick Print action (open + print immediately)
  // from View (open only); both reuse the same modal/row selection.
  const [receiptEntry, setReceiptEntry] = useState<PaymentHistoryListEntry | null>(null)
  const [autoPrint, setAutoPrint] = useState(false)
  function openReceipt(r: PaymentHistoryListEntry, print: boolean) {
    setReceiptEntry(r)
    setAutoPrint(print)
    setSearch('')
  }
  function closeReceipt() {
    setReceiptEntry(null)
    setAutoPrint(false)
  }

  const { data, isLoading } = usePaymentHistoryList(page, PAGE_SIZE)
  const rows = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // The real endpoint only paginates — it has no confirmed search/filter
  // query params — so, same convention as /admission/enquiry-list, Search
  // and Fee Type here only narrow the currently-loaded server page rather
  // than querying the full 100k+-row table.
  function matchesFilters(r: PaymentHistoryListEntry, q: string) {
    const matchesSearch = q.length < MIN_SEARCH_CHARS
      || (r.studentName ?? '').toLowerCase().includes(q)
      || (r.receiptNo ?? '').toLowerCase().includes(q)
      || (r.studentNo ?? '').toLowerCase().includes(q)
    const matchesFeeType = !feeType || r.feeType === feeType
    return matchesSearch && matchesFeeType
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => matchesFilters(r, q))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, feeType])

  // Empty below MIN_SEARCH_CHARS, matching TableSearch's own minChars gate on
  // when the dropdown is even allowed to open.
  const searchMatches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length < MIN_SEARCH_CHARS) return []
    return rows.filter(r => matchesFilters(r, q)).slice(0, 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search])

  function clearFilters() { setSearch(''); setFeeType('') }

  return (
    <>
      <div className="page active">
        {/* pg-hdr holds only the title, matching the app-wide convention
            (receipt-books, discounts, …) — search/filter controls live in
            the table's own card-hdr below instead, which has the full page
            width to itself rather than sharing the row with the title. The
            three controls here (Search + Fee Type + Export) previously sat
            in pg-hdr alongside the title and didn't fit at narrower widths,
            wrapping into an awkward 3-row stack (confirmed live). */}
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Payment History</div>
            <div className="pg-sub">Complete transaction ledger · Search &amp; Fee Type filter apply to this page only</div>
          </div>
        </div>

        {/* Only Total Records is wired to real data (totalCount) — it counts
            fee-line rows, not distinct payments (one receipt/paymentGuid can
            span several rows, one per fee type, per the real sample data).
            Collected (UGX/USD) and Avg. Payment Size would need a real
            aggregate across all 100k+ rows, which no endpoint provides yet —
            left as placeholders rather than computed from just this page's
            20 rows and presented as if they were a genuine grand total. */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-lbl">Total Records</div>
            <div className="stat-num text-blue">{totalCount.toLocaleString()}</div>
            <div className="stat-sub">Fee-line rows, all time</div>
          </div>
          <div className="stat-card [--b700:var(--green)] [--b400:#34d399]">
            <div className="stat-lbl">Collected (UGX)</div>
            <div className="stat-num text-green">—</div>
            <div className="stat-sub">No aggregate endpoint yet</div>
          </div>
          <div className="stat-card">
            <div className="stat-lbl">Collected (USD)</div>
            <div className="stat-num text-blue">—</div>
            <div className="stat-sub">No aggregate endpoint yet</div>
          </div>
          <div className="stat-card [--b700:var(--gold)] [--b400:#fbbf24]">
            <div className="stat-lbl">Avg. Payment Size</div>
            <div className="stat-num" style={{ color: 'var(--gold)' }}>—</div>
            <div className="stat-sub">No aggregate endpoint yet</div>
          </div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-list"></i></span> Transactions</div>
          </div>
          <div className="flex gap-2 mb-[14px]">
            <TableSearch
              className="w-80"
              placeholder="Name, receipt#, student no… (this page)"
              value={search}
              onChange={setSearch}
              results={searchMatches.map(r => ({ id: `${r.paymentGuid}-${r.feeType}`, primary: r.studentName ?? r.receiptNo, secondary: `${r.receiptNo} · ${r.studentNo ?? '—'}` }))}
              minChars={MIN_SEARCH_CHARS}
              onSelect={(res) => {
                const row = rows.find(r => `${r.paymentGuid}-${r.feeType}` === res.id)
                if (row) openReceipt(row, false)
              }}
            />
            <SearchSelect className="w-36" options={FEE_TYPE_OPTIONS} value={feeType} onChange={setFeeType} />
            {/* Export CSV — commented out per request, not wired to a real
                export (was only ever a showToast stub); kept here rather
                than deleted so it's easy to bring back once there's an
                actual export to call. */}
            {/* <button className="btn btn-neu btn-sm" onClick={() => showToast('Exporting payment history to CSV…', 'success')}>
              <i className="lni lni-upload"></i> Export CSV
            </button> */}
          </div>
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Receipt #</th><th>Date</th><th>Student No.</th><th>Student Name</th>
                  <th>Programme</th><th>Fee Type</th><th>Paid</th><th>Cur.</th>
                  <th>UGX Value</th><th>Rate</th><th>Method</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={!!search || !!feeType} onClearFilters={clearFilters} />
                    : null}
                {!isLoading && filteredRows.map((r, i) => (
                  <tr key={`${r.paymentGuid}-${r.feeType}-${i}`}>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => openReceipt(r, true)}>
                          <i className="lni lni-printer"></i> Print
                        </button>
                        <button className="btn btn-neu btn-sm" onClick={() => openReceipt(r, false)}>
                          <i className="lni lni-eye"></i> View
                        </button>
                      </ActionMenu>
                    </td>
                    <td className="text-blue font-bold font-mono">{r.receiptNo}</td>
                    <td className="text-muted">{formatDate(r.payDate)}</td>
                    <td className="font-mono text-blue">{r.studentNo ?? '—'}</td>
                    <td><strong>{r.studentName ?? '—'}</strong></td>
                    <td>{r.programName ?? '—'}</td>
                    <td><span className={`badge ${feeTypeBadge(r.feeType)}`}>{r.feeType}</span></td>
                    <td className="text-green font-bold">{fmtAmount(r.amount)}</td>
                    <td><span className="badge badge-gold">{r.currencyCode}</span></td>
                    <td className="font-bold">{fmtAmount(r.ugxValue)}</td>
                    <td className="text-g400" style={{ fontSize: 11 }}>{r.rate != null ? fmtAmount(r.rate) : '—'}</td>
                    <td>{r.payType ? <span className={`pill ${payTypePill(r.payType.value)}`}>{r.payType.name}</span> : <span className="text-g400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="records" onPageChange={setPage} />
        </div>
      </div>
      <ViewPaymentReceiptModal
        isOpen={!!receiptEntry}
        onClose={closeReceipt}
        showToast={showToast}
        entry={receiptEntry}
        autoPrint={autoPrint}
      />
      <Toast toast={toast} />
    </>
  )
}
