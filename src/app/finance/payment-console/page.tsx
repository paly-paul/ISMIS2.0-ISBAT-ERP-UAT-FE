'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { Pagination } from '@/components/Pagination'
import { PaymentSuccessModal } from '@/components/modals/finance/PaymentSuccessModal'
import { UpcomingSemestersModal } from '@/components/modals/finance/UpcomingSemestersModal'
import { ViewPaymentModal } from '@/components/modals/finance/ViewPaymentModal'
import { EditPaymentModal, EditablePaymentTarget } from '@/components/modals/finance/EditPaymentModal'
import { EditPaymentOtherModal, EditablePaymentOtherTarget } from '@/components/modals/finance/EditPaymentOtherModal'
import DatePicker from '@/components/DatePicker'
import { SearchSelect } from '@/components/SearchSelect'
import { useProcBanks } from '@/hooks/finance/useProcBanks'
import { useReceiptBooks } from '@/hooks/finance/useReceiptBooks'
import { useFinanceCurrencies, getDefaultFinanceCurrencyGuid } from '@/hooks/finance/useFinanceCurrencies'
import { useExchangeRatesByDate, ExchangeRate } from '@/hooks/finance/useExchangeRates'
import { TodayExchangeRateModal } from '@/components/modals/finance/TodayExchangeRateModal'
import { RatesAlreadySetNote } from '@/components/finance/RatesAlreadySetNote'
import { useAdvanceStatusByPayment } from '@/hooks/finance/usePayments'
import {
  useAdvanceDeposits,
  useAdvanceBalance,
  useAdjustmentsByAdvance,
  useAdjustmentLedgerBreakdown,
  useCreateAdjustment,
  AdvanceDepositSummary,
} from '@/hooks/finance/useAdvancePayment'
import { useSemestersForProgram } from '@/hooks/academic/useSemesters'
import {
  useSearchStudentsInfinite,
  useStudentProfile,
  useCurrentSemesterPayable,
  useAllOutstandingLedgers,
  useLedgerOthers,
  usePaymentHistory,
  usePayableLedgers,
  useCreatePayment,
  useCreatePaymentOther,
  PAYMENT_CATEGORY_LABELS,
  PAY_TYPE_LABELS,
  PAY_TYPE_TO_RECEIPT_CATEGORY,
  AllOutstandingItem,
  CurrentSemesterPayableTotal,
  PaymentHistoryEntry,
} from '@/hooks/finance/usePaymentConsole'
import { usePaymentOthersList, useResitFee } from '@/hooks/finance/usePaymentOthers'
import { getPaymentReceiptPdf, isResitLedger, refugeeLabel, studCategoryLabel } from '@/lib/api/finance/paymentConsole'
import { downloadBlob } from '@/lib/downloadBlob'
import { formatDate, formatDateTime } from '@/lib/date'
import { AuthError } from '@/lib/api/client'
import { scrollToFirstError } from '@/lib/scrollToFirstError'
import { stripLeadingZeros } from '@/lib/errorMessages'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'

// Real "what's owed" table for the Other Payment tab, sourced from GET
// .../outstanding-all (get-all-outstanding-ledgers.md) filtered to
// category 2 client-side. That doc documents ledgerGuid/semesterName/
// currency as null on NCHE/Guild rows specifically (not ledger-based) —
// this page no longer renders those categories, but the same fields
// aren't confirmed non-null for Other either, so the defensive '—'
// fallbacks stay.
function OutstandingCategoryTable({ items, isLoading, isError }: { items: AllOutstandingItem[]; isLoading: boolean; isError: boolean }) {
  if (isLoading) return <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading outstanding balance…</div>
  if (isError) return <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load the outstanding balance.</div>
  // No "Fully settled" empty state here (removed per request, 2026-09-04)
  // — Other Payment's own Payment Detail form always renders right below
  // this regardless of whether there's anything outstanding, so an empty
  // items list just renders nothing above it instead of a redundant
  // checkmark block.
  if (items.length === 0) return null
  const total = items.reduce((sum, it) => sum + it.outstanding, 0)
  return (
    <>
      {/* Itemized card rows (.pc-ledger-item), same treatment as Step 2's
          own tuition ledger list — matches the reference "Completing
          Registration" panel's layout instead of a Description/Semester/
          Outstanding table. */}
      {items.map((it, i) => (
        <div className="pc-ledger-item" key={`${it.ledgerGuid ?? it.description}-${i}`}>
          <span className="pc-ledger-icon"><i className="lni lni-wallet"></i></span>
          <div className="flex-1 min-w-0">
            <div className="pc-ledger-name truncate">{it.description}</div>
            {it.semesterName && <div className="pc-ledger-sub">{it.semesterName}</div>}
          </div>
          <span className="flex items-baseline gap-1.5 justify-end flex-shrink-0">
            {it.currencyCode && <span className="text-g400 font-semibold" style={{ fontSize: 11 }}>{it.currencyCode}</span>}
            <span className="font-bold text-amber">{fmtAmt(it.outstanding)}</span>
          </span>
        </div>
      ))}
      <div className="pc-total-due">
        <span className="text-muted" style={{ fontSize: 12 }}>Total Outstanding</span>
        <span className="font-bold text-amber" style={{ fontSize: 15 }}>{fmtAmt(total)}</span>
      </div>
    </>
  )
}

// Outstanding/total figures (Outstanding Balance, Total Outstanding, Total
// Due) always render with exactly 2 decimal places, matching how these
// amounts are quoted elsewhere in Finance — plain toLocaleString() would
// drop the decimals entirely for a whole-number amount (e.g. "500" instead
// of "500.00"), which reads as imprecise next to a currency figure.
function fmtAmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Paid-vs-Remaining donut for the Programme Progress stat card (2026-09-11,
// replacing two separate stat cards, per request) — self-contained SVG, no
// chart library. Green/amber is the same status pair (good/warning) this
// page already paints Paid/Outstanding with everywhere else, not a new
// palette, so it reads as part of this app rather than a bolted-on chart
// widget. That pair's CVD separation sits in the 6-8 "floor" band (checked
// via the dataviz skill's validate_palette script) — legal only with
// secondary encoding, which the legend's text labels + percentages below
// (never color alone) and the surface gap between the two arcs both supply.
// No base/track ring is drawn — paid + remaining always sum to ~100%, so
// the card's own white background shows through the small gap between
// segments, which *is* the separator (a drawn ring would just be extra ink
// imitating what the real background already does).
function ProgrammePaidDonut({ paidPercentage, remainingPercentage }: { paidPercentage: number; remainingPercentage: number }) {
  const r = 34
  const strokeWidth = 12
  const circumference = 2 * Math.PI * r
  const gap = 4 // px of arc length left as a surface-color gap at each boundary
  const paid = Math.min(100, Math.max(0, paidPercentage))
  const remaining = Math.min(100, Math.max(0, remainingPercentage))
  const paidLen = Math.max(0, (paid / 100) * circumference - gap)
  const remainingLen = Math.max(0, (remaining / 100) * circumference - gap)

  return (
    <div className="flex items-center gap-4 mt-1" role="img" aria-label={`${paid.toFixed(2)}% paid, ${remaining.toFixed(2)}% remaining`}>
      <svg width="84" height="84" viewBox="0 0 84 84" style={{ flexShrink: 0 }}>
        <g transform="rotate(-90 42 42)">
          <circle
            cx="42" cy="42" r={r} fill="none"
            stroke="var(--green)" strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={`${paidLen} ${circumference - paidLen}`}
          />
          <circle
            cx="42" cy="42" r={r} fill="none"
            stroke="var(--amber)" strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={`${remainingLen} ${circumference - remainingLen}`}
            strokeDashoffset={-(paidLen + gap)}
          />
        </g>
        <text x="42" y="42" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 15, fontWeight: 800, fill: 'var(--g900)' }}>
          {paid.toFixed(0)}%
        </text>
      </svg>
      <div className="flex flex-col gap-1.5" style={{ fontSize: 12, minWidth: 0 }}>
        <div className="flex items-center gap-2">
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }}></span>
          <span className="text-g700">Paid</span>
          <span className="font-bold text-green" style={{ marginLeft: 'auto', paddingLeft: 10 }}>{paid.toFixed(2)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--amber)', flexShrink: 0 }}></span>
          <span className="text-g700">Remaining</span>
          <span className="font-bold text-amber" style={{ marginLeft: 'auto', paddingLeft: 10 }}>{remaining.toFixed(2)}%</span>
        </div>
      </div>
    </div>
  )
}

// Stable reference for todayRates' "no data yet" case — `data = []` as a
// destructuring default creates a NEW array literal every render while
// `data` is undefined (loading, or between an invalidation and its refetch
// resolving), not just once per actual fetch. That new reference fed
// straight into the rateBarInputs effect's dependency array below, so the
// effect fired every render, called setRateBarInputs, triggered a
// re-render, got a new [] again, and looped forever ("Maximum update depth
// exceeded", confirmed live) — same bug, same fix as exchange-rates/
// page.tsx's own EMPTY_RATES. A module-level constant has one identity for
// the app's whole lifetime.
const EMPTY_RATES: ExchangeRate[] = []

// Currency conversion for Outstanding Balance's Scheduled Bill/Outstanding
// figures (per request, 2026-09-04). exRate was previously assumed to be
// "this currency's units per 1 unit of the base currency" (a small fraction
// for anything stronger than the base, e.g. USD ≈ 0.00026) — confirmed
// WRONG against a real get-exchange-rate-exists response: USD came back as
// exRate: 3774.90 and KSH as exRate: 29.16, both of which are exactly
// "1 {currency} = {exRate} {base}" (real UGX/USD and UGX/KSH rates), not a
// tiny fraction. exRate is actually base-currency units per 1 unit of the
// given currency, the reverse of what this used to assume. Converting A→B
// always routes through the base: amountInBase = amount * rateA (rateA
// units of base per unit of A), amountInB = amountInBase / rateB. The base
// currency itself has an implicit rate of 1 against itself (unaffected by
// which direction that identity multiplication/division goes) — it has no
// row in the exchange-rates board at all. Returns null (not a fallback
// guess) when either currency's rate can't be resolved — a ledger with no
// currencyGuid, or a currency with no rate on file for today — so callers
// can show "no rate available" instead of silently wrong math.
function convertAmount(
  amount: number,
  fromGuid: string | null,
  toGuid: string | null,
  baseGuid: string | null,
  ratesByGuid: Map<string, number>,
): number | null {
  if (!fromGuid || !toGuid) return null
  if (fromGuid === toGuid) return amount
  const fromRate = fromGuid === baseGuid ? 1 : ratesByGuid.get(fromGuid)
  const toRate = toGuid === baseGuid ? 1 : ratesByGuid.get(toGuid)
  // A rate of exactly 0 is never a real "no rate available" — no currency
  // trades at 0 units per 1 base — but it slips past the `== null` check
  // above (0 isn't null), and amount / 0 produces Infinity, which then
  // propagates into NaN once anything downstream multiplies/subtracts it.
  // Confirmed root cause of the "∞ Total Payable / NaN Discount" bug: a
  // currency the cashier hasn't entered today's rate for yet (e.g. USD/KSH
  // before the Exchange Rates bar is filled in) can come back from the
  // by-date board as an exRate: 0 row instead of being omitted entirely.
  // Treat it the same as a missing rate — return null so callers show "—".
  if (fromRate == null || toRate == null || fromRate <= 0 || toRate <= 0) return null
  return (amount * fromRate) / toRate
}

function applicantName(a: { firstName: string | null; lastName: string | null }) {
  return `${a.firstName ?? ''}${a.lastName ? ` ${a.lastName}` : ''}`.trim() || '—'
}

// Search results come from FinanceStudentSearchDto (PaymentConsoleStudentSearch.bru)
// now, which has no lastName — it carries a pre-combined studentName instead,
// falling back to firstName alone for an application that isn't a student yet.
function searchResultName(a: { studentName: string | null; firstName: string | null }) {
  return a.studentName || a.firstName || '—'
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '—'
}

function todayYmd() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

interface ReceiptData {
  paymentGuid: string; ref: string; code: string; name: string; refNo: string; prog: string; method: string
  date: string; amount: string; balance: string; advanceMessage: string | null; reRegistrationWarning: string | null
}

// Fee-category tab (flow doc: "This page covers the tuition tab only.
// Other fee categories (other/NCHE/guild)... live on their own tabs/pages
// and are not documented here.") — 'tuition' is wired to real endpoints,
// 'other' stays a UI-first mock. NCHE and Guild were here too at one
// point (also mocked, then wired to their own real POST endpoints) but
// are dropped as of this page — they're getting dedicated pages of their
// own instead, so there's no reason to keep their now-unused state/JSX
// around as dead weight. Recoverable from git history if that plan
// changes.
type PayCategory = 'tuition' | 'other'

// Gate for the Allocation Preview card — commented out (not removed) per
// request. Typed `: boolean` rather than left as the bare literal `false`:
// `{false && (...)}` makes TypeScript's control-flow analysis treat that
// whole branch as statically unreachable, which disables narrowing inside
// it (payableLedgers/previewError go back to their raw nullable types even
// after the isPreviewError/!payableLedgers checks that would normally
// narrow them) — surfacing spurious "possibly undefined/null" errors on
// code that's otherwise unchanged. Widening the type to `boolean` keeps
// the branch reachable as far as the checker is concerned, so normal
// narrowing applies, while still always evaluating to false at runtime.
const SHOW_ALLOCATION_PREVIEW: boolean = false

// Gate for Other Payment's own "Paid Fee Details" log — commented out (not
// removed) per request, now that the left column's Payment History card
// calls the dedicated get-payment-others.md list while the Other Payment tab
// is active (usePaymentOthersList below), making this second list redundant.
const SHOW_OTHER_PAID_FEE_DETAILS: boolean = false

// Tuition's own Payment History (left column) is fetched whole per
// application — not server-paginated (usePaymentHistory takes no
// page/pageSize) — so this pages it client-side instead, same Pagination
// component the rest of the app's server-paginated lists use. The Other
// Payment tab's own history (usePaymentOthersList) is genuinely
// server-paginated, so it uses this same page size but its own page state
// and Pagination instance further down — the two histories come from
// different endpoints and can't share one paging cursor.
const HISTORY_PAGE_SIZE = 10

// Student search needs at least this many characters (empty = browse all) —
// the backend errors on shorter terms.
const MIN_SEARCH_CHARS = 3

export default function PaymentConsolePage() {
  const router = useRouter()
  const permissions = usePagePermissions()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // Step 8 — server-rendered receipt PDF (tuition payments only). The tab is
  // opened synchronously on click, before the fetch, because popup blockers
  // drop a window.open that happens after an await; the PDF is loaded into
  // it once it arrives. If the popup was blocked anyway, it downloads
  // instead. On a 404 ("Payment not found." etc.) the blank tab is closed
  // and the server's message shown.
  const [printingGuid, setPrintingGuid] = useState<string | null>(null)
  async function printReceipt(paymentGuid: string, fallbackName: string) {
    if (printingGuid) return
    const tab = window.open('', '_blank')
    setPrintingGuid(paymentGuid)
    try {
      const { blob, filename } = await getPaymentReceiptPdf(paymentGuid)
      const pdf = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' })
      if (tab && !tab.closed) {
        // Not revoked — the tab needs the blob URL for as long as it's open.
        tab.location.href = URL.createObjectURL(pdf)
      } else {
        downloadBlob(pdf, filename ?? `Receipt_${fallbackName}.pdf`)
      }
    } catch (err) {
      tab?.close()
      showToast(err instanceof Error && err.message ? err.message : 'Could not load the receipt.', 'error')
    } finally {
      setPrintingGuid(null)
    }
  }

  // Success confirmation for every payment category's submit (Tuition/
  // Other; NCHE/Guild before they were dropped from this page) — replaces
  // the plain success toast; errors still use showToast (see each submit
  // handler's own onError). null when closed.
  const [successModal, setSuccessModal] = useState<{ title: string; rows: [string, string][]; notices?: string[] } | null>(null)

  const { data: allProcBanks = [] } = useProcBanks()
  const banks = allProcBanks.filter(b => b.status === 2)
  const { data: allReceiptBooks = [] } = useReceiptBooks()
  const activeReceiptBooks = allReceiptBooks.filter(r => r.status === 1)
  const { data: currencies = [] } = useFinanceCurrencies()

  // Exchange Rate bar now lives behind the header's "Exchange Rates"
  // toggle instead of always showing — collapsed by default so the page
  // opens straight to Student Search per the redesign.
  const [showExchangeRates, setShowExchangeRates] = useState(false)

  const [search, setSearch] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  // Drives the results dropdown's visibility, separately from whether it
  // has matches — clicking into the box shows it (listing everything if
  // the box is still empty; PaymentConsoleStudentSearch.bru: searchTerm is
  // optional, omit to browse all), clicking away or picking a result
  // hides it again. searchBoxRef scopes the click-outside check to the
  // search field + dropdown, same pattern as ActionMenu.tsx's trigger/
  // dropdown refs.
  const [searchFocused, setSearchFocused] = useState(false)
  const searchBoxRef = useRef<HTMLDivElement>(null)
  // Scroll target for the full-width student card (see its own ref below) —
  // that card renders below the fold on a shorter viewport once a student
  // is picked, so selectStudent() scrolls it into view instead of leaving
  // the cashier to notice and scroll manually. See the effect right after
  // selectStudent.
  const mainAreaRef = useRef<HTMLDivElement>(null)
  const [selectedApplicationGuid, setSelectedApplicationGuid] = useState<string | null>(null)
  // studentGuid straight off the search hit (PaymentConsoleStudentSearch.bru
  // returns it directly) — passed into useStudentProfile below so the first
  // profile fetch already resolves full student fields instead of falling
  // back to application-only ones. Distinct from the `studentGuid` derived
  // from the loaded profile further down, which stays the source of truth
  // for every query after the profile has actually loaded.
  const [selectedStudentGuidHint, setSelectedStudentGuidHint] = useState<string | null>(null)

  // Fee-category menu, Column 1 (sketch: a stacked list, not a tab bar).
  // Resets to 'tuition' on every new student pick, same as the rest of the
  // payment form (selectStudent's resetPaymentForm call).
  const [activePayTab, setActivePayTab] = useState<PayCategory>('tuition')

  // Semester Payment tab mode toggle — 'payment' is the regular tuition
  // payment form (existing, below); 'adjustment' swaps in Payment Console
  // Adjustments' own "Apply Advance" fields/functionality, moved here
  // 2026-09-08 (that standalone page is retired — see its own git history
  // for the original). Both modes share the same Outstanding Balance ledger
  // table above the toggle; only the Payment Detail section below it swaps.
  // Resets to 'payment' on every new student pick, same as activePayTab.
  const [tuitionMode, setTuitionMode] = useState<'payment' | 'adjustment'>('payment')

  // Other Payment tab — same UI-first mock treatment NCHE/Guild had before
  // they were dropped from this page (they'll get their own pages later),
  // laid out after the matching legacy reference screen
  // (frmTrnPaymentOther.aspx). No per-semester Paid/Due grid here (that
  // screen's own header fields — Student/Programme/Semester — are already
  // covered by the Student Profile Details bar above the 3-column body, so
  // they aren't repeated); this tab is closer to a flat payment log keyed
  // by a ledger picker rather than a semester, now wired to the real
  // post-payment-other.md submit (ledgerOthersGuid sourced from
  // getLedgerOthers()). Receipt Book/Bank fields mirror Tuition's own
  // (narrowed by payType via PAY_TYPE_TO_RECEIPT_CATEGORY, bank only when
  // the payment method isn't cash) since the real endpoint needs
  // receiptBookGuid/procBankGuid, not the free-text "Bank Account" field the
  // old mock form had.
  //
  // otherIsAdvance mirrors the legacy form's "Advance Payment" checkbox —
  // now wired for real (2026-09-01) via get-advance-deposits.md's
  // per-application list (useAdvanceDeposits, same hook Payment Console
  // Adjustments' own Apply Advance dropdown uses — switched 2026-09-08 from
  // the studentGuid-scoped get-payment-advances.md list). Checking the box
  // reveals an inline deposit-picker table below it (see the "Advance
  // Payment" block further down) rather than opening a popup — selecting a
  // row there sets selectedAdvance (see selectAdvanceDeposit below), and
  // unchecking clears both. No separate "Advance Payment Date" field any
  // more — the picker table's own Deposit Date column already shows when
  // the selected deposit was originally paid in; otherPayDate is the one
  // date that actually reaches CreatePaymentOther (when this draw-down
  // happens).
  const [otherPayments, setOtherPayments] = useState<{ id: string; code: string; receiptNo: string | null; payDate: string; ledgerName: string; amount: string; currencyCode: string }[]>([])
  // Multi-row Ledger/Ledger Amount table (2026-09-10, per request) — replaces
  // the old single Ledger + "Amount to Apply" pair. CreatePaymentOther itself
  // still only ever accepts one ledgerOthersGuid + one amount per call (see
  // PaymentOtherInput's own comment — no batch/array support on the real
  // endpoint), so this is purely a staging table: otherSaveEntry() below
  // loops it and fires one real payment call per row with a valid ledger +
  // amount, sharing the rest of the form's fields (currency/date/receipt
  // book/bank/remarks) across every call. Starts with one blank row, same
  // "at least one entry" convention as calendarEntries on the Intake form.
  interface OtherLedgerRow { id: number; ledgerOthersGuid: string; amount: string }
  const [otherLedgerRows, setOtherLedgerRows] = useState<OtherLedgerRow[]>([{ id: 1, ledgerOthersGuid: '', amount: '' }])
  const nextOtherRowIdRef = useRef(2)
  function addOtherLedgerRow() {
    setOtherLedgerRows(prev => [...prev, { id: nextOtherRowIdRef.current++, ledgerOthersGuid: '', amount: '' }])
  }
  function removeOtherLedgerRow(id: number) {
    setOtherLedgerRows(prev => prev.length <= 1 ? prev : prev.filter(r => r.id !== id))
  }
  function updateOtherLedgerRow(id: number, field: 'ledgerOthersGuid' | 'amount', value: string) {
    setOtherLedgerRows(prev => prev.map(r => {
      if (r.id !== id) return r
      if (field === 'amount') return { ...r, amount: value.replace(/[^0-9.]/g, '') }
      // Switching onto or off the resit ledger clears the amount — onto it,
      // the resit-fee effect below fills it in; off it, the locked fee
      // shouldn't carry over to a ledger the cashier types into.
      const touchesResit = r.ledgerOthersGuid === resitLedgerGuid || value === resitLedgerGuid
      return { ...r, ledgerOthersGuid: value, amount: touchesResit ? '' : r.amount }
    }))
  }
  // Sum of every row's amount, in the one shared Currency picked below —
  // drives both the Total row under the table and the "Amount to Collect"
  // summary strip (this replaced the old single free-typed Amount field, so
  // there's no separate figure to keep in sync with it any more).
  const otherLedgerRowsTotal = otherLedgerRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
  // Guards the whole submit loop in otherSaveEntry() — createPaymentOther's
  // own isPending flag briefly drops back to false BETWEEN each row's call,
  // which would let the button re-enable mid-loop without this.
  const [isSavingOtherBatch, setIsSavingOtherBatch] = useState(false)
  const [otherPayDate, setOtherPayDate] = useState(todayYmd)
  const [otherIsAdvance, setOtherIsAdvance] = useState(false)
  const [selectedAdvance, setSelectedAdvance] = useState<AdvanceDepositSummary | null>(null)
  const [otherPayType, setOtherPayType] = useState('1')
  // Narrowed to only the category CreatePaymentOther will accept for the
  // currently-selected Payment Type — same reasoning as Tuition's own
  // receiptBooks derivation above.
  const otherReceiptBooks = activeReceiptBooks.filter(r => r.category === PAY_TYPE_TO_RECEIPT_CATEGORY[Number(otherPayType)])
  const [otherReceiptBookGuid, setOtherReceiptBookGuid] = useState('')
  const [otherProcBankGuid, setOtherProcBankGuid] = useState('')
  // No more standalone Amount field — otherLedgerRowsTotal (summed from the
  // Ledger/Ledger Amount table above) is what's shown/collected now.
  const [otherCurrencyGuid, setOtherCurrencyGuid] = useState('')
  const [otherRemarks, setOtherRemarks] = useState('')

  const [amount, setAmount] = useState('')
  const [currencyGuid, setCurrencyGuid] = useState('')
  const [payDate, setPayDate] = useState(todayYmd)
  const [payType, setPayType] = useState('1')
  // Narrowed to only the category CreatePayment will accept for the
  // currently-selected Payment Method — see PAY_TYPE_TO_RECEIPT_CATEGORY above.
  const receiptBooks = activeReceiptBooks.filter(r => r.category === PAY_TYPE_TO_RECEIPT_CATEGORY[Number(payType)])
  const [receiptBookGuid, setReceiptBookGuid] = useState('')
  const [procBankGuid, setProcBankGuid] = useState('')
  const [bankRef, setBankRef] = useState('')
  const [remarks, setRemarks] = useState('')
  // Inline field errors for the tuition Payment Detail form, keyed by field
  // (amount, currencyGuid, payDate, payType, receiptBookGuid, procBankGuid).
  const [payErrors, setPayErrors] = useState<Record<string, string>>({})
  function clearPayError(field: string) {
    setPayErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }
  function payErr(field: string) {
    return payErrors[field] ? <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{payErrors[field]}</p> : null
  }

  const [receipt, setReceipt] = useState<ReceiptData | null>(null)

  // ── Apply Advance (tuitionMode === 'adjustment') ────────────────────────
  // Draws down one of this application's own advance deposits against its
  // outstanding TUITION ledgers via the dedicated post-adjustment.md
  // endpoint (port of the legacy T_InsertPaymentAdjustments_Advance
  // procedure) — a genuinely different mechanism from Other Payment's own
  // "Advance Payment" checkbox above (that one settles Other-category
  // ledgers through the regular CreatePaymentOther endpoint with a
  // paymentAdvanceGuid attached). Field names are prefixed adj*/paymentAdvanceGuid
  // rather than reusing amount/currencyGuid above so switching tuitionMode
  // never mixes up the two forms' state.
  const [paymentAdvanceGuid, setPaymentAdvanceGuid] = useState('')
  const [adjCurrencyGuid, setAdjCurrencyGuid] = useState('')
  const [adjAmount, setAdjAmount] = useState('')
  const [adjustmentDate, setAdjustmentDate] = useState(todayYmd)
  const [adjRemarks, setAdjRemarks] = useState('')
  // Ledger breakdown for one adjustment-history row, shown in a small modal
  // on click (get-adjustment-ledger-breakdown.md) — fetched on demand.
  const [breakdownGuid, setBreakdownGuid] = useState<string | null>(null)

  // Debounced so GetPayableLedgers isn't hit on every keystroke.
  const [debouncedAmount, setDebouncedAmount] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAmount(amount), 400)
    return () => clearTimeout(t)
  }, [amount])

  // Debounced so the dropdown updates live as the user types (like every
  // other search box in the app), without hitting GetStudentSearch on every
  // keystroke. Search click / Enter still commit immediately for anyone who
  // types fast and hits Enter before the debounce would've fired.
  useEffect(() => {
    const t = setTimeout(() => setCommittedSearch(search.trim()), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!searchFocused) return
    function handle(e: MouseEvent) {
      if (!searchBoxRef.current?.contains(e.target as Node)) setSearchFocused(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [searchFocused])

  // isError kept separate from the [] fallback on purpose — same reasoning
  // as usePaymentHistory below: a failed search (a 401, or any other
  // downstream failure) must not render as the same "No matching
  // applications found" a genuinely empty result gets, or a real error goes
  // unnoticed as "this student doesn't exist". MIN_SEARCH_CHARS (3) matches
  // the backend: PaymentConsoleStudentSearch.bru documents no validator,
  // but a 2-char term was confirmed to fail on the dev backend with a
  // generic "An unexpected error occurred." while 3 chars work — so 1–2
  // chars show a "keep typing" hint instead of firing a request. An
  // empty committedSearch is allowed too, but only once the box has focus
  // (searchFocused) — that's the "list everything" case for clicking into
  // an empty box, not something to fetch on mount before the user has
  // interacted with the field at all.
  const searchTermLen = committedSearch.trim().length
  const searchTooShort = searchTermLen > 0 && searchTermLen < MIN_SEARCH_CHARS
  // Infinite-scroll variant (same mechanism as the student module's own
  // student-master search dropdown, useStudentSearchAdvancedInfinite) —
  // scrolling the results list near its bottom below fetches the next page
  // instead of this dropdown being capped at a single fixed page of 20.
  const {
    data: searchPages, fetchNextPage, hasNextPage, isFetchingNextPage,
    isFetching: isSearching, isError: isSearchError, error: searchError,
  } = useSearchStudentsInfinite(
    committedSearch, 20,
    searchFocused && !searchTooShort,
  )
  const matches = searchPages?.pages.flatMap(p => p.items) ?? []

  // Same scrollTop > 0 guard TableSearch's own handleResultsScroll uses —
  // see that component's comment: a plain distance-to-bottom check alone
  // fires spuriously on a short list right after a new page loads, even
  // with no user interaction.
  function handleSearchResultsScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!hasNextPage || isFetchingNextPage) return
    const el = e.currentTarget
    if (el.scrollTop > 0 && el.scrollHeight - el.scrollTop - el.clientHeight < 48) fetchNextPage()
  }

  // isError surfaced explicitly — without it, a profile fetch failure (e.g.
  // a real "Application not found." 404 for a guid the search endpoint just
  // returned, confirmed live) silently renders nothing once isLoading flips
  // false, leaving the whole "select a student" action look like it did
  // nothing rather than showing why.
  const { data: profile, isLoading: isProfileLoading, isError: isProfileError, error: profileError } = useStudentProfile(selectedApplicationGuid, !!selectedApplicationGuid, selectedStudentGuidHint)
  // profile.studentGuid — confirmed via a real live student-profile
  // response, not documented in the spec's own sample — is the studentGuid
  // outstanding-ledgers/payable-ledgers/createPayment all optionally
  // accept (see the .md docs' notes on it narrowing the billed semester
  // range). Falls back to selectedStudentGuidHint (straight off the search
  // hit) while the profile is still loading — the flow doc says to "always
  // pass studentGuid when known", and the hint is already known before the
  // profile fetch resolves, not just after. Once profile loads, its own
  // studentGuid takes over as the source of truth (it can also newly appear
  // there even when the search hit had none, so it isn't just a one-time
  // override).
  const studentGuid = profile?.studentGuid ?? selectedStudentGuidHint ?? null

  // After a payment: straight to this student's statement to see the updated
  // payment details. Only offered once there's a studentGuid — an applicant
  // who isn't a registered student yet has no statement.
  function openStudentStatement() {
    if (!studentGuid) return
    setSuccessModal(null)
    // from + applicationGuid let the statement offer "Back to Payment Console"
    // that reopens this same student (see the URL preload effect below).
    const q = new URLSearchParams({ studentGuid, from: 'payment-console' })
    if (selectedApplicationGuid) q.set('applicationGuid', selectedApplicationGuid)
    router.push(`/finance/student-statements?${q.toString()}`)
  }

  // Re-added per request — hide the Other Payment tab's Advance Payment
  // checkbox entirely when this application has zero advance deposits on
  // record at all (matching the inline picker table's own EmptyState
  // condition, rows.length === 0), rather than always showing it and
  // letting the table's empty state be the only place that says so.
  // Scoped by applicationGuid, not studentGuid (2026-09-08 fix) — the
  // earlier studentGuid-scoped check never fired at all for an applicant
  // who hasn't been converted into an enrolled student yet, silently hiding
  // the checkbox even when real deposits existed on their application. This
  // same query also backs the inline picker table itself (checking the box
  // just reveals rows already sitting in cache, no second fetch) and
  // Semester Payment's own Apply Advance dropdown below.
  const { data: otherAdvancesCheck, isLoading: isAdvanceDepositsLoading, isError: isAdvanceDepositsError } = useAdvanceDeposits(selectedApplicationGuid, !!selectedApplicationGuid)
  const hasAdvanceDeposits = (otherAdvancesCheck?.length ?? 0) > 0

  // Semester Payment tab's "Apply Advance" mode reuses this same per-
  // application deposit list (get-advance-deposits.md, not category-scoped)
  // rather than firing a second identical query.
  const deposits = otherAdvancesCheck ?? []
  const selectedDeposit = deposits.find(d => d.paymentAdvanceGuid === paymentAdvanceGuid)

  // Advance balance strip — per-currency undrawn total (get-advance-balance.md),
  // informational only. Backs Semester Payment's own Apply Advance mode and
  // (2026-09-09, per request) Other Payment's Advance Payment checkbox too,
  // same data either way since it's scoped by applicationGuid, not
  // category — only fetched while one of those two flows is actually active.
  const { data: advanceBalances = [] } = useAdvanceBalance(
    selectedApplicationGuid,
    !!selectedApplicationGuid && (
      (activePayTab === 'tuition' && tuitionMode === 'adjustment') ||
      (activePayTab === 'other' && otherIsAdvance)
    ),
  )

  // This deposit's own adjustment history (get-adjustments-by-advance.md), unpaged.
  const {
    data: adjustmentHistory = [], isLoading: isAdjHistoryLoading, isError: isAdjHistoryError,
  } = useAdjustmentsByAdvance(paymentAdvanceGuid || null, !!paymentAdvanceGuid)

  const {
    data: adjBreakdown = [], isLoading: isAdjBreakdownLoading, isError: isAdjBreakdownError,
  } = useAdjustmentLedgerBreakdown(breakdownGuid, !!breakdownGuid)

  const createAdjustment = useCreateAdjustment()

  // Defaults the Apply Advance currency picker to the deposit's own currency
  // as soon as it's picked (the common case is applying it in the currency
  // it was deposited in, still freely changeable), falling back to
  // Finance's own default before any deposit is picked rather than sitting
  // blank — same convention as Other Payment's own currency effect above.
  useEffect(() => {
    if (selectedDeposit?.currencyGuid) setAdjCurrencyGuid(selectedDeposit.currencyGuid)
    else if (!adjCurrencyGuid && currencies.length > 0) setAdjCurrencyGuid(getDefaultFinanceCurrencyGuid(currencies))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeposit?.currencyGuid, currencies])

  // Apply Advance's own deposit picker — an inline selectable table now
  // (2026-09-09, same move as Other Payment's own AdvanceDepositPickerModal
  // → inline table), not a SearchSelect dropdown. Clicking the
  // already-selected row again deselects it, same as Other Payment's own
  // selectAdvanceDeposit; adjCurrencyGuid/adjAmount are cleared alongside
  // (currency falls back to Finance's own default via the effect above once
  // it's blank) rather than sitting on the abandoned deposit's own figures.
  // Selecting a deposit now prefills both fields the same way Other
  // Payment's own checkbox does (2026-09-09 per request) — Amount defaults
  // to the full undrawn balance but stays freely editable for a partial
  // draw-down, Currency to the deposit's own (the effect above would get
  // there too, just one render later; setting it here directly avoids that
  // flash). Both fields also stay whatever the cashier already typed if
  // this fires again for the same deposit (only the guid-equality branch
  // above touches previously-entered values).
  function selectApplyAdvanceDeposit(deposit: AdvanceDepositSummary) {
    if (deposit.paymentAdvanceGuid === paymentAdvanceGuid) {
      setPaymentAdvanceGuid('')
      setAdjCurrencyGuid('')
      setAdjAmount('')
      return
    }
    setPaymentAdvanceGuid(deposit.paymentAdvanceGuid)
    setAdjCurrencyGuid(deposit.currencyGuid)
    setAdjAmount(String(deposit.balance))
  }

  // Discount-aware replacement for the old useOutstandingLedgers — same
  // current-semester scoping, but each ledger also carries its applicable
  // discount (discountName/discountAmount/netPayable), which
  // outstanding-ledgers has no fields for at all (see
  // get-current-semester-payable-ledgers.md). `ledgers` here is already
  // scoped to "this semester" server-side, so there's no client-side
  // semester-grouping/picking step left to do the way the old
  // ledgerGroups/currentSemesterGroup had to.
  const { data: currentSemesterPayable, isLoading: isLedgersLoading } = useCurrentSemesterPayable(selectedApplicationGuid, !!selectedApplicationGuid, studentGuid)
  const ledgers = currentSemesterPayable?.ledgers ?? []
  // Whole-programme progress (every semester, not just the current one) —
  // shown alongside the current semester's own ledger table below, not
  // folded into ledgerTotals/convertedLedgers which stay scoped to `ledgers`.
  const totalProgramOutstanding = currentSemesterPayable?.totalProgramOutstanding ?? 0
  const paidPercentage = currentSemesterPayable?.paidPercentage ?? 0
  const remainingPercentage = currentSemesterPayable?.remainingPercentage ?? 0
  // Business rule (2026-09-04, per request): the discount is documented as
  // conditional on "this group is paid in full" (see discountMessage's own
  // wording), but this endpoint always shows it unconditionally — it has no
  // proposed amount to check against, so it can't itself tell a fresh
  // ledger from one that already took a partial payment without earning the
  // discount. A paidAmount > 0 means exactly that already happened: some of
  // this ledger was paid without the group being paid in full, so the
  // discount is already forfeited and would double-count if still shown.
  // Zeroed client-side here rather than trusted from the response, and
  // netPayable falls back to the plain outstanding (no discount to net
  // against) — every other field, including outstanding/paidAmount
  // themselves, passes through unchanged.
  const effectiveLedgers = useMemo(() => ledgers.map(l => {
    if (l.paidAmount <= 0 || !l.discountGuid) return l
    return {
      ...l,
      discountGuid: null,
      discountName: null,
      discountCalcType: null,
      discountAmtPer: null,
      discountGroupLedgerNums: [],
      discountAmount: 0,
      discountMessage: null,
      discountExcessAmount: 0,
      discountWarning: null,
      netPayable: l.outstanding,
    }
  }), [ledgers])
  // 2026-09-03 backend change: the endpoint used to return a
  // { ledgers, totals } wrapper with a server-computed per-currency totals[]
  // block; it now returns the flat ledger list only (see
  // getCurrentSemesterPayable's own comment) — sum client-side, per
  // currency, same grouping key (currencyGuid, falling back to currencyName)
  // the old server-side totals used. Summed from effectiveLedgers, not the
  // raw ledgers, so a forfeited discount above doesn't leak into the totals.
  const ledgerTotals = useMemo<CurrentSemesterPayableTotal[]>(() => {
    const byCurrency = new Map<string, CurrentSemesterPayableTotal>()
    for (const l of effectiveLedgers) {
      const key = l.currencyGuid ?? l.currencyName
      const entry = byCurrency.get(key) ?? { currencyGuid: l.currencyGuid, currencyName: l.currencyName, totalOutstanding: 0, totalDiscount: 0, totalNetPayable: 0 }
      entry.totalOutstanding += l.outstanding
      entry.totalDiscount += l.discountAmount
      entry.totalNetPayable += l.netPayable
      byCurrency.set(key, entry)
    }
    return Array.from(byCurrency.values())
  }, [effectiveLedgers])
  // Outstanding Balance shows one currency's table at a time, converted
  // into whichever currency the cashier has picked as "Currency Received"
  // below — per a follow-up request (2026-09-05) that dropped the separate
  // "Convert to Currency" picker above the ledger table in favour of
  // reusing that one field, rather than asking the cashier to keep two
  // currency pickers in sync on one form.
  useEffect(() => {
    if (currencies.length === 0) return
    if (currencyGuid && currencies.some(c => c.currencyGuid === currencyGuid)) return
    // Defaults to whichever currency the student's own ledgers are actually
    // billed in, when that's one of the configured ones — falls back to
    // Finance's own default currency (UGX) otherwise, same as the Other
    // Payment tab's otherCurrencyGuid default below, rather than whatever
    // happened to be first in the API's own currency list order. Only runs
    // when the current selection is missing/no longer valid, so it doesn't
    // fight a cashier's own pick once one's been made.
    const preferred = ledgerTotals.find(t => currencies.some(c => c.currencyGuid === t.currencyGuid))
    setCurrencyGuid(preferred?.currencyGuid ?? getDefaultFinanceCurrencyGuid(currencies))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencies, ledgerTotals])
  // Converts Scheduled Bill/Outstanding (regardless of a given ledger's own
  // original currency) into whichever currency is picked above — per
  // request (2026-09-04). Scheduled Amt and Paid deliberately do NOT
  // convert (per a follow-up correction, same date): those are the actual
  // fee-line figures — a student's Admission Fee ledger can genuinely be
  // billed in USD while their Semester Fee ledger is billed in UGX, so
  // showing Scheduled Amt/Paid pre-converted would misreport what was
  // actually charged/collected on that specific ledger. Only Scheduled Bill
  // (the same ledgerAmount, but converted — the two now deliberately
  // diverge where they used to read the same figure twice) and Outstanding
  // exist to be compared/totalled across a mixed-currency ledger set, so
  // those are what actually need a common currency. Each ledger's own
  // native code is shown right under its Scheduled Amt figure; the target
  // currency for Scheduled Bill/Outstanding is named in the "Total Payable
  // (…)" footer and the picker above.
  // Today's board (get-exchange-rates-by-date.md) — a rate is only ever
  // entered for "today", so that's the only date meaningful for a live
  // "what does this student owe right now" figure; there's no historical
  // date on this screen to convert as of.
  const todayRatesQuery = useExchangeRatesByDate(todayYmd())
  const todayRates = todayRatesQuery.data ?? EMPTY_RATES
  // Today's Exchange Rates bar (header toggle) — read-only display of
  // today's USD/KSH rates (exRate = "1 {currency} = {exRate} UGX", as-is).
  // A missing rate is entered through TodayExchangeRateModal (POST, with a
  // currency dropdown), same as Application Payment; correcting an
  // already-set rate stays on Exchange Rate Management.
  const usdCurrency = currencies.find(c => c.currencyCode === 'USD')
  const kesCurrency = currencies.find(c => c.currencyCode === 'KSH') // Kenyan Shilling — backend's Currency Master uses code KSH, not KES
  const todayRateByCurrency = new Map(todayRates.map(r => [r.currencyGuid, r]))
  const usdRateMissing = !!usdCurrency && todayRatesQuery.isSuccess && !todayRateByCurrency.has(usdCurrency.currencyGuid)
  const kesRateMissing = !!kesCurrency && todayRatesQuery.isSuccess && !todayRateByCurrency.has(kesCurrency.currencyGuid)

  const baseCurrency = currencies.find(c => c.isDefault === 1)
  const rateCurrencies = currencies.filter(c => c.currencyGuid !== baseCurrency?.currencyGuid)
  const [rateModal, setRateModal] = useState<{ open: boolean; currencyGuid?: string }>({ open: false })
  function openRateModal(currencyGuid?: string) { setRateModal({ open: true, currencyGuid }) }
  const [ratesSetNote, setRatesSetNote] = useState(false)
  // No USD rate for today → ask for it once, as soon as that's known. After
  // a Cancel it stays closed; the bar's buttons reopen it.
  const usdPromptShown = useRef(false)
  useEffect(() => {
    if (usdRateMissing && !usdPromptShown.current) { usdPromptShown.current = true; openRateModal(usdCurrency?.currencyGuid) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usdRateMissing])
  const ratesByGuid = new Map(todayRates.map(r => [r.currencyGuid, r.exRate]))
  const targetOutstandingCurrency = currencies.find(c => c.currencyGuid === currencyGuid)
  const targetCurrencyGuid = targetOutstandingCurrency?.currencyGuid ?? null
  const targetCurrencyName = targetOutstandingCurrency?.currencyName ?? ''
  // null on a given ledger means its own currency (or the target's) has no
  // resolvable rate — shown as "—" rather than silently defaulting to the
  // original, unconverted figure, which would misreport what's actually
  // owed in the chosen currency.
  const convertedLedgers = effectiveLedgers.map(l => ({
    ...l,
    convScheduled: convertAmount(l.ledgerAmount, l.currencyGuid, targetCurrencyGuid, baseCurrency?.currencyGuid ?? null, ratesByGuid),
    convOutstanding: convertAmount(l.outstanding, l.currencyGuid, targetCurrencyGuid, baseCurrency?.currencyGuid ?? null, ratesByGuid),
  }))
  const convertedTotalDiscount = ledgerTotals.reduce((sum, t) => {
    const conv = convertAmount(t.totalDiscount, t.currencyGuid, targetCurrencyGuid, baseCurrency?.currencyGuid ?? null, ratesByGuid)
    return sum + (conv ?? 0)
  }, 0)
  // What the "Discount" row above the total actually needs to feed into —
  // the footer used to just re-show the raw pre-discount outstanding sum
  // here, which left the Discount line looking like a subtraction that
  // never actually applied to the number below it (a student billed 250
  // outstanding with a 187.50 discount kept showing "Total Outstanding:
  // 250.00" instead of the 62.50 the backend's own netPayable already
  // computes per-row). Summed from ledgerTotals' totalNetPayable, same
  // per-currency-then-convert approach convertedTotalDiscount uses, rather
  // than (per-ledger outstanding total) - convertedTotalDiscount, so a
  // ledger with an unconvertible currency (convOutstanding null) doesn't
  // desync the two.
  const convertedTotalNetPayable = ledgerTotals.reduce((sum, t) => {
    const conv = convertAmount(t.totalNetPayable, t.currencyGuid, targetCurrencyGuid, baseCurrency?.currencyGuid ?? null, ratesByGuid)
    return sum + (conv ?? 0)
  }, 0)
  const hasUnconvertibleLedger = convertedLedgers.some(l => l.convOutstanding === null)
  // All four categories in one call (get-all-outstanding-ledgers.md) — used
  // to show a real outstanding figure on the Other Payment tab, whose own
  // payment-entry form stays mock (no documented single-category submit
  // endpoint for it). isError surfaced explicitly, same reasoning as the
  // other queries on this page.
  const { data: allOutstanding = [], isLoading: isAllOutstandingLoading, isError: isAllOutstandingError } = useAllOutstandingLedgers(selectedApplicationGuid, !!selectedApplicationGuid)
  const otherOutstanding = allOutstanding.filter(i => i.category === 2)
  // isError kept separate from the [] fallback on purpose — a failed fetch
  // (confirmed live: this endpoint can 500 with server_error for some
  // applications) must not render the same "No payment history" message as
  // a genuinely empty result, since that would misreport a backend failure
  // as "this student has no payment history."
  // Fetched only while the Semester Payment tab is active — the left-column
  // Payment History card now sources the Other Payment tab from the
  // dedicated get-payment-others.md list further down instead (that
  // endpoint has no Tuition rows to filter out, so there's nothing this
  // cross-category list adds there any more; it used to be shown there
  // unfiltered, spanning every category, which is what this change fixes).
  // Also fetched (regardless of active tab) whenever this application has
  // advance deposits — get-advance-deposits.md's own response normalizes
  // every deposit to the base currency (originalAmount/balance/currencyGuid
  // all in USD terms, confirmed live: a deposit made in 3,000,000 UGX comes
  // back as baseAmount 810.81), with no native-currency figure of its own.
  // getPaymentHistory's category-5 rows are the one place that native
  // amount/currency still exists (paymentGuid there is the same guid as
  // paymentAdvanceGuid) — advanceNativeByGuid below cross-references it so
  // the picker can show what the cashier actually deposited, not just its
  // base-currency equivalent.
  const { data: paymentHistory = [], isLoading: isHistoryLoading, isError: isHistoryError } = usePaymentHistory(selectedApplicationGuid, !!selectedApplicationGuid && (activePayTab === 'tuition' || hasAdvanceDeposits))
  const tuitionPaymentHistory = useMemo(() => paymentHistory.filter(h => h.category === 1), [paymentHistory])
  const advanceNativeByGuid = useMemo(() => {
    const map = new Map<string, { amount: number; currencyName: string }>()
    paymentHistory.forEach(h => {
      if (h.category === 5) map.set(h.paymentGuid, { amount: h.amount, currencyName: h.currencyName })
    })
    return map
  }, [paymentHistory])
  const [historyPage, setHistoryPage] = useState(1)
  // Reset to page 1 on a new student so the view doesn't get stranded on a
  // now out-of-range page.
  useEffect(() => setHistoryPage(1), [selectedApplicationGuid])
  const historyTotalPages = Math.max(1, Math.ceil(tuitionPaymentHistory.length / HISTORY_PAGE_SIZE))
  const pagedPaymentHistory = tuitionPaymentHistory.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE)

  // View/Edit (get-payments.md/put-payment.md) — this table's own
  // ActionMenu, Tuition rows only (this is already the Tuition tab's own
  // history, so every row here qualifies). No separate fetch for View: the
  // row itself (PaymentHistoryEntry) already carries everything shown.
  const [viewEntry, setViewEntry] = useState<PaymentHistoryEntry | null>(null)
  const [editTarget, setEditTarget] = useState<EditablePaymentTarget | null>(null)
  const [showUpcomingSemesters, setShowUpcomingSemesters] = useState(false)
  // Payment History (2026-09-11, per request) — back to a popup, opened
  // from a button on the student card, instead of its own permanent card in
  // the body below. Kept inline in this component (not its own modal
  // component/file) since its content reads straight off a long list of
  // page-scoped state (activePayTab, both tabs' history queries/pagination,
  // advanceByPayment, setViewEntry/setEditTarget/setEditOtherTarget) that a
  // separate component would otherwise need passed through as a wall of
  // props for no real benefit — see its own render further down.
  const [showPaymentHistory, setShowPaymentHistory] = useState(false)
  // Other Payment tab's own Edit target (put-payment-other.md) — a
  // genuinely different shape/endpoint from Tuition's editTarget above, so
  // kept as its own state rather than reused.
  const [editOtherTarget, setEditOtherTarget] = useState<EditablePaymentOtherTarget | null>(null)
  // Which of this application's payments are advance-funded — put-payment.md
  // rejects editing those outright ("adjust the advance deposit instead"),
  // and the fee-line row itself has no `advance` field to check ahead of
  // time (see useAdvanceStatusByPayment's own comment). Only fetched while
  // the Tuition tab is actually active, matching this table's own gating.
  const advanceByPayment = useAdvanceStatusByPayment(selectedApplicationGuid, !!selectedApplicationGuid && activePayTab === 'tuition')

  // Other Payment tab's own Payment History — genuinely server-paginated
  // (get-payment-others.md), unlike Tuition's own fetch-whole-then-slice
  // approach above. Filtered by studentGuid once known (narrows to the
  // enrolled student's own rows), falling back to applicationGuid before
  // that — same precedence Payment Console's other studentGuid-optional
  // queries use elsewhere on this page.
  const [otherHistoryPage, setOtherHistoryPage] = useState(1)
  useEffect(() => setOtherHistoryPage(1), [selectedApplicationGuid])
  const {
    data: otherPaymentHistory, isLoading: isOtherHistoryLoading, isError: isOtherHistoryError,
  } = usePaymentOthersList(
    { applicationGuid: studentGuid ? undefined : selectedApplicationGuid, studentGuid, page: otherHistoryPage, pageSize: HISTORY_PAGE_SIZE },
    !!selectedApplicationGuid && activePayTab === 'other',
  )
  const otherHistoryItems = otherPaymentHistory?.items ?? []
  const otherHistoryTotalPages = Math.max(1, Math.ceil((otherPaymentHistory?.totalCount ?? 0) / HISTORY_PAGE_SIZE))

  // Campus/Programme/Batch client-side fallback lookups (useCampuses/
  // useProgramMasters/useBatches) dropped entirely (2026-09-09, per
  // request) — they existed only to cover the rare case of the server
  // sending null for its own pre-resolved programName/batchCode (and, for
  // Campus, because the DTO never carried a name at all), at the cost of
  // three full-list fetches. Now reading straight off profile's own fields;
  // Campus has nothing to read since it was never anything but that lookup,
  // so it's dropped from the hero card below rather than left permanently
  // blank. Semester keeps its own fallback (useSemestersForProgram) — that
  // one wasn't part of this request and is scoped to just this student's
  // programme, not a full-list fetch.
  const { data: semesters = [] } = useSemestersForProgram(profile?.programGuid ?? '', !!profile?.programGuid)

  const programName = profile?.programName
  const batchCode = profile?.batchCode
  const semName = profile?.semesterName ?? semesters.find(s => s.semesterGuid === profile?.semesterGuid)?.semName

  const selectedCurrency = currencies.find(c => c.currencyGuid === currencyGuid)

  const payableLedgersParams = useMemo(() => {
    const amt = parseFloat(debouncedAmount) || 0
    if (!selectedApplicationGuid || !selectedCurrency || amt <= 0 || !payDate) return null
    return { applicationGuid: selectedApplicationGuid, studentGuid, amount: amt, currencyGuid: selectedCurrency.currencyGuid, payDate }
  }, [selectedApplicationGuid, studentGuid, selectedCurrency, debouncedAmount, payDate])

  // isError surfaced explicitly — same reasoning as isSearchError/
  // isProfileError above. A real failure here (confirmed live: "Today's
  // exchange rate has not been entered for the payment date... Please add
  // it before proceeding." when the currency has no rate on file for
  // payDate) must not render as the same "No payable ledger lines for this
  // amount" a genuinely empty allocation gets, or the cashier has no idea
  // why the preview is blank.
  const { data: payableLedgers, isFetching: isPreviewLoading, isError: isPreviewError, error: previewError } = usePayableLedgers(payableLedgersParams, !!payableLedgersParams)

  const createPayment = useCreatePayment()
  const { data: ledgerOthers = [] } = useLedgerOthers()
  const createPaymentOther = useCreatePaymentOther()

  // Resit fee auto-fill (get-resit-fee.md) — picking the resit ledger in any
  // Ledger row fills that row's amount from the backend and locks it, same
  // as the legacy page's txtAmount.Enabled = false. The fee is always UGX,
  // and the API needs a real studentGuid (an applicant-only record can't owe
  // a resit fee), so both are checked again on submit in otherSaveEntry.
  const resitLedgerGuid = ledgerOthers.find(isResitLedger)?.ledgerOthersGuid ?? null
  const hasResitRow = !!resitLedgerGuid && otherLedgerRows.some(r => r.ledgerOthersGuid === resitLedgerGuid)
  const {
    data: resitFee, isFetching: isResitFeeLoading, isError: isResitFeeError, error: resitFeeError,
  } = useResitFee(studentGuid, selectedApplicationGuid, activePayTab === 'other' && hasResitRow)
  const resitFeeErrorMsg = resitFeeError instanceof Error ? resitFeeError.message : 'Could not fetch the resit fee.'
  useEffect(() => {
    if (!resitLedgerGuid || resitFee === undefined) return
    const amount = String(resitFee)
    setOtherLedgerRows(prev => prev.some(r => r.ledgerOthersGuid === resitLedgerGuid && r.amount !== amount)
      ? prev.map(r => r.ledgerOthersGuid === resitLedgerGuid ? { ...r, amount } : r)
      : prev)
  }, [resitFee, resitLedgerGuid, hasResitRow])

  function handleSearchClick() {
    const term = search.trim()
    if (!term) { showToast('Please enter a student number or name.', 'warn'); return }
    if (term.length < MIN_SEARCH_CHARS) { showToast(`Search term must be at least ${MIN_SEARCH_CHARS} characters.`, 'warn'); return }
    setCommittedSearch(term)
  }

  function resetPaymentForm() {
    setAmount('')
    setCurrencyGuid('')
    setPayDate(todayYmd())
    setPayType('1')
    setReceiptBookGuid('')
    setProcBankGuid('')
    setBankRef('')
    setRemarks('')
    setReceipt(null)
    setPayErrors({})
  }

  function resetAdjustmentForm() {
    setPaymentAdvanceGuid('')
    setAdjCurrencyGuid(getDefaultFinanceCurrencyGuid(currencies))
    setAdjAmount('')
    setAdjustmentDate(todayYmd())
    setAdjRemarks('')
  }

  function resetOtherForm() {
    setOtherLedgerRows([{ id: nextOtherRowIdRef.current++, ledgerOthersGuid: '', amount: '' }])
    setOtherPayDate(todayYmd())
    setOtherIsAdvance(false)
    setSelectedAdvance(null)
    setOtherPayType('1')
    setOtherReceiptBookGuid('')
    setOtherProcBankGuid('')
    setOtherCurrencyGuid(getDefaultFinanceCurrencyGuid(currencies))
    setOtherRemarks('')
  }

  // Other Payment's own currency picker has no ledger to default off of the
  // way Tuition's does (see that tab's own currencyGuid effect) — just
  // Finance's own default (UGX) once the currency list loads, rather than
  // sitting blank. Only fires while nothing's been picked yet (an advance
  // draw-down's own currency, set in selectAdvanceDeposit above, or a
  // manual pick both take priority).
  useEffect(() => {
    if (!otherCurrencyGuid && currencies.length > 0) setOtherCurrencyGuid(getDefaultFinanceCurrencyGuid(currencies))
  }, [otherCurrencyGuid, currencies])

  // Checking the box just flips the flag straight away now (2026-09-09 —
  // moved from a popup picker to an inline table, see the "Advance Payment"
  // block below) and reveals the deposit-picker table; nothing's selected
  // yet until a row in it is clicked. Unchecking clears both right away.
  function toggleAdvancePayment(checked: boolean) {
    setOtherIsAdvance(checked)
    if (!checked) setSelectedAdvance(null)
  }

  function selectAdvanceDeposit(advance: AdvanceDepositSummary) {
    // Clicking the already-selected row again deselects it — the table has
    // no separate "clear" affordance, so the same radio/row that picked a
    // deposit is what un-picks it too. Currency goes back to blank (the
    // Currency effect below re-defaults it) rather than left sitting on the
    // now-abandoned deposit's own currency.
    if (advance.paymentAdvanceGuid === selectedAdvance?.paymentAdvanceGuid) {
      setSelectedAdvance(null)
      setOtherCurrencyGuid('')
      return
    }
    setSelectedAdvance(advance)
    // Currency should normally stay as-is (CreatePaymentOther draws down in
    // the deposit's own currency) — the amount to draw is whatever the
    // cashier has already keyed into the Ledger/Ledger Amount table's rows
    // (otherLedgerRowsTotal), validated against this deposit's balance at
    // submit time in otherSaveEntry() rather than pre-filled here.
    setOtherCurrencyGuid(advance.currencyGuid)
  }

  // No edit/delete here, unlike Tuition's receipt — the legacy Other
  // Payment reference screen's own "Paid Fee Details" table has no edit/
  // delete affordance, so this stays a flat append-only log to match; each
  // successful submit appends the real result (post-payment-other.md) to it.
  // Loops the Ledger/Ledger Amount table, firing one real
  // CreatePaymentOther call per valid row (ledger picked + amount > 0) — N
  // rows means N sequential calls sharing every other field (currency/date/
  // receipt book/bank/remarks), each sent as its own single-entry `lines`
  // array (see PaymentOtherInput's own comment: the endpoint itself now
  // accepts several lines under one call/receipt, as of 2026-09-10, but
  // this page still claims one receipt per row rather than batching every
  // valid row into one call). Sequential rather than Promise.all so a
  // mid-batch failure stops cleanly instead of leaving a partial,
  // hard-to-reconcile set of receipts firing concurrently; rows that
  // already succeeded stay recorded (both here and on the server) even if a
  // later row fails — only the table itself is left as-is for the cashier
  // to fix and retry the remainder.
  async function otherSaveEntry() {
    if (!profile || !selectedApplicationGuid) { showToast('Please select a student first.', 'warn'); return }

    // Resit row checks run first — their amount is locked, so the generic
    // "needs an amount greater than 0" message below would be misleading.
    if (hasResitRow) {
      if (!studentGuid) { showToast('The resit fee can only be collected from a registered student.', 'warn'); return }
      if (isResitFeeLoading) { showToast('Still fetching the resit fee — please wait a moment.', 'warn'); return }
      if (isResitFeeError) { showToast(resitFeeErrorMsg, 'error'); return }
      if (resitFee === 0) { showToast('This student has no resit fee to pay. Remove the resit ledger row.', 'warn'); return }
      const currencyCode = currencies.find(c => c.currencyGuid === otherCurrencyGuid)?.currencyCode
      if (currencyCode && currencyCode !== 'UGX') { showToast('The resit fee is in UGX — switch the currency to UGX.', 'warn'); return }
    }

    const validRows = otherLedgerRows.filter(r => r.ledgerOthersGuid && parseFloat(r.amount) > 0)
    const ledgerNoAmount = otherLedgerRows.find(r => r.ledgerOthersGuid && !(parseFloat(r.amount) > 0))
    const amountNoLedger = otherLedgerRows.find(r => !r.ledgerOthersGuid && parseFloat(r.amount) > 0)
    // Backstop only — the dropdown already excludes a ledger picked in
    // another row, so this shouldn't normally be reachable.
    const seenLedgers = new Set<string>()
    const duplicateLedger = validRows.find(r => {
      if (seenLedgers.has(r.ledgerOthersGuid)) return true
      seenLedgers.add(r.ledgerOthersGuid)
      return false
    })
    if (validRows.length === 0) { showToast('Add at least one ledger with an amount greater than 0.', 'warn'); return }
    if (duplicateLedger) {
      const name = ledgerOthers.find(l => l.ledgerOthersGuid === duplicateLedger.ledgerOthersGuid)?.ledgerName ?? 'That ledger'
      showToast(`${name} is added more than once — each ledger can only appear in one row.`, 'warn')
      return
    }
    if (ledgerNoAmount) { showToast('Every ledger row needs an amount greater than 0.', 'warn'); return }
    if (amountNoLedger) { showToast('Every amount entered needs a ledger selected.', 'warn'); return }
    if (!otherCurrencyGuid) { showToast('Please select a currency.', 'warn'); return }
    if (!otherPayDate) { showToast('Please select a payment date.', 'warn'); return }
    const payTypeNum = Number(otherPayType)
    const showOtherBankFields = payTypeNum > 1

    // Advance mode: draw down against the selected deposit's own
    // paymentAdvanceGuid instead of claiming a new receipt — no receipt
    // book/bank needed (the money was already receipted when the advance
    // was deposited), same reasoning PaymentOtherInput's own comment gives.
    // Checked against the TABLE'S TOTAL now, since every row draws from the
    // same single deposit.
    if (otherIsAdvance) {
      if (!selectedAdvance) { showToast('Please select an advance deposit to draw from.', 'warn'); return }
      if (otherLedgerRowsTotal > selectedAdvance.balance) { showToast(`Total exceeds this deposit's remaining balance (${selectedAdvance.balance.toLocaleString()}).`, 'warn'); return }
    } else {
      if (!otherReceiptBookGuid) { showToast('Please select a receipt book.', 'warn'); return }
      if (showOtherBankFields && !otherProcBankGuid) { showToast('Please select a bank.', 'warn'); return }
    }

    const currencyCode = currencies.find(c => c.currencyGuid === otherCurrencyGuid)?.currencyCode ?? ''

    setIsSavingOtherBatch(true)
    const successRows: [string, string][] = []
    const succeededIds: number[] = []
    try {
      for (const row of validRows) {
        const ledgerName = ledgerOthers.find(l => l.ledgerOthersGuid === row.ledgerOthersGuid)?.ledgerName ?? '—'
        const result = await createPaymentOther.mutateAsync({
          applicationGuid: selectedApplicationGuid,
          studentGuid,
          lines: [{ ledgerOthersGuid: row.ledgerOthersGuid, amount: parseFloat(row.amount) }],
          currencyGuid: otherCurrencyGuid,
          payDate: otherPayDate,
          payType: payTypeNum,
          remarks: otherRemarks.trim() || null,
          receiptBookGuid: otherIsAdvance ? null : otherReceiptBookGuid,
          procBankGuid: otherIsAdvance ? null : (showOtherBankFields ? otherProcBankGuid : null),
          paymentAdvanceGuid: otherIsAdvance ? selectedAdvance?.paymentAdvanceGuid ?? null : null,
        })
        succeededIds.push(row.id)
        setOtherPayments(prev => [...prev, {
          id: result.paymentOtherGuid,
          code: result.paymentCode,
          receiptNo: result.receipt,
          payDate: otherPayDate, ledgerName, amount: String(result.amount), currencyCode,
        }])
        successRows.push([ledgerName, `${result.amount.toLocaleString()} ${currencyCode} — Receipt ${result.receipt ?? '—'}`])
      }
      setSuccessModal({
        title: validRows.length > 1 ? `${validRows.length} Other Payments Recorded` : 'Other Payment Recorded',
        rows: successRows,
      })
      resetOtherForm()
    } catch (error) {
      // Drop only the rows that already succeeded before the failure —
      // whatever's left (the failed row plus anything after it) stays in
      // the table so the cashier can fix and retry just those.
      setOtherLedgerRows(prev => {
        const remaining = prev.filter(r => !succeededIds.includes(r.id))
        return remaining.length > 0 ? remaining : [{ id: nextOtherRowIdRef.current++, ledgerOthersGuid: '', amount: '' }]
      })
      showToast(error instanceof Error ? error.message : 'Failed to save other payment. Please try again.', 'error')
    } finally {
      setIsSavingOtherBatch(false)
    }
  }

  function selectStudent(applicationGuid: string, name: string, studentGuidHint: string | null) {
    setSelectedApplicationGuid(applicationGuid)
    setSelectedStudentGuidHint(studentGuidHint)
    setSearch(name)
    setCommittedSearch('')
    setSearchFocused(false)
    setActivePayTab('tuition')
    setTuitionMode('payment')
    resetPaymentForm()
    resetAdjustmentForm()
    setOtherPayments([])
    resetOtherForm()
    setSuccessModal(null)
    if (name) showToast(`Loaded: ${name}`, 'success')
  }

  // Opened as /finance/payment-console?applicationGuid=…&studentGuid=…&name=…
  // (Student Statement's "Back to Payment Console"): reopen that student.
  // Read from window.location after mount — useSearchParams would need a
  // Suspense boundary in the static build. Runs once, on mount only.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const applicationGuid = params.get('applicationGuid')
    if (applicationGuid) selectStudent(applicationGuid, params.get('name') ?? '', params.get('studentGuid'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Smooth-scrolls the student card into view once it actually renders —
  // can't scroll straight from selectStudent() itself, since that card is
  // gated on `profile &&` and mainAreaRef isn't attached to anything until
  // this state change's own re-render has committed. Double
  // requestAnimationFrame defers the call until the browser has painted a
  // settled layout (one rAF for React's own post-commit paint, a second so
  // a same-tick reflow from the profile query's first data isn't still
  // pending) — a plain call right in the effect body risked measuring
  // against a not-yet-settled box.
  useEffect(() => {
    if (!selectedApplicationGuid) return
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        mainAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2) }
  }, [selectedApplicationGuid])

  const showBankFields = Number(payType) > 1

  // CreatePaymentCommandValidator (post-payment.md › Validation), checked all
  // at once and shown inline under each field.
  function validatePayment(): Record<string, string> {
    const e: Record<string, string> = {}
    // 0 is a legal amount here — unlike every other create in this module,
    // per the flow doc: "tuition create-payment accepts amount: 0 — it
    // books a pure-discount settlement that moves no cash. Do not block it
    // client-side." Only reject a blank field or a genuinely negative
    // number; parseFloat('') || 0 would otherwise silently treat a blank
    // field as an intentional 0, so the emptiness check comes first.
    const amt = parseFloat(amount)
    if (!amount.trim()) e.amount = 'Amount is required.'
    else if (isNaN(amt) || amt < 0) e.amount = 'Amount must be zero or greater.'
    if (!selectedCurrency) e.currencyGuid = 'Please select the currency received.'
    if (!payDate) e.payDate = 'Payment date is required.'
    if (!PAY_TYPE_LABELS[Number(payType)]) e.payType = 'Invalid payment type.'
    if (!receiptBookGuid) e.receiptBookGuid = 'Please select a receipt book.'
    if (showBankFields && !procBankGuid) e.procBankGuid = 'Bank account is required for non-cash payments.'
    return e
  }

  // Field a create-payment rejection belongs to, from its documented message
  // (post-payment.md › Validation and Business rules). null = not a field
  // problem (e.g. a missing exchange rate is a Finance-admin setup issue).
  function payErrorField(code: string | undefined, msg: string): string | null {
    if (code === 'amount_exceeds_program_outstanding') return 'amount'
    if (/receipt book/i.test(msg)) return 'receiptBookGuid'
    if (/^bank|bank account/i.test(msg)) return 'procBankGuid'
    if (/^currency not found/i.test(msg)) return 'currencyGuid'
    if (/payment type/i.test(msg)) return 'payType'
    return null
  }

  function handleSave(confirmOverride = false) {
    if (!profile || !selectedApplicationGuid) { showToast('Please select a student first.', 'warn'); return }
    const errs = validatePayment()
    setPayErrors(errs)
    if (Object.keys(errs).length || !selectedCurrency) { scrollToFirstError(errs); return }
    const amt = parseFloat(amount)
    const payTypeNum = Number(payType)

    createPayment.mutate(
      {
        applicationGuid: selectedApplicationGuid,
        studentGuid,
        amount: amt,
        currencyGuid: selectedCurrency.currencyGuid,
        receiptBookGuid,
        payDate,
        payType: payTypeNum,
        procBankGuid: showBankFields ? procBankGuid : null,
        remarks: remarks.trim() || null,
        confirmOverride,
      },
      {
        onSuccess: result => {
          const now = new Date()
          setReceipt({
            paymentGuid: result.paymentGuid,
            ref: result.receipt,
            code: result.paymentCode,
            name: applicantName(profile),
            refNo: profile.appRefNo,
            prog: programName ?? '—',
            method: PAY_TYPE_LABELS[payTypeNum] ?? `Type ${payTypeNum}`,
            date: formatDateTime(now),
            amount: `${amt.toLocaleString()} ${selectedCurrency.currencyCode}`,
            balance: `${selectedCurrency.currencyCode} ${result.balance.toLocaleString()}`,
            advanceMessage: result.advanceMessage,
            reRegistrationWarning: result.reRegistrationWarning,
          })
          // Step 3/7 (outstanding-ledgers, payment-history) already refetch
          // via useCreatePayment's onSuccess invalidation — clear Step 5's
          // own allocation preview here, per the flow doc, so it doesn't
          // keep showing the just-spent amount's stale allocation next to
          // the fresh receipt.
          setAmount('')
          setCurrencyGuid('')
          setSuccessModal({
            title: 'Tuition Payment Recorded',
            rows: [
              ['Receipt', result.receipt],
              ['Amount', `${amt.toLocaleString()} ${selectedCurrency.currencyCode}`],
              ['Unallocated Balance', `${selectedCurrency.currencyCode} ${result.balance.toLocaleString()}`],
            ],
            notices: [result.advanceMessage, result.reRegistrationWarning].filter((n): n is string => !!n),
          })
        },
        onError: (error: Error) => {
          // 409 reregistration_required — the student is behind on results.
          // Per the flow doc: show the explanation in a confirm dialog, and
          // on confirm resubmit the identical body with confirmOverride: true.
          if (error instanceof AuthError && error.code === 'reregistration_required') {
            if (window.confirm(`${error.message}\n\nProceed with this payment anyway?`)) handleSave(true)
            return
          }
          const code = error instanceof AuthError ? error.code : undefined
          // A rejection about one field (receipt book exhausted / wrong
          // category, bank, currency, amount over the programme's maximum)
          // goes under that field, so the cashier can fix it and resubmit.
          const field = payErrorField(code, error.message || '')
          if (field) {
            const e = { [field]: error.message }
            setPayErrors(prev => ({ ...prev, ...e }))
            scrollToFirstError(e)
            return
          }
          // concurrent_update: useCreatePayment has already refetched the
          // outstanding grid and the preview — the message tells the cashier.
          showToast(error.message || 'Failed to save payment. Please try again.', 'error')
        },
      },
    )
  }

  // Submit handler for Apply Advance (tuitionMode === 'adjustment') — ported
  // as-is from the standalone Payment Console Adjustments page's own
  // handleSubmit.
  function handleSubmitAdjustment() {
    if (!profile || !selectedApplicationGuid) { showToast('Please select a student first.', 'warn'); return }
    if (!selectedDeposit) { showToast('Please select an advance deposit to draw from.', 'warn'); return }
    if (!adjCurrencyGuid) { showToast('Please select a currency.', 'warn'); return }
    const amt = parseFloat(adjAmount)
    if (!adjAmount.trim() || isNaN(amt) || amt <= 0) { showToast('Amount must be greater than 0.', 'warn'); return }
    if (!adjustmentDate) { showToast('Please select an adjustment date.', 'warn'); return }

    createAdjustment.mutate(
      {
        paymentAdvanceGuid: selectedDeposit.paymentAdvanceGuid,
        applicationGuid: selectedApplicationGuid,
        input: { amount: amt, currencyGuid: adjCurrencyGuid, adjustmentDate, remarks: adjRemarks.trim() || null },
      },
      {
        onSuccess: result => {
          setSuccessModal({
            title: 'Adjustment Recorded',
            rows: [
              ['Adjustment Code', result.adjustmentCode ?? '—'],
              ['Applied', `${currencies.find(c => c.currencyGuid === adjCurrencyGuid)?.currencyName ?? ''} ${fmtAmt(result.adjustedAmount)}`.trim()],
              ['Receipt', result.receipt],
              ['Remaining Deposit Balance', `${selectedDeposit.currencyCode} ${fmtAmt(result.remainingAdvanceBalance)}`],
            ],
            notices: result.newAdvanceMessage ? [result.newAdvanceMessage] : undefined,
          })
          resetAdjustmentForm()
        },
        onError: (error: Error) => {
          // Business-rule rejections (exhausted balance, missing exchange
          // rate, nothing outstanding, concurrent settlement, …) all come
          // back as a plain message on the generic-failure branch — surface
          // it as-is rather than a generic "failed" toast.
          showToast(error instanceof AuthError ? error.message : (error.message || 'Failed to record adjustment. Please try again.'), 'error')
        },
      },
    )
  }

  function handleClear() {
    setSelectedApplicationGuid(null)
    setSelectedStudentGuidHint(null)
    setSearch('')
    setCommittedSearch('')
    resetPaymentForm()
    setActivePayTab('tuition')
    setTuitionMode('payment')
    resetAdjustmentForm()
    setOtherPayments([])
    resetOtherForm()
    setSuccessModal(null)
    showToast('Form cleared.', 'warn')
  }

  return (
    <>
      {/* id scopes the .g2 override in globals.css to just this page's outer
          Left-form/Right-preview split — same "direct-child combinator, not
          a plain descendant selector" reasoning as #page-payment's own .g2
          override, so Step 3's inner 2-column field grids (Amount/Currency,
          Payment Date/Method) don't get caught by it too. */}
      <div className="page active" id="page-payment-console">

        <div className="pg-hdr">
          <div>
            <div className="pg-title">Payment Collection Console</div>
            <div className="pg-sub">Search student → view outstanding balance → record payment → server-computed allocation</div>
          </div>
          <div className="flex gap-2">
            {/* Toggles the Exchange Rate bar below — per the redesign, rates
                move behind this button instead of always showing, so the
                page opens straight to Student Search. */}
            <button className={`btn btn-sm ${showExchangeRates ? 'btn-primary' : 'btn-neu'}`} onClick={() => setShowExchangeRates(v => !v)}>
              <i className="lni lni-money-protection"></i> Exchange Rates
            </button>          </div>
        </div>

        {showExchangeRates && (
          <div className="card flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-[7px] font-bold text-g700" style={{ fontSize: 'var(--fs-sm)' }}>
              <i className="lni lni-money-protection"></i> Today&apos;s Exchange Rates
              <span className="badge badge-blue text-[10px]">Daily Rate</span>
            </div>
            {/* Read-only — a missing rate is entered via the popup, an
                already-set one is corrected on Exchange Rate Management. */}
            {[
              { code: 'USD', currency: usdCurrency },
              { code: 'KSH', currency: kesCurrency },
            ].map(({ code, currency }) => {
              const rate = currency ? todayRateByCurrency.get(currency.currencyGuid)?.exRate : undefined
              return (
                <div key={code} className="flex items-center gap-[6px] flex-wrap text-[var(--fs-sm)]">
                  <span className="text-muted">1 {code} =</span>
                  {!currency ? (
                    <span className="text-g400" style={{ fontSize: 12 }}>not in Currency Master</span>
                  ) : todayRatesQuery.isLoading ? (
                    <span className="text-g400" style={{ fontSize: 12 }}>Loading…</span>
                  ) : todayRatesQuery.isError ? (
                    <span className="text-clr-red" style={{ fontSize: 12 }}><i className="lni lni-warning" /> Couldn&apos;t load</span>
                  ) : rate != null ? (
                    <span className="font-bold" style={{ fontSize: 13, color: 'var(--b800)' }}>{rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  ) : (
                    <button
                      className="btn btn-sm"
                      style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-bd)', color: 'var(--amber)', padding: '2px 8px', gap: 4 }}
                      onClick={() => openRateModal(currency.currencyGuid)}
                      title={`No ${code} rate for today — click to enter it`}
                    >
                      <i className="lni lni-pencil" style={{ fontSize: 11 }} /> Set {code} rate
                    </button>
                  )}
                  <span className="badge badge-gold">{baseCurrency?.currencyCode ?? 'UGX'}</span>
                </div>
              )
            })}
            <div className="flex items-center gap-[7px] flex-wrap" style={{ marginLeft: 'auto' }}>
              <button
                className="btn btn-primary btn-sm"
                style={{ gap: 5 }}
                onClick={() => {
                  // Both of today's rates already set — nothing to enter here.
                  const usdSet = !!usdCurrency && todayRateByCurrency.has(usdCurrency.currencyGuid)
                  const kesSet = !!kesCurrency && todayRateByCurrency.has(kesCurrency.currencyGuid)
                  if (usdSet && kesSet) { setRatesSetNote(true); return }
                  openRateModal((usdRateMissing ? usdCurrency : kesRateMissing ? kesCurrency : undefined)?.currencyGuid)
                }}
                disabled={rateCurrencies.length === 0}
              >
                <i className="lni lni-plus" style={{ fontSize: 12 }} /> Set Exchange Rate
              </button>
            </div>
            {ratesSetNote && <RatesAlreadySetNote codes={['USD', 'KSH']} onDismiss={() => setRatesSetNote(false)} />}
          </div>
        )}

        {/* Student Search — its own full-width bar (sketch: "Student Search"),
            split out from the profile card below it so a cashier can search
            without the profile summary's extra height in the way. */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-search-alt"></i></span> Student Search</div>
          </div>
          <div className="fg" style={{ marginBottom: 0, position: 'relative' }} ref={searchBoxRef}>
            <div className="lbl">Search by Applicant Name, Ref No, Phone, or Email <span className="req">*</span></div>
            <div className="flex gap-2 flex-wrap">
              <div className="inp-wrap" style={{ flex: 1, minWidth: 180 }}>
                <span className="inp-icon"><i className="lni lni-search-alt"></i></span>
                <input
                  className="ctrl"
                  type="text"
                  placeholder="e.g. APP20222/667 or Tumukunde Alice"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSearchClick() }}
                />
              </div>
              {/* Search button commented out per request — the dropdown
                  already opens live on focus/typing (browse-all when empty,
                  narrowed as you type) and Enter still commits the search
                  via the input's own onKeyDown above, so the button was
                  redundant. handleSearchClick kept as-is for that Enter path. */}
              {/* <button className="btn btn-primary" onClick={handleSearchClick}><i className="lni lni-search-alt"></i> Search</button> */}
            </div>

            {/* Dropdown: opens on focus (empty box lists every application,
                per PaymentConsoleStudentSearch.bru's "omit searchTerm to browse all"),
                closes on outside click via the searchBoxRef effect above
                or on picking a result. Floats over the page below the
                input row rather than pushing content down, since "list
                all" can return many rows. */}
            {searchFocused && (
              <div
                className="mt-1"
                style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                  background: 'var(--white)', border: '1.5px solid var(--b200)', borderRadius: 'var(--rsm)',
                  boxShadow: 'var(--neu-out)', maxHeight: 260, overflowY: 'auto',
                }}
                onScroll={handleSearchResultsScroll}
              >
                {/* matches.length === 0 gates the loading/error/empty states
                    below — isSearching (useInfiniteQuery's isFetching) also
                    goes true for a load-more fetch, which must not blank out
                    an already-loaded list; isFetchingNextPage's own row
                    further down covers that case instead. */}
                {searchTooShort ? (
                  <div className="text-g400 px-3 py-2" style={{ fontSize: 12.5 }}>
                    Type at least {MIN_SEARCH_CHARS} characters to search.
                  </div>
                ) : <>
                {isSearching && matches.length === 0 && <div className="text-g400 px-3 py-2" style={{ fontSize: 12.5 }}>Searching…</div>}
                {!isSearching && isSearchError && matches.length === 0 && (
                  <div className="text-clr-red px-3 py-2" style={{ fontSize: 12.5 }}>
                    <i className="lni lni-warning"></i> {searchError instanceof Error ? searchError.message : 'Search failed. Please try again.'}
                  </div>
                )}
                {!isSearching && !isSearchError && matches.length === 0 && (
                  <div className="text-g400 px-3 py-2" style={{ fontSize: 12.5 }}>
                    {committedSearch ? 'No matching applications found.' : 'No applications found.'}
                  </div>
                )}
                {matches.map(a => (
                  <div
                    key={a.applicationGuid}
                    className="cursor-pointer px-3 py-2 hover:bg-b50 border-b border-g100 last:border-b-0"
                    onClick={() => selectStudent(a.applicationGuid, searchResultName(a), a.studentGuid)}
                  >
                    <div className="font-bold">{searchResultName(a)}</div>
                    <div className="text-g500" style={{ fontSize: 11 }}>{a.appRefNo} · {a.phone ?? '—'} · {a.emailId ?? '—'}</div>
                  </div>
                ))}
                {isFetchingNextPage && (
                  <div className="text-g400 px-3 py-2 text-center" style={{ fontSize: 11.5 }}>
                    <i className="lni lni-reload"></i> Loading more…
                  </div>
                )}
                </>}
              </div>
            )}
          </div>

          {isProfileLoading && selectedApplicationGuid && (
            <div className="mt-4 text-g400" style={{ fontSize: 12.5 }}>Loading applicant profile…</div>
          )}

          {isProfileError && selectedApplicationGuid && (
            <div className="mt-4 text-clr-red" style={{ fontSize: 12.5 }}>
              <i className="lni lni-warning"></i> {profileError instanceof Error ? profileError.message : "Couldn't load this applicant's profile."}
            </div>
          )}
        </div>

        {/* Redesigned body (sketch): a top-level Semester Payment / Other
            Payment switcher, then a narrow left column (Profile Details +
            Payment History, both inline now — not a full-width bar / modal
            any more) beside a wide right column holding whichever
            category's outstanding balance + form (+ receipt, for Tuition)
            is active. Replaces the old vertical "Payment Category" menu
            and the g2/g3 three-column split. */}
        {selectedApplicationGuid && (
        <>
          <div className="pc-tabs">
            <button
              className={`pc-tab-btn${activePayTab === 'tuition' ? ' active' : ''}`}
              onClick={() => setActivePayTab('tuition')}
            >
              <i className="lni lni-graduation"></i> Semester Payment
            </button>
            {/* NCHE and Guild are dropped from this page — they'll get
                their own pages later — so "Other Payment" is just the
                Other-category form now, no inner sub-tab switcher
                needed. */}
            <button
              className={`pc-tab-btn${activePayTab === 'other' ? ' active' : ''}`}
              onClick={() => setActivePayTab('other')}
            >
              <i className="lni lni-wallet"></i> Other Payment
            </button>
          </div>

          {/* Student card — full-width, single column above the 2-column
              body (2026-09-11, per request; was the left column's own top
              section, sharing one card with Payment History below it).
              Still gradient-on-brand/hero-styled, just promoted out of the
              grid instead of being pinned to one column's width. Also the
              scroll target selectStudent() lands on (see mainAreaRef's own
              comment) — it's the first thing after the tabs, so scrolling
              here brings the rest of the body (Payment History, Outstanding
              Balance/payment form) into view right behind it. */}
          {profile && (
            <div className="card p-0 overflow-hidden" ref={mainAreaRef}>
              <div className="pc-hero">
                <div className="pc-hero-top">
                  <div className="pc-hero-avatar">{initialsFor(applicantName(profile))}</div>
                  <div className="flex-1 min-w-0">
                    <div className="pc-hero-name truncate">{applicantName(profile)}</div>
                    <div className="pc-hero-sub truncate">{programName ?? '—'}</div>
                    <span className="pc-hero-badge"><i className="lni lni-bookmark"></i> {profile.appRefNo}</span>
                  </div>
                  {/* Card-level actions (2026-09-11, per request) — Total
                      Outstanding moved here from its own amber stat card
                      below (see the Programme Progress donut's own
                      comment); Payment History moved here from its
                      permanent card in the body, now a popup instead (see
                      showPaymentHistory). Third flex child of
                      .pc-hero-top, pushed to the top-right corner by the
                      name block's own flex-1 rather than needing
                      justify-content on the row. Stacked/right-aligned via
                      .pc-hero-actions-top so two buttons don't fight the
                      name block for width on a narrower card — was a row
                      below .pc-hero-facts, which left the Semester/Intake
                      grid with a wide empty gap of its own underneath. */}
                  <div className="pc-hero-actions pc-hero-actions-top">
                    {!isLedgersLoading && currentSemesterPayable && currentSemesterPayable.totalProgramAmount > 0 && (
                      <button type="button" className="pc-hero-action" onClick={() => setShowUpcomingSemesters(true)}>
                        <i className="lni lni-wallet"></i>
                        <span>Total Outstanding</span>
                        <strong>{fmtAmt(totalProgramOutstanding)}</strong>
                      </button>
                    )}
                    <button type="button" className="pc-hero-action" onClick={() => setShowPaymentHistory(true)}>
                      <i className="lni lni-folder"></i>
                      <span>Payment History</span>
                    </button>
                  </div>
                </div>
                <div className="pc-hero-facts">
                  {/* title on each value gives the full text as a native
                      hover tooltip when it's long enough to be
                      ellipsis-truncated by pc-hero-fact-val, without
                      letting a long value wrap and break the grid's row
                      alignment (confirmed live: wrapping a long value
                      staggered every row after it out of alignment).
                      Campus dropped entirely (2026-09-09, per request) —
                      it only ever existed via the useCampuses() fallback
                      lookup that's now gone, nothing left to show here. */}
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Semester</span><span className="pc-hero-fact-val" title={semName ?? '—'}>{semName ?? '—'}</span></div>
                  {/* Guards against the literal string "null" —
                      confirmed live on an application with no intake
                      assigned yet, this field can come back as the
                      4-char string "null" rather than a real null,
                      which ?? alone doesn't catch. */}
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Intake</span><span className="pc-hero-fact-val" title={profile.intakeCode && profile.intakeCode !== 'null' ? profile.intakeCode : '—'}>{profile.intakeCode && profile.intakeCode !== 'null' ? profile.intakeCode : '—'}</span></div>
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Batch</span><span className="pc-hero-fact-val" title={batchCode ?? '—'}>{batchCode ?? '—'}</span></div>
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Year</span><span className="pc-hero-fact-val" title={profile.yearCode ?? '—'}>{profile.yearCode ?? '—'}</span></div>
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Phone</span><span className="pc-hero-fact-val" title={profile.phone ?? '—'}>{profile.phone ?? '—'}</span></div>
                  {/* Paired with Phone as a normal cell, not its own
                      pc-hero-fact-span2 row (2026-09-11 — that left a
                      visible blank cell next to Phone whenever there was no
                      7th fact to fill it, confirmed live). The span2 row's
                      original reasoning — pairing a long email with a short
                      neighbor risks uneven row heights from wrapping — no
                      longer applies: .truncate below already keeps this to
                      one line with an ellipsis, same as it did when span2
                      too, so nothing is lost by letting it sit in the grid
                      like every other fact. */}
                  <div className="pc-hero-fact">
                    <span className="pc-hero-fact-lbl">Email</span>
                    <span className="pc-hero-fact-val truncate" title={profile.emailId ?? profile.universityEmail ?? '—'}>{profile.emailId ?? profile.universityEmail ?? '—'}</span>
                  </div>
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Reg Status</span><span className="pc-hero-fact-val" title={profile.regStatusName ?? '—'}>{profile.regStatusName ?? '—'}</span></div>
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Refugee</span><span className="pc-hero-fact-val">{refugeeLabel(profile.refugee)}</span></div>
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Category</span><span className="pc-hero-fact-val">{studCategoryLabel(profile.studCategory)}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Payment History — a popup now (2026-09-11, per request),
              opened from the button on the student card above, instead of
              its own permanent card in the body below. Same
              modal-overlay/modal-lg shell as PaymentHistoryModal.tsx/
              UpcomingSemestersModal.tsx elsewhere in this app, just kept
              inline here rather than split into its own component — see
              showPaymentHistory's own comment for why. */}
          {showPaymentHistory && profile && (
            <div className="modal-overlay open">
              <div className="modal modal-lg" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
                <div className="modal-hdr modal-hdr-blue" style={{ flexShrink: 0 }}>
                  <div className="modal-title"><i className="lni lni-folder"></i> Payment History</div>
                  <button className="modal-close" onClick={() => setShowPaymentHistory(false)}><i className="lni lni-close"></i></button>
                </div>
                <div style={{ padding: 20, overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
                  {/* Semester Payment tab: Tuition-only rows sliced client-side
                      out of the whole-application payment-history fetch (see
                      usePaymentHistory's own comment on why it isn't
                      server-paginated). Other Payment tab: the dedicated
                      get-payment-others.md list instead, genuinely
                      server-paginated — replaces what used to be the same
                      cross-category fetch shown UNFILTERED (every category,
                      not just Other) while this tab was active. */}
                  {activePayTab === 'tuition' ? (
                    isHistoryLoading ? (
                      <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading payment history…</div>
                    ) : isHistoryError ? (
                      <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}>
                        <i className="lni lni-warning"></i> Couldn&apos;t load payment history. Please try again.
                      </div>
                    ) : tuitionPaymentHistory.length === 0 ? (
                      <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No payment history for this application.</div>
                    ) : (
                      <>
                      <ScrollTable className="no-sticky-col">
                        <table>
                          <thead><tr><th style={{ width: 40 }}></th><th>Date</th><th>Category</th><th>Amount</th><th>Cur.</th><th>Method</th></tr></thead>
                          <tbody>
                            {pagedPaymentHistory.map(h => {
                              // put-payment.md rejects editing an advance-funded
                              // payment outright — this is how you can tell
                              // ahead of time instead of finding out from the
                              // rejection toast: the badge below, and Edit
                              // disabled with the same explanation as its title.
                              const isAdvanceFunded = advanceByPayment.get(h.paymentGuid) === true
                              return (
                              <tr key={h.paymentGuid}>
                                <td>
                                  <ActionMenu>
                                    <button className="btn btn-neu btn-sm" onClick={() => setViewEntry(h)}>
                                      <i className="lni lni-eye"></i> View
                                    </button>
                                    {/* permissions.edit && ( */}
                                      <button
                                        className="btn btn-neu btn-sm"
                                        disabled={isAdvanceFunded}
                                        title={isAdvanceFunded ? 'Linked to an advance deposit — adjust the deposit instead.' : undefined}
                                        onClick={() => setEditTarget({ paymentGuid: h.paymentGuid, amount: h.amount, payDate: h.payDate, payType: h.payType, label: h.paymentCode })}
                                      >
                                        <i className="lni lni-pencil-alt"></i> Edit
                                      </button>
                                    {/* )} */}
                                    {/* Receipt PDF exists for tuition only — other categories 404. */}
                                    {h.category === 1 && (
                                      <button className="btn btn-neu btn-sm" disabled={printingGuid === h.paymentGuid} onClick={() => printReceipt(h.paymentGuid, h.paymentCode)}>
                                        <i className="lni lni-printer"></i> {printingGuid === h.paymentGuid ? 'Loading…' : 'Print / Reprint'}
                                      </button>
                                    )}
                                  </ActionMenu>
                                </td>
                                <td>{h.payDate.slice(0, 10)}</td>
                                <td>{PAYMENT_CATEGORY_LABELS[h.category] ?? `Category ${h.category}`}</td>
                                <td className="text-green font-bold">{h.amount.toLocaleString()}</td>
                                <td>{h.currencyName ?? '—'}</td>
                                <td>
                                  <span className="pill pill-blue">{h.payType?.name ?? '—'}</span>
                                  {isAdvanceFunded && <span className="badge badge-purple ml-1" title="Funded from an advance deposit">Advance</span>}
                                </td>
                              </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </ScrollTable>
                      <Pagination page={historyPage} totalPages={historyTotalPages} totalCount={tuitionPaymentHistory.length} itemLabel="payments" onPageChange={setHistoryPage} />
                      </>
                    )
                  ) : (
                    isOtherHistoryLoading ? (
                      <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading payment history…</div>
                    ) : isOtherHistoryError ? (
                      <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}>
                        <i className="lni lni-warning"></i> Couldn&apos;t load payment history. Please try again.
                      </div>
                    ) : otherHistoryItems.length === 0 ? (
                      <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No other payments recorded for this application.</div>
                    ) : (
                      <>
                      <ScrollTable className="no-sticky-col">
                        <table>
                          <thead><tr><th style={{ width: 40 }}></th><th>Date</th><th>Ledger</th><th>Amount</th><th>Cur.</th><th>Method</th></tr></thead>
                          <tbody>
                            {otherHistoryItems.map(h => (
                              <tr key={h.paymentOtherGuid}>
                                <td>
                                  <ActionMenu>
                                    <button
                                      className="btn btn-neu btn-sm"
                                      disabled={h.advance === 1}
                                      title={h.advance === 1 ? 'Linked to an advance deposit — adjust the deposit instead.' : undefined}
                                      onClick={() => setEditOtherTarget({ paymentOtherGuid: h.paymentOtherGuid, amount: h.amount, payDate: h.payDate, bankGuid: h.bank?.bankGuid ?? null, label: h.paymentCode })}
                                    >
                                      <i className="lni lni-pencil-alt"></i> Edit
                                    </button>
                                  </ActionMenu>
                                </td>
                                <td>{h.payDate.slice(0, 10)}</td>
                                <td>
                                  {/* One line per ledger — a payment can cover several
                                      (get-payment-others.md, 2026-09-10); each line's
                                      own amount is shown only when there's more than one. */}
                                  {h.ledgers?.length ? h.ledgers.map((l, i) => (
                                    <div key={l.ledger?.ledgerGuid ?? i} style={{ marginTop: i ? 4 : 0 }}>
                                      {l.ledger?.ledgerName ?? '—'}
                                      <span className="text-g400" style={{ display: 'block', fontSize: 11 }}>
                                        {l.ledger?.ledgerCode}{h.ledgers.length > 1 && ` · ${l.amount.toLocaleString()}`}
                                      </span>
                                    </div>
                                  )) : '—'}
                                </td>
                                <td className="text-green font-bold">{h.amount.toLocaleString()}</td>
                                <td>{h.currency.currencyCode}</td>
                                <td><span className="pill pill-blue">{PAY_TYPE_LABELS[h.payType] ?? `Type ${h.payType}`}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </ScrollTable>
                      <Pagination page={otherHistoryPage} totalPages={otherHistoryTotalPages} totalCount={otherPaymentHistory?.totalCount ?? 0} itemLabel="payments" onPageChange={setOtherHistoryPage} />
                      </>
                    )
                  )}
                </div>
                <div className="modal-footer" style={{ flexShrink: 0 }}>
                  <button className="btn btn-neu flex-1 justify-center" onClick={() => setShowPaymentHistory(false)}>Close</button>
                </div>
              </div>
            </div>
          )}

          {/* Outstanding balance/payment form (+ receipt, Tuition only) —
              was the body's RIGHT column; now the sole content since
              Payment History moved into the popup above and the hero moved
              to its own full-width card, so the .pc-body 2-column grid no
              longer has a second column to balance against. */}
          <div className="flex flex-col gap-5 min-w-0">

            {/* Other Payment tab — restructured 2026-09-15 to match Tuition's
                own .pc-tuition-split two-card layout exactly (left card:
                Outstanding Balance + ledger rows + Advance Deposit table;
                right card: "Payment Detail" fields), not a single merged
                card any more. Outstanding balance is real (GET
                .../outstanding-all, filtered to category 2); the
                payment-entry form and its payment log stay a UI-first mock
                laid out after the legacy ISMS reference screen
                (frmTrnPaymentOther.aspx) — a ledger picker, an Advance
                Payment toggle, bank-account gating matching Tuition's own
                bank fields, and a flat, append-only payment log (no
                edit/delete, per the reference screen's own "Paid Fee
                Details" table) — no documented single-category Other-payment
                submit endpoint exists yet, so nothing here calls a real API.
                NCHE and Guild are dropped from this page entirely — they'll
                get their own pages later. */}
            {activePayTab === 'other' && (
              <div className="pc-tuition-split">
                <div className="card flex flex-col gap-4 min-w-0">
                  <div className="card-hdr">
                    <div className="card-title"><span className="ctitle-icon"><i className="lni lni-wallet"></i></span> Other Payment</div>
                  </div>

                  <OutstandingCategoryTable items={otherOutstanding} isLoading={isAllOutstandingLoading} isError={isAllOutstandingError} />

                  {/* Advance Payment checkbox — same placement/treatment as
                      Semester Payment's own "Apply Advance" checkbox
                      (unlabeled divider, checkbox pushed to the end via
                      justify-end — "Payment Detail" itself is the RIGHT
                      card's own header now, not repeated here). Hidden
                      entirely when hasAdvanceDeposits is false, same
                      reasoning as before — nothing to draw from, so
                      there's nothing this checkbox would let the cashier
                      do. */}
                  {hasAdvanceDeposits && (
                    <div className="sec-divider flex items-center justify-end flex-wrap gap-2">
                      <label className="flex items-center gap-2" style={{ fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={otherIsAdvance} onChange={e => toggleAdvancePayment(e.target.checked)} />
                        Advance Payment
                      </label>
                    </div>
                  )}

                  {/* Ledger/Ledger Amount table (2026-09-10, per request) —
                    replaces the old single Ledger + "Amount to Apply" pair
                    with a repeatable table, one row per ledger the cashier
                    wants to collect against in this visit, same
                    add-row/Total-footer shape as Semester Payment's own
                    Outstanding Balance table above (just two editable
                    columns here instead of that one's read-only five). Real
                    catalogue (get-ledger-others.md) — each row's value is
                    the ledgerOthersGuid CreatePaymentOther needs, not a
                    display label. Only two grid columns per the request —
                    the remove-row control lives inside the Ledger Amount
                    cell itself rather than as its own column. otherSaveEntry
                    fires one real payment call per valid row (see its own
                    comment); the Total below is otherLedgerRowsTotal, also
                    what the "Amount to Collect" summary strip and (in
                    Advance mode) the deposit-balance check further down use. */}
                <div className="mb-[14px]">
                  {/* Moved above the table, right-aligned (2026-09-11, per
                      request) — was a plain button below the Total footer
                      row; same action, just placed where a "row-adding"
                      control on a table conventionally sits, next to what
                      it's adding to instead of trailing after the totals. */}
                  <div className="flex justify-end mb-2">
                    <button type="button" className="btn btn-neu btn-sm" onClick={addOtherLedgerRow}>
                      <i className="lni lni-plus"></i> Add Row
                    </button>
                  </div>
                  <div className="recgrid" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
                    <div className="recgrid-row recgrid-hdr">
                      <span style={{ textAlign: 'left' }}>Ledger</span>
                      <span>Ledger Amount</span>
                    </div>
                    {otherLedgerRows.map(row => {
                      const isResitRow = !!resitLedgerGuid && row.ledgerOthersGuid === resitLedgerGuid
                      // Status under a locked resit amount — only shown when
                      // there's something to say beyond the filled number.
                      const resitNote = !isResitRow ? null
                        : !studentGuid ? { text: 'Resit fee needs a registered student.', color: 'var(--amber)' }
                        : isResitFeeLoading ? { text: 'Fetching resit fee…', color: 'var(--g400)' }
                        : isResitFeeError ? { text: resitFeeErrorMsg, color: 'var(--red)' }
                        : resitFee === 0 ? { text: 'No resit fee owed.', color: 'var(--amber)' }
                        : null
                      return (
                      <div className="recgrid-row recgrid-body" key={row.id}>
                        <span style={{ textAlign: 'left' }}>
                          <SearchSelect
                            placeholder="— Select Ledger —"
                            // Excludes whatever's already picked in every OTHER
                            // row (this row's own current value stays in its
                            // own list) — a ledger can't be added twice, so
                            // there's no dropdown path to a duplicate, not just
                            // a submit-time rejection of one.
                            options={ledgerOthers
                              .filter(l => l.ledgerOthersGuid === row.ledgerOthersGuid || !otherLedgerRows.some(r => r.id !== row.id && r.ledgerOthersGuid === l.ledgerOthersGuid))
                              .map(l => ({ value: l.ledgerOthersGuid, label: l.ledgerName }))}
                            value={row.ledgerOthersGuid}
                            onChange={v => updateOtherLedgerRow(row.id, 'ledgerOthersGuid', v)}
                          />
                        </span>
                        <span>
                          <div className="flex items-center gap-2 justify-end">
                            <input
                              className="ctrl"
                              style={{ textAlign: 'right' }}
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={row.amount}
                              disabled={isResitRow}
                              title={isResitRow ? 'Resit fee is set automatically and cannot be edited' : undefined}
                              onChange={e => updateOtherLedgerRow(row.id, 'amount', stripLeadingZeros(e.target.value))}
                            />
                            {otherLedgerRows.length > 1 && (
                              <button
                                type="button"
                                title="Remove row"
                                onClick={() => removeOtherLedgerRow(row.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'var(--g300)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                              >
                                <i className="lni lni-trash-can"></i>
                              </button>
                            )}
                          </div>
                          {resitNote && (
                            <div style={{ fontSize: 'var(--fs-xs)', color: resitNote.color, textAlign: 'right', marginTop: 4 }}>{resitNote.text}</div>
                          )}
                        </span>
                      </div>
                      )
                    })}
                    <div className="recgrid-foot recgrid-total">
                      <span style={{ gridColumn: '1 / 2' }}>Total</span>
                      <span>{fmtAmt(otherLedgerRowsTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Advance Payment deposit table — the checkbox that gates
                    this moved up into the "Payment Detail" section header
                    above (2026-09-09, per request, matching Semester
                    Payment's own "Apply Advance" checkbox placement).
                    Checking it reveals this inline table (2026-09-09 —
                    moved off a popup modal per an earlier request) instead
                    of flipping otherIsAdvance straight away;
                    selectAdvanceDeposit below only fires once a row is
                    actually clicked. */}
                {otherIsAdvance && (
                  <div className="mb-[14px]">
                    {/* Same Remaining Advance Balance strip as Semester
                        Payment's own Apply Advance mode. Label now sits
                        inside the card itself, one row (2026-09-09, per
                        request), rather than as its own line above. The
                        card has no fixed width, so .pc-total-due's own
                        space-between has nothing to distribute once
                        label+value fit snugly — an explicit gap is what
                        actually keeps them apart (replaces the old
                        minWidth-based hack, which doesn't help once the
                        box is sized to its own content instead of
                        sitting in a row of same-width siblings). */}
                    {advanceBalances.length > 0 && (
                      <div className="flex gap-4 flex-wrap mb-2">
                        {advanceBalances.map(b => (
                          <div className="pc-total-due" style={{ gap: 14, background: 'var(--b50)', border: '1.5px solid var(--b200)' }} key={b.currencyGuid}>
                            {/* .pc-total-due's own amber/gold gradient reads as
                                "outstanding/due" (see Total Outstanding above),
                                wrong signal for an available balance — overridden
                                to the same blue (--b50/--b200) this page already
                                uses for the "Drawing from" deposit badge below. */}
                            <span className="text-muted" style={{ fontSize: 12 }}>Remaining Advance Balance</span>
                            <span className="flex items-baseline gap-1.5">
                              <span className="text-g400 font-semibold" style={{ fontSize: 11 }}>{b.currencyName}</span>
                              <span className="font-bold text-blue" style={{ fontSize: 15 }}>{fmtAmt(b.balance)}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedAdvance && (
                      <div className="flex items-center gap-2 mb-2 p-2.5 rounded-[var(--rsm)] bg-b50 border border-[1.5px] border-b100">
                        <div style={{ fontSize: 12 }}>
                          Drawing from <span className="font-mono text-blue font-bold">{selectedAdvance.advPaymentCode}</span>
                          <span className="text-g500"> · Balance {selectedAdvance.balance.toLocaleString()} {selectedAdvance.currencyCode}</span>
                        </div>
                      </div>
                    )}
                    <div className="text-g500" style={{ fontSize: 12, marginBottom: 8 }}>
                      {selectedAdvance ? 'Pick a different deposit to draw from instead —' : 'Pick a deposit to draw from —'} every row below still has an undrawn balance.
                    </div>
                    {/* Same .recgrid CSS-Grid "table look" as the Outstanding
                        Balance card above (2026-09-09, per request), not a
                        <table> — see globals.css's own .recgrid comment for
                        why (subgrid keeps header/body columns pixel-aligned).
                        Extra leading radio column, so the shared 5-column
                        template is overridden here via an inline
                        gridTemplateColumns rather than touching the global
                        class (which Outstanding Balance still uses as-is).
                        Deposit Code/Date get an explicit textAlign: 'left'
                        override — .recgrid-body>span:not(:first-child) right-
                        aligns every column after the first by default, which
                        reads fine for the numeric Deposited/Remaining columns
                        but wrong for a code/date. Ends in a Total Remaining
                        Deposits footer, one row per currency (mirrors the
                        Remaining Advance Balance strip above, since it's the
                        exact same advanceBalances figure) — same
                        recgrid-foot/recgrid-total footer convention
                        Outstanding Balance's own Discount/Total Payable rows
                        use. */}
                    <div className="recgrid" style={{ gridTemplateColumns: '36px 1.3fr 1fr 1fr 0.8fr 1fr' }}>
                      <div className="recgrid-row recgrid-hdr">
                        <span></span>
                        <span style={{ textAlign: 'left' }}>Deposit Code</span>
                        <span style={{ textAlign: 'left' }}>Deposit Date</span>
                        <span>Deposited</span><span>Cur.</span><span>Remaining</span>
                      </div>
                      {isAdvanceDepositsLoading ? (
                        <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading…</div>
                      ) : isAdvanceDepositsError ? (
                        <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load advance deposits.</div>
                      ) : deposits.length === 0 ? (
                        <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No advance deposits.</div>
                      ) : (
                        <>
                          {deposits.map(r => {
                            const isSelected = r.paymentAdvanceGuid === selectedAdvance?.paymentAdvanceGuid
                            const native = advanceNativeByGuid.get(r.paymentAdvanceGuid)
                            // Same fraction-of-original applies in either currency —
                            // no exchange rate needed to carry the remaining balance
                            // over to the native figure, just the ratio the
                            // base-currency pair already implies.
                            const nativeRemaining = native && r.originalAmount > 0 ? native.amount * (r.balance / r.originalAmount) : null
                            return (
                              <div
                                className="recgrid-row recgrid-body"
                                key={r.paymentAdvanceGuid}
                                style={{ cursor: 'pointer', background: isSelected ? 'var(--b50)' : undefined }}
                                onClick={() => selectAdvanceDeposit(r)}
                              >
                                <span>
                                  <input
                                    type="radio"
                                    checked={isSelected}
                                    onChange={() => selectAdvanceDeposit(r)}
                                    // A native radio only fires onChange on an
                                    // unchecked→checked transition — clicking an
                                    // already-checked one to deselect it wouldn't
                                    // otherwise do anything, so the toggle is
                                    // driven from onClick instead (which fires on
                                    // every click regardless of prior state).
                                    onClick={e => { e.stopPropagation(); selectAdvanceDeposit(r) }}
                                  />
                                </span>
                                <span className="font-mono text-blue" data-label="Deposit Code" style={{ textAlign: 'left', fontSize: 12 }}>{r.advPaymentCode}</span>
                                <span data-label="Deposit Date" style={{ textAlign: 'left' }}>{formatDate(r.payDate)}</span>
                                <span data-label="Deposited">
                                  <span className="font-bold">{fmtAmt(native ? native.amount : r.originalAmount)}</span>
                                  {native && (
                                    <span className="text-g400" style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>
                                      {fmtAmt(r.originalAmount)} {r.currencyCode}
                                    </span>
                                  )}
                                </span>
                                <span data-label="Cur."><span className="badge badge-gold">{native ? native.currencyName : r.currencyCode}</span></span>
                                <span data-label="Remaining">
                                  <span className="font-bold text-amber">{fmtAmt(nativeRemaining ?? r.balance)}</span>
                                  {native && (
                                    <span className="text-g400" style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>
                                      {fmtAmt(r.balance)} {r.currencyCode}
                                    </span>
                                  )}
                                </span>
                              </div>
                            )
                          })}
                          {advanceBalances.map(b => (
                            // .recgrid-foot>span:first-child's own grid-column: 1/5
                            // (globals.css) assumes the shared 5-column template —
                            // overridden here to 1/6 so it spans every column up to
                            // (not including) Remaining, the same way the 5-column
                            // version spans up to Outstanding; the value span then
                            // auto-places into the now-correct 6th column instead of
                            // sliding one column short (under Cur.) as it would with
                            // the un-overridden 1/5 on a 6-column row.
                            <div className="recgrid-foot recgrid-total" key={b.currencyGuid}>
                              <span style={{ gridColumn: '1 / 6' }}>Total Remaining Deposits ({b.currencyName})</span>
                              <span>{fmtAmt(b.balance)}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}
                </div>

                <div className="card flex flex-col gap-4 min-w-0">
                  {/* Payment Detail — right card's own header now, matching
                      Tuition's own right-card divider exactly (was this
                      card's single shared header, moved off the left card
                      above per this block's own top comment). */}
                  <div className="sec-divider" style={{ marginTop: 0 }}>Payment Detail</div>

                  {/* Live summary strip — same treatment as Tuition's own,
                      now sourced from the Ledger Amount table's own Total
                      (otherLedgerRowsTotal) rather than a separately-typed
                      Amount field. */}
                  {otherLedgerRowsTotal > 0 && (
                  <div className="pc-pay-summary">
                    <div>
                      <div className="pc-pay-lbl">Amount to Collect</div>
                      <div className="pc-pay-amt">{currencies.find(c => c.currencyGuid === otherCurrencyGuid)?.currencyCode ?? ''} {otherLedgerRowsTotal.toLocaleString()}</div>
                    </div>
                    <div className="pc-pay-meta">
                      <div><span>Date</span><b>{otherPayDate}</b></div>
                      <div><span>Method</span><b>{otherIsAdvance ? 'Advance Draw-down' : (PAY_TYPE_LABELS[Number(otherPayType)] ?? `Type ${otherPayType}`)}</b></div>
                    </div>
                  </div>
                )}
                {/* Currency + Amount paired, amount on the right — same
                    pairing as Tuition's own Currency/Amount row. */}
                <div className="g2 mb-[14px]">
                  <div className="fg">
                    {/* Editable again (2026-09-09, per request — was reported
                        as "the dropdown not showing" even outside Advance
                        mode). Locked read-only ONLY while otherIsAdvance is
                        true, since Currency then has to follow the drawn-
                        down deposit's own currency (set by
                        selectAdvanceDeposit) rather than a free cashier
                        pick — there's nothing to choose between in that
                        case. Outside Advance mode there's no such
                        constraint, so it's a real SearchSelect again,
                        defaulting to Finance's own default currency the
                        same way it always has (see the effect above). */}
                    <div className="lbl">Currency <span className="req">*</span></div>
                    {otherIsAdvance ? (
                      <input className="ctrl" readOnly value={currencies.find(c => c.currencyGuid === otherCurrencyGuid)?.currencyName ?? ''} placeholder="—" />
                    ) : (
                      <SearchSelect
                        placeholder="— Select Currency —"
                        options={currencies.map(c => ({ value: c.currencyGuid, label: `${c.currencyCode} — ${c.currencyName}` }))}
                        value={otherCurrencyGuid}
                        onChange={setOtherCurrencyGuid}
                      />  
                    )}
                  </div>
                  <div className="fg">
                    {/* Read-only now — the amount to collect is the Ledger
                        Amount table's own Total above (otherLedgerRowsTotal),
                        not a separately-typed figure that could drift out of
                        sync with what the rows actually add up to. */}
                    <div className="lbl">Amount</div>
                    <input className="amt-val-input" readOnly
                      style={{ fontSize: 18, fontWeight: 700, color: 'var(--g700)', cursor: 'not-allowed' }}
                      value={fmtAmt(otherLedgerRowsTotal)} />
                  </div>
                </div>
                {/* Payment Date stays view-only (always today) either way —
                    only Payment Type is editable again (2026-09-09, same
                    reasoning as Currency above), locked to a plain "Advance
                    Draw-down" label while otherIsAdvance is true (matches
                    the live summary strip's own Method line above) since no
                    new receipt/bank is actually claimed in that mode. */}
                <div className="g2 mb-[14px]">
                  <div className="fg">
                    <div className="lbl">Payment Date</div>
                    <input className="ctrl" readOnly value={formatDate(otherPayDate)} />
                  </div>
                  <div className="fg">
                    <div className="lbl">Payment Type</div>
                    {otherIsAdvance ? (
                      <input className="ctrl" readOnly value="Advance Draw-down" />
                    ) : (
                      <SearchSelect
                        options={Object.entries(PAY_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                        value={otherPayType}
                        onChange={val => { setOtherPayType(val); setOtherReceiptBookGuid(''); setOtherProcBankGuid('') }}
                      />
                    )}
                  </div>
                </div>

                {/* Receipt Book + Bank — real fields post-payment-other.md
                    needs (receiptBookGuid required, procBankGuid required
                    too unless Cash), replacing the old free-text "Bank
                    Account" input, same convention as Tuition's own
                    Receipt Book/Bank Name fields. Hidden entirely in
                    Advance mode — no new receipt is claimed there, the
                    money was already receipted when the advance was
                    deposited (both sent as null on submit either way). */}
                {!otherIsAdvance && (
                <div className="fg mb-[14px]">
                  <div className="lbl">Receipt Book <span className="req">*</span></div>
                  <SearchSelect
                    placeholder="— Select Receipt Book —"
                    options={otherReceiptBooks.map(r => ({ value: r.receiptBookGuid, label: r.bookCode }))}
                    value={otherReceiptBookGuid}
                    onChange={setOtherReceiptBookGuid}
                  />
                </div>
                )}

                {!otherIsAdvance && Number(otherPayType) > 1 && (
                  <div className="fg mb-[14px]">
                    <div className="lbl">Bank Name <span className="req">*</span></div>
                    <SearchSelect
                      placeholder="— Select Bank —"
                      options={banks.map(b => ({ value: b.procBankGuid, label: b.bankName }))}
                      value={otherProcBankGuid}
                      onChange={setOtherProcBankGuid}
                    />
                  </div>
                )}

                <div className="fg mb-4">
                  <div className="lbl">Remarks</div>
                  <textarea className="ctrl" rows={2} placeholder="Optional notes" value={otherRemarks} onChange={e => setOtherRemarks(e.target.value)} />
                </div>

                <div className="flex gap-[10px] justify-end items-center mb-5">
                  <button className="btn btn-primary btn-lg" disabled={isSavingOtherBatch} onClick={otherSaveEntry}>
                    <i className="lni lni-save"></i> {isSavingOtherBatch ? 'Saving…' : 'Add Payment'}
                  </button>
                </div>

                {SHOW_OTHER_PAID_FEE_DETAILS && (
                  <>
                    <div className="sec-divider" style={{ marginTop: 0 }}>Paid Fee Details</div>
                    {otherPayments.length === 0 ? (
                      <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No other payments recorded yet.</div>
                    ) : (
                      <ScrollTable className="no-sticky-col">
                        <table>
                          <thead><tr><th>Payment Code</th><th>Payment Date</th><th>Receipt No.</th><th>Ledger Name</th><th>Amount</th><th>Cur.</th></tr></thead>
                          <tbody>
                            {otherPayments.map(p => (
                              <tr key={p.id}>
                                <td className="font-mono">{p.code}</td>
                                <td>{p.payDate}</td>
                                <td className="font-mono text-blue">{p.receiptNo ?? '—'}</td>
                                <td>{p.ledgerName}</td>
                                <td className="text-green font-bold">{parseFloat(p.amount).toLocaleString()}</td>
                                <td>{p.currencyCode}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </ScrollTable>
                    )}
                  </>
                )}
                </div>
              </div>
            )}

            {/* Outstanding Balance + Record Payment — a single card, not
                two: the reference "Completing Registration" panel has no
                separate section boundary between the fee/ledger rows and
                the payment fields, just a plain divider ("Payment Detail"
                below), so this merges what used to be Step 2 and Step 3
                into one card (tuition only). */}
            {activePayTab === 'tuition' && (
              <>
                {/* "Outstanding Balance" card-hdr label removed per request
                    (2026-09-04) — the table below already makes clear
                    what's being shown. */}
                {/* Loading / fully-settled — each its own card, only
                    rendered while actually showing something (2026-09-11 —
                    was one always-rendered card wrapping both this and the
                    Apply Advance checkbox; with the checkbox moved into the
                    left card's own top-right corner below, an
                    always-rendered card here would sit empty whenever
                    neither state applies, which is the normal case once
                    ledgers have loaded). */}
                {!receipt && isLedgersLoading && (
                  <div className="card text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Checking outstanding balance…</div>
                )}
                {!receipt && !isLedgersLoading && ledgers.length === 0 && (
                  <div className="card text-center" style={{ padding: 24 }}>
                    <div className="pc-receipt-check" style={{ fontSize: 22 }}><i className="lni lni-checkmark-circle"></i></div>
                    <div className="font-bold text-g700" style={{ fontSize: 13.5 }}>Fully settled</div>
                    <div className="text-g400 mt-1" style={{ fontSize: 12.5 }}>This application has no outstanding tuition ledgers — there is nothing to bill right now.</div>
                  </div>
                )}

                {/* Two-column split (2026-09-11, per request) — Outstanding
                    Balance (+ the Advance Deposit table, in Apply Advance
                    mode) in its own left card; Payment Detail's own fields
                    in its own right card. Only renders once there's actually
                    something outstanding to act on (mirrors the loading/
                    fully-settled gating above) — a half-empty column pair
                    would be worse than the single full-width states those
                    cover. */}
                {!receipt && !isLedgersLoading && ledgers.length > 0 && (
                  <div className="pc-tuition-split">
                    <div className="card flex flex-col gap-4 min-w-0">
                      {/* Whole-programme progress (2026-09-11) — every
                          semester's ledgers, not just the current
                          semester's own ledgers in the table below. Folded
                          into this card instead of its own standalone
                          .stat-card (confirmed live: a whole separate card
                          just for a small donut — its own padding/margin/
                          border on top of the donut's own size — cost more
                          scroll than the content was worth; this card
                          already pays that overhead once). green/amber, the
                          same status pair (good/warning) this page already
                          paints Paid/Outstanding with everywhere else, not
                          a new chart-library palette. Color alone sits in
                          the 6-8 CVD floor band for this pair (validated
                          via the dataviz skill's palette script) — legal
                          only with secondary encoding, which the direct
                          segment labels, the always-on legend, and the
                          surface gap between segments below all provide.
                          Narrower than before, though: this card (and so
                          this donut) now only renders once
                          ledgers.length > 0 — no longer shown once fully
                          settled or with a receipt on screen, both cases
                          the standalone card used to cover independently. */}
                      {!isLedgersLoading && currentSemesterPayable && currentSemesterPayable.totalProgramAmount > 0 && (
                        <div>
                          <div className="stat-lbl" style={{ marginBottom: 6 }}>Paid vs Remaining</div>
                          <ProgrammePaidDonut paidPercentage={paidPercentage} remainingPercentage={remainingPercentage} />
                        </div>
                      )}
                      {/* Apply Advance switch — moved into this card's own
                          top-right corner (2026-09-11, per request; was a
                          full-width row above the whole split). Kept the
                          .sec-divider class it had there (bold/uppercase/
                          blue label text + bottom-border) rather than a
                          plain flex row — dropping it initially read as a
                          style regression even though the position was
                          right. Regular Payment / Apply Advance — a
                          checkbox (matching Other Payment's own "Advance
                          Payment" checkbox). Switching modes doesn't touch
                          the ledger table below — both modes settle the
                          same outstanding tuition ledgers, just via a
                          different funding source. Hidden when
                          hasAdvanceDeposits is false (nothing to draw from,
                          same reasoning as Other Payment's own checkbox) —
                          this card only ever renders once ledgers.length > 0
                          anyway (see the condition this whole split is
                          under), so no separate "fully settled" guard is
                          needed here. */}
                      {hasAdvanceDeposits && (
                        <div className="sec-divider flex items-center justify-end flex-wrap gap-2">
                          <label className="flex items-center gap-2" style={{ fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={tuitionMode === 'adjustment'}
                              onChange={e => setTuitionMode(e.target.checked ? 'adjustment' : 'payment')}
                            />
                            Apply Advance
                          </label>
                        </div>
                      )}
                      {/* Outstanding Balance table — unchanged content; no
                          longer wrapped in its own isLedgersLoading/
                          ledgers.length===0 ternary, since the condition
                          this whole split renders under already covers
                          both (see above). Column-aligned per request
                          (2026-09-04, invoice reference) — Ledger/Scheduled
                          Amt/Scheduled Bill/Paid/Outstanding columns as
                          .recgrid CSS-Grid rows (see globals.css) instead of
                          a <table>. Scheduled Amt and Scheduled Bill both
                          read from ledgerAmount — the backend has no second
                          figure distinguishing them, they're the same value
                          shown twice. Discount/Total stay below as their own
                          bold footer rows (Discount/Total aren't "a
                          ledger", so they don't belong as grid rows the
                          column headers describe). Every ledger (regardless
                          of its own original currency) converts into
                          whichever currency the cashier picks as "Currency
                          Received" in Payment Detail on the right — one
                          merged list, not one table per currency-group.
                          convertAmount/convertedLedgers do the actual
                          exchange-rate math. */}
                      <div className="text-g400 mb-2" style={{ fontSize: 11.5 }}>
                        Converted to {targetCurrencyName || 'the currency picked in Payment Detail'} — set via <b>Currency Received</b>.
                      </div>
                      {hasUnconvertibleLedger && (
                        <div className="warn-box mb-3">
                          <i className="lni lni-warning" style={{ color: 'var(--amber)', fontSize: 15, flexShrink: 0, marginTop: 1 }}></i>
                          <div>Some ledgers couldn&apos;t be converted to {targetCurrencyName || 'the selected currency'} — no exchange rate is on file for today for that currency. Those rows show <span className="font-mono">—</span> below; the totals only include what could be converted.</div>
                        </div>
                      )}
                      <div className="recgrid">
                        <div className="recgrid-row recgrid-hdr">
                          <span>Ledger</span>
                          <span>Scheduled Amt</span>
                          <span>Scheduled Bill</span>
                          <span>Paid</span>
                          <span>Outstanding</span>
                        </div>
                        {convertedLedgers.map((l, i) => {
                          const isPaid = l.outstanding === 0
                          return (
                            <div className="recgrid-row recgrid-body" key={`${l.ledgerGuid ?? 'none'}-${i}`}>
                              <span>
                                {l.ledgerName}{l.ledgerNum ? ` (${l.ledgerNum})` : ''}
                                {isPaid && <span className="text-green" style={{ fontSize: 11, fontWeight: 600, marginLeft: 6 }}>Paid</span>}
                              </span>
                              {/* Native — the raw fee-line amount, not run
                                  through convertAmount, with the ledger's
                                  own currencyCode (added to the API
                                  2026-09-03) shown right under it. Stays
                                  native rather than the picked target
                                  currency: a student's Admission Fee ledger
                                  can genuinely be billed in USD while their
                                  Semester Fee ledger is billed in UGX, so
                                  pre-converting this figure would misreport
                                  what was actually charged on that ledger. */}
                              {/* Wrapped in its own inner span, rather than
                                  two direct children of the cell, so the
                                  amount and currency code stay paired as
                                  one flex item under the mobile "stack
                                  instead of squeeze" breakpoint below
                                  (640px) — that layout turns each cell
                                  into a flex row of [label, value], and an
                                  unwrapped second child here would become
                                  a third item space-between'd off to the
                                  side instead of sitting under the amount. */}
                              <span data-label="Scheduled Amt">
                                <span>
                                  {fmtAmt(l.ledgerAmount)}
                                  {l.currencyCode && <span className="text-g400" style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>({l.currencyCode})</span>}
                                </span>
                              </span>
                              {/* Converted — same underlying ledgerAmount
                                  as Scheduled Amt, but into the picked
                                  target currency; the two intentionally
                                  diverge now instead of repeating the same
                                  figure twice. */}
                              <span data-label="Scheduled Bill">{l.convScheduled != null ? fmtAmt(l.convScheduled) : '—'}</span>
                              {/* Native — actually collected in the
                                  ledger's own currency, with the code
                                  shown underneath same as Scheduled Amt
                                  (per request, 2026-09-04) — wrapped the
                                  same way for the same mobile-stacking
                                  reason. */}
                              <span data-label="Paid" className="font-bold text-green">
                                <span>
                                  {fmtAmt(l.paidAmount)}
                                  {l.currencyCode && <span className="text-g400" style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>({l.currencyCode})</span>}
                                </span>
                              </span>
                              <span data-label="Outstanding" className={isPaid ? 'font-bold text-green' : 'font-bold text-amber'}>{l.convOutstanding != null ? fmtAmt(l.convOutstanding) : '—'}</span>
                            </div>
                          )
                        })}
                        {/* Discount/Total as bold footer rows on the same
                            grid, not a separate right-aligned block — no
                            colored bar behind either (removed per request,
                            2026-09-04), just the emphasis typography
                            .recgrid-total gives them. Value colors set
                            inline since .recgrid-total>span:last-child's
                            own color is more specific than a plain text-*
                            class and would otherwise win over it. Discount
                            always shows, even at 0, and still carries the
                            "full payment only" caveat since that condition
                            can't be read off the figure itself. Both are
                            the converted totals (summed from
                            convertedLedgers/ledgerTotals above), not the
                            original per-currency totals. */}
                        <div className="recgrid-foot recgrid-total">
                          <span>
                            Discount
                            <span className="text-g400" style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 4 }}>(full payment only)</span>
                          </span>
                          <span style={{ color: convertedTotalDiscount > 0 ? 'var(--green)' : 'var(--g400)' }}>
                            {convertedTotalDiscount > 0 ? `− ${fmtAmt(convertedTotalDiscount)}` : fmtAmt(convertedTotalDiscount)}
                          </span>
                        </div>
                        <div className="recgrid-foot recgrid-total">
                          {/* Net of the Discount row above it — was
                              convertedTotalOutstanding (the raw, pre-
                              discount sum) until 2026-09-04, which made
                              the Discount line above look like a
                              subtraction that never actually landed in
                              this figure. Relabeled to "Total Payable" so
                              it doesn't read as the same "Outstanding"
                              figure the per-ledger column above already
                              shows pre-discount. */}
                          <span>Total Payable {targetCurrencyName && `(${targetCurrencyName})`}</span>
                          <span style={{ color: 'var(--amber)' }}>{fmtAmt(convertedTotalNetPayable)}</span>
                        </div>
                      </div>

                      {/* Advance Deposit table (Apply Advance mode only) —
                          moved here (2026-09-11, per request) from further
                          down; its own "Payment Detail" fields (Ledger
                          Amount/Currency/Adjustment Date/Remarks) moved to
                          the right column below instead of following
                          directly under this table. */}
                      {tuitionMode === 'adjustment' && (
                        deposits.length === 0 ? (
                          <div className="text-g400 text-center" style={{ padding: '12px 0', fontSize: 12.5 }}>
                            No drawable advance deposits for this application — nothing to apply until one exists.
                          </div>
                        ) : (
                          <div className="fg">
                            <div className="lbl">Advance Deposit <span className="req">*</span></div>
                            {/* Inline selectable table — same move as Other
                                Payment's own AdvanceDepositPickerModal →
                                inline table (2026-09-09), replacing the
                                SearchSelect dropdown + separate read-only
                                "Deposit Balance" panel this used before.
                                get-advance-deposits.md's own
                                balance/currencyCode are base-currency
                                figures for every row — a deposit actually
                                made in USD still comes back here as its UGX
                                equivalent. Cross-referenced against
                                advanceNativeByGuid (paymentHistory's
                                category-5 rows), same as Other Payment's
                                table, so the cashier picks the deposit by
                                what they actually collected, not its
                                base-currency figure. */}
                            {selectedDeposit && (
                              <div className="flex items-center gap-2 mb-2 p-2.5 rounded-[var(--rsm)] bg-b50 border border-[1.5px] border-b100">
                                <div style={{ fontSize: 12 }}>
                                  Applying from <span className="font-mono text-blue font-bold">{selectedDeposit.advPaymentCode}</span>
                                  <span className="text-g500"> · Balance {selectedDeposit.balance.toLocaleString()} {selectedDeposit.currencyCode}</span>
                                </div>
                              </div>
                            )}
                            {/* Same .recgrid treatment as Other Payment's own
                                deposit table (2026-09-09, per request) — see
                                that table's own comment for the full rationale
                                (subgrid column-alignment, the inline
                                gridTemplateColumns override, textAlign
                                overrides on Code/Date, and the Total Remaining
                                Deposits footer sourced from advanceBalances). */}
                            <div className="recgrid" style={{ gridTemplateColumns: '36px 1.3fr 1fr 1fr 0.8fr 1fr' }}>
                              <div className="recgrid-row recgrid-hdr">
                                <span></span>
                                <span style={{ textAlign: 'left' }}>Deposit Code</span>
                                <span style={{ textAlign: 'left' }}>Deposit Date</span>
                                <span>Deposited</span><span>Cur.</span><span>Remaining</span>
                              </div>
                              {isAdvanceDepositsLoading ? (
                                <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading…</div>
                              ) : isAdvanceDepositsError ? (
                                <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load advance deposits.</div>
                              ) : (
                                <>
                                  {deposits.map(d => {
                                    const isSelected = d.paymentAdvanceGuid === paymentAdvanceGuid
                                    const native = advanceNativeByGuid.get(d.paymentAdvanceGuid)
                                    // Same fraction-of-original applies in either currency —
                                    // no exchange rate needed to carry the remaining balance
                                    // over to the native figure, just the ratio the
                                    // base-currency pair already implies.
                                    const nativeRemaining = native && d.originalAmount > 0 ? native.amount * (d.balance / d.originalAmount) : null
                                    return (
                                      <div
                                        className="recgrid-row recgrid-body"
                                        key={d.paymentAdvanceGuid}
                                        style={{ cursor: 'pointer', background: isSelected ? 'var(--b50)' : undefined }}
                                        onClick={() => selectApplyAdvanceDeposit(d)}
                                      >
                                        <span>
                                          <input
                                            type="radio"
                                            checked={isSelected}
                                            onChange={() => selectApplyAdvanceDeposit(d)}
                                            // See Other Payment's own radio comment — a native
                                            // radio doesn't fire onChange on a checked→checked
                                            // click, so the deselect toggle is driven from
                                            // onClick instead.
                                            onClick={e => { e.stopPropagation(); selectApplyAdvanceDeposit(d) }}
                                          />
                                        </span>
                                        <span className="font-mono text-blue" data-label="Deposit Code" style={{ textAlign: 'left', fontSize: 12 }}>{d.advPaymentCode}</span>
                                        <span data-label="Deposit Date" style={{ textAlign: 'left' }}>{formatDate(d.payDate)}</span>
                                        <span data-label="Deposited">
                                          <span className="font-bold">{fmtAmt(native ? native.amount : d.originalAmount)}</span>
                                          {native && (
                                            <span className="text-g400" style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>
                                              {fmtAmt(d.originalAmount)} {d.currencyCode}
                                            </span>
                                          )}
                                        </span>
                                        <span data-label="Cur."><span className="badge badge-gold">{native ? native.currencyName : d.currencyCode}</span></span>
                                        <span data-label="Remaining">
                                          <span className="font-bold text-amber">{fmtAmt(nativeRemaining ?? d.balance)}</span>
                                          {native && (
                                            <span className="text-g400" style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>
                                              {fmtAmt(d.balance)} {d.currencyCode}
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                    )
                                  })}
                                  {advanceBalances.map(b => (
                                    // See Other Payment's own footer comment — 1/6
                                    // override for the 6-column row, same reasoning.
                                    <div className="recgrid-foot recgrid-total" key={b.currencyGuid}>
                                      <span style={{ gridColumn: '1 / 6' }}>Total Remaining Deposits ({b.currencyName})</span>
                                      <span>{fmtAmt(b.balance)}</span>
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    <div className="card flex flex-col gap-4 min-w-0">
                      {/* Payment Detail — Regular Payment mode's own fields.
                          Unchanged content, just the right column now
                          instead of following directly under the ledger
                          table above. */}
                      {tuitionMode === 'payment' && (
                        <>
                          <div className="sec-divider" style={{ marginTop: 0 }}>Payment Detail</div>
                          {/* Live summary strip — mirrors the amount/currency/date/
                              method already entered below back at the cashier as
                              a glanceable card, purely derived from this form's
                              own state (no extra fetch). Only shows once an
                              amount has actually been typed. */}
                          {amount.trim() && (
                            <div className="pc-pay-summary">
                              <div>
                                <div className="pc-pay-lbl">Amount to Collect</div>
                                <div className="pc-pay-amt">{selectedCurrency?.currencyCode ?? ''} {(parseFloat(amount) || 0).toLocaleString()}</div>
                              </div>
                              <div className="pc-pay-meta">
                                <div><span>Date</span><b>{payDate}</b></div>
                                <div><span>Method</span><b>{PAY_TYPE_LABELS[Number(payType)] ?? `Type ${payType}`}</b></div>
                              </div>
                            </div>
                          )}
                          {/* Currency + Amount paired, amount on the right, per
                              request — then Date + Method paired, then Receipt
                              Book on its own row. This currency picker now does
                              double duty (per follow-up request, 2026-09-05): it's
                              also what the Outstanding Balance table on the left
                              converts into (targetCurrencyGuid/targetCurrencyName
                              further up read straight off this same currencyGuid
                              state). */}
                          <div className="g2 mb-[14px]">
                            <div className="fg">
                              <div className="lbl">Currency Received <span className="req">*</span></div>
                              <SearchSelect
                                placeholder="— Select Currency —"
                                options={currencies.map(c => ({ value: c.currencyGuid, label: `${c.currencyCode} — ${c.currencyName}` }))}
                                value={currencyGuid}
                                onChange={v => { setCurrencyGuid(v); clearPayError('currencyGuid') }}
                              />
                              {payErr('currencyGuid')}
                            </div>
                            <div className="fg">
                              <div className="lbl">Amount Received <span className="req">*</span></div>
                              <input type="number" min={0} step={0.01} className="amt-val-input" placeholder="0.00"
                                style={{ fontSize: 18, fontWeight: 700, ...(payErrors.amount ? { borderColor: 'var(--red)' } : {}) }}
                                aria-invalid={!!payErrors.amount}
                                // Number inputs still accept e/E/+/-; none is a valid amount (≥ 0).
                                onKeyDown={e => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
                                value={amount} onChange={e => { setAmount(stripLeadingZeros(e.target.value)); clearPayError('amount') }} />
                              {payErr('amount')}
                            </div>
                          </div>
                          <div className="g2 mb-[14px]">
                            <div className="fg">
                              <div className="lbl">Payment Date <span className="req">*</span></div>
                              <DatePicker value={payDate} onChange={v => { setPayDate(v); clearPayError('payDate') }} hasError={!!payErrors.payDate} />
                              {payErr('payDate')}
                            </div>
                            <div className="fg">
                              <div className="lbl">Payment Method <span className="req">*</span></div>
                              <SearchSelect
                                options={Object.entries(PAY_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                                value={payType}
                                onChange={val => {
                                  // Receipt books are filtered by the method's category, and
                                  // Cash has no bank — so both selections (and errors) reset.
                                  setPayType(val); setReceiptBookGuid(''); setProcBankGuid('')
                                  setPayErrors(prev => ({ ...prev, payType: '', receiptBookGuid: '', procBankGuid: '' }))
                                }}
                              />
                              {payErr('payType')}
                            </div>
                          </div>
                          <div className="fg mb-[14px]">
                            <div className="lbl">Receipt Book <span className="req">*</span></div>
                            <SearchSelect
                              placeholder="— Select Receipt Book —"
                              options={receiptBooks.map(r => ({ value: r.receiptBookGuid, label: r.bookCode }))}
                              value={receiptBookGuid}
                              onChange={v => { setReceiptBookGuid(v); clearPayError('receiptBookGuid') }}
                            />
                            {payErr('receiptBookGuid')}
                          </div>

                          {showBankFields && (
                            <div className="g2 mb-[14px]">
                              <div className="fg">
                                <div className="lbl">Bank Name <span className="req">*</span></div>
                                <SearchSelect
                                  placeholder="— Select Bank —"
                                  options={banks.map(b => ({ value: b.procBankGuid, label: b.bankName }))}
                                  value={procBankGuid}
                                  onChange={v => { setProcBankGuid(v); clearPayError('procBankGuid') }}
                                />
                                {payErr('procBankGuid')}
                              </div>
                              <div className="fg">
                                <div className="lbl">Bank Transaction Ref</div>
                                <input className="ctrl" type="text" placeholder="Bank reference number" value={bankRef} onChange={e => setBankRef(e.target.value)} />
                              </div>
                            </div>
                          )}

                          <div className="fg mb-4">
                            <div className="lbl">Remarks</div>
                            <textarea className="ctrl" rows={2} placeholder="Optional notes or sponsor details..." value={remarks} onChange={e => setRemarks(e.target.value)} />
                          </div>

                          <div className="flex gap-[10px] justify-end items-center">
                            {/* permissions.add && ( */}
                              <button className="btn btn-primary btn-lg" disabled={createPayment.isPending} onClick={() => handleSave()}>
                                <i className="lni lni-save"></i> {createPayment.isPending ? 'Saving…' : 'Save Payment & Generate Receipt →'}
                              </button>
                            {/* )} */}
                          </div>
                        </>
                      )}

                      {/* Payment Detail — Apply Advance mode's own fields
                          (moved from the standalone Payment Console
                          Adjustments page, 2026-09-08; same fields/
                          functionality/APIs, ported as-is). Draws down the
                          deposit picked on the left against the outstanding
                          tuition ledgers above it, via the dedicated
                          post-adjustment.md endpoint
                          (handleSubmitAdjustment/useCreateAdjustment). Only
                          rendered once a deposit actually exists to pick
                          from — deposits.length === 0's own message already
                          covers "nothing to apply" on the left; repeating a
                          stack of disabled fields here on the right would
                          just say the same thing twice. */}
                      {tuitionMode === 'adjustment' && deposits.length > 0 && (
                        <>
                          <div className="sec-divider" style={{ marginTop: 0 }}>Payment Detail</div>
                          <div className="g2 mb-[14px]">
                            <div className="fg">
                              <div className="lbl">Ledger Amount <span className="req">*</span></div>
                              <input
                                className="ctrl"
                                type="number"
                                placeholder="0.00"
                                value={adjAmount}
                                onChange={e => setAdjAmount(stripLeadingZeros(e.target.value))}
                                disabled={!selectedDeposit}
                              />
                            </div>
                            <div className="fg">
                              {/* View-only per request — Currency always
                                  follows the selected deposit's own currency
                                  (see the effect defaulting adjCurrencyGuid
                                  above), never a separate cashier choice, so
                                  there's nothing here for a picker to actually
                                  let them change. */}
                              <div className="lbl">Currency</div>
                              <input
                                className="ctrl"
                                readOnly
                                value={currencies.find(c => c.currencyGuid === adjCurrencyGuid)?.currencyName ?? ''}
                                placeholder="—"
                              />
                            </div>
                          </div>

                          <div className="g2 mb-[14px]">
                            <div className="fg">
                              {/* View-only per request — always today, same as
                                  every other "Adjustment Date" this endpoint
                                  would otherwise silently backdate/postdate if
                                  it were left editable. */}
                              <div className="lbl">Adjustment Date</div>
                              <input className="ctrl" readOnly value={formatDate(adjustmentDate)} />
                            </div>
                            <div className="fg">
                              <div className="lbl">Remarks <span className="text-g400" style={{ fontWeight: 500 }}>(optional)</span></div>
                              <textarea className="ctrl" rows={1} placeholder="Defaults to “Advance Adjustment”" value={adjRemarks} onChange={e => setAdjRemarks(e.target.value)} disabled={!selectedDeposit} />
                            </div>
                          </div>

                          <div className="flex gap-[10px] justify-end flex-wrap">
                            <button className="btn btn-neu" onClick={resetAdjustmentForm}><i className="lni lni-close"></i> Cancel</button>
                            <button className="btn btn-primary btn-lg" disabled={createAdjustment.isPending} onClick={handleSubmitAdjustment}>
                              <i className="lni lni-checkmark"></i> {createAdjustment.isPending ? 'Submitting…' : 'Apply Advance'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Payment Adjustment History for the currently-picked deposit
                (get-adjustments-by-advance.md) — full width, moved from the
                standalone Payment Console Adjustments page. The endpoint
                takes a paymentAdvanceGuid in its path — there's no "all
                adjustments for this application" variant — so this genuinely
                can't render (or fire its API call) before a deposit is
                picked in Apply Advance above; these placeholders say so
                instead of just leaving the space blank with no explanation. */}
            {activePayTab === 'tuition' && tuitionMode === 'adjustment' && !paymentAdvanceGuid && deposits.length > 0 && (
              <div className="card text-g400 text-center" style={{ padding: 24, fontSize: 12.5 }}>
                <i className="lni lni-folder" style={{ fontSize: 20, display: 'block', marginBottom: 6 }}></i>
                Select an Advance Deposit above to see its Payment Adjustment History.
              </div>
            )}
            {activePayTab === 'tuition' && tuitionMode === 'adjustment' && paymentAdvanceGuid && (
              <div className="card">
                <div className="card-hdr">
                  <div className="card-title"><span className="ctitle-icon"><i className="lni lni-folder"></i></span> Payment Adjustment History</div>
                  {selectedDeposit?.advPaymentCode && <span className="badge badge-grey">{selectedDeposit.advPaymentCode}</span>}
                </div>
                {isAdjHistoryLoading ? (
                  <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading adjustment history…</div>
                ) : isAdjHistoryError ? (
                  <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load adjustment history.</div>
                ) : adjustmentHistory.length === 0 ? (
                  <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No adjustments recorded against this deposit yet.</div>
                ) : (
                  <ScrollTable className="no-sticky-col">
                    <table>
                      <thead><tr><th style={{ width: 40 }}></th><th>Adjustment Code</th><th>Amount</th><th>Currency</th><th>Date</th><th>Receipt</th></tr></thead>
                      <tbody>
                        {adjustmentHistory.map(a => (
                          <tr key={a.adjustmentGuid}>
                            <td>
                              <ActionMenu>
                                <button className="btn btn-neu btn-sm" onClick={() => setBreakdownGuid(a.adjustmentGuid)}>
                                  <i className="lni lni-eye"></i> View
                                </button>
                              </ActionMenu>
                            </td>
                            <td className="font-mono text-blue">{a.adjustmentCode ?? '—'}</td>
                            <td className="text-green font-bold">{fmtAmt(a.adjustedAmount)}</td>
                            <td>{a.currencyName ?? '—'}</td>
                            <td>{formatDate(a.adjustmentDate)}</td>
                            <td className="font-mono">{a.receipt}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollTable>
                )}
              </div>
            )}

            {/* Allocation Preview + Receipt — moved here from their own old
                grid column, now stacked below Step 3 in this same right
                column (tuition only).

                Allocation Preview — commented out (not removed) per request.
                Gated on SHOW_ALLOCATION_PREVIEW (see its declaration
                comment above) rather than an ordinary JSX comment block,
                since this section contains its own nested comment (below)
                and JSX comments don't nest. Re-enable by flipping that
                constant to true; nothing else needs to change — the
                usePayableLedgers() query above is still live, so the data
                is ready the moment this is flipped back on. */}
            {activePayTab === 'tuition' && SHOW_ALLOCATION_PREVIEW && (
            <div className="card" style={{ background: 'linear-gradient(135deg,var(--b50),var(--white))' }}>
                <div className="card-hdr">
                  <div className="card-title"><span className="ctitle-icon"><i className="lni lni-layers"></i></span> Allocation Preview</div>
                  <span className="badge badge-blue">Auto-updated</span>
                </div>
                {!payableLedgersParams ? (
                  <div className="text-center text-g400" style={{ padding: 32 }}>
                    <div className="mb-2" style={{ fontSize: 32 }}><i className="lni lni-layers"></i></div>
                    <div style={{ fontSize: 13 }}>Enter a payment amount, currency, and date to see how funds will be allocated across outstanding ledgers.</div>
                  </div>
                ) : isPreviewLoading ? (
                  <div className="text-center text-g400" style={{ padding: 32, fontSize: 13 }}>Calculating allocation…</div>
                ) : isPreviewError ? (
                  <div className="text-center text-clr-red" style={{ padding: 32, fontSize: 13 }}>
                    <i className="lni lni-warning"></i> {previewError instanceof Error ? previewError.message : "Couldn't calculate the allocation."}
                  </div>
                ) : !payableLedgers || payableLedgers.lines.length === 0 ? (
                  <div className="text-center text-g400" style={{ padding: 32, fontSize: 13 }}>No payable ledger lines for this amount.</div>
                ) : (
                  <div>
                    <ScrollTable className="no-sticky-col">
                      <table>
                        <thead><tr><th>Ledger</th><th>Amount</th><th>Type</th></tr></thead>
                        <tbody>
                          {payableLedgers.lines.map((l, i) => (
                            <tr key={`${l.ledgerGuid ?? 'none'}-${i}`}>
                              <td>{l.ledgerName}</td>
                              <td className="text-green font-bold">{l.currencyName} {l.amount.toLocaleString()}</td>
                              <td>
                                {l.isDiscountLine && <span className="badge badge-green">Discount</span>}
                                {l.isRoundingLine && <span className="badge badge-grey">Rounding</span>}
                                {!l.isDiscountLine && !l.isRoundingLine && <span className="badge badge-blue">Ledger</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollTable>
                    {/* payableLedgers.balance is what's left UNALLOCATED from
                        this payment amount after applying it to the lines
                        above — NOT the student's total outstanding balance
                        (get-payable-ledgers.md). A common misreading: 0 here
                        just means the entered amount was small enough to be
                        fully absorbed by the top of the ledger queue, not
                        that the account is settled. Labeled accordingly so a
                        cashier doesn't read "0" as "fully paid off" — Step 2
                        · Outstanding Balance is the real "what's still owed"
                        view, and it refetches after Save. */}
                    <div className="mt-[10px] p-3 rounded-[var(--rsm)] bg-b50 border border-[1.5px] border-b100 flex justify-between items-center">
                      <span className="text-muted" style={{ fontSize: 12 }}>Unallocated from This Payment{payableLedgers.balance > 0 ? ' (→ advance deposit)' : ''}</span>
                      <span className="font-bold text-blue">{selectedCurrency?.currencyCode ?? ''} {payableLedgers.balance.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {receipt && (
              <div className="card">
                {/* receipt-print-area (globals.css) — window.print() below
                    previously printed the entire page (sidebar, header,
                    Step 1-3 forms, everything), since no print-scoped CSS
                    existed anywhere in this app. Now only this card prints. */}
                <div className="receipt-print-area border border-g200 rounded-xl p-5 bg-g50">
                  <div className="text-center mb-4 pb-3 border-b border-g200">
                    <div className="pc-receipt-check"><i className="lni lni-checkmark-circle"></i></div>
                    <h3 className="font-bold text-g900" style={{ fontSize: 'var(--fs-lg)' }}>ISBAT University</h3>
                    <p className="text-g500" style={{ fontSize: 'var(--fs-xs)' }}>Institute of Skill Development And Training</p>
                    <p className="text-g400" style={{ fontSize: 11 }}><i className="lni lni-map-marker"></i> Kampala, Uganda · erp.isbatuniversity.ac.ug</p>
                    <div className="font-mono font-bold text-blue mt-2" style={{ fontSize: 14 }}>{receipt.ref}</div>
                    <div className="text-g400 uppercase font-bold mt-1" style={{ fontSize: 10, letterSpacing: '.06em' }}>Official Fee Payment Receipt</div>
                  </div>
                  <div className="receipt-row"><span className="text-muted">Student Name</span><span className="font-bold">{receipt.name}</span></div>
                  <div className="receipt-row"><span className="text-muted">App. Ref</span><span className="font-mono text-blue">{receipt.refNo}</span></div>
                  <div className="receipt-row"><span className="text-muted">Programme</span><span>{receipt.prog}</span></div>
                  <div className="receipt-row"><span className="text-muted">Payment Method</span><span>{receipt.method}</span></div>
                  <div className="receipt-row"><span className="text-muted">Date &amp; Time</span><span>{receipt.date}</span></div>
                  <div className="receipt-row"><span className="text-muted">Amount Paid</span><span className="font-bold">{receipt.amount}</span></div>
                  <div className="receipt-row" style={{ background: 'var(--green-bg)', borderRadius: 'var(--rxs)', padding: '6px 2px' }}>
                    <span className="text-muted">Allocated To</span><span className="font-bold text-green">Outstanding ledgers — see allocation above</span>
                  </div>
                  {/* receipt.balance is PaymentResultDto.balance — the
                      amount left UNALLOCATED from this payment, not the
                      student's total outstanding balance (post-payment.md).
                      Was previously labeled "New Outstanding", which reads
                      as "the account is now settled" — wrong whenever the
                      payment was smaller than what's owed, which is the
                      common case. Step 2 · Outstanding Balance (which
                      refetches after Save) is where the real remaining
                      balance is shown. */}
                  <div className="receipt-total"><span>Unallocated Amount</span><span>{receipt.balance}</span></div>
                  <div className="text-g400" style={{ fontSize: 10.5, marginTop: -4 }}>
                    Leftover from this payment only — see Step 2 · Outstanding Balance for the student&apos;s updated total owed.
                  </div>
                  {receipt.advanceMessage && (
                    <div className="mt-2"><div className="info-box"><i className="lni lni-information"></i> {receipt.advanceMessage}</div></div>
                  )}
                  {/* Surfaced as a notice, not an error — per the flow doc,
                      this is the same reregistration warning the 409 would
                      have blocked on; it's informational now that the
                      cashier already confirmed past it via confirmOverride. */}
                  {receipt.reRegistrationWarning && (
                    <div className="mt-2"><div className="info-box"><i className="lni lni-warning"></i> {receipt.reRegistrationWarning}</div></div>
                  )}
                  <div className="text-center text-g400 mt-3 pt-3 border-t border-dashed border-g300" style={{ fontSize: 10 }}>
                    Received by: Finance Office · ISBAT University<br />
                    System-generated receipt. Unique code: <span className="font-mono">{receipt.code}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 flex-wrap no-print">
                  {/* Opens the official server-rendered receipt PDF (step 8)
                      instead of printing this on-screen summary card. */}
                  <button className="btn btn-neu flex-1 justify-center" disabled={printingGuid === receipt.paymentGuid} onClick={() => printReceipt(receipt.paymentGuid, receipt.ref)}>
                    <i className="lni lni-printer"></i> {printingGuid === receipt.paymentGuid ? 'Loading receipt…' : 'Print Receipt'}
                  </button>
                  {studentGuid && (
                    <button className="btn btn-neu flex-1 justify-center" onClick={openStudentStatement}>
                      <i className="lni lni-files"></i> Student Statement
                    </button>
                  )}
                  <button className="btn btn-primary flex-1 justify-center" onClick={handleClear}>← New Payment</button>
                </div>
              </div>
            )}
          </div>
        </>
        )}
      </div>
      {successModal && (
        <PaymentSuccessModal
          isOpen
          onClose={() => setSuccessModal(null)}
          showToast={showToast}
          title={successModal.title}
          rows={successModal.rows}
          notices={successModal.notices}
          secondaryAction={studentGuid ? { label: 'View Student Statement', icon: 'lni-files', onClick: openStudentStatement } : undefined}
        />
      )}
      <ViewPaymentModal isOpen={!!viewEntry} onClose={() => setViewEntry(null)} showToast={showToast} entry={viewEntry} />
      <EditPaymentModal isOpen={!!editTarget} onClose={() => setEditTarget(null)} showToast={showToast} target={editTarget} applicationGuid={selectedApplicationGuid ?? undefined} />
      <EditPaymentOtherModal isOpen={!!editOtherTarget} onClose={() => setEditOtherTarget(null)} showToast={showToast} target={editOtherTarget} />
      <UpcomingSemestersModal
        isOpen={showUpcomingSemesters}
        onClose={() => setShowUpcomingSemesters(false)}
        showToast={showToast}
        upcomingSemesters={currentSemesterPayable?.upcomingSemesters ?? []}
        totalProgramOutstanding={totalProgramOutstanding}
      />

      {/* Ledger breakdown for one Payment Adjustment History row
          (get-adjustment-ledger-breakdown.md) — what the applied money
          actually settled, ledger by ledger. Moved from the standalone
          Payment Console Adjustments page as-is. */}
      {breakdownGuid && (
        <div className="modal-overlay open">
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr modal-hdr-blue">
              <div className="modal-title"><i className="lni lni-list"></i> Adjustment Ledger Breakdown</div>
              <button className="modal-close" onClick={() => setBreakdownGuid(null)}><i className="lni lni-close"></i></button>
            </div>
            {isAdjBreakdownLoading ? (
              <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading breakdown…</div>
            ) : isAdjBreakdownError ? (
              <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load this adjustment&apos;s breakdown.</div>
            ) : adjBreakdown.length === 0 ? (
              <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No ledger lines found for this adjustment.</div>
            ) : (
              <ScrollTable className="no-sticky-col">
                <table>
                  <thead><tr><th>Ledger</th><th>Semester</th><th>Amount</th><th>Currency</th></tr></thead>
                  <tbody>
                    {adjBreakdown.map((l, i) => (
                      <tr key={`${l.ledgerGuid}-${i}`}>
                        <td>
                          {l.isDiscountLine ? `${l.ledgerName} (Discount${l.discountName ? `: ${l.discountName}` : ''})` : l.isRoundingLine ? `${l.ledgerName} (Round-off)` : l.ledgerName}
                        </td>
                        <td>{l.semName ?? '—'}</td>
                        <td className={l.isDiscountLine ? 'text-red font-bold' : 'font-bold'}>{fmtAmt(l.amount)}</td>
                        <td>{l.currencyName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollTable>
            )}
            <div className="modal-footer">
              <button className="btn btn-neu" onClick={() => setBreakdownGuid(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <TodayExchangeRateModal
        isOpen={rateModal.open}
        onClose={() => setRateModal({ open: false })}
        currencies={rateCurrencies}
        initialCurrencyGuid={rateModal.currencyGuid}
        baseCode={baseCurrency?.currencyCode ?? 'UGX'}
        date={todayYmd()}
        onSaved={(code, rate) => { setRateModal({ open: false }); showToast(`Today's ${code} rate saved: 1 ${code} = ${rate} ${baseCurrency?.currencyCode ?? 'UGX'}.`, 'success') }}
      />
      <Toast toast={toast} />
    </>
  )
}