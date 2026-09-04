'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import { Pagination } from '@/components/Pagination'
import { PaymentSuccessModal } from '@/components/modals/finance/PaymentSuccessModal'
import { AdvanceDepositPickerModal } from '@/components/modals/finance/AdvanceDepositPickerModal'
import DatePicker from '@/components/DatePicker'
import { SearchSelect } from '@/components/SearchSelect'
import { useProcBanks } from '@/hooks/finance/useProcBanks'
import { useReceiptBooks } from '@/hooks/finance/useReceiptBooks'
import { useFinanceCurrencies } from '@/hooks/finance/useFinanceCurrencies'
import { useExchangeRatesByDate, useCreateExchangeRate, useUpdateExchangeRate } from '@/hooks/finance/useExchangeRates'
import { PaymentAdvance } from '@/hooks/finance/usePayments'
import { useCampuses } from '@/hooks/config/useCampuses'
import { useProgramMasters } from '@/hooks/academic/useProgramMaster'
import { useBatches } from '@/hooks/academic/useBatches'
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
} from '@/hooks/finance/usePaymentConsole'
import { formatDateTime } from '@/lib/date'
import { AuthError } from '@/lib/api/client'

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

// Currency conversion for Outstanding Balance's Scheduled Bill/Outstanding
// figures (per request, 2026-09-04) — exRate (exchange-rates/get-exchange-
// rate-by-guid.md, confirmed via the Exchange Rates page's own "{currency}
// per 1 {base}" label) is "this currency's units per 1 unit of the base
// currency" (Currency Master's isDefault=1 row), never a direct rate
// between two arbitrary currencies. Converting A→B always routes through
// the base: amountInBase = amount / rateA, amountInB = amountInBase * rateB.
// The base currency itself has an implicit rate of 1 against itself — it
// has no row in the exchange-rates board at all. Returns null (not a
// fallback guess) when either currency's rate can't be resolved — a ledger
// with no currencyGuid, or a currency with no rate on file for today — so
// callers can show "no rate available" instead of silently wrong math.
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
  if (fromRate == null || toRate == null) return null
  return (amount / fromRate) * toRate
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
  ref: string; code: string; name: string; refNo: string; prog: string; method: string
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
// already shows this application's Other-category payments (it isn't
// filtered to Tuition the way tuitionPaymentHistory narrows the tuition
// tab), making this second list redundant.
const SHOW_OTHER_PAID_FEE_DETAILS: boolean = false

// Payment History (left column) is fetched whole per application — not
// server-paginated (usePaymentHistory takes no page/pageSize) — so this
// pages it client-side instead, same Pagination component the rest of the
// app's server-paginated lists use.
const HISTORY_PAGE_SIZE = 10

export default function PaymentConsolePage() {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

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
  // now wired for real (2026-09-01) via AdvanceDepositPickerModal +
  // get-payment-advances.md's list endpoint (already backing the Advanced
  // Payments console page, usePaymentAdvances). Checking the box opens the
  // picker instead of flipping the flag directly; otherIsAdvance/
  // selectedAdvance are only set once a deposit is actually confirmed there
  // (see toggleAdvancePayment/confirmAdvanceSelection below), and unchecking
  // clears both. No separate "Advance Payment Date" field any more — the
  // picker's own Deposit Date column already shows when the selected
  // deposit was originally paid in; otherPayDate is the one date that
  // actually reaches CreatePaymentOther (when this draw-down happens).
  const [otherPayments, setOtherPayments] = useState<{ id: string; code: string; receiptNo: string | null; payDate: string; ledgerName: string; amount: string; currencyCode: string }[]>([])
  const [otherLedger, setOtherLedger] = useState('')
  const [otherPayDate, setOtherPayDate] = useState(todayYmd)
  const [otherIsAdvance, setOtherIsAdvance] = useState(false)
  const [selectedAdvance, setSelectedAdvance] = useState<PaymentAdvance | null>(null)
  const [showAdvancePicker, setShowAdvancePicker] = useState(false)
  const [otherPayType, setOtherPayType] = useState('1')
  // Narrowed to only the category CreatePaymentOther will accept for the
  // currently-selected Payment Type — same reasoning as Tuition's own
  // receiptBooks derivation above.
  const otherReceiptBooks = activeReceiptBooks.filter(r => r.category === PAY_TYPE_TO_RECEIPT_CATEGORY[Number(otherPayType)])
  const [otherReceiptBookGuid, setOtherReceiptBookGuid] = useState('')
  const [otherProcBankGuid, setOtherProcBankGuid] = useState('')
  const [otherAmount, setOtherAmount] = useState('')
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

  const [receipt, setReceipt] = useState<ReceiptData | null>(null)

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
  // unnoticed as "this student doesn't exist". The 2-char floor below is
  // this page's own client-side guard, not a backend rule any more —
  // PaymentConsoleStudentSearch.bru documents no validator on this endpoint
  // (a single-char term is accepted), unlike the older Finance-proxy route
  // this used to call. Kept anyway so a request isn't fired on every
  // keystroke while the user is still mid-word. An
  // empty committedSearch is allowed too, but only once the box has focus
  // (searchFocused) — that's the "list everything" case for clicking into
  // an empty box, not something to fetch on mount before the user has
  // interacted with the field at all.
  const searchTermLen = committedSearch.trim().length
  // Infinite-scroll variant (same mechanism as the student module's own
  // student-master search dropdown, useStudentSearchAdvancedInfinite) —
  // scrolling the results list near its bottom below fetches the next page
  // instead of this dropdown being capped at a single fixed page of 20.
  const {
    data: searchPages, fetchNextPage, hasNextPage, isFetchingNextPage,
    isFetching: isSearching, isError: isSearchError, error: searchError,
  } = useSearchStudentsInfinite(
    committedSearch, 20,
    searchFocused && (searchTermLen === 0 || searchTermLen >= 2),
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
  // Discount-aware replacement for the old useOutstandingLedgers — same
  // current-semester scoping, but each ledger also carries its applicable
  // discount (discountName/discountAmount/netPayable), which
  // outstanding-ledgers has no fields for at all (see
  // get-current-semester-payable-ledgers.md). `ledgers` here is already
  // scoped to "this semester" server-side, so there's no client-side
  // semester-grouping/picking step left to do the way the old
  // ledgerGroups/currentSemesterGroup had to.
  const { data: currentSemesterPayable, isLoading: isLedgersLoading } = useCurrentSemesterPayable(selectedApplicationGuid, !!selectedApplicationGuid, studentGuid)
  const ledgers = currentSemesterPayable ?? []
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
  // Outstanding Balance shows one currency's table at a time behind a
  // dropdown now, per request (2026-09-04) — two stacked tables for a
  // student billed in more than one currency read as confusing rather than
  // informative. Options come straight from `currencies` (the finance-
  // currencies master list, GET /finance/currencies) — the same source and
  // the same full unfiltered list "Currency Received" below already uses —
  // rather than a hardcoded KES/USD/UGX subset (dropped per a follow-up
  // request, 2026-09-04): filtering by code silently produced a near-empty
  // picker whenever a currency wasn't actually configured in that master
  // list under the expected code, which is exactly what happened here.
  const [selectedOutstandingCurrency, setSelectedOutstandingCurrency] = useState<string | null>(null)
  useEffect(() => {
    if (currencies.length === 0) { setSelectedOutstandingCurrency(null); return }
    if (selectedOutstandingCurrency && currencies.some(c => c.currencyGuid === selectedOutstandingCurrency)) return
    // Defaults to whichever currency the student's own ledgers are actually
    // billed in, when that's one of the configured ones — falls back to
    // the first configured currency otherwise. Only runs when the current
    // selection is missing/no longer valid, so it doesn't fight a
    // cashier's own pick once one's been made.
    const preferred = ledgerTotals.find(t => currencies.some(c => c.currencyGuid === t.currencyGuid))
    setSelectedOutstandingCurrency(preferred?.currencyGuid ?? currencies[0].currencyGuid)
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
  const { data: todayRates = [] } = useExchangeRatesByDate(todayYmd())
  // Today's Exchange Rates bar (header toggle) — wired to the real
  // POST/PUT exchange-rate endpoints now (per request, 2026-09-04), same
  // create-if-missing/update-if-present pattern the dedicated Exchange
  // Rate Management page (exchange-rates/page.tsx) already uses, just
  // narrowed to USD/KES since that's all this compact bar has room for.
  // Reseeded from todayRates whenever it changes (including right after a
  // save invalidates and refetches it), so the inputs reflect what's
  // actually saved rather than a stale typed value.
  const usdCurrency = currencies.find(c => c.currencyCode === 'USD')
  const kesCurrency = currencies.find(c => c.currencyCode === 'KES')
  const todayRateByCurrency = new Map(todayRates.map(r => [r.currencyGuid, r]))
  const [rateBarInputs, setRateBarInputs] = useState<Record<string, string>>({})
  useEffect(() => {
    const map: Record<string, string> = {}
    todayRates.forEach(r => { map[r.currencyGuid] = String(r.exRate) })
    setRateBarInputs(map)
  }, [todayRates])
  const createExchangeRate = useCreateExchangeRate()
  const updateExchangeRate = useUpdateExchangeRate()
  const isSavingRates = createExchangeRate.isPending || updateExchangeRate.isPending

  async function saveExchangeRateBar() {
    const targets = [usdCurrency, kesCurrency].filter((c): c is NonNullable<typeof c> => !!c)
    if (targets.length === 0) { showToast('USD/KES aren’t configured in Currency Master.', 'warn'); return }
    let successCount = 0
    const failures: string[] = []
    for (const c of targets) {
      const raw = rateBarInputs[c.currencyGuid] ?? ''
      const num = parseFloat(raw)
      if (!raw || !(num > 0)) { failures.push(`${c.currencyCode}: enter a valid rate`); continue }
      const existing = todayRateByCurrency.get(c.currencyGuid)
      try {
        if (existing) await updateExchangeRate.mutateAsync({ guid: existing.exchangeRateGuid, input: { exRate: num, exDate: todayYmd() } })
        else await createExchangeRate.mutateAsync({ currencyGuid: c.currencyGuid, exRate: num, exDate: todayYmd() })
        successCount++
      } catch (err) {
        failures.push(`${c.currencyCode}: ${err instanceof Error ? err.message : 'failed'}`)
      }
    }
    if (failures.length === 0) showToast(`Saved today’s rate for ${successCount} currenc${successCount === 1 ? 'y' : 'ies'}.`, 'success')
    else showToast(`Saved ${successCount}; ${failures.join('; ')}`, successCount > 0 ? 'warn' : 'error')
  }

  const baseCurrency = currencies.find(c => c.isDefault === 1)
  const ratesByGuid = new Map(todayRates.map(r => [r.currencyGuid, r.exRate]))
  const targetOutstandingCurrency = currencies.find(c => c.currencyGuid === selectedOutstandingCurrency)
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
  // Fetched as soon as a student is selected — Payment History is now its
  // own inline card in the left column (below Profile Details), not a
  // modal opened on demand, so there's no toggle left to gate this on.
  const { data: paymentHistory = [], isLoading: isHistoryLoading, isError: isHistoryError } = usePaymentHistory(selectedApplicationGuid, !!selectedApplicationGuid)
  // The left-column Payment History card only shows Tuition (category 1)
  // rows while the Semester Payment tab is active — Other Payment already
  // gets its own "Paid Fee Details" history table scoped to category 2 in
  // the right column, so this one narrows instead of duplicating it.
  const tuitionPaymentHistory = useMemo(
    () => activePayTab === 'tuition' ? paymentHistory.filter(h => h.category === 1) : paymentHistory,
    [paymentHistory, activePayTab]
  )
  const [historyPage, setHistoryPage] = useState(1)
  // Reset to page 1 whenever the underlying list changes shape — a new
  // student, or switching tabs narrows/widens which categories are shown —
  // so the view doesn't get stranded on a now out-of-range page.
  useEffect(() => setHistoryPage(1), [selectedApplicationGuid, activePayTab])
  const historyTotalPages = Math.max(1, Math.ceil(tuitionPaymentHistory.length / HISTORY_PAGE_SIZE))
  const pagedPaymentHistory = tuitionPaymentHistory.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE)

  // Client-side name resolution for the profile's guid FKs — same fallback
  // pattern used throughout the app (faculty.ts's deanName, enquiry-list's
  // resolveProgramName), but only as a fallback now: a real live
  // student-profile response confirms the server pre-resolves these names
  // itself (programName, levelName, batchCode, semesterName, feeCode) —
  // prefer those and only fall back to the client-side lookup when the
  // server sends null, which it does for some of these on some
  // applications (programName/batchCode/semesterName were null on an
  // otherwise fully-resolved sample).
  const { data: campuses = [] } = useCampuses()
  const { data: programs = [] } = useProgramMasters()
  const { data: allBatchesData } = useBatches(1, 1000)
  const batches = allBatchesData?.items ?? []
  const { data: semesters = [] } = useSemestersForProgram(profile?.programGuid ?? '', !!profile?.programGuid)

  // campusName has no server-resolved counterpart on the DTO — always
  // client-resolved.
  const campusName = campuses.find(c => c.campusGuid === profile?.campusGuid)?.campusName
  const programName = profile?.programName ?? programs.find(p => p.programGuid === profile?.programGuid)?.programName
  const batchCode = profile?.batchCode ?? batches.find(b => b.batchGuid === profile?.batchGuid)?.batchCode
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

  function handleSearchClick() {
    const term = search.trim()
    if (!term) { showToast('Please enter a student number or name.', 'warn'); return }
    if (term.length < 2) { showToast('Search term must be at least 2 characters.', 'warn'); return }
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
  }

  function resetOtherForm() {
    setOtherLedger('')
    setOtherPayDate(todayYmd())
    setOtherIsAdvance(false)
    setSelectedAdvance(null)
    setOtherPayType('1')
    setOtherReceiptBookGuid('')
    setOtherProcBankGuid('')
    setOtherAmount('')
    setOtherCurrencyGuid('')
    setOtherRemarks('')
  }

  // Checking the box opens the picker instead of flipping otherIsAdvance
  // straight away — it only actually turns on once a deposit is confirmed
  // there (confirmAdvanceSelection below). Unchecking clears both right
  // away, no picker involved.
  function toggleAdvancePayment(checked: boolean) {
    if (checked) setShowAdvancePicker(true)
    else { setOtherIsAdvance(false); setSelectedAdvance(null) }
  }

  function confirmAdvanceSelection(advance: PaymentAdvance) {
    setSelectedAdvance(advance)
    setOtherIsAdvance(true)
    setShowAdvancePicker(false)
    // Prefilled from the deposit, both still editable: Currency should
    // normally stay as-is (CreatePaymentOther draws down in the deposit's
    // own currency), Amount defaults to the full undrawn balance but a
    // cashier may want a partial draw-down instead.
    if (advance.currency) setOtherCurrencyGuid(advance.currency.currencyGuid)
    setOtherAmount(String(advance.balance))
  }

  // No edit/delete here, unlike Tuition's receipt — the legacy Other
  // Payment reference screen's own "Paid Fee Details" table has no edit/
  // delete affordance, so this stays a flat append-only log to match; each
  // successful submit appends the real result (post-payment-other.md) to it.
  function otherSaveEntry() {
    if (!profile || !selectedApplicationGuid) { showToast('Please select a student first.', 'warn'); return }
    if (!otherLedger) { showToast('Please select a ledger.', 'warn'); return }
    const amt = parseFloat(otherAmount)
    if (!otherAmount.trim() || isNaN(amt) || amt <= 0) { showToast('Amount must be greater than 0.', 'warn'); return }
    if (!otherCurrencyGuid) { showToast('Please select a currency.', 'warn'); return }
    if (!otherPayDate) { showToast('Please select a payment date.', 'warn'); return }
    const payTypeNum = Number(otherPayType)
    const showOtherBankFields = payTypeNum > 1

    // Advance mode: draw down against the selected deposit's own
    // paymentAdvanceGuid instead of claiming a new receipt — no receipt
    // book/bank needed (the money was already receipted when the advance
    // was deposited), same reasoning PaymentOtherInput's own comment gives.
    if (otherIsAdvance) {
      if (!selectedAdvance) { showToast('Please select an advance deposit to draw from.', 'warn'); return }
      if (amt > selectedAdvance.balance) { showToast(`Amount exceeds this deposit's remaining balance (${selectedAdvance.balance.toLocaleString()}).`, 'warn'); return }
    } else {
      if (!otherReceiptBookGuid) { showToast('Please select a receipt book.', 'warn'); return }
      if (showOtherBankFields && !otherProcBankGuid) { showToast('Please select a bank.', 'warn'); return }
    }

    const currencyCode = currencies.find(c => c.currencyGuid === otherCurrencyGuid)?.currencyCode ?? ''
    const ledgerName = ledgerOthers.find(l => l.ledgerOthersGuid === otherLedger)?.ledgerName ?? '—'

    createPaymentOther.mutate(
      {
        applicationGuid: selectedApplicationGuid,
        studentGuid,
        ledgerOthersGuid: otherLedger,
        amount: amt,
        currencyGuid: otherCurrencyGuid,
        payDate: otherPayDate,
        payType: payTypeNum,
        remarks: otherRemarks.trim() || null,
        receiptBookGuid: otherIsAdvance ? null : otherReceiptBookGuid,
        procBankGuid: otherIsAdvance ? null : (showOtherBankFields ? otherProcBankGuid : null),
        paymentAdvanceGuid: otherIsAdvance ? selectedAdvance?.paymentAdvanceGuid ?? null : null,
      },
      {
        onSuccess: result => {
          setOtherPayments(prev => [...prev, {
            id: result.paymentOtherGuid,
            code: result.paymentCode,
            receiptNo: result.receipt,
            payDate: otherPayDate, ledgerName, amount: String(result.amount), currencyCode,
          }])
          setSuccessModal({
            title: 'Other Payment Recorded',
            rows: [
              ['Ledger', ledgerName],
              ['Receipt', result.receipt ?? '—'],
              ['Amount', `${result.amount.toLocaleString()} ${currencyCode}`],
            ],
          })
          resetOtherForm()
        },
        onError: (error: Error) => showToast(error.message || 'Failed to save other payment. Please try again.', 'error'),
      },
    )
  }

  function selectStudent(applicationGuid: string, name: string, studentGuidHint: string | null) {
    setSelectedApplicationGuid(applicationGuid)
    setSelectedStudentGuidHint(studentGuidHint)
    setSearch(name)
    setCommittedSearch('')
    setSearchFocused(false)
    setActivePayTab('tuition')
    resetPaymentForm()
    setOtherPayments([])
    resetOtherForm()
    setSuccessModal(null)
    showToast(`Loaded: ${name}`, 'success')
  }

  const showBankFields = Number(payType) > 1

  function handleSave(confirmOverride = false) {
    if (!profile || !selectedApplicationGuid) { showToast('Please select a student first.', 'warn'); return }
    // 0 is a legal amount here — unlike every other create in this module,
    // per the flow doc: "tuition create-payment accepts amount: 0 — it
    // books a pure-discount settlement that moves no cash. Do not block it
    // client-side." Only reject a blank field or a genuinely negative
    // number; parseFloat('') || 0 would otherwise silently treat a blank
    // field as an intentional 0, so the emptiness check comes first.
    if (!amount.trim()) { showToast('Please enter an amount.', 'warn'); return }
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt < 0) { showToast('Amount must be zero or greater.', 'warn'); return }
    if (!selectedCurrency) { showToast('Please select a payment currency.', 'warn'); return }
    if (!receiptBookGuid) { showToast('Please select a receipt book.', 'warn'); return }
    if (!payDate) { showToast('Please select a payment date.', 'warn'); return }
    const payTypeNum = Number(payType)
    if (showBankFields && !procBankGuid) { showToast('Please select a bank.', 'warn'); return }

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
          showToast(error.message || 'Failed to save payment. Please try again.', 'error')
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
            </button>
            <button className="btn btn-neu" onClick={() => router.push('/finance/dashboard')}><i className="lni lni-arrow-left"></i> Back</button>
          </div>
        </div>

        {showExchangeRates && (
          <div className="card flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-[7px] font-bold text-g700" style={{ fontSize: 'var(--fs-sm)' }}>
              <i className="lni lni-money-protection"></i> Today&apos;s Exchange Rates
              <span className="badge badge-blue text-[10px]">Daily Rate</span>
            </div>
            {/* Wired to the real POST/PUT exchange-rate endpoints (per
                request, 2026-09-04) — saveExchangeRateBar above creates a
                fresh rate for today if none exists yet, or updates the
                existing one (only today's row is PUT-able per
                put-exchange-rate.md). Disabled + placeholder when USD/KES
                aren't in Currency Master at all, rather than accepting
                input that has nowhere real to save to. */}
            <div className="flex items-center gap-[6px] flex-wrap text-[var(--fs-sm)]">
              <span className="text-muted">1 USD =</span>
              <input
                type="number"
                className="ctrl"
                disabled={!usdCurrency}
                placeholder={usdCurrency ? '' : 'Not configured'}
                value={usdCurrency ? (rateBarInputs[usdCurrency.currencyGuid] ?? '') : ''}
                onChange={e => usdCurrency && setRateBarInputs(prev => ({ ...prev, [usdCurrency.currencyGuid]: e.target.value }))}
                style={{ width: 72, padding: '5px 9px', fontSize: 13, fontWeight: 700, color: 'var(--b800)' }}
              />
              <span className="badge badge-gold">UGX</span>
            </div>
            <div className="flex items-center gap-[6px] flex-wrap text-[var(--fs-sm)]">
              <span className="text-muted">1 KES =</span>
              <input
                type="number"
                className="ctrl"
                disabled={!kesCurrency}
                placeholder={kesCurrency ? '' : 'Not configured'}
                value={kesCurrency ? (rateBarInputs[kesCurrency.currencyGuid] ?? '') : ''}
                onChange={e => kesCurrency && setRateBarInputs(prev => ({ ...prev, [kesCurrency.currencyGuid]: e.target.value }))}
                style={{ width: 72, padding: '5px 9px', fontSize: 13, fontWeight: 700, color: 'var(--b800)' }}
              />
              <span className="badge badge-gold">UGX</span>
            </div>
            <div className="flex items-center gap-[7px] flex-wrap" style={{ marginLeft: 'auto' }}>
              <button className="btn btn-neu btn-sm" style={{ fontSize: 11 }} disabled={isSavingRates} onClick={saveExchangeRateBar}>
                <i className="lni lni-save"></i> {isSavingRates ? 'Saving…' : 'Save Rates'}
              </button>
            </div>
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

          <div className="pc-body">
            {/* LEFT column: Profile Details + Payment History, both inline
                per the redesign — Profile Details moved out of its old
                full-width bar above; Payment History moved out of the
                modal it was in before this redesign. */}
            <div className="flex flex-col gap-5 min-w-0">
              {profile && (
                <div className="card p-0 overflow-hidden">
                  {/* Hero header, gradient-on-brand — replaces the old
                      plain card-hdr + avatar row so the Profile Details
                      block reads as a summary banner rather than a form,
                      matching the reference layouts' glossy header treatment. */}
                  <div className="pc-hero">
                    <div className="pc-hero-top">
                      <div className="pc-hero-avatar">{initialsFor(applicantName(profile))}</div>
                      <div className="flex-1 min-w-0">
                        <div className="pc-hero-name truncate">{applicantName(profile)}</div>
                        <div className="pc-hero-sub truncate">{programName ?? '—'}</div>
                        <span className="pc-hero-badge"><i className="lni lni-bookmark"></i> {profile.appRefNo}</span>
                      </div>
                    </div>
                    <div className="pc-hero-facts">
                      {/* title on each value gives the full text as a native
                          hover tooltip when it's long enough to be
                          ellipsis-truncated by pc-hero-fact-val, without
                          letting a long value wrap and break the grid's row
                          alignment (confirmed live: wrapping "ISBAT
                          University - Main Campus" etc. staggered every row
                          after it out of alignment). */}
                      <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Campus</span><span className="pc-hero-fact-val" title={campusName ?? '—'}>{campusName ?? '—'}</span></div>
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
                      {/* Full row to itself (pc-hero-fact-span2) — an email
                          is typically longer than every other fact here, so
                          pairing it with a short one would risk the same
                          uneven-row-height issue the Campus/Semester
                          pairing above was built to avoid. Was previously
                          its own plain div sitting below the hero box
                          entirely, formatted differently from every other
                          fact — moved in and reformatted to match. */}
                      <div className="pc-hero-fact pc-hero-fact-span2">
                        <span className="pc-hero-fact-lbl">Email</span>
                        <span className="pc-hero-fact-val truncate" title={profile.emailId ?? profile.universityEmail ?? '—'}>{profile.emailId ?? profile.universityEmail ?? '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment History — merged into this same card as a
                      second section (per request) instead of its own
                      separate card below, matching the "Payment Detail"
                      sec-divider convention the right column's own cards
                      already use rather than a second card-hdr. */}
                  <div className="px-5 pb-5">
                  <div className="sec-divider"><i className="lni lni-folder"></i> Payment History</div>
                  {isHistoryLoading ? (
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
                        <thead><tr><th>Date</th><th>Category</th><th>Amount</th><th>Cur.</th><th>Method</th></tr></thead>
                        <tbody>
                          {pagedPaymentHistory.map(h => (
                            <tr key={h.paymentGuid}>
                              <td>{h.payDate.slice(0, 10)}</td>
                              <td>{PAYMENT_CATEGORY_LABELS[h.category] ?? `Category ${h.category}`}</td>
                              <td className="text-green font-bold">{h.amount.toLocaleString()}</td>
                              <td>{h.currencyName ?? '—'}</td>
                              <td><span className="pill pill-blue">{h.payType?.name ?? '—'}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollTable>
                    <Pagination page={historyPage} totalPages={historyTotalPages} totalCount={tuitionPaymentHistory.length} itemLabel="payments" onPageChange={setHistoryPage} />
                    </>
                  )}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT column: the active category's outstanding balance,
                payment form, and (Tuition only) the receipt/allocation. */}
            <div className="flex flex-col gap-5 min-w-0">

            {/* Other Payment tab — laid out to match Tuition's merged card
                exactly (header + toggle, ledger rows, "Payment Detail"
                divider, paired field grid, Clear/Add buttons), swapping in
                Other Payment's own fields where they differ. Outstanding
                balance is real (GET .../outstanding-all, filtered to
                category 2); the payment-entry form and its payment log
                stay a UI-first mock laid out after the legacy ISMS
                reference screen (frmTrnPaymentOther.aspx) — a ledger
                picker, an Advance Payment toggle, bank-account gating
                matching Tuition's own bank fields, and a flat, append-only
                payment log (no edit/delete, per the reference screen's own
                "Paid Fee Details" table) — no documented single-category
                Other-payment submit endpoint exists yet, so nothing here
                calls a real API. NCHE and Guild are dropped from this page
                entirely — they'll get their own pages later. */}
            {activePayTab === 'other' && (
              <div className="card">
                <div className="card-hdr">
                  <div className="card-title"><span className="ctitle-icon"><i className="lni lni-wallet"></i></span> Other Payment</div>
                </div>

                <OutstandingCategoryTable items={otherOutstanding} isLoading={isAllOutstandingLoading} isError={isAllOutstandingError} />

                <div className="sec-divider">Payment Detail</div>

                {/* Ledger moved to the top of the form, ahead of the
                    Currency/Amount pair — picking the ledger first is the
                    natural order for Other Payment (its outstanding-items
                    list is keyed by ledger). Real catalogue now
                    (get-ledger-others.md) — value is the ledgerOthersGuid
                    CreatePaymentOther needs, not a display label. */}
                <div className="fg mb-[14px]">
                  <div className="lbl">Ledger <span className="req">*</span></div>
                  <SearchSelect
                    placeholder="— Select Ledger —"
                    options={ledgerOthers.map(l => ({ value: l.ledgerOthersGuid, label: l.ledgerName }))}
                    value={otherLedger}
                    onChange={setOtherLedger}
                  />
                </div>

                {/* Advance Payment — no Tuition equivalent, Other-specific.
                    Moved directly below the Ledger field per request, ahead
                    of Currency/Amount, rather than down by Receipt Book/Bank.
                    Checking it opens AdvanceDepositPickerModal rather than
                    flipping otherIsAdvance straight away — see
                    toggleAdvancePayment/confirmAdvanceSelection's own
                    comments. Always shown now (per request, 2026-09-02) —
                    the hasAdvanceDeposits gate that used to hide this
                    entirely when the student had no deposits on record is
                    gone; the picker itself already has its own empty state
                    for that case. */}
                <div className="fg mb-[14px]">
                  <label className="flex items-center gap-2" style={{ fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={otherIsAdvance} onChange={e => toggleAdvancePayment(e.target.checked)} />
                    Advance Payment
                  </label>
                  {otherIsAdvance && selectedAdvance && (
                    <div className="flex items-center justify-between gap-2 mt-2 p-2.5 rounded-[var(--rsm)] bg-b50 border border-[1.5px] border-b100">
                      <div style={{ fontSize: 12 }}>
                        Drawing from <span className="font-mono text-blue font-bold">{selectedAdvance.advPaymentCode}</span>
                        <span className="text-g500"> · Balance {selectedAdvance.balance.toLocaleString()} {selectedAdvance.currency?.currencyCode ?? ''}</span>
                      </div>
                      <button type="button" className="btn btn-neu btn-sm" onClick={() => setShowAdvancePicker(true)}>Change</button>
                    </div>
                  )}
                </div>

                {/* Live summary strip — same treatment as Tuition's own,
                    purely derived from this form's state. */}
                {otherAmount.trim() && (
                  <div className="pc-pay-summary">
                    <div>
                      <div className="pc-pay-lbl">Amount to Collect</div>
                      <div className="pc-pay-amt">{currencies.find(c => c.currencyGuid === otherCurrencyGuid)?.currencyCode ?? ''} {(parseFloat(otherAmount) || 0).toLocaleString()}</div>
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
                    <div className="lbl">Currency <span className="req">*</span></div>
                    <SearchSelect
                      placeholder="— Select Currency —"
                      options={currencies.map(c => ({ value: c.currencyGuid, label: `${c.currencyCode} — ${c.currencyName}` }))}
                      value={otherCurrencyGuid}
                      onChange={setOtherCurrencyGuid}
                    />
                  </div>
                  <div className="fg">
                    <div className="lbl">Amount <span className="req">*</span></div>
                    <input type="number" min={0} step={0.01} className="amt-val-input" placeholder="0.00"
                      style={{ fontSize: 18, fontWeight: 700 }}
                      value={otherAmount} onChange={e => setOtherAmount(e.target.value)} />
                  </div>
                </div>
                {/* Payment Date + Payment Type paired — same pairing as
                    Tuition's own Date/Method row. */}
                <div className="g2 mb-[14px]">
                  <div className="fg">
                    <div className="lbl">Payment Date <span className="req">*</span></div>
                    <DatePicker value={otherPayDate} onChange={setOtherPayDate} />
                  </div>
                  <div className="fg">
                    <div className="lbl">Payment Type <span className="req">*</span></div>
                    <SearchSelect
                      options={Object.entries(PAY_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                      value={otherPayType}
                      onChange={val => { setOtherPayType(val); setOtherReceiptBookGuid('') }}
                    />
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
                  <button className="btn btn-primary btn-lg" disabled={createPaymentOther.isPending} onClick={otherSaveEntry}>
                    <i className="lni lni-save"></i> {createPaymentOther.isPending ? 'Saving…' : 'Add Payment'}
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
            )}

            {/* Outstanding Balance + Record Payment — a single card, not
                two: the reference "Completing Registration" panel has no
                separate section boundary between the fee/ledger rows and
                the payment fields, just a plain divider ("Payment Detail"
                below), so this merges what used to be Step 2 and Step 3
                into one card (tuition only). */}
            {activePayTab === 'tuition' && (
              <div className="card">
                {/* "Outstanding Balance" card-hdr label removed per request
                    (2026-09-04) — the table below already makes clear
                    what's being shown. */}
                {
                  isLedgersLoading ? (
                    <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading ledgers…</div>
                  ) : ledgers.length === 0 ? (
                    // No separate "nothing outstanding" line here — the
                    // fully-settled checkmark block below (after the
                    // Payment Detail divider) already says this; showing
                    // both back to back just repeated the same message twice.
                    null
                  ) : (
                    <>
                      {/* Column-aligned per request (2026-09-04, invoice
                          reference) — Ledger/Scheduled Amt/Scheduled Bill/
                          Paid/Outstanding columns as .recgrid CSS-Grid rows
                          (see globals.css) instead of a <table>. Scheduled
                          Amt and Scheduled Bill both read from ledgerAmount —
                          the backend has no second figure distinguishing
                          them, they're the same value shown twice. Discount/
                          Total stay below as their own bold footer rows
                          (Discount/Total aren't "a ledger", so they don't
                          belong as grid rows the column headers describe).
                          The dropdown now converts every ledger (regardless
                          of its own original currency) into whichever
                          currency is picked — one merged list, not one table
                          per currency-group — per a follow-up request;
                          convertAmount/convertedLedgers above do the actual
                          exchange-rate math. */}
                      {/* ledgerTotals.length > 1 gate commented out per
                          request (2026-09-05) — this was a frontend-only
                          judgment call ("nothing to convert with one
                          currency"), not anything the backend dictates, so
                          the picker now always shows even for a single-
                          currency student. Options come from `currencies`
                          — the same finance-currencies master list (and the
                          same full, unfiltered list) "Currency Received"
                          below already uses — not a hardcoded KES/USD/UGX
                          subset (dropped per a follow-up request,
                          2026-09-04): that filter silently produced a
                          near-empty picker whenever a currency wasn't
                          actually configured in the master list under the
                          expected code. */}
                      <div className="fg" style={{ maxWidth: 220 }}>
                        <label className="lbl">Convert to Currency</label>
                        <SearchSelect
                          options={currencies.map(c => ({ value: c.currencyGuid, label: `${c.currencyCode} — ${c.currencyName}` }))}
                          value={selectedOutstandingCurrency ?? ''}
                          onChange={setSelectedOutstandingCurrency}
                        />
                      </div>
                      {hasUnconvertibleLedger && (
                        <div className="warn-box mb-3">
                          <i className="lni lni-warning" style={{ color: 'var(--amber)', fontSize: 15, flexShrink: 0, marginTop: 1 }}></i>
                          <div>Some ledgers couldn&apos;t be converted to {targetCurrencyName || 'the selected currency'} — no exchange rate is on file for today for that currency. Those rows show <span className="font-mono">—</span> below; the totals only include what could be converted.</div>
                        </div>
                      )}
                      <div className="mb-4">
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
                                    2026-09-03) shown right under it — no
                                    separate Currency column anymore (removed
                                    per request, 2026-09-04). Stays native
                                    rather than the "Convert to Currency"
                                    picker's selection: a student's Admission
                                    Fee ledger can genuinely be billed in USD
                                    while their Semester Fee ledger is billed
                                    in UGX, so pre-converting this figure
                                    would misreport what was actually
                                    charged on that ledger. */}
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
                      </div>
                    </>
                  )
                }
                {/* Payment Detail — no separate card/section, per request;
                    continues directly in the same card as the outstanding
                    ledger rows above, behind a plain divider (matching the
                    reference panel's own "REGISTRATION PAYMENT DETAILS"
                    label). Still gated the same three ways as before
                    (checking / fully settled / the actual form) — per the
                    flow doc: "'No outstanding ledgers found.' is a 404 but
                    not an error. It means fully paid. Render step 3 as an
                    empty/settled state and suppress the payment form,
                    rather than showing a failure toast." Gated on
                    !isLedgersLoading too so the form doesn't flash visible
                    before that grid has had a chance to report empty. */}
                {!receipt && (
                  <div className="sec-divider">Payment Detail</div>
                )}
                {!receipt && isLedgersLoading && (
                  <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Checking outstanding balance…</div>
                )}
                {!receipt && !isLedgersLoading && ledgers.length === 0 && (
                  <div className="text-center" style={{ padding: 24 }}>
                    <div className="pc-receipt-check" style={{ fontSize: 22 }}><i className="lni lni-checkmark-circle"></i></div>
                    <div className="font-bold text-g700" style={{ fontSize: 13.5 }}>Fully settled</div>
                    <div className="text-g400 mt-1" style={{ fontSize: 12.5 }}>This application has no outstanding tuition ledgers — there is nothing to bill right now.</div>
                  </div>
                )}
                {!receipt && !isLedgersLoading && ledgers.length > 0 && (
                  <>
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
                        Book on its own row. */}
                    <div className="g2 mb-[14px]">
                      <div className="fg">
                        <div className="lbl">Currency Received <span className="req">*</span></div>
                        <SearchSelect
                          placeholder="— Select Currency —"
                          options={currencies.map(c => ({ value: c.currencyGuid, label: `${c.currencyCode} — ${c.currencyName}` }))}
                          value={currencyGuid}
                          onChange={setCurrencyGuid}
                        />
                      </div>
                      <div className="fg">
                        <div className="lbl">Amount Received <span className="req">*</span></div>
                        <input type="number" min={0} step={0.01} className="amt-val-input" placeholder="0.00"
                          style={{ fontSize: 18, fontWeight: 700 }}
                          value={amount} onChange={e => setAmount(e.target.value)} />
                      </div>
                    </div>
                    <div className="g2 mb-[14px]">
                      <div className="fg">
                        <div className="lbl">Payment Date <span className="req">*</span></div>
                        <DatePicker value={payDate} onChange={setPayDate} />
                      </div>
                      <div className="fg">
                        <div className="lbl">Payment Method <span className="req">*</span></div>
                        <SearchSelect
                          options={Object.entries(PAY_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                          value={payType}
                          onChange={val => { setPayType(val); setReceiptBookGuid('') }}
                        />
                      </div>
                    </div>
                    <div className="fg mb-[14px]">
                      <div className="lbl">Receipt Book <span className="req">*</span></div>
                      <SearchSelect
                        placeholder="— Select Receipt Book —"
                        options={receiptBooks.map(r => ({ value: r.receiptBookGuid, label: r.bookCode }))}
                        value={receiptBookGuid}
                        onChange={setReceiptBookGuid}
                      />
                    </div>

                    {showBankFields && (
                      <div className="g2 mb-[14px]">
                        <div className="fg">
                          <div className="lbl">Bank Name <span className="req">*</span></div>
                          <SearchSelect
                            placeholder="— Select Bank —"
                            options={banks.map(b => ({ value: b.procBankGuid, label: b.bankName }))}
                            value={procBankGuid}
                            onChange={setProcBankGuid}
                          />
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
                      <button className="btn btn-primary btn-lg" disabled={createPayment.isPending} onClick={() => handleSave()}>
                        <i className="lni lni-save"></i> {createPayment.isPending ? 'Saving…' : 'Save Payment & Generate Receipt →'}
                      </button>
                    </div>
                  </>
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
                  <button className="btn btn-neu flex-1 justify-center" onClick={() => window.print()}><i className="lni lni-printer"></i> Print Receipt</button>
                  <button className="btn btn-primary flex-1 justify-center" onClick={handleClear}>← New Payment</button>
                </div>
              </div>
            )}
          </div>
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
        />
      )}
      <AdvanceDepositPickerModal
        isOpen={showAdvancePicker}
        // Cancelling the picker without confirming leaves otherIsAdvance
        // however it was before (still off on a first check, unchanged on
        // "Change" from an already-selected deposit) — only Confirm inside
        // the modal (confirmAdvanceSelection) actually flips it.
        onClose={() => setShowAdvancePicker(false)}
        onConfirm={confirmAdvanceSelection}
        showToast={showToast}
        // Scopes the picker to the currently-loaded student instead of
        // every deposit in the system (get-payment-advances.md's now-
        // confirmed studentGuid filter, 2026-09-01). Falls back to the
        // unfiltered list if the applicant hasn't registered as a student
        // yet (no studentGuid) — not worth an applicationGuid filter too.
        studentGuid={studentGuid}
        studentDisplayName={profile ? applicantName(profile) : undefined}
      />
      <Toast toast={toast} />
    </>
  )
}
