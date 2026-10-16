'use client'
import { useState, useMemo, useEffect, Fragment } from 'react'
import Link from 'next/link'
import { ScrollTable } from '@/components/ScrollTable'
import { TableSearch } from '@/components/TableSearch'
import { SearchSelect } from '@/components/SearchSelect'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { ActionMenu } from '@/components/ActionMenu'
import { Toast } from '@/components/Toast'
import { ViewPaymentReceiptModal } from '@/components/modals/finance/ViewPaymentReceiptModal'
import { useStudentStatementSearch, useStudentStatement, useStudentFeeSummary } from '@/hooks/student/useStudentStatement'
import { getStudentStatementPdfUrl } from '@/lib/api/student/studentStatement'
import { PAYMENT_CATEGORY_LABELS, type PaymentHistoryListEntry } from '@/lib/api/finance/paymentConsole'

// Category options for standard SearchSelect dropdown
const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: '1', label: 'Tuition Fee' },
  { value: '3', label: 'NCHE Fee' },
  { value: '4', label: 'Guild Fee' },
  { value: '5', label: 'Advance Deposit' },
]

// Format currency amount with commas
function formatMoney(amount?: number | null, currency = ''): string {
  if (amount == null) return '—'
  const formatted = Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const prefix = amount < 0 ? '-' : ''
  return currency ? `${currency} ${prefix}${formatted}` : `${prefix}${formatted}`
}

function parseSemesterOrder(name: string): number {
  if (!name) return 9999
  const lower = name.toLowerCase().trim()

  // Extract Year
  let year = 99
  if (lower.includes('year one') || lower.includes('year 1') || lower.includes('1st year') || lower.includes('first year')) year = 1
  else if (lower.includes('year two') || lower.includes('year 2') || lower.includes('2nd year') || lower.includes('second year')) year = 2
  else if (lower.includes('year three') || lower.includes('year 3') || lower.includes('3rd year') || lower.includes('third year')) year = 3
  else if (lower.includes('year four') || lower.includes('year 4') || lower.includes('4th year') || lower.includes('fourth year')) year = 4
  else if (lower.includes('year five') || lower.includes('year 5') || lower.includes('5th year') || lower.includes('fifth year')) year = 5

  // Extract Semester
  let sem = 99
  if (lower.includes('semester one') || lower.includes('semester 1') || lower.includes('sem 1') || lower.includes('sem one')) sem = 1
  else if (lower.includes('semester two') || lower.includes('semester 2') || lower.includes('sem 2') || lower.includes('sem two')) sem = 2
  else if (lower.includes('semester three') || lower.includes('semester 3') || lower.includes('sem 3') || lower.includes('sem three')) sem = 3

  return year * 10 + sem
}

function sumByCurrency<T extends { currencyName?: string | null; amount?: number; outstanding?: number; amountDue?: number }>(
  rows: T[],
  field: 'amount' | 'outstanding' | 'amountDue'
): { currency: string; total: number }[] {
  const byCurrency = new Map<string, number>()
  for (const r of rows) {
    const rawCur = r.currencyName?.trim()
    const cur = !rawCur || rawCur === '—' ? 'UGX' : rawCur
    const val = (field === 'amount' ? r.amount : field === 'outstanding' ? r.outstanding : r.amountDue) ?? 0
    byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + val)
  }
  return [...byCurrency.entries()].map(([currency, total]) => ({ currency, total }))
}

function getCategoryBadge(category?: number | null) {
  switch (category) {
    case 3: // NCHE
      return { badge: 'badge-green', label: 'NCHE' }
    case 4: // Guild
      return { badge: 'badge-amber', label: 'Guild' }
    case 1: // Tuition
      return { badge: 'badge-blue', label: 'Tuition' }
    case 5: // Advance Deposit
      return { badge: 'badge-purple', label: 'Advance Deposit' }
    default:
      return {
        badge: 'badge-grey',
        label: (category != null ? PAYMENT_CATEGORY_LABELS[category] : null) || 'Other',
      }
  }
}

function renderCategoryBadge(category?: number | null) {
  const { badge, label } = getCategoryBadge(category)
  return (
    <span className={`badge ${badge}`}>
      <span className="bdot" />
      {label}
    </span>
  )
}

type DisplayView = 'hybrid' | 'charts' | 'official'

export default function StudentStatementPage() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const [term, setTerm] = useState('')
  const [selectedGuid, setSelectedGuid] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<DisplayView>('hybrid')
  const [tableTab, setTableTab] = useState<'payments' | 'outstanding' | 'future'>('payments')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [tableSearch, setTableSearch] = useState('')
  const [hoveredChartSegment, setHoveredChartSegment] = useState<string | null>(null)
  const [groupBySemester, setGroupBySemester] = useState(true)

  // Receipt Modal State (matching payment-history convention)
  const [receiptEntry, setReceiptEntry] = useState<PaymentHistoryListEntry | null>(null)
  const [autoPrint, setAutoPrint] = useState(false)

  // Infinite search query for quick student selection
  const {
    data: searchPages,
    isLoading: isSearching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useStudentStatementSearch(term, !selectedGuid)
  const matches = searchPages?.pages.flatMap(p => p.items) ?? []

  // Main statement query
  const {
    data: statement,
    isLoading: isStatementLoading,
    isError: isStatementError,
    error: statementError,
  } = useStudentStatement(selectedGuid)

  const header = statement?.header
  const paymentHistory = statement?.paymentHistory ?? []
  const outstandingItems = statement?.outstandingItems ?? []
  const futurePayments = statement?.futurePayments ?? []

  // Summary totals
  const { data: feeSummary } = useStudentFeeSummary(selectedGuid)

  const totalPaid = feeSummary?.amountPaid ?? paymentHistory.reduce((acc, p) => acc + (p.amount || 0), 0)
  const currentOutstanding = feeSummary?.pendingFee ?? outstandingItems.reduce((acc, o) => acc + (o.outstanding || 0), 0)
  const totalFuture = futurePayments.reduce((acc, f) => acc + (f.amountDue || 0), 0)
  const balanceDueCurrent = currentOutstanding - totalPaid

  // Clearance percentage
  const totalBilled = (feeSummary?.totalAmountToPay ?? (totalPaid + currentOutstanding)) || 1
  const paidPercent = Math.min(100, Math.max(0, Math.round((totalPaid / totalBilled) * 100)))

  // Opened as /finance/student-statements?studentGuid=… (e.g. Payment
  // Console's "View Student Statement" after a payment): load that student
  // straight away. Read from window.location after mount rather than
  // useSearchParams, which would need a Suspense boundary in the static build.
  // from=payment-console (+ that page's applicationGuid) adds a Back button
  // that reopens the console on the same student.
  const [backToConsole, setBackToConsole] = useState<{ applicationGuid: string; studentGuid: string } | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const guid = params.get('studentGuid')
    if (guid) setSelectedGuid(guid)
    const applicationGuid = params.get('applicationGuid')
    if (guid && applicationGuid && params.get('from') === 'payment-console') setBackToConsole({ applicationGuid, studentGuid: guid })
  }, [])

  function backToPaymentConsoleHref() {
    if (!backToConsole) return '/finance/payment-console'
    const q = new URLSearchParams({ applicationGuid: backToConsole.applicationGuid, studentGuid: backToConsole.studentGuid })
    if (header?.studentName) q.set('name', header.studentName)
    return `/finance/payment-console?${q.toString()}`
  }

  // A student opened from the URL has no search hit to take a name from, so
  // fill the search box from the statement once it loads.
  useEffect(() => {
    if (selectedGuid && !term && header?.studentName) setTerm(header.studentName)
  }, [selectedGuid, term, header?.studentName])

  function handleSelect(guid: string) {
    setSelectedGuid(guid)
    const found = matches.find(m => m.studentGuid === guid)
    if (found) setTerm(found.studentName ?? '')
  }

  function handleClearStudent() {
    setSelectedGuid(null)
    setTerm('')
  }

  function copyToClipboard(text: string, label: string) {
    if (!text) return
    navigator.clipboard.writeText(text).then(
      () => showToast(`${label} copied to clipboard`, 'success'),
      () => showToast(`Failed to copy ${label}`, 'error')
    )
  }

  function openReceipt(p: (typeof paymentHistory)[0], print: boolean) {
    const entry: PaymentHistoryListEntry = {
      paymentGuid: p.paymentGuid || `STU-REC-${p.receipt || p.paymentCode || '001'}`,
      category: p.category || 1,
      receiptNo: p.receipt || p.paymentCode || '—',
      payDate: p.payDate || new Date().toISOString(),
      studentNo: header?.studentNum || header?.studentRegNo || null,
      studentName: header?.studentName || null,
      programName: header?.programName || null,
      feeType: (p.category != null ? PAYMENT_CATEGORY_LABELS[p.category] : null) || 'Tuition Fee',
      amount: p.amount || 0,
      currencyCode: p.currencyName || 'UGX',
      ugxValue: p.amount || 0,
      rate: null,
      payType: p.payType ? { value: 1, name: p.payType } : null,
    }
    setReceiptEntry(entry)
    setAutoPrint(print)
  }

  // One payment row, shared by the grouped and flat views. The grouped view
  // drops the Semester cell — the group header above already names it.
  // Empty values render as a plain muted dash, not an empty pill/badge.
  function renderPaymentRow(p: (typeof paymentHistory)[0], idx: number, key: string, showSemester: boolean) {
    const dash = <span className="text-g300">—</span>
    return (
      <tr key={key}>
        <td>
          <ActionMenu>
            <button type="button" className="btn btn-neu btn-sm" onClick={() => openReceipt(p, false)}>
              <i className="lni lni-eye" /> View Receipt
            </button>
            <button type="button" className="btn btn-neu btn-sm" onClick={() => openReceipt(p, true)}>
              <i className="lni lni-printer" /> Print Receipt
            </button>
            {p.receipt && (
              <button type="button" className="btn btn-neu btn-sm" onClick={() => copyToClipboard(p.receipt!, 'Receipt Number')}>
                <i className="lni lni-clipboard" /> Copy Receipt #
              </button>
            )}
            {p.paymentCode && (
              <button type="button" className="btn btn-neu btn-sm" onClick={() => copyToClipboard(p.paymentCode!, 'Payment Code')}>
                <i className="lni lni-clipboard" /> Copy Code
              </button>
            )}
          </ActionMenu>
        </td>
        <td className="text-center text-g400">{p.slNo || idx + 1}</td>
        <td className="font-mono text-blue font-semibold">{p.paymentCode || dash}</td>
        <td className="whitespace-nowrap text-g700">
          {p.payDate
            ? new Date(p.payDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : dash}
        </td>
        {showSemester && <td className="text-g800 font-medium">{p.semesterName || header?.semesterName || dash}</td>}
        <td>{p.payType ? <span className="pill pill-blue">{p.payType}</span> : dash}</td>
        <td className="font-mono text-g700">{p.receipt || dash}</td>
        <td className="num font-mono font-bold text-green">{formatMoney(p.amount)}</td>
        <td className="text-g500">{p.currencyName || dash}</td>
        <td>{renderCategoryBadge(p.category)}</td>
      </tr>
    )
  }

  function closeReceipt() {
    setReceiptEntry(null)
    setAutoPrint(false)
  }

  // Group payments by category for chart
  const categoryStats = useMemo(() => {
    const map = new Map<string, { label: string; paid: number; due: number; count: number }>()

    paymentHistory.forEach(p => {
      const catName = PAYMENT_CATEGORY_LABELS[p.category] || 'Other'
      const existing = map.get(catName) || { label: catName, paid: 0, due: 0, count: 0 }
      existing.paid += p.amount || 0
      existing.count += 1
      map.set(catName, existing)
    })

    outstandingItems.forEach(o => {
      const catName = PAYMENT_CATEGORY_LABELS[o.category] || 'Other'
      const existing = map.get(catName) || { label: catName, paid: 0, due: 0, count: 0 }
      existing.due += o.outstanding || 0
      map.set(catName, existing)
    })

    return Array.from(map.values())
  }, [paymentHistory, outstandingItems])

  // Donut chart math
  const chartTotal = totalPaid + currentOutstanding + totalFuture || 1

  // Filtered payments by category and search
  const filteredPayments = useMemo(() => {
    return paymentHistory.filter(p => {
      const matchCat = selectedCategory === 'all' || String(p.category) === selectedCategory
      const q = tableSearch.trim().toLowerCase()
      const matchSearch =
        !q ||
        (p.receipt && p.receipt.toLowerCase().includes(q)) ||
        (p.paymentCode && p.paymentCode.toLowerCase().includes(q)) ||
        (p.payType && p.payType.toLowerCase().includes(q)) ||
        (p.semesterName && p.semesterName.toLowerCase().includes(q)) ||
        (PAYMENT_CATEGORY_LABELS[p.category] && PAYMENT_CATEGORY_LABELS[p.category].toLowerCase().includes(q))
      return matchCat && matchSearch
    })
  }, [paymentHistory, selectedCategory, tableSearch])

  // Filtered outstanding items
  const filteredOutstanding = useMemo(() => {
    return outstandingItems.filter(item => {
      const matchCat = selectedCategory === 'all' || String(item.category) === selectedCategory
      const q = tableSearch.trim().toLowerCase()
      const matchSearch =
        !q ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (PAYMENT_CATEGORY_LABELS[item.category] && PAYMENT_CATEGORY_LABELS[item.category].toLowerCase().includes(q)) ||
        (item.currencyName && item.currencyName.toLowerCase().includes(q)) ||
        (item.semesterName && item.semesterName.toLowerCase().includes(q))
      return matchCat && matchSearch
    })
  }, [outstandingItems, selectedCategory, tableSearch])

  // Filtered future payments
  const filteredFuture = useMemo(() => {
    return futurePayments.filter(item => {
      const q = tableSearch.trim().toLowerCase()
      const matchSearch =
        !q ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.semesterName && item.semesterName.toLowerCase().includes(q)) ||
        (item.currencyName && item.currencyName.toLowerCase().includes(q))
      return matchSearch
    })
  }, [futurePayments, tableSearch])

  // Grouped payments by semester (sorted ascending by year & semester, with currency breakdown)
  const groupedPayments = useMemo(() => {
    const map = new Map<string, typeof filteredPayments>()
    for (const p of filteredPayments) {
      const sem = p.semesterName?.trim() || header?.semesterName?.trim() || 'General / Unassigned'
      if (!map.has(sem)) map.set(sem, [])
      map.get(sem)!.push(p)
    }
    const groups = [...map.entries()].map(([semester, items]) => ({
      semester,
      items,
      currencyTotals: sumByCurrency(items, 'amount'),
    }))

    groups.sort((a, b) => {
      const orderA = parseSemesterOrder(a.semester)
      const orderB = parseSemesterOrder(b.semester)
      if (orderA !== orderB) return orderA - orderB
      return a.semester.localeCompare(b.semester)
    })

    return groups
  }, [filteredPayments, header?.semesterName])

  // Grouped outstanding items by semester (sorted ascending by year & semester, with currency breakdown)
  const groupedOutstanding = useMemo(() => {
    const map = new Map<string, typeof filteredOutstanding>()
    for (const item of filteredOutstanding) {
      const sem = item.semesterName?.trim() || header?.semesterName?.trim() || 'General / Unassigned'
      if (!map.has(sem)) map.set(sem, [])
      map.get(sem)!.push(item)
    }
    const groups = [...map.entries()].map(([semester, items]) => ({
      semester,
      items,
      currencyTotals: sumByCurrency(items, 'outstanding'),
    }))

    groups.sort((a, b) => {
      const orderA = parseSemesterOrder(a.semester)
      const orderB = parseSemesterOrder(b.semester)
      if (orderA !== orderB) return orderA - orderB
      return a.semester.localeCompare(b.semester)
    })

    return groups
  }, [filteredOutstanding, header?.semesterName])

  // Grouped future payments by semester (sorted ascending by year & semester, with currency breakdown)
  const groupedFuture = useMemo(() => {
    const map = new Map<string, typeof filteredFuture>()
    for (const item of filteredFuture) {
      const sem = item.semesterName?.trim() || 'Future Assessments'
      if (!map.has(sem)) map.set(sem, [])
      map.get(sem)!.push(item)
    }
    const groups = [...map.entries()].map(([semester, items]) => ({
      semester,
      items,
      currencyTotals: sumByCurrency(items, 'amountDue'),
    }))

    groups.sort((a, b) => {
      const orderA = parseSemesterOrder(a.semester)
      const orderB = parseSemesterOrder(b.semester)
      if (orderA !== orderB) return orderA - orderB
      return a.semester.localeCompare(b.semester)
    })

    return groups
  }, [filteredFuture])

  return (
    <>
      <div className="page active" id="page-student-statement">
        {/* ── Page Header matching standard ISBAT ERP convention ──────── */}
        <div className="pg-hdr">
          <div>
            {backToConsole && (
              <Link href={backToPaymentConsoleHref()} prefetch={false} className="btn btn-neu btn-sm mb-2" style={{ display: 'inline-flex' }}>
                <i className="lni lni-arrow-left" /> Back to Payment Console
              </Link>
            )}
            <div className="pg-title">Student Statement</div>
            <div className="pg-sub">Official student financial ledger, payment history, and fee breakdown</div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 p-1 bg-g100 rounded-[var(--rsm)] border border-g200">
              <button
                type="button"
                onClick={() => setViewMode('hybrid')}
                className={`btn btn-sm ${viewMode === 'hybrid' ? 'btn-primary' : 'btn-neu'} border-0`}
                style={viewMode === 'hybrid' ? undefined : { background: 'transparent', boxShadow: 'none' }}
              >
                <i className="lni lni-grid-alt" />
                <span>Overview</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('charts')}
                className={`btn btn-sm ${viewMode === 'charts' ? 'btn-primary' : 'btn-neu'} border-0`}
                style={viewMode === 'charts' ? undefined : { background: 'transparent', boxShadow: 'none' }}
              >
                <i className="lni lni-pie-chart" />
                <span>Analytics</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('official')}
                className={`btn btn-sm ${viewMode === 'official' ? 'btn-primary' : 'btn-neu'} border-0`}
                style={viewMode === 'official' ? undefined : { background: 'transparent', boxShadow: 'none' }}
              >
                <i className="lni lni-files" />
                <span>Ledger View</span>
              </button>
            </div>

            {/* Print & PDF Export Buttons */}
            <button
              type="button"
              className="btn btn-neu btn-sm"
              onClick={() => window.print()}
              disabled={!selectedGuid}
              title="Print official statement"
            >
              <i className="lni lni-printer" />
              <span>Print</span>
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (selectedGuid) {
                  window.open(getStudentStatementPdfUrl(selectedGuid), '_blank')
                  showToast('Opening official signed statement PDF…', 'success')
                }
              }}
              disabled={!selectedGuid}
              title="Download signed PDF statement"
            >
              <i className="lni lni-download" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* ── Student Search Bar (Standard Card + TableSearch) ─────────── */}
        <div className="card mb-4">
          <div className="card-hdr">
            <div className="card-title">
              <span className="ctitle-icon">
                <i className="lni lni-search-alt" />
              </span>
              Student Search
            </div>
            {selectedGuid && (
              <button
                type="button"
                className="btn btn-neu btn-sm"
                onClick={handleClearStudent}
              >
                <i className="lni lni-reload" />
                <span>Change Student</span>
              </button>
            )}
          </div>

          <TableSearch
            value={term}
            onChange={v => {
              setTerm(v)
              setSelectedGuid(null)
            }}
            placeholder="Search student by Name, Reg No (e.g. 027240104), or Programme…"
            loading={isSearching}
            emptyLabel="No students found matching your search"
            minChars={0}
            results={matches.map(m => ({
              id: m.studentGuid,
              primary: m.studentName ?? '—',
              secondary: [m.studentRegNo, m.programName, m.batchCode].filter(Boolean).join(' • '),
            }))}
            onSelect={r => handleSelect(r.id)}
            onLoadMore={() => hasNextPage && fetchNextPage()}
            hasMore={hasNextPage}
            loadingMore={isFetchingNextPage}
          />
        </div>

        {/* ── Main Viewport ─────────────────────────────────────────── */}
        {!selectedGuid ? (
          <div className="card text-center py-16">
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-b700"
              style={{ background: 'var(--b50)', fontSize: 32 }}
            >
              <i className="lni lni-files" />
            </div>
            <div className="text-base font-bold text-g900 mb-1">No Student Statement Loaded</div>
            <div className="text-sm text-g500 max-w-md mx-auto mb-4">
              Click the search box above to choose an enrolled student by Name or Registration Number to load their real-time fee statement and payment history.
            </div>
            <div className="inline-flex items-center gap-2 py-1.5 px-3 rounded-lg bg-g100 text-xs text-g600">
              <i className="lni lni-bulb text-amber" />
              <span>Tip: Try searching &ldquo;027240104&rdquo; or &ldquo;Ashfa&rdquo; to test with live records.</span>
            </div>
          </div>
        ) : isStatementLoading ? (
          <div className="card text-center py-16 text-g400">
            <i className="lni lni-spinner-arrow spin inline-block text-2xl mb-2 text-b700" />
            <div className="text-sm font-medium">Fetching student financial statement, ledgers, and transactions…</div>
          </div>
        ) : isStatementError || !header ? (
          <div className="card text-center py-12 text-clr-red border border-red-200 bg-red-50/40">
            <i className="lni lni-warning inline-block text-2xl mb-2 text-red" />
            <div className="text-sm font-bold text-red-900 mb-1">Failed to Load Statement</div>
            <div className="text-xs text-red-700 max-w-md mx-auto mb-4">
              {statementError instanceof Error && statementError.message && statementError.message !== 'not_found'
                ? statementError.message
                : "Unable to retrieve the student's statement records."}
            </div>
            <button type="button" className="btn btn-neu btn-sm" onClick={handleClearStudent}>
              Search Another Student
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* ══════════════════════════════════════════════════════════════
                1. ERP CANONICAL STUDENT PROFILE HERO CARD (.pc-hero)
               ══════════════════════════════════════════════════════════════ */}
            <div className="card p-0 overflow-hidden mb-4">
              <div className="pc-hero before:!hidden after:!hidden">
                <div className="pc-hero-top">
                  <div className="pc-hero-avatar">
                    {header.studentName ? header.studentName.slice(0, 2).toUpperCase() : 'ST'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="pc-hero-name truncate">{header.studentName || '—'}</div>
                    <div className="pc-hero-sub truncate">{header.programName || '—'}</div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="pc-hero-badge">
                        <i className="lni lni-bookmark" /> {header.studentRegNo || '—'}
                      </span>
                      <span className="pc-hero-badge">
                        <i className="lni lni-id" /> Student No: {header.studentNum || header.studentRegNo || '—'}
                      </span>
                      {header.appRefNo && (
                        <span className="pc-hero-badge">
                          <i className="lni lni-file" /> App Ref: {header.appRefNo}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="pc-hero-actions pc-hero-actions-top">
                    <button
                      type="button"
                      className="pc-hero-action"
                      onClick={() => copyToClipboard(header.studentRegNo || '', 'Reg No')}
                      title="Copy Reg No to clipboard"
                    >
                      <i className="lni lni-clipboard" />
                      <span>Copy Reg No</span>
                    </button>
                  </div>
                </div>

                <div className="pc-hero-facts">
                  <div className="pc-hero-fact">
                    <span className="pc-hero-fact-lbl">Programme</span>
                    <span className="pc-hero-fact-val" title={header.programName ?? '—'}>
                      {header.programName ?? '—'}
                    </span>
                  </div>
                  <div className="pc-hero-fact">
                    <span className="pc-hero-fact-lbl">Batch</span>
                    <span className="pc-hero-fact-val" title={header.batchCode ?? '—'}>
                      {header.batchCode ?? '—'}
                    </span>
                  </div>
                  <div className="pc-hero-fact">
                    <span className="pc-hero-fact-lbl">Current Semester</span>
                    <span className="pc-hero-fact-val" title={header.semesterName ?? '—'}>
                      {header.semesterName ?? '—'}
                    </span>
                  </div>
                  <div className="pc-hero-fact">
                    <span className="pc-hero-fact-lbl">Admission Type</span>
                    <span className="pc-hero-fact-val" title={header.admissionTypeLabel ?? 'Regular Student'}>
                      {header.admissionTypeLabel ?? 'Regular Student'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                2. SUMMARY STATS ROW (.stats-row)
               ══════════════════════════════════════════════════════════════ */}
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-lbl">Total Paid</div>
                <div className="stat-num text-blue">{formatMoney(totalPaid)}</div>
                <div className="stat-sub">{paymentHistory.length} recorded payments</div>
              </div>

              <div className="stat-card [--b700:var(--amber)] [--b400:#fbbf24]">
                <div className="stat-lbl">Current Outstanding</div>
                <div className="stat-num text-amber">{formatMoney(currentOutstanding)}</div>
                <div className="stat-sub">{outstandingItems.length} pending dues</div>
              </div>

              <div className="stat-card">
                <div className="stat-lbl">Future Payments</div>
                <div className="stat-num text-blue">{formatMoney(totalFuture)}</div>
                <div className="stat-sub">{futurePayments.length} upcoming fees</div>
              </div>

              <div
                className={`stat-card ${
                  balanceDueCurrent <= 0
                    ? '[--b700:var(--green)] [--b400:#34d399]'
                    : '[--b700:var(--red)] [--b400:#f87171]'
                }`}
              >
                <div className="stat-lbl">Net Balance Due</div>
                <div className={`stat-num ${balanceDueCurrent <= 0 ? 'text-green' : 'text-red'}`}>
                  {formatMoney(balanceDueCurrent)}
                </div>
                <div className="stat-sub">
                  {balanceDueCurrent <= 0 ? 'Clearance in good standing' : 'Pending balance payment'}
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                3. VISUAL ANALYTICS (Overview & Analytics Views)
               ══════════════════════════════════════════════════════════════ */}
            {(viewMode === 'hybrid' || viewMode === 'charts') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Chart 1: Donut Clearance Ratio */}
                <div className="card mb-0 flex flex-col justify-between">
                  <div>
                    <div className="card-hdr">
                      <div className="card-title">
                        <span className="ctitle-icon">
                          <i className="lni lni-pie-chart" />
                        </span>
                        Fee Clearance Ratio
                      </div>
                      <span className="badge badge-green">{paidPercent}% Cleared</span>
                    </div>
                    <div className="card-sub -mt-3 mb-3">Paid vs. Outstanding vs. Future</div>

                    {/* SVG Donut Chart */}
                    <div className="relative py-2 flex items-center justify-center">
                      <svg width="140" height="140" viewBox="0 0 100 100" className="transform -rotate-90">
                        {/* Background track */}
                        <circle cx="50" cy="50" r="38" stroke="var(--g100)" strokeWidth="10" fill="transparent" />

                        {/* Paid arc (Green) */}
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          stroke="var(--green)"
                          strokeWidth="10"
                          strokeDasharray="238.76"
                          strokeDashoffset={238.76 - (238.76 * totalPaid) / chartTotal}
                          strokeLinecap="round"
                          fill="transparent"
                          className="transition-all duration-700 cursor-pointer"
                          onMouseEnter={() => setHoveredChartSegment('paid')}
                          onMouseLeave={() => setHoveredChartSegment(null)}
                        />

                        {/* Outstanding arc (Red) */}
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          stroke="var(--red)"
                          strokeWidth="10"
                          strokeDasharray="238.76"
                          strokeDashoffset={238.76 - (238.76 * currentOutstanding) / chartTotal}
                          style={{
                            strokeDashoffset: `${238.76 - (238.76 * (totalPaid + currentOutstanding)) / chartTotal}`,
                          }}
                          strokeLinecap="round"
                          fill="transparent"
                          className="transition-all duration-700 cursor-pointer"
                          onMouseEnter={() => setHoveredChartSegment('outstanding')}
                          onMouseLeave={() => setHoveredChartSegment(null)}
                        />
                      </svg>

                      {/* Inner Ring Badge */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-xl font-extrabold text-g900 tracking-tight">{paidPercent}%</span>
                        <span className="text-[10px] font-semibold text-g400 uppercase tracking-wide">
                          {hoveredChartSegment === 'paid'
                            ? 'Paid Total'
                            : hoveredChartSegment === 'outstanding'
                            ? 'Pending'
                            : 'Settled'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="space-y-1.5 pt-3 border-t border-g100 text-xs mt-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-g600">
                        <span className="w-2 h-2 rounded-full" style={{ background: 'var(--green)' }} /> Total Paid
                      </span>
                      <span className="font-bold text-g900 font-mono">{formatMoney(totalPaid)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-g600">
                        <span className="w-2 h-2 rounded-full" style={{ background: 'var(--red)' }} /> Current Outstanding
                      </span>
                      <span className="font-bold text-red font-mono">{formatMoney(currentOutstanding)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-g600">
                        <span className="w-2 h-2 rounded-full" style={{ background: 'var(--b500)' }} /> Future Assessments
                      </span>
                      <span className="font-bold text-g800 font-mono">{formatMoney(totalFuture)}</span>
                    </div>
                  </div>
                </div>

                {/* Chart 2: Fee Head Allocation Breakdown */}
                <div className="card mb-0 flex flex-col justify-between">
                  <div>
                    <div className="card-hdr">
                      <div className="card-title">
                        <span className="ctitle-icon">
                          <i className="lni lni-layers" />
                        </span>
                        Fee Head Allocation
                      </div>
                      <span className="badge badge-grey">{categoryStats.length} Heads</span>
                    </div>
                    <div className="card-sub -mt-3 mb-3">Paid vs. Outstanding across fee categories</div>

                    <div className="space-y-2.5">
                      {categoryStats.length === 0 ? (
                        <div className="py-8 text-center text-xs text-g400">No category breakdown available</div>
                      ) : (
                        categoryStats.map(cat => {
                          const total = (cat.paid + cat.due) || 1
                          const catPaidPct = Math.round((cat.paid / total) * 100)
                          return (
                            <div key={cat.label} className="text-xs">
                              <div className="flex items-center justify-between font-semibold text-g800 mb-1">
                                <span>{cat.label}</span>
                                <span className="text-g400 font-mono text-[11px]">
                                  {cat.paid.toLocaleString()} / {(cat.paid + cat.due).toLocaleString()}
                                </span>
                              </div>
                              <div className="w-full bg-g100 h-2 rounded-full overflow-hidden flex">
                                <div
                                  className="h-full transition-all duration-500"
                                  style={{ width: `${catPaidPct}%`, background: 'var(--green)' }}
                                  title={`Paid: ${cat.paid.toLocaleString()} (${catPaidPct}%)`}
                                />
                                <div
                                  className="h-full transition-all duration-500"
                                  style={{ width: `${100 - catPaidPct}%`, background: 'var(--red-bd)' }}
                                  title={`Outstanding: ${cat.due.toLocaleString()}`}
                                />
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-4 pt-3 border-t border-g100 text-xs text-g500 mt-2">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--green)' }} /> Settled
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--red-bd)' }} /> Balance Remaining
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                4. STATEMENT LEDGER TABS & TABLE (.card)
               ══════════════════════════════════════════════════════════════ */}
            {(viewMode === 'hybrid' || viewMode === 'official') && (
              <div className="card">
                {/* Standard ERP Tab Switcher (.pc-tabs) */}
                <div className="pc-tabs">
                  <button
                    type="button"
                    onClick={() => setTableTab('payments')}
                    className={`pc-tab-btn ${tableTab === 'payments' ? 'active' : ''}`}
                  >
                    <i className="lni lni-credit-cards" />
                    <span>Payment History</span>
                    <span
                      className={`badge ${tableTab === 'payments' ? 'badge-blue' : 'badge-grey'}`}
                      style={{ fontSize: 11, padding: '1px 6px' }}
                    >
                      {paymentHistory.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTableTab('outstanding')}
                    className={`pc-tab-btn ${tableTab === 'outstanding' ? 'active' : ''}`}
                  >
                    <i className="lni lni-wallet" />
                    <span>Outstanding Items</span>
                    <span
                      className={`badge ${tableTab === 'outstanding' ? 'badge-amber' : 'badge-grey'}`}
                      style={{ fontSize: 11, padding: '1px 6px' }}
                    >
                      {outstandingItems.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTableTab('future')}
                    className={`pc-tab-btn ${tableTab === 'future' ? 'active' : ''}`}
                  >
                    <i className="lni lni-alarm-clock" />
                    <span>Future Payments</span>
                    <span
                      className={`badge ${tableTab === 'future' ? 'badge-blue' : 'badge-grey'}`}
                      style={{ fontSize: 11, padding: '1px 6px' }}
                    >
                      {futurePayments.length}
                    </span>
                  </button>
                </div>

                {/* Filter & Grouping Controls with Standard Reusable Components */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <TableSearch
                      className="w-64"
                      placeholder="Filter records…"
                      value={tableSearch}
                      onChange={setTableSearch}
                    />

                    {(tableTab === 'payments' || tableTab === 'outstanding') && (
                      <SearchSelect
                        className="w-48"
                        options={CATEGORY_OPTIONS}
                        value={selectedCategory}
                        onChange={setSelectedCategory}
                        placeholder="All Categories"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={`btn btn-sm ${groupBySemester ? 'btn-primary' : 'btn-neu'}`}
                      onClick={() => setGroupBySemester(prev => !prev)}
                      title="Toggle grouping records by semester"
                    >
                      <i className="lni lni-layers" />
                      <span>Group by Semester</span>
                      {groupBySemester && <i className="lni lni-checkmark" />}
                    </button>
                  </div>
                </div>

                {/* Standard ERP Table inside ScrollTable */}
                <ScrollTable className="no-sticky-col stmt-tbl">
                  {/* Tab 1: Payment History */}
                  {tableTab === 'payments' && (
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: 44 }}></th>
                          <th style={{ width: 44, textAlign: 'center' }}>#</th>
                          <th>Payment Code</th>
                          <th>Date</th>
                          {!groupBySemester && <th>Semester</th>}
                          <th>Pay Type</th>
                          <th>Receipt #</th>
                          <th className="num">Amount</th>
                          <th>Currency</th>
                          <th>Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPayments.length === 0 ? (
                          <EmptyState
                            colSpan={10}
                            title={tableSearch || selectedCategory !== 'all' ? 'No matching payments' : 'No payments recorded'}
                            subtitle={
                              tableSearch || selectedCategory !== 'all'
                                ? 'No payments match the active search or category filters. Try clearing them.'
                                : 'No payment transactions found for this student.'
                            }
                            hasFilters={!!tableSearch || selectedCategory !== 'all'}
                            onClearFilters={() => {
                              setTableSearch('')
                              setSelectedCategory('all')
                            }}
                          />
                        ) : groupBySemester ? (
                          groupedPayments.map((group, groupIdx) => (
                            <Fragment key={group.semester || groupIdx}>
                              {/* Semester Group Header Row */}
                              <tr className="stmt-group-hdr">
                                <td colSpan={9}>
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-b700 font-bold">
                                      <i className="lni lni-graduation" />
                                    </span>
                                    <span className="stmt-group-name">
                                      {group.semester}
                                    </span>
                                    <span className="badge badge-blue">
                                      {group.items.length} {group.items.length === 1 ? 'Record' : 'Records'}
                                    </span>
                                  </div>
                                </td>
                              </tr>

                              {/* Rows in this Semester */}
                              {group.items.map((p, idx) => renderPaymentRow(p, idx, p.paymentGuid || `${groupIdx}-${idx}`, false))}

                              {/* Section Subtotal Row */}
                              <tr className="stmt-group-total">
                                <td colSpan={9}>
                                  <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <div className="flex items-center gap-2">
                                      <span className="stmt-group-total-label">Semester Total</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {group.currencyTotals.map(ct => (
                                        <div key={ct.currency} className="stmt-total-chip">
                                          <span>{ct.currency}</span>
                                          <span className="font-mono">
                                            {formatMoney(ct.total)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            </Fragment>
                          ))
                        ) : (
                          filteredPayments.map((p, idx) => renderPaymentRow(p, idx, p.paymentGuid || String(idx), true))
                        )}
                      </tbody>
                    </table>
                  )}

                  {/* Tab 2: Outstanding Items */}
                  {tableTab === 'outstanding' && (
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: 44, textAlign: 'center' }}>#</th>
                          <th>Description</th>
                          <th>Semester</th>
                          <th>Category</th>
                          <th className="num">Outstanding</th>
                          <th>Currency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOutstanding.length === 0 ? (
                          <EmptyState
                            colSpan={6}
                            title={tableSearch || selectedCategory !== 'all' ? 'No matching items' : 'Fully settled'}
                            subtitle={
                              tableSearch || selectedCategory !== 'all'
                                ? 'No outstanding items match your active filters.'
                                : 'No outstanding fee assessments found for this student.'
                            }
                            hasFilters={!!tableSearch || selectedCategory !== 'all'}
                            onClearFilters={() => {
                              setTableSearch('')
                              setSelectedCategory('all')
                            }}
                          />
                        ) : groupBySemester ? (
                          groupedOutstanding.map((group, groupIdx) => (
                            <Fragment key={group.semester || groupIdx}>
                              {/* Semester Group Header Row */}
                              <tr className="stmt-group-hdr">
                                <td colSpan={6}>
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-b700 font-bold">
                                      <i className="lni lni-wallet" />
                                    </span>
                                    <span className="stmt-group-name">
                                      {group.semester}
                                    </span>
                                    <span className="badge badge-amber">
                                      {group.items.length} {group.items.length === 1 ? 'Due' : 'Dues'}
                                    </span>
                                  </div>
                                </td>
                              </tr>

                              {/* Rows in this Semester */}
                              {group.items.map((o, idx) => (
                                <tr key={o.ledgerGuid || `${groupIdx}-${idx}`}>
                                  <td className="text-center text-g500">{o.slNo || idx + 1}</td>
                                  <td className="font-bold text-g900">{o.description || 'Fee Assessment'}</td>
                                  <td className="text-g700">{o.semesterName || header?.semesterName || '—'}</td>
                                  <td>{renderCategoryBadge(o.category)}</td>
                                  <td className="num font-mono font-bold text-red">
                                    {formatMoney(o.outstanding)}
                                  </td>
                                  <td>
                                    <span className="badge badge-grey">{o.currencyName || '—'}</span>
                                  </td>
                                </tr>
                              ))}

                              {/* Section Subtotal Row */}
                              <tr className="stmt-group-total">
                                <td colSpan={6}>
                                  <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <div className="flex items-center gap-2">
                                      <span className="stmt-group-total-label">Semester Outstanding</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {group.currencyTotals.map(ct => (
                                        <div key={ct.currency} className="flex items-center gap-1.5 text-xs">
                                          <span className="text-g500 font-semibold">{ct.currency}:</span>
                                          <span className="font-mono font-bold text-red">
                                            {formatMoney(ct.total)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            </Fragment>
                          ))
                        ) : (
                          filteredOutstanding.map((o, idx) => (
                            <tr key={o.ledgerGuid || idx}>
                              <td className="text-center text-g500">{o.slNo || idx + 1}</td>
                              <td className="font-bold text-g900">{o.description || 'Fee Assessment'}</td>
                              <td className="text-g700">{o.semesterName || header?.semesterName || '—'}</td>
                              <td>{renderCategoryBadge(o.category)}</td>
                              <td className="num font-mono font-bold text-red">
                                {formatMoney(o.outstanding)}
                              </td>
                              <td>
                                <span className="badge badge-grey">{o.currencyName || '—'}</span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  {/* Tab 3: Future Payments */}
                  {tableTab === 'future' && (
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: 44, textAlign: 'center' }}>#</th>
                          <th>Description</th>
                          <th>Semester</th>
                          <th className="num">Amount Due</th>
                          <th>Currency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFuture.length === 0 ? (
                          <EmptyState
                            colSpan={5}
                            title={tableSearch ? 'No matching scheduled items' : 'No future payments'}
                            subtitle={
                              tableSearch
                                ? 'No upcoming scheduled payments match your filter.'
                                : 'No future scheduled payments or assessments registered for this student.'
                            }
                            hasFilters={!!tableSearch}
                            onClearFilters={() => setTableSearch('')}
                          />
                        ) : groupBySemester ? (
                          groupedFuture.map((group, groupIdx) => (
                            <Fragment key={group.semester || groupIdx}>
                              {/* Semester Group Header Row */}
                              <tr className="stmt-group-hdr">
                                <td colSpan={5}>
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-b700 font-bold">
                                      <i className="lni lni-alarm-clock" />
                                    </span>
                                    <span className="stmt-group-name">
                                      {group.semester}
                                    </span>
                                    <span className="badge badge-blue">
                                      {group.items.length} {group.items.length === 1 ? 'Scheduled' : 'Scheduled'}
                                    </span>
                                  </div>
                                </td>
                              </tr>

                              {/* Rows in this Semester */}
                              {group.items.map((f, idx) => (
                                <tr key={f.slNo || `${groupIdx}-${idx}`}>
                                  <td className="text-center text-g500">{f.slNo || idx + 1}</td>
                                  <td className="font-bold text-g900">{f.description}</td>
                                  <td className="text-g700">{f.semesterName || '—'}</td>
                                  <td className="num font-mono font-bold text-g900">
                                    {formatMoney(f.amountDue)}
                                  </td>
                                  <td>
                                    <span className="badge badge-grey">{f.currencyName || 'US Dollar'}</span>
                                  </td>
                                </tr>
                              ))}

                              {/* Section Subtotal Row */}
                              <tr className="stmt-group-total">
                                <td colSpan={5}>
                                  <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <div className="flex items-center gap-2">
                                      <span className="stmt-group-total-label">Semester Scheduled</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {group.currencyTotals.map(ct => (
                                        <div key={ct.currency} className="stmt-total-chip">
                                          <span>{ct.currency}</span>
                                          <span className="font-mono">
                                            {formatMoney(ct.total)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            </Fragment>
                          ))
                        ) : (
                          filteredFuture.map((f, idx) => (
                            <tr key={f.slNo || idx}>
                              <td className="text-center text-g500">{f.slNo || idx + 1}</td>
                              <td className="font-bold text-g900">{f.description}</td>
                              <td className="text-g700">{f.semesterName || 'Year Three - Semester Two'}</td>
                              <td className="num font-mono font-bold text-g900">
                                {formatMoney(f.amountDue)}
                              </td>
                              <td>
                                <span className="badge badge-grey">{f.currencyName || 'US Dollar'}</span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </ScrollTable>

                {/* ── Active Tab Summary Footer Bar ─────────────────────── */}
                {tableTab === 'payments' && filteredPayments.length > 0 && (
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-3.5 mt-3 border-t border-g200 text-xs text-g600">
                    <div>
                      Showing <strong className="text-g900">{filteredPayments.length}</strong> of{' '}
                      <strong>{paymentHistory.length}</strong> payment records
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-g700">Total Paid Sum:</span>
                      <span className="font-mono font-bold text-green">
                        {sumByCurrency(filteredPayments, 'amount')
                          .map(c => `${c.currency} ${c.total.toLocaleString()}`)
                          .join(' • ') || '0.00'}
                      </span>
                    </div>
                  </div>
                )}

                {tableTab === 'outstanding' && filteredOutstanding.length > 0 && (
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-3.5 mt-3 border-t border-g200 text-xs text-g600">
                    <div>
                      Showing <strong className="text-g900">{filteredOutstanding.length}</strong> of{' '}
                      <strong>{outstandingItems.length}</strong> outstanding items
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-g700">Total Current Outstanding:</span>
                      <span className="font-mono font-bold text-red">
                        {sumByCurrency(filteredOutstanding, 'outstanding')
                          .map(c => `${c.currency} ${c.total.toLocaleString()}`)
                          .join(' • ') || '0.00'}
                      </span>
                    </div>
                  </div>
                )}

                {tableTab === 'future' && filteredFuture.length > 0 && (
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-3.5 mt-3 border-t border-g200 text-xs text-g600">
                    <div>
                      Showing <strong className="text-g900">{filteredFuture.length}</strong> of{' '}
                      <strong>{futurePayments.length}</strong> future payments
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-g700">Total Future Due:</span>
                      <span className="font-mono font-bold text-blue">
                        {formatMoney(filteredFuture.reduce((acc, item) => acc + (item.amountDue || 0), 0))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Official Receipt Modal (same as Payment History) */}
      <ViewPaymentReceiptModal
        isOpen={!!receiptEntry}
        onClose={closeReceipt}
        entry={receiptEntry}
        autoPrint={autoPrint}
        showToast={showToast}
      />

      <Toast toast={toast} />
    </>
  )
}
