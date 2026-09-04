'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import { ActionMenu } from '@/components/ActionMenu'
import { StudentLookup } from '@/components/student/StudentLookup'
import { useStudent } from '@/hooks/student/useStudents'
import { StudentDto, normalizeStudentDetail } from '@/lib/api/student/student'
import { useIdCard, useIssueOrRenewIdCard, useUpdateIdCardDates, getIdCardQrImageUrl, currentCardIssue } from '@/hooks/student/useIdCards'
import { useSponsorDetails, useSponsorCategories, useAssignSponsorCategory } from '@/hooks/student/useSponsor'
import { useStudentRefugeeDetails, useAssignRefugeeStatus, useRemoveRefugeeStatus } from '@/hooks/student/useRefugee'
import { useCountries } from '@/hooks/config/useCountries'
import { useStudentDiscount, useAssignStudentDiscount, useUpdateStudentDiscount, useCancelStudentDiscount, DISCOUNT_STATUS_VALUES, StudentDiscountDto } from '@/hooks/student/useStudentDiscount'
import { useDiscounts } from '@/hooks/finance/useDiscounts'
import { CALC_TYPE_VALUES } from '@/lib/api/finance/discount'
import { formatDate } from '@/lib/date'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Ported from isbat_student_module.html's Student Profile page. Identity/
// academic fields (name, programme, semester, batch, status) come from the
// real GET /api/v1/students/:guid (useStudent) once a student is loaded via
// StudentLookup. The ID Card tab is now wired to the real students/id-cards/*
// endpoints (see students/id-cards/*.md), and the Sponsor field to
// students/sponsor-assignment. Discount is now wired to the real
// students/{guid}/discount assign/update/cancel endpoints (students/
// student-discounts/*.md) via a management modal — the StudentDetailDto
// discount fields are still used for the read-only summary badge shown
// before that modal is opened, since useStudent already carries them.
// Refugee status is wired to students/refugee/*.md the same way, via its
// own assign/remove modal (assign is multipart — a document is mandatory).
// Sponsor/Discount/Refugee's own dedicated GET endpoints are no longer
// fetched automatically the moment a student loads (per request,
// 2026-09-01) — each now fires only on demand (Sponsor: entering edit;
// Discount: opening the management modal; Refugee: an explicit "Check
// status" click, since it has no fallback field to show passively) — see
// each hook call's own comment below.
// Fee structure/learning mode display and the communication dispatch audit
// log still have no backend contract — page-local mock state only, same
// "UI-first prototype" convention as Finance's Payment Collection pages.
// The old barcode/ESSL-device and photo-upload UI had no backing endpoint at
// all (id-cards has no such fields) — commented out below rather than
// removed, in favour of the real QR-image endpoint. The Live Card Preview
// now also carries the full printed-card field set (card no./print date,
// batch, joining/expiry, embedded QR) instead of just name/programme/regno —
// Batch Time and Nationality have no field on any student/id-card response
// yet, shown as placeholders. Card History (the issue/renewal timeline) has
// been dropped from this tab entirely, per request.
const PROFICIENCY_TABS = [
  { id: 'info', label: 'Profile Info', icon: 'lni-user' },
  { id: 'idcard', label: 'ID Card', icon: 'lni-credit-cards' },
  { id: 'comms', label: 'Communication & Access', icon: 'lni-envelope' },
] as const
type TabId = typeof PROFICIENCY_TABS[number]['id']

interface AuditEntry { id: number; action: string; detail: string; dot: 'email' | 'whatsapp' | 'update' }

function initials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function isValidEmail(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) }
function isValidPhone(v: string) { return /^\+\d[\d\s]{6,14}$/.test(v.trim()) }

// calcType is documented ("1" = Amount, "2" = Percentage) on the
// student-discounts assign/update endpoints; StudentDetailDto carries the
// same field for whatever discount is already resolved onto the student.
function formatDiscount(detail: { discountStatus: string | null; calcType: string | null; amtPer: number | null } | undefined) {
  if (!detail?.discountStatus || detail.discountStatus === 'Cancelled' || detail.discountStatus === 'CancelledImmediate') return 'None'
  const kind = detail.calcType === '2' ? '%' : detail.calcType === '1' ? 'Amt' : ''
  return detail.amtPer != null ? `${detail.amtPer}${kind}` : detail.discountStatus
}

// Same summary format as formatDiscount above, but for the real
// student-discount assignment (StudentDiscountDto) — discountStatus there
// is a confirmed-live NUMERIC enum, not the string label formatDiscount's
// StudentDetailDto-sourced fallback expects (see studentDiscount.ts), so
// this doesn't just reformat and delegate to it.
function formatDiscountDetail(detail: StudentDiscountDto) {
  if (detail.discountStatus !== DISCOUNT_STATUS_VALUES.Active) return 'None'
  const kind = detail.calcType === CALC_TYPE_VALUES.Percentage ? '%' : detail.calcType === CALC_TYPE_VALUES.Amount ? 'Amt' : ''
  return detail.amtPer != null ? `${detail.amtPer}${kind}` : 'Active'
}

function StudentProfileContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Student Master's "View" row action links here as
  // /student/profile?studentGuid=<guid> instead of opening its own read-only
  // modal (that modal — StudentProfileModal — is now unused; this page is
  // the single Profile view). No StudentLookup search happens in that case:
  // the guid off the URL feeds the same useStudent(...) call below that a
  // manual search would populate `student` from, so the rest of the page
  // (tabs, ID card, sponsor, etc.) behaves identically either way.
  const studentGuidParam = searchParams.get('studentGuid')
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [student, setStudent] = useState<StudentDto | null>(null)
  const [tab, setTab] = useState<TabId>('info')

  const effectiveStudentGuid = student?.studentGuid ?? studentGuidParam
  const { data: detail } = useStudent(effectiveStudentGuid ?? null, !!effectiveStudentGuid)

  // Once the deep-linked guid's detail resolves, seed `student` from it so
  // the rest of the page (which reads off `student`, not `detail`, for name/
  // programme/batch/etc.) renders exactly as if it had been picked from
  // StudentLookup. Guarded on `!student` so it only ever fires the one time
  // for the URL-driven load, not on every detail refetch.
  useEffect(() => {
    if (!student && studentGuidParam && detail) setStudent(normalizeStudentDetail(detail, effectiveStudentGuid))
  }, [student, studentGuidParam, detail, effectiveStudentGuid])
  // studentNum has come back undefined on a real response (2026-08-31) —
  // StudentDto's type still promises it as a required string, but the
  // backend isn't reliably filling it in practice. studentRegNo has been
  // reliable on every real response seen so far, so it's the fallback
  // everywhere this page used to read studentNum directly.
  const studentNo = student?.studentNum || student?.studentRegNo || '—'

  // Real ID-card record — GET /students/id-cards/{studentGuid}. Resolves to
  // null when the student has no card yet (404 not_found is the common case,
  // not an error — see getIdCardDetails).
  const { data: card } = useIdCard(student?.studentGuid ?? null, !!student)
  const issueOrRenewIdCard = useIssueOrRenewIdCard()
  const updateIdCardDates = useUpdateIdCardDates(student?.studentGuid ?? null)

  // Real sponsor assignment — GET .../sponsor-details, resolves to null when
  // unassigned. No longer fetched automatically on profile load (per
  // request, 2026-09-01) — sponsorRequested gates it to only fire once the
  // cashier actually clicks in to edit, since that's the one place the
  // fetched value (sponsorCategoryGuid, for seeding the picker) and the
  // restriction check both matter. The inline read-only label falls back to
  // detail?.sponsor (StudentDetailDto's own raw field, already fetched by
  // useStudent above) instead of a bare "Unassigned" while unrequested, so
  // it doesn't lie about a value that simply hasn't been checked yet.
  // `error` here is NOT "no assignment" (that's a null `data`, handled
  // server-side as 404) — a real 401 has been observed live (2026-08-25):
  // "You are not authorized to view sponsor details for students in this
  // campus", despite the docs saying no fine-grained permission exists.
  // Surfaced as "Restricted" below rather than silently reading as
  // "Unassigned", which would misleadingly invite editing.
  const [sponsorRequested, setSponsorRequested] = useState(false)
  const { data: sponsorDetail, error: sponsorError } = useSponsorDetails(student?.studentGuid ?? null, !!student && sponsorRequested)
  const sponsorRestricted = !!sponsorError
  const { data: sponsorCategoriesPage } = useSponsorCategories()
  const assignSponsorCategory = useAssignSponsorCategory()
  const [editingSponsor, setEditingSponsor] = useState(false)
  const [sponsorChoice, setSponsorChoice] = useState('')

  // Real refugee-status record — GET /students/refugee/{guid}, resolves to
  // null when the student has no record yet (404 not_found is the common
  // case, not an error — see getStudentRefugeeDetails). No longer fetched
  // automatically on profile load (per request, 2026-09-01) — unlike
  // Sponsor/Discount, StudentDetailDto carries no refugee field at all to
  // fall back on for a passive display, so refugeeRequested gates a genuine
  // "check status" step the cashier triggers explicitly, before the row can
  // show either state (Refugee/Not a refugee).
  const [refugeeRequested, setRefugeeRequested] = useState(false)
  const { data: refugeeDetail, isFetching: isRefugeeChecking } = useStudentRefugeeDetails(student?.studentGuid ?? null, !!student && refugeeRequested)
  const assignRefugeeStatus = useAssignRefugeeStatus()
  const removeRefugeeStatus = useRemoveRefugeeStatus()
  // CountryGuid — confirmed (post-assign-refugee-status.md) as a real guid
  // field on the student entity, not a legacy numeric code, so the option's
  // own countryGuid is sent as-is; no index/position workaround needed.
  const { data: refugeeCountries = [] } = useCountries()
  const refugeeCountryOptions = refugeeCountries.map(c => ({ value: c.countryGuid, label: c.countryName }))
  const [refugeeModalOpen, setRefugeeModalOpen] = useState(false)
  const [refugeeCountryGuid, setRefugeeCountryGuid] = useState('')
  const [refugeeIdInput, setRefugeeIdInput] = useState('')
  const [refugeeDocFile, setRefugeeDocFile] = useState<File | null>(null)

  // Real discount assignment — GET /students/{guid}/discount, resolves to
  // null when unassigned (see getStudentDiscount). No longer fetched
  // automatically on profile load (per request, 2026-09-01) — gated on the
  // management modal actually being open instead, since the inline
  // read-only badge already has a real fallback (detail's own
  // discountStatus/calcType/amtPer fields, from the always-fetched
  // useStudent above — see formatDiscount(detail) below) and doesn't need
  // this dedicated endpoint just to display a label. Finance's own discount
  // catalogue (useDiscounts) backs the "which discount" picker in the
  // management modal.
  const [discountModalOpen, setDiscountModalOpen] = useState(false)
  const { data: discountDetail } = useStudentDiscount(student?.studentGuid ?? null, !!student && discountModalOpen)
  const { data: discountCatalogue = [] } = useDiscounts()
  const assignStudentDiscount = useAssignStudentDiscount()
  const updateStudentDiscount = useUpdateStudentDiscount()
  const cancelStudentDiscount = useCancelStudentDiscount()
  const [discountChoice, setDiscountChoice] = useState('')
  const [discountCalcType, setDiscountCalcType] = useState<'Amount' | 'Percentage'>('Percentage')
  const [discountAmtPer, setDiscountAmtPer] = useState('')
  const [discountRemarks, setDiscountRemarks] = useState('')
  // A cancelled assignment is still a non-null discountDetail (cancellation
  // is a status change, not a delete — post-cancel-student-discount.md), so
  // "is there something to edit/cancel" needs the status check too, not
  // just "did this fetch resolve to a record at all" — otherwise the modal
  // would offer Update/Cancel on an assignment that's already cancelled
  // instead of reopening the Assign form for a new one.
  const hasActiveDiscount = discountDetail?.discountStatus === DISCOUNT_STATUS_VALUES.Active

  // Personal-info edit form — seeded from the loaded record, editable but
  // not wired to any save endpoint (none confirmed for this workflow).
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [gender, setGender] = useState('Female')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  // ID-card date fields — seeded from the real card record below (or left
  // blank for a first-time issue); joiningDate/expiryDate are the only
  // fields the backend actually stores (see students/id-cards/*.md).
  const [joiningDate, setJoiningDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [cardRemarks, setCardRemarks] = useState('')

  // Communications mock state — no backend contract for this workflow.
  const [stuEmail, setStuEmail] = useState('')
  const [stuPhone, setStuPhone] = useState('')
  const [parEmail, setParEmail] = useState('parent.sarah@gmail.com')
  const [parPhone, setParPhone] = useState('+256 772 987 654')
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])

  // Old barcode/ESSL/photo-upload state — no backend contract (the id-cards
  // API has no such fields). Commented out rather than removed; re-enable if
  // a real endpoint shows up for these later.
  // const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  // const [barcode, setBarcode] = useState('')

  // The most recent cardHistory entry is the "current" card — there's no
  // separate current-card field on the real response (see idCards.ts).
  const currentCard = currentCardIssue(card)

  useEffect(() => {
    if (currentCard) {
      setJoiningDate(currentCard.joiningDate?.slice(0, 10) ?? '')
      setExpiryDate(currentCard.expiryDate?.slice(0, 10) ?? '')
    } else {
      setJoiningDate('')
      setExpiryDate('')
      setCardRemarks('')
    }
  }, [currentCard])

  useEffect(() => {
    setSponsorChoice(sponsorDetail?.sponsorCategoryGuid ?? '')
    setEditingSponsor(false)
  }, [sponsorDetail])

  // Seed the discount modal's fields whenever it's (re)opened — either from
  // the existing assignment's terms, or discount-catalogue/50% defaults for
  // a fresh assignment.
  useEffect(() => {
    if (!discountModalOpen) return
    if (hasActiveDiscount && discountDetail) {
      setDiscountChoice(discountDetail.discountGuid)
      setDiscountCalcType(discountDetail.calcType === CALC_TYPE_VALUES.Amount ? 'Amount' : 'Percentage')
      setDiscountAmtPer(discountDetail.amtPer != null ? String(discountDetail.amtPer) : '')
      setDiscountRemarks(discountDetail.remarks ?? '')
    } else {
      setDiscountChoice(discountCatalogue[0]?.discountGuid ?? '')
      setDiscountCalcType('Percentage')
      setDiscountAmtPer('')
      setDiscountRemarks('')
    }
  }, [discountModalOpen, discountDetail, hasActiveDiscount, discountCatalogue])

  useEffect(() => {
    if (!refugeeModalOpen) return
    setRefugeeCountryGuid('')
    setRefugeeIdInput('')
    setRefugeeDocFile(null)
  }, [refugeeModalOpen])

  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  useEffect(() => {
    if (!student) return
    const parts = student.studentName.trim().split(/\s+/)
    const derivedEmail = `${studentNo.toLowerCase().replace(/[^a-z0-9]/g, '.')}@isbat.ac.ug`
    setFirstName(parts[0] ?? '')
    setLastName(parts.slice(1).join(' '))
    setStuEmail(derivedEmail)
    setEmail(derivedEmail)
    setStuPhone('+256 701 234 567')
    setPhone('+256 701 234 567')
    // Same seed audit log as the mockup — illustrative dispatch/update
    // history, not real events (there's no backend for this workflow at
    // all), just re-pointed at whichever student is actually loaded.
    setAuditLog([
      { id: 1, action: 'Student credentials dispatched via Email', detail: `To: ${derivedEmail} · Admin: Registrar · Aug 19, 2026 10:33 AM`, dot: 'email' },
      { id: 2, action: 'Parent credentials dispatched via WhatsApp', detail: 'To: +256 772 987 654 · Admin: Registrar · Aug 15, 2026 2:10 PM', dot: 'whatsapp' },
      { id: 3, action: 'Student email address updated', detail: `Old: ${parts[0]?.toLowerCase() ?? 'student'}.n@gmail.com → New: ${derivedEmail} · Admin: IT Admin · Jul 2, 2026`, dot: 'update' },
      { id: 4, action: 'Parent credentials dispatched via Email', detail: 'To: parent.sarah@gmail.com · Admin: Registrar · Jan 20, 2024 9:00 AM', dot: 'email' },
    ])
    setTab('info')
  }, [student])

  // sponsorRequested/refugeeRequested reset here too — a newly-loaded (or
  // cleared) student starts back at "not checked" for both, same as a first
  // visit, rather than carrying over the previous student's requested state.
  function handleLoad(s: StudentDto) { setStudent(s); setSponsorRequested(false); setRefugeeRequested(false); showToast(`${s.studentName} profile loaded`, 'ok') }
  function handleClear() {
    setStudent(null)
    setSponsorRequested(false)
    setRefugeeRequested(false)
    // Drop ?studentGuid= so the useEffect above doesn't immediately reload
    // the same student right after Clear.
    if (studentGuidParam) router.replace('/student/profile')
  }

  function dispatch(who: 'student' | 'parent', channel: 'email' | 'whatsapp') {
    const clbl = channel === 'email' ? 'Email' : 'WhatsApp'
    const wlbl = who === 'student' ? 'Student' : 'Parent'
    showToast(`${wlbl} credentials dispatched via ${clbl}`, 'ok')
    setAuditLog(prev => [
      { id: Date.now(), action: `${wlbl} credentials dispatched via ${clbl}`, detail: `Admin: Student Registrar · ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, dot: channel },
      ...prev,
    ])
  }

  // Photo upload had no backing field on the real id-cards API — commented
  // out along with its JSX rather than removed (see the state comment above).
  // function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
  //   const file = e.target.files?.[0]
  //   if (!file) return
  //   const reader = new FileReader()
  //   reader.onload = ev => { setPhotoUrl(ev.target?.result as string); showToast('Photo uploaded', 'ok') }
  //   reader.readAsDataURL(file)
  // }

  function handleSaveCard() {
    if (!student) return
    if (currentCard) {
      updateIdCardDates.mutate(
        { cardIssueId: currentCard.cardIssueId, payload: { joiningDate, expiryDate } },
        { onSuccess: () => showToast('Card dates updated', 'ok'), onError: () => showToast('Could not update card dates', 'err') },
      )
    } else {
      issueOrRenewIdCard.mutate(
        { studentGuid: student.studentGuid, joiningDate: joiningDate || null, expiryDate: expiryDate || null, remarks: cardRemarks || null, isRenewal: false },
        { onSuccess: () => showToast('ID card issued', 'ok'), onError: () => showToast('Could not issue ID card', 'err') },
      )
    }
  }

  function handleRenewCard() {
    if (!student) return
    issueOrRenewIdCard.mutate(
      { studentGuid: student.studentGuid, joiningDate: joiningDate || null, expiryDate: expiryDate || null, remarks: cardRemarks || null, isRenewal: true },
      { onSuccess: () => showToast('Card renewed', 'ok'), onError: () => showToast('Could not renew card', 'err') },
    )
  }

  function handleSaveSponsor() {
    if (!student || !sponsorChoice) return
    assignSponsorCategory.mutate(
      { studentGuid: student.studentGuid, sponsorCategoryGuid: sponsorChoice },
      { onSuccess: () => showToast('Sponsor category updated', 'ok'), onError: () => showToast('Could not update sponsor category', 'err') },
    )
  }

  function handleAssignRefugee() {
    if (!student) return
    if (!refugeeCountryGuid) { showToast('Country is required.', 'warn'); return }
    if (!refugeeIdInput.trim()) { showToast('Refugee ID is required.', 'warn'); return }
    if (refugeeIdInput.trim().length > 20) { showToast('Refugee ID must be 20 characters or fewer.', 'warn'); return }
    if (!refugeeDocFile) { showToast('A supporting document is required.', 'warn'); return }
    assignRefugeeStatus.mutate(
      { studentGuid: student.studentGuid, countryGuid: refugeeCountryGuid, refugeeId: refugeeIdInput.trim(), document: refugeeDocFile },
      {
        onSuccess: () => { showToast('Refugee status granted', 'ok'); setRefugeeModalOpen(false) },
        onError: (error: Error) => showToast(error.message || 'Could not assign refugee status', 'err'),
      },
    )
  }

  function handleRemoveRefugee() {
    if (!student) return
    removeRefugeeStatus.mutate(student.studentGuid, {
      onSuccess: () => showToast('Refugee status removed', 'ok'),
      onError: (error: Error) => showToast(error.message || 'Could not remove refugee status', 'err'),
    })
  }

  function handleSaveDiscount() {
    if (!student) return
    const amtPer = discountAmtPer.trim() ? Number(discountAmtPer) : null
    if (amtPer != null && amtPer <= 0) { showToast('Amount/percentage must be greater than 0.', 'warn'); return }
    if (amtPer != null && discountCalcType === 'Percentage' && amtPer > 100) { showToast('Percentage cannot be more than 100.', 'warn'); return }

    if (hasActiveDiscount) {
      updateStudentDiscount.mutate(
        { studentGuid: student.studentGuid, payload: { calcType: CALC_TYPE_VALUES[discountCalcType], amtPer, remarks: discountRemarks.trim() || null } },
        { onSuccess: () => { showToast('Discount updated', 'ok'); setDiscountModalOpen(false) }, onError: (error: Error) => showToast(error.message || 'Could not update discount', 'err') },
      )
    } else {
      if (!discountChoice) { showToast('Please select a discount.', 'warn'); return }
      assignStudentDiscount.mutate(
        {
          studentGuid: student.studentGuid,
          payload: {
            discountGuid: discountChoice,
            calcType: CALC_TYPE_VALUES[discountCalcType],
            amtPer,
            // No program-scoped semester list is available here to pick
            // from (see studentDiscount.ts) — defaults to the student's own
            // current semester rather than an invented dropdown.
            effectiveFromSemesterGuid: detail?.currentSemesterGuid ?? null,
            remarks: discountRemarks.trim() || null,
          },
        },
        { onSuccess: () => { showToast('Discount assigned', 'ok'); setDiscountModalOpen(false) }, onError: (error: Error) => showToast(error.message || 'Could not assign discount', 'err') },
      )
    }
  }

  function handleCancelDiscount(includeCurrentSemester: boolean) {
    if (!student) return
    cancelStudentDiscount.mutate(
      { studentGuid: student.studentGuid, includeCurrentSemester },
      {
        onSuccess: () => { showToast('Discount cancelled', 'ok'); setDiscountModalOpen(false) },
        onError: (error: Error) => showToast(error.message || 'Could not cancel discount', 'err'),
      },
    )
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div><div className="pg-title">Student Profile</div><div className="pg-sub">Search a student or navigate from Student Master to view and edit their profile</div></div>
        </div>

        <StudentLookup
          onLoad={handleLoad}
          onClear={handleClear}
          loaded={!!student}
          hint="Once loaded, all tabs populate at once — including ID card management and credential dispatch."
        />

        {!student && (
          <div className="empty">
            <div className="empty-icon"><i className="lni lni-user"></i></div>
            <div className="empty-title">No Student Selected</div>
            <div className="empty-sub">Search above to load a student. All tabs load simultaneously once a student is found.</div>
          </div>
        )}

        {student && (
          <>
            <div className="stu-banner">
              {/* Hero header — reuses Payment Console's/Discount Allocation's
                  pc-hero layout wholesale (avatar + name/programme/reg-no up
                  top, an aligned label/value facts grid below) instead of the
                  old free-flowing pill row, see globals.css. .stu-hero below
                  overrides just the background back to this page's own blue
                  rather than pc-hero's own gradient. Same five data points as
                  before — status, programme, batch, semester, campus — just
                  laid out consistently with the rest of the app now. */}
              <div className="pc-hero stu-hero">
                <div className="pc-hero-top">
                  <div className="pc-hero-avatar">{initials(student.studentName)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="pc-hero-name truncate">{student.studentName}</div>
                    <div className="pc-hero-sub truncate">{student.programName || detail?.programme || '—'}</div>
                    <span className="pc-hero-badge"><i className="lni lni-bookmark"></i> {studentNo} · {student.studentRegNo || detail?.regNo}</span>
                  </div>
                  {/* Batch/Programme Transfer, Learning Mode, Intake Transfer — tucked
                      behind a single three-dot menu instead of four always-visible
                      buttons, same ActionMenu component the table rows elsewhere in
                      this app use for their own row actions. A flex sibling here,
                      not absolutely positioned — pc-hero-top's flex-1 name column
                      otherwise doesn't reserve room for it and the programme/reg-no
                      lines end up sitting underneath the button instead of beside it.
                      Each link carries ?studentGuid= so the destination page
                      preloads this same student instead of requiring a second
                      StudentLookup search — same deep-link convention Student
                      Master's own "View" action uses to reach this page. */}
                  <ActionMenu tooltip="Student Actions">
                    {/* lni-transfer isn't a real LineIcons 4.0 class (silently renders
                        nothing) — lni-shuffle is what the sidebar leaf uses for this
                        same page, see menu.ts. */}
                    <button className="btn btn-neu btn-sm" onClick={() => router.push('/student/batch-transfer?studentGuid=' + student.studentGuid)}><i className="lni lni-shuffle"></i> Batch Transfer</button>
                    <button className="btn btn-neu btn-sm" onClick={() => router.push('/student/prog-transfer?studentGuid=' + student.studentGuid)}><i className="lni lni-graduation"></i> Prog. Transfer</button>
                    <button className="btn btn-neu btn-sm" onClick={() => router.push('/student/learning-mode?studentGuid=' + student.studentGuid)}><i className="lni lni-display"></i> Learning Mode</button>
                    <button className="btn btn-neu btn-sm" onClick={() => router.push('/student/intake-transfer?studentGuid=' + student.studentGuid)}><i className="lni lni-calendar"></i> Dropout Rejoin</button>
                  </ActionMenu>
                </div>
                <div className="pc-hero-facts">
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Status</span><span className="pc-hero-fact-val">{detail?.studActive === 1 ? '✓ Active' : detail ? '⚠ Inactive' : '…'}</span></div>
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Batch</span><span className="pc-hero-fact-val" title={student.batchCode || detail?.batch || '—'}>{student.batchCode || detail?.batch || '—'}</span></div>
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Semester</span><span className="pc-hero-fact-val" title={student.semesterName || detail?.semester || '—'}>{student.semesterName || detail?.semester || '—'}</span></div>
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Campus</span><span className="pc-hero-fact-val">Campus</span></div>
                </div>
              </div>
              <div className="stu-meta-row">
                {/* Fee Structure / Learning Mode still have no backend contract — left as
                    illustrative placeholders, same as before. */}
                <div className="stu-meta-item"><div className="stu-meta-lbl">Fee Structure</div><div className="stu-meta-val">Local</div></div>
                <div className="stu-meta-item">
                  <div className="stu-meta-lbl">Sponsor</div>
                  {sponsorRestricted ? (
                    <div className="stu-meta-val" title="You are not authorized to view sponsor details for students in this campus">
                      Restricted
                    </div>
                  ) : editingSponsor ? (
                    <div className="flex gap-2" style={{ alignItems: 'center' }}>
                      <SearchSelect
                        options={(sponsorCategoriesPage?.items ?? []).map(c => c.category)}
                        value={(sponsorCategoriesPage?.items ?? []).find(c => c.sponsorCategoryGuid === sponsorChoice)?.category ?? ''}
                        onChange={label => {
                          const found = sponsorCategoriesPage?.items.find(c => c.category === label)
                          setSponsorChoice(found?.sponsorCategoryGuid ?? '')
                        }}
                      />
                      <button className="btn-icon" title="Save" onClick={handleSaveSponsor}><i className="lni lni-checkmark"></i></button>
                      <button className="btn-icon" title="Cancel" onClick={() => setEditingSponsor(false)}><i className="lni lni-close"></i></button>
                    </div>
                  ) : (
                    <div className="stu-meta-val" style={{ cursor: 'pointer' }} onClick={() => { setSponsorRequested(true); setEditingSponsor(true) }} title="Click to change sponsor category">
                      {sponsorDetail?.category ?? detail?.sponsor ?? 'Unassigned'} <i className="lni lni-pencil-alt" style={{ fontSize: 10 }}></i>
                    </div>
                  )}
                </div>
                <div className="stu-meta-item">
                  <div className="stu-meta-lbl">Discount</div>
                  <div className="stu-meta-val" style={{ cursor: 'pointer' }} onClick={() => setDiscountModalOpen(true)} title="Click to manage this student's discount">
                    {discountDetail ? formatDiscountDetail(discountDetail) : formatDiscount(detail)}
                    {' '}<i className="lni lni-pencil-alt" style={{ fontSize: 10 }}></i>
                  </div>
                </div>
                <div className="stu-meta-item">
                  <div className="stu-meta-lbl">Refugee Status</div>
                  {/* No fallback field exists on StudentDetailDto for this
                      one (unlike Sponsor/Discount) — the row starts at an
                      explicit "not checked" state instead of guessing, and
                      only fetches once the cashier actually asks. */}
                  {!refugeeRequested ? (
                    <div className="stu-meta-val" style={{ cursor: 'pointer' }} onClick={() => setRefugeeRequested(true)} title="Click to check refugee status">
                      Check status <i className="lni lni-search-alt" style={{ fontSize: 10 }}></i>
                    </div>
                  ) : isRefugeeChecking ? (
                    <div className="stu-meta-val text-g400">Checking…</div>
                  ) : refugeeDetail ? (
                    <div className="flex gap-2" style={{ alignItems: 'center' }}>
                      <span className="stu-meta-val">Refugee · ID {refugeeDetail.refugeeId}</span>
                      <button className="btn-icon" title="Remove refugee status" onClick={handleRemoveRefugee} disabled={removeRefugeeStatus.isPending}><i className="lni lni-close"></i></button>
                    </div>
                  ) : (
                    <div className="stu-meta-val" style={{ cursor: 'pointer' }} onClick={() => setRefugeeModalOpen(true)} title="Click to grant refugee status">
                      Not a refugee <i className="lni lni-pencil-alt" style={{ fontSize: 10 }}></i>
                    </div>
                  )}
                </div>
                <div className="stu-meta-item"><div className="stu-meta-lbl">Learning Mode</div><div className="stu-meta-val">Campus</div></div>
                <div className="stu-meta-item"><div className="stu-meta-lbl">Registration No.</div><div className="stu-meta-val">{student.studentRegNo || detail?.regNo}</div></div>
                <div className="stu-meta-item"><div className="stu-meta-lbl">Status</div><div className="stu-meta-val">{detail?.regStatusName || '—'}</div></div>
              </div>
            </div>

            <div className="ptabs">
              {PROFICIENCY_TABS.map(t => (
                <button key={t.id} className={`ptab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
                  <i className={`lni ${t.icon}`}></i> {t.label}
                </button>
              ))}
            </div>

            {tab === 'info' && (
              <div>
                <div className="card">
                  <div className="card-hdr"><div className="card-title"><i className="lni lni-pencil-alt"></i> Personal Information</div><span className="badge badge-grey">Editable</span></div>
                  <div className="g3">
                    <div className="fg"><label className="lbl">First Name <span className="req">*</span></label><input className="ctrl" value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
                    <div className="fg"><label className="lbl">Last Name <span className="req">*</span></label><input className="ctrl" value={lastName} onChange={e => setLastName(e.target.value)} /></div>
                    <div className="fg"><label className="lbl">Gender <span className="req">*</span></label><SearchSelect options={['Female', 'Male', 'Other']} value={gender} onChange={setGender} /></div>
                  </div>
                </div>
                <div className="card">
                  <div className="card-hdr"><div className="card-title"><i className="lni lni-graduation"></i> Academic Details</div><span className="badge badge-grey">Read-only</span></div>
                  <div className="g3">
                    <div className="fg"><label className="lbl">Student No.</label><input className="ctrl" readOnly value={studentNo} /></div>
                    <div className="fg"><label className="lbl">Registration No.</label><input className="ctrl" readOnly value={student.studentRegNo || detail?.regNo || ''} /></div>
                    <div className="fg"><label className="lbl">Programme</label><input className="ctrl" readOnly value={student.programName || detail?.programme || '—'} /></div>
                    <div className="fg"><label className="lbl">Current Batch</label><input className="ctrl" readOnly value={student.batchCode || detail?.batch || '—'} /></div>
                    <div className="fg"><label className="lbl">Current Semester</label><input className="ctrl" readOnly value={student.semesterName || detail?.semester || '—'} /></div>
                    <div className="fg"><label className="lbl">Status</label><input className="ctrl" readOnly value={detail?.regStatusName || (detail?.studActive === 1 ? 'Active' : '—')} style={{ color: 'var(--green)', fontWeight: 700 }} /></div>
                  </div>
                  <div className="info-box"><i className="lni lni-information" style={{ color: 'var(--b700)', fontSize: 15, flexShrink: 0 }}></i><div style={{ fontSize: 12 }}>To change Batch, Programme, Learning Mode, or Intake — use the quick-action buttons in the banner above or navigate via the Operations section in the sidebar.</div></div>
                </div>
                <div className="card">
                  <div className="card-hdr"><div className="card-title"><i className="lni lni-home"></i> Contact</div></div>
                  <div className="g3">
                    <div className="fg"><label className="lbl">Primary Email <span className="req">*</span></label><input className="ctrl" value={email} onChange={e => setEmail(e.target.value)} /></div>
                    <div className="fg"><label className="lbl">Mobile / WhatsApp <span className="req">*</span></label><input className="ctrl" value={phone} onChange={e => setPhone(e.target.value)} /></div>
                  </div>
                </div>
                <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginBottom: 20 }}>
                  <button className="btn btn-neu">Discard</button>
                  <button className="btn btn-primary" onClick={() => showToast('Profile saved', 'ok')}><i className="lni lni-save"></i> Save Profile</button>
                </div>
              </div>
            )}

            {tab === 'idcard' && (
              <div className="g2">
                <div>
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-hdr">
                      <div className="card-title"><i className="lni lni-credit-cards"></i> Card Details</div>
                      <span className={`badge ${currentCard ? 'badge-green' : 'badge-grey'}`}>{currentCard ? 'Issued' : 'Not issued yet'}</span>
                    </div>
                    {/* Photo upload had no field on the real id-cards API (issue/renew
                        only takes studentGuid/joiningDate/expiryDate/remarks/isRenewal)
                        — commented out rather than removed. The preview below falls
                        back to a placeholder icon with no photo, same as always. */}
                    {/* <div>
                      <label className="lbl">Photo</label>
                      <label className="photo-zone">
                        <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
                        <i className="lni lni-image"></i><span>Upload</span>
                      </label>
                      <div style={{ fontSize: 10.5, color: 'var(--g500)', marginTop: 6, textAlign: 'center' }}>JPG/PNG · Max 2MB</div>
                    </div> */}
                    <div className="fg"><label className="lbl">Name on Card</label><input className="ctrl" value={student.studentName} readOnly /></div>
                    <div className="fg"><label className="lbl">Student ID</label><input className="ctrl" value={studentNo} readOnly /></div>
                    <div className="fg"><label className="lbl">Programme</label><input className="ctrl" value={student.programName || detail?.programme || '—'} readOnly /></div>
                    <div className="g2">
                      <div className="fg"><label className="lbl">Joining Date</label><input className="ctrl" type="date" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} /></div>
                      <div className="fg"><label className="lbl">Expiry Date</label><input className="ctrl" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} /></div>
                    </div>
                    {!currentCard && (
                      <div className="fg"><label className="lbl">Remarks</label><textarea className="ctrl" rows={2} value={cardRemarks} onChange={e => setCardRemarks(e.target.value)} placeholder="Optional — only recorded on first issue" /></div>
                    )}
                    <div className="flex gap-2" style={{ marginTop: 8 }}>
                      {currentCard ? (
                        <>
                          <button className="btn btn-neu btn-sm" onClick={handleRenewCard} disabled={issueOrRenewIdCard.isPending}><i className="lni lni-reload"></i> Renew</button>
                          <button className="btn btn-primary btn-sm" onClick={handleSaveCard} disabled={updateIdCardDates.isPending}><i className="lni lni-save"></i> Save Dates</button>
                        </>
                      ) : (
                        <button className="btn btn-primary btn-sm" onClick={handleSaveCard} disabled={issueOrRenewIdCard.isPending}><i className="lni lni-save"></i> Issue Card</button>
                      )}
                    </div>
                  </div>
                  <div className="card">
                    <div className="card-hdr"><div className="card-title"><i className="lni lni-qr-code"></i> QR Verification</div></div>
                    {/* Replaces the old free-text "Physical Barcode" + ESSL device list —
                        neither had a backing field on the real API. The QR endpoint
                        (GET /students/id-cards/{studentGuid}/qr-image) just encodes the
                        bare studentGuid, unsigned — it's not a substitute for the ESSL
                        device workflow, only for the barcode's own verification role. */}
                    {MOCK_AUTH ? (
                      <div className="empty" style={{ padding: 20 }}>
                        <div className="empty-sub">QR preview needs a live backend — not available in mock mode.</div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <img src={getIdCardQrImageUrl(student.studentGuid)} alt="ID card QR code" style={{ width: 160, height: 160 }} />
                        <div style={{ fontSize: 11, color: 'var(--g500)', marginTop: 6 }}>Scans to this student's GUID — verify via the scan-result endpoint, not the image alone.</div>
                      </div>
                    )}
                    {/* <div className="fg">
                      <label className="lbl">ESSL Device Registration</label>
                      <div className="chklist">
                        <div className="chk pass"><i className="lni lni-checkmark-circle chk-icon" style={{ color: 'var(--green)' }}></i><span className="chk-text">Device F22-01 · Main Gate</span><span className="chk-status">Enrolled</span></div>
                        <div className="chk pend"><i className="lni lni-alarm-clock chk-icon" style={{ color: 'var(--amber)' }}></i><span className="chk-text">Device F22-02 · Library</span><span className="chk-status">Pending</span></div>
                        <div className="chk fail"><i className="lni lni-close chk-icon" style={{ color: 'var(--red)' }}></i><span className="chk-text">Device F22-03 · Lab Block</span><span className="chk-status">Not Enrolled</span></div>
                      </div>
                    </div>
                    <div className="flex gap-2" style={{ marginTop: 8 }}>
                      <button className="btn btn-neu btn-sm"><i className="lni lni-reload"></i> Sync Devices</button>
                    </div> */}
                  </div>
                </div>
                <div>
                  <div className="card">
                    <div className="card-hdr"><div className="card-title"><i className="lni lni-eye"></i> Live Card Preview</div><span className="badge badge-blue">Preview</span></div>
                    <div className="id-preview">
                      <div className="id-logo">ISBAT UNIVERSITY · KAMPALA</div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div className="id-photo"><i className="lni lni-user"></i></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="id-name">{student.studentName}</div>
                          <div className="id-prog">{student.programName || '—'} · {student.semesterName || '—'}</div>
                          <div className="id-num">{student.studentRegNo || detail?.regNo}</div>
                        </div>
                        {/* QR box needs a white backing plate — the code itself is dark-on-
                            transparent PNG and won't scan against the card's dark gradient. */}
                        <div style={{ background: '#fff', borderRadius: 8, padding: 4, flexShrink: 0, width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {MOCK_AUTH ? (
                            <i className="lni lni-qr-code" style={{ color: '#1e1b4b', fontSize: 26 }}></i>
                          ) : (
                            <img src={getIdCardQrImageUrl(student.studentGuid)} alt="ID card QR code" style={{ width: '100%', height: '100%', display: 'block' }} />
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 10px', marginTop: 12, fontSize: 10.5 }}>
                        <div><span style={{ color: 'rgba(255,255,255,.55)' }}>Card No.</span> {currentCard?.issueCode || '—'}</div>
                        <div><span style={{ color: 'rgba(255,255,255,.55)' }}>Batch</span> {student.batchCode || '—'}</div>
                        {/* Batch Time / Nationality have no field anywhere on the wire yet
                            (not on StudentDto/StudentDetailDto, not on the id-cards DTO) —
                            shown as placeholders rather than invented, same "flag the gap"
                            convention as the commented-out photo-upload/ESSL UI above. */}
                        <div><span style={{ color: 'rgba(255,255,255,.55)' }}>Batch Time</span> —</div>
                        <div><span style={{ color: 'rgba(255,255,255,.55)' }}>Nationality</span> —</div>
                        <div><span style={{ color: 'rgba(255,255,255,.55)' }}>Joining</span> {joiningDate ? formatDate(joiningDate) : '—'}</div>
                        <div><span style={{ color: 'rgba(255,255,255,.55)' }}>Expiry</span> {expiryDate ? formatDate(expiryDate) : '—'}</div>
                      </div>
                      <div className="id-bar" style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'inherit', letterSpacing: 'normal', textTransform: 'none' }}>
                        <span>REG NO {student.studentRegNo || detail?.regNo}</span>
                        <span>PRINTED {currentCard?.issueDate ? formatDate(currentCard.issueDate) : '—'}</span>
                      </div>
                    </div>
                    <div className="flex gap-2" style={{ justifyContent: 'center', marginTop: 12 }}>
                      <button className="btn btn-neu btn-sm"><i className="lni lni-download"></i> Download</button>
                      <button className="btn btn-primary btn-sm"><i className="lni lni-printer"></i> Print</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'comms' && (
              <div>
                <div className="dcard">
                  <div className="dcard-hdr stu">
                    <div className="dcard-title"><i className="lni lni-user"></i> Student Profile</div>
                    <div className="flex gap-2" style={{ alignItems: 'center' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>Login ID:</span><span className="dcard-id">{studentNo}</span></div>
                  </div>
                  <div className="dcard-body">
                    <div className="dcard-grid">
                      <div className="fg">
                        <label className="lbl">Student Email <span className="req">*</span></label>
                        <input className="ctrl" value={stuEmail} onChange={e => setStuEmail(e.target.value)} />
                        <div className={`field-hint ${isValidEmail(stuEmail) ? 'ok' : 'err'}`}>{isValidEmail(stuEmail) ? '✓ Valid email format' : '✗ Invalid email format'}</div>
                      </div>
                      <div className="fg">
                        <label className="lbl">WhatsApp / Mobile <span className="req">*</span></label>
                        <input className="ctrl" value={stuPhone} onChange={e => setStuPhone(e.target.value)} />
                        <div className={`field-hint ${isValidPhone(stuPhone) ? 'ok' : 'err'}`}>{isValidPhone(stuPhone) ? '✓ Valid international format' : '✗ Use format e.g. +256 701 234 567'}</div>
                      </div>
                    </div>
                    <div className="dcard-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => dispatch('student', 'email')}><i className="lni lni-envelope"></i> Send Credentials via Email</button>
                      <button className="btn btn-success btn-sm" onClick={() => dispatch('student', 'whatsapp')}><i className="lni lni-whatsapp"></i> Send via WhatsApp</button>
                      <button className="btn btn-neu btn-sm ml-auto" onClick={() => showToast('Student contact saved', 'ok')}><i className="lni lni-save"></i> Save</button>
                    </div>
                  </div>
                </div>
                <div className="dcard">
                  <div className="dcard-hdr par">
                    <div className="dcard-title"><i className="lni lni-users"></i> Parent / Guardian Profile</div>
                    <div className="flex gap-2" style={{ alignItems: 'center' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>Auto-generated Login ID:</span><span className="dcard-id">{studentNo}_P</span></div>
                  </div>
                  <div className="dcard-body">
                    <div className="purple-box" style={{ marginBottom: 14, background: '#f0fdf4', borderColor: 'var(--green-bd)' }}>
                      <i className="lni lni-information" style={{ color: 'var(--green)', fontSize: 15, flexShrink: 0, marginTop: 1 }}></i>
                      <div style={{ fontSize: 12 }}>Parent login ID is auto-generated by appending <code style={{ background: 'rgba(0,0,0,.06)', padding: '1px 5px', borderRadius: 3 }}>_P</code> to the Student ID. A separate password token is generated on first credential dispatch.</div>
                    </div>
                    <div className="dcard-grid">
                      <div className="fg">
                        <label className="lbl">Parent Email <span className="req">*</span></label>
                        <input className="ctrl" value={parEmail} onChange={e => setParEmail(e.target.value)} />
                        <div className={`field-hint ${isValidEmail(parEmail) ? 'ok' : 'err'}`}>{isValidEmail(parEmail) ? '✓ Valid email format' : '✗ Invalid email format'}</div>
                      </div>
                      <div className="fg">
                        <label className="lbl">Parent WhatsApp / Mobile <span className="req">*</span></label>
                        <input className="ctrl" value={parPhone} onChange={e => setParPhone(e.target.value)} />
                        <div className={`field-hint ${isValidPhone(parPhone) ? 'ok' : 'err'}`}>{isValidPhone(parPhone) ? '✓ Valid international format' : '✗ Use format e.g. +256 701 234 567'}</div>
                      </div>
                    </div>
                    <div className="dcard-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => dispatch('parent', 'email')}><i className="lni lni-envelope"></i> Send Parent Credentials via Email</button>
                      <button className="btn btn-success btn-sm" onClick={() => dispatch('parent', 'whatsapp')}><i className="lni lni-whatsapp"></i> Send Parent via WhatsApp</button>
                      <button className="btn btn-neu btn-sm ml-auto" onClick={() => showToast('Parent contact saved', 'ok')}><i className="lni lni-save"></i> Save</button>
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="card-hdr"><div className="card-title"><i className="lni lni-shield"></i> Security &amp; Dispatch Audit Log</div><span className="badge badge-grey">Last {auditLog.length} events</span></div>
                  {auditLog.map(row => (
                    <div className="audit-row" key={row.id}>
                      <div className={`audit-dot ${row.dot}`}></div>
                      <div><div className="audit-action">{row.action}</div><div className="audit-detail">{row.detail}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {refugeeModalOpen && student && (
        <div className="modal-overlay open" onClick={() => setRefugeeModalOpen(false)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr"><div className="modal-title"><i className="lni lni-shield"></i> Grant Refugee Status</div><button className="modal-close" onClick={() => setRefugeeModalOpen(false)}>✕</button></div>
            <div>
              <div className="fg"><label className="lbl">Student</label><input className="ctrl" readOnly value={student.studentName} /></div>
              <div className="fg">
                <label className="lbl">Country <span className="req">*</span></label>
                <SearchSelect placeholder="-- Select Country --" options={refugeeCountryOptions} value={refugeeCountryGuid} onChange={setRefugeeCountryGuid} />
              </div>
              <div className="fg"><label className="lbl">Refugee ID <span className="req">*</span></label><input className="ctrl" maxLength={20} value={refugeeIdInput} onChange={e => setRefugeeIdInput(e.target.value)} placeholder="Refugee document/registration number" /></div>
              <div className="fg">
                <label className="lbl">Supporting Document <span className="req">*</span></label>
                <input className="ctrl" type="file" onChange={e => setRefugeeDocFile(e.target.files?.[0] ?? null)} />
                <div style={{ fontSize: 11.5, color: 'var(--g500)', marginTop: 4 }}>Required — the request is rejected without it.</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-neu" onClick={() => setRefugeeModalOpen(false)} disabled={assignRefugeeStatus.isPending}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAssignRefugee} disabled={assignRefugeeStatus.isPending}><i className="lni lni-checkmark"></i> {assignRefugeeStatus.isPending ? 'Saving…' : 'Grant Status'}</button>
            </div>
          </div>
        </div>
      )}

      {discountModalOpen && student && (
        <div className="modal-overlay open" onClick={() => setDiscountModalOpen(false)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr"><div className="modal-title"><i className="lni lni-tag"></i> Manage Discount</div><button className="modal-close" onClick={() => setDiscountModalOpen(false)}>✕</button></div>
            <div>
              {/* A cancelled discountDetail is still "nothing currently
                  assigned" (see hasActiveDiscount's own comment) — the
                  discount picker reopens for it same as with no assignment
                  at all, with a note about what it's replacing. */}
              {discountDetail && !hasActiveDiscount && (
                <div className="info-box" style={{ marginBottom: 12 }}>
                  <i className="lni lni-information" style={{ color: 'var(--b700)', fontSize: 15, flexShrink: 0 }}></i>
                  <div style={{ fontSize: 12 }}>Previous discount &ldquo;{discountDetail.discountName}&rdquo; is {discountDetail.discountStatus === DISCOUNT_STATUS_VALUES.CancelledImmediate ? 'cancelled immediately' : 'cancelled'}. Assigning below starts a new one.</div>
                </div>
              )}
              {!hasActiveDiscount && (
                <div className="fg">
                  <label className="lbl">Discount <span className="req">*</span></label>
                  <SearchSelect
                    placeholder="— Select discount —"
                    options={discountCatalogue.map(d => ({ value: d.discountGuid, label: `${d.discountCode} — ${d.discountName}` }))}
                    value={discountChoice}
                    onChange={setDiscountChoice}
                  />
                </div>
              )}
              <div className="g2">
                <div className="fg"><label className="lbl">Calculation Type</label><SearchSelect options={['Amount', 'Percentage']} value={discountCalcType} onChange={v => setDiscountCalcType(v as 'Amount' | 'Percentage')} /></div>
                <div className="fg"><label className="lbl">{discountCalcType === 'Percentage' ? 'Percentage (%)' : 'Amount'}</label><input className="ctrl" type="number" min={0} value={discountAmtPer} onChange={e => setDiscountAmtPer(e.target.value)} placeholder="Leave blank to inherit from the discount" /></div>
              </div>
              <div className="fg"><label className="lbl">Remarks</label><textarea className="ctrl" rows={2} maxLength={500} value={discountRemarks} onChange={e => setDiscountRemarks(e.target.value)} /></div>
              {hasActiveDiscount && (
                <div className="info-box"><i className="lni lni-information" style={{ color: 'var(--b700)', fontSize: 15, flexShrink: 0 }}></i><div style={{ fontSize: 12 }}>The discount and its effective-from semester can&apos;t be changed here — cancel this assignment and assign again to change either.</div></div>
              )}
            </div>
            <div className="modal-footer" style={{ justifyContent: hasActiveDiscount ? 'space-between' : 'flex-end' }}>
              {hasActiveDiscount && (
                <div className="flex gap-2">
                  <button className="btn btn-neu btn-sm" onClick={() => handleCancelDiscount(false)} disabled={cancelStudentDiscount.isPending}>Cancel (from next semester)</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleCancelDiscount(true)} disabled={cancelStudentDiscount.isPending}>Cancel Immediately</button>
                </div>
              )}
              <div className="flex gap-2">
                <button className="btn btn-neu" onClick={() => setDiscountModalOpen(false)}>Close</button>
                <button className="btn btn-primary" onClick={handleSaveDiscount} disabled={assignStudentDiscount.isPending || updateStudentDiscount.isPending}>
                  <i className="lni lni-checkmark"></i> {assignStudentDiscount.isPending || updateStudentDiscount.isPending ? 'Saving…' : hasActiveDiscount ? 'Update Terms' : 'Assign Discount'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </>
  )
}

export default function Page() {
  return (
    <Suspense>
      <StudentProfileContent />
    </Suspense>
  )
}
