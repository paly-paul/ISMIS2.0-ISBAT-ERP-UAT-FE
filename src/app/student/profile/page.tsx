'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { ActionMenu } from '@/components/ActionMenu'
import { StudentLookup } from '@/components/student/StudentLookup'
import { useStudent } from '@/hooks/student/useStudents'
import { StudentDto, normalizeStudentDetail } from '@/lib/api/student/student'
import { useIdCard, useIssueOrRenewIdCard, useUpdateIdCardDates, getIdCardQrImageUrl, currentCardIssue } from '@/hooks/student/useIdCards'
import { useSponsorDetails } from '@/hooks/student/useSponsor'
import { useStudentRefugeeDetails } from '@/hooks/student/useRefugee'
import { useDropoutStudents } from '@/hooks/student/useDropoutRejoin'
import { useCountries } from '@/hooks/config/useCountries'
import { useIntakesDropdown } from '@/hooks/academic/useIntakes'
import { formatDate } from '@/lib/date'
// import { usePagePermissions } from '@/hooks/users/usePagePermissions'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Ported from isbat_student_module.html's Student Profile page. Identity/
// academic fields (name, programme, semester, batch, status) come from the
// real GET /api/v1/students/:guid (useStudent) once a student is loaded via
// StudentLookup. The ID Card tab is now wired to the real students/id-cards/*
// endpoints (see students/id-cards/*.md). Sponsor is read-only here and
// links through to Student Master's StudentSponsorModal (assign/change).
// Discount is read-only here (the
// StudentDetailDto discount fields useStudent already carries) — its value
// links through to Finance's Discount Allocation, which owns assign/update/
// cancel.
// Refugee status is read-only here (students/refugee GET) — its value links
// through to Student Master, whose StudentRefugeeModal owns assign/remove.
// Sponsor's own dedicated GET endpoint is never fetched from this page (per
// request, 2026-09-01). Refugee's is fetched on load, since the Refugee
// Details card's visibility depends on it — see each hook call's comment.
// Fee structure display and the communication dispatch audit
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

// "15%" for a percentage, "Amt 600,000" for an amount. No currency — the
// discount records carry none.
function formatDiscountValue(amtPer: number, isPercentage: boolean, isAmount: boolean) {
  const value = amtPer.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (isPercentage) return `${value}%`
  if (isAmount) return `Amt ${value}`
  return value
}

// calcType is documented ("1" = Amount, "2" = Percentage) on the
// student-discounts assign/update endpoints; StudentDetailDto carries the
// same field for whatever discount is already resolved onto the student.
function formatDiscount(detail: { discountStatus: string | null; calcType: string | null; amtPer: number | null } | undefined) {
  if (!detail?.discountStatus || detail.discountStatus === 'Cancelled' || detail.discountStatus === 'CancelledImmediate') return 'None'
  return detail.amtPer != null ? formatDiscountValue(detail.amtPer, detail.calcType === '2', detail.calcType === '1') : detail.discountStatus
}

function StudentProfileContent() {
  // Permission checks disabled for now — every action is allowed. Restore the
  // line below (and the import above) to gate actions by the menu permissions again.
  // const permissions = usePagePermissions()
  const permissions = { add: true, edit: true, delete: true }
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
  // Student Master's View adds &from=student-master. Held in state since
  // the params get stripped (handleClear). router.back() returns to Student
  // Master's own URL, which carries its page/search/filters.
  const [cameFromStudentMaster] = useState(() => searchParams.get('from') === 'student-master')
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

  // Intakes arrive as bare codes (joinedIntake "20222" on the detail,
  // academicIntake 20241 on Student Master's list rows) — resolved to their
  // description via the intakes dropdown. A code missing from it still shows
  // as the raw code rather than nothing.
  const { data: intakes = [] } = useIntakesDropdown()
  function intakeInfo(code: string | number | null | undefined) {
    if (code === null || code === undefined || code === '') return null
    const match = intakes.find(i => String(i.intakeCode) === String(code))
    return { code: String(code), label: match?.description ? `${match.description} (${code})` : String(code), isCurrent: !!match?.currentIntake }
  }
  const joinedIntake = intakeInfo(detail?.joinedIntake)
  const academicIntake = intakeInfo(student?.academicIntake ?? detail?.academicIntake)

  // Real ID-card record — GET /students/id-cards/{studentGuid}. Resolves to
  // null when the student has no card yet (404 not_found is the common case,
  // not an error — see getIdCardDetails).
  const { data: card } = useIdCard(student?.studentGuid ?? null, !!student)
  const issueOrRenewIdCard = useIssueOrRenewIdCard()
  const updateIdCardDates = useUpdateIdCardDates(student?.studentGuid ?? null)

  // Sponsor is read-only here (assign/change lives in Student Master's
  // StudentSponsorModal). Never fetched from this page (per 2026-09-01, no
  // eager sponsor-details call) — enabled: false only reads the shared
  // react-query cache, so a sponsor just assigned in the modal shows here
  // straight away; otherwise it falls back to StudentDetailDto's own
  // detail?.sponsor, already fetched by useStudent above.
  const { data: sponsorDetail } = useSponsorDetails(student?.studentGuid ?? null, false)

  // Real refugee-status record — GET /students/refugee/{guid}, resolves to
  // null when the student has no record yet (404 not_found is the common
  // case, not an error — see getStudentRefugeeDetails). Fetched as soon as a
  // student loads again (was on-demand behind a "Check status" click, per
  // 2026-09-01) — the Profile Info tab's Refugee Details card only renders
  // when a record exists, so the answer is needed up front to decide that.
  const { data: refugeeDetail, isLoading: isRefugeeChecking } = useStudentRefugeeDetails(student?.studentGuid ?? null, !!student)

  // The Dropout Rejoin action only applies to dropped-out students — the
  // rejoin candidate endpoint rejects anyone else ("Student is not a
  // dropout."). The student detail response carries no reg status, so this
  // checks membership in the dropout list (GET /students/dropout-rejoin),
  // the same list Dropout Rejoin itself shows — searched by reg no. (an
  // exact match server-side) so it isn't limited to the list's first page.
  const regNo = student?.studentRegNo ?? ''
  const { data: dropoutMatch } = useDropoutStudents({ searchTerm: regNo, page: 1, pageSize: 25 }, !!regNo)
  const isDropout = !!student && !!dropoutMatch?.items.some(d => d.studentGuid === student.studentGuid)
  // Supporting-document preview popup. Images render as <img>; anything
  // else (PDF, etc.) goes in an iframe and relies on the browser's viewer.
  const [docPreviewOpen, setDocPreviewOpen] = useState(false)
  const refugeeDocUrl = refugeeDetail?.documentUrl ?? null
  const refugeeDocIsImage = !!refugeeDocUrl && /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(refugeeDocUrl)
  // Resolves the ID card's Nationality — GET /students/{guid} returns
  // nationality: null alongside a populated nationalityGuid (confirmed live
  // 2026-09-28), so the name has to come from the country catalogue. Same
  // fallback chain as StudentProfileModal; the guid has been seen not to
  // match any catalogue row, in which case it stays '—'.
  const nationalityGuid = detail?.nationalityGuid ?? detail?.applicationSummary?.countryGuid ?? null
  const needsCountryLookup = !detail?.nationality && !detail?.nationalityCode && !!nationalityGuid
  const { data: countries = [] } = useCountries(needsCountryLookup)
  const nationality = detail?.nationality
    || detail?.nationalityCode
    || countries.find(c => c.countryGuid === nationalityGuid)?.nationality
    || '—'

  // Personal-info edit form — seeded from the loaded record, editable but
  // not wired to any save endpoint (none confirmed for this workflow).
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [gender, setGender] = useState('')

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


  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  useEffect(() => {
    if (!student) return
    const parts = student.studentName.trim().split(/\s+/)
    const derivedEmail = `${studentNo.toLowerCase().replace(/[^a-z0-9]/g, '.')}@isbat.ac.ug`
    setFirstName(parts[0] ?? '')
    setLastName(parts.slice(1).join(' '))
    // Gender field is display-only now — was previously a hardcoded
    // 'Female' default regardless of the actual student (never wired to
    // real data since it was editable and no save endpoint existed for it
    // either). student (StudentDto, the list/search shape) has no gender
    // field at all — only StudentDetailDto (`detail`) does — so this seeds
    // from whatever `detail` already has at the time `student` changes; the
    // effect below corrects it once `detail` itself actually resolves.
    setGender(detail?.gender || '—')
    // Communication tab's student contact seeds from the real record, same
    // as gender — the effect below corrects it once `detail` resolves.
    setStuEmail(detail?.email || '')
    setStuPhone(detail?.phone || '')
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

  // Gender specifically re-seeded off `detail` on its own, separate from the
  // reset-everything effect above — `detail` (useStudent(effectiveStudentGuid))
  // almost always resolves after `student` itself (student.gender is only
  // populated when it was seeded from a prior detail fetch via
  // normalizeStudentDetail, e.g. the URL-driven ?studentGuid= flow; a
  // StudentLookup search result typically won't carry it), so this corrects
  // gender once the real value actually arrives instead of leaving it on
  // whatever the effect above had at the time (stale, or the '—' fallback).
  useEffect(() => {
    if (detail?.gender) setGender(detail.gender)
    if (detail?.email) setStuEmail(detail.email)
    if (detail?.phone) setStuPhone(detail.phone)
  }, [detail])

  function handleLoad(s: StudentDto) { setStudent(s); showToast(`${s.studentName} profile loaded`, 'ok') }
  function handleClear() {
    setStudent(null)
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

  function handleIssueCard() {
    if (!student) return
    const isRenew = Boolean(currentCard)
    const payloadJoining = joiningDate ? (joiningDate.includes('T') ? joiningDate : `${joiningDate}T00:00:00`) : null
    const payloadExpiry = expiryDate ? (expiryDate.includes('T') ? expiryDate : `${expiryDate}T00:00:00`) : null
    issueOrRenewIdCard.mutate(
      { studentGuid: student.studentGuid, joiningDate: payloadJoining, expiryDate: payloadExpiry, remarks: cardRemarks || null, isRenewal: isRenew },
      {
        onSuccess: () => showToast(isRenew ? 'ID card renewed' : 'ID card issued', 'ok'),
        onError: (err: any) => showToast(err?.message || 'Could not issue ID card', 'err'),
      },
    )
  }

  function handleSaveCard() {
    if (!student) return
    if (currentCard) {
      updateIdCardDates.mutate(
        { cardIssueId: currentCard.cardIssueId, payload: { joiningDate, expiryDate } },
        { onSuccess: () => showToast('Card dates updated', 'ok'), onError: () => showToast('Could not update card dates', 'err') },
      )
    } else {
      handleIssueCard()
    }
  }

  function handleRenewCard() {
    if (!student) return
    const payloadJoining = joiningDate ? (joiningDate.includes('T') ? joiningDate : `${joiningDate}T00:00:00`) : null
    const payloadExpiry = expiryDate ? (expiryDate.includes('T') ? expiryDate : `${expiryDate}T00:00:00`) : null
    issueOrRenewIdCard.mutate(
      { studentGuid: student.studentGuid, joiningDate: payloadJoining, expiryDate: payloadExpiry, remarks: cardRemarks || null, isRenewal: true },
      { onSuccess: () => showToast('Card renewed', 'ok'), onError: (err: any) => showToast(err?.message || 'Could not renew card', 'err') },
    )
  }

  function handleDownloadCard() {
    if (!student) return
    const a = document.createElement('a')
    a.href = getIdCardQrImageUrl(student.studentGuid)
    a.download = `ID_Card_QR_${student.studentRegNo || student.studentNum || 'student'}.png`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    showToast('ID card QR downloaded', 'ok')
  }

  function handlePrintCard() {
    // Scopes the print to the card preview only — see .printing-id-card in globals.css.
    document.body.classList.add('printing-id-card')
    window.addEventListener('afterprint', () => document.body.classList.remove('printing-id-card'), { once: true })
    window.print()
  }

  // Sponsor is read-only here too — assigning/changing lives in Student
  // Master's StudentSponsorModal, which this deep-links to via ?sponsorFor=.
  function handleManageSponsor() {
    if (!student) return
    router.push(`/student/student-master?sponsorFor=${student.studentGuid}&studentName=${encodeURIComponent(student.studentName)}`)
  }

  // Refugee status is read-only here — granting/removing lives in Student
  // Master's own StudentRefugeeModal, which this deep-links to (the modal
  // opens pre-loaded for this student via ?refugeeFor=).
  function handleManageRefugee() {
    if (!student) return
    router.push(`/student/student-master?refugeeFor=${student.studentGuid}&studentName=${encodeURIComponent(student.studentName)}`)
  }

  // Discount is read-only here too — assign/update/cancel lives on Finance's
  // Discount Allocation page, which this deep-links to pre-loaded with the
  // student (it searches by applicationGuid, with studentGuid as a hint).
  function handleManageDiscount() {
    if (!student) return
    const params = new URLSearchParams({ studentGuid: student.studentGuid, studentName: student.studentName })
    const applicationGuid = detail?.applicationSummary?.applicationGuid
    if (applicationGuid) params.set('applicationGuid', applicationGuid)
    router.push('/finance/discount-allocation?' + params.toString())
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div><div className="pg-title">Student Profile</div><div className="pg-sub">Search a student or navigate from Student Master to view and edit their profile</div></div>
          {cameFromStudentMaster && (
            <button className="btn btn-neu btn-sm" onClick={() => router.back()}><i className="lni lni-arrow-left"></i> Back to Student Master</button>
          )}
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
                    {/* studentNo falls back to the reg no. when studentNum is
                        missing (see studentNo above) — only show the reg no.
                        separately when it's actually a different value. */}
                    <span className="pc-hero-badge">
                      <i className="lni lni-bookmark"></i> {studentNo}
                      {(() => { const regNo = student.studentRegNo || detail?.regNo; return regNo && regNo !== studentNo ? ` · ${regNo}` : null })()}
                    </span>
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
                  {permissions.edit && (
                    <ActionMenu tooltip="Student Actions">
                      {/* lni-transfer isn't a real LineIcons 4.0 class (silently renders
                          nothing) — lni-shuffle is what the sidebar leaf uses for this
                          same page, see menu.ts. */}
                      <button className="btn btn-neu btn-sm" onClick={() => router.push('/student/batch-transfer?studentGuid=' + student.studentGuid)}><i className="lni lni-shuffle"></i> Batch Transfer</button>
                      <button className="btn btn-neu btn-sm" onClick={() => router.push('/student/prog-transfer?studentGuid=' + student.studentGuid)}><i className="lni lni-graduation"></i> Prog. Transfer</button>
                      <button className="btn btn-neu btn-sm" onClick={() => router.push('/student/learning-mode?studentGuid=' + student.studentGuid)}><i className="lni lni-display"></i> Learning Mode</button>
                      {isDropout && <button className="btn btn-neu btn-sm" onClick={() => router.push('/student/intake-transfer?studentGuid=' + student.studentGuid)}><i className="lni lni-calendar"></i> Dropout Rejoin</button>}
                    </ActionMenu>
                  )}
                </div>
                <div className="pc-hero-facts">
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Batch</span><span className="pc-hero-fact-val" title={student.batchCode || detail?.batch || '—'}>{student.batchCode || detail?.batch || '—'}</span></div>
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Semester</span><span className="pc-hero-fact-val" title={student.semesterName || detail?.semester || '—'}>{student.semesterName || detail?.semester || '—'}</span></div>
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Campus</span><span className="pc-hero-fact-val" title={detail?.campus || '—'}>{detail?.campus || '—'}</span></div>
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Joined Intake</span><span className="pc-hero-fact-val" title={joinedIntake?.label || '—'}>{joinedIntake?.label || '—'}</span></div>
                </div>
              </div>
              <div className="stu-meta-row">
                {/* Fee Structure still has no field on any student response — left as an
                    illustrative placeholder. Learning Mode reads detail.learningMode. */}
                <div className="stu-meta-item"><div className="stu-meta-lbl">Fee Structure</div><div className="stu-meta-val">Local</div></div>
                <div className="stu-meta-item">
                  <div className="stu-meta-lbl">Sponsor</div>
                  <div className="stu-meta-val" style={{ cursor: 'pointer' }} onClick={handleManageSponsor} title="Assign or change sponsor in Student Master">
                    {sponsorDetail?.category ?? detail?.sponsor ?? 'Unassigned'} <i className="lni lni-arrow-right" style={{ fontSize: 10 }}></i>
                  </div>
                </div>
                <div className="stu-meta-item">
                  <div className="stu-meta-lbl">Discount</div>
                  <div className="stu-meta-val" style={{ cursor: 'pointer' }} onClick={handleManageDiscount} title="Manage discount in Discount Allocation">
                    {formatDiscount(detail)}
                    {' '}<i className="lni lni-arrow-right" style={{ fontSize: 10 }}></i>
                  </div>
                </div>
                <div className="stu-meta-item">
                  <div className="stu-meta-lbl">Refugee Status</div>
                  {isRefugeeChecking ? (
                    <div className="stu-meta-val text-g400">Checking…</div>
                  ) : (
                    <div className="stu-meta-val" style={{ cursor: 'pointer' }} onClick={handleManageRefugee} title="Manage refugee status in Student Master">
                      {refugeeDetail ? `Refugee · ID ${refugeeDetail.refugeeId}` : 'Not a refugee'} <i className="lni lni-arrow-right" style={{ fontSize: 10 }}></i>
                    </div>
                  )}
                </div>
                <div className="stu-meta-item"><div className="stu-meta-lbl">Learning Mode</div><div className="stu-meta-val">{detail?.learningMode || '—'}</div></div>
                <div className="stu-meta-item"><div className="stu-meta-lbl">Registration No.</div><div className="stu-meta-val">{student.studentRegNo || detail?.regNo}</div></div>
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
                  <div className="card-hdr"><div className="card-title"><i className="lni lni-user"></i> Personal Information</div><span className="badge badge-grey">Read-only</span></div>
                  <div className="g3">
                    <div className="fg"><label className="lbl">First Name</label><input className="ctrl" readOnly value={firstName} /></div>
                    <div className="fg"><label className="lbl">Last Name</label><input className="ctrl" readOnly value={lastName} /></div>
                    <div className="fg"><label className="lbl">Gender</label><input className="ctrl" readOnly value={gender} /></div>
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
                  </div>
                </div>
                <div className="card">
                  <div className="card-hdr"><div className="card-title"><i className="lni lni-calendar"></i> Intake Details</div><span className="badge badge-grey">Read-only</span></div>
                  <div className="g3">
                    <div className="fg">
                      <label className="lbl">Joined Intake</label>
                      <input className="ctrl" readOnly value={joinedIntake?.label || '—'} />
                      <div className="text-g500" style={{ fontSize: 11, marginTop: 4 }}>The intake the student was admitted in.</div>
                    </div>
                    <div className="fg">
                      <label className="lbl">Academic Intake {academicIntake?.isCurrent && <span className="badge badge-green" style={{ marginLeft: 4 }}>Current</span>}</label>
                      <input className="ctrl" readOnly value={academicIntake?.label || '—'} />
                      <div className="text-g500" style={{ fontSize: 11, marginTop: 4 }}>The intake the student is currently studying in.</div>
                    </div>
                    <div className="fg">
                      <label className="lbl">Registration Date</label>
                      <input className="ctrl" readOnly value={detail?.regDate ? formatDate(detail.regDate) : '—'} />
                    </div>
                  </div>
                  <div className="info-box"><i className="lni lni-information" style={{ color: 'var(--b700)', fontSize: 15, flexShrink: 0 }}></i><div style={{ fontSize: 12 }}>To change Batch, Programme, Learning Mode, or Intake — use the quick-action buttons in the banner above or navigate via the Operations section in the sidebar.</div></div>
                </div>
                <div className="card">
                  <div className="card-hdr"><div className="card-title"><i className="lni lni-home"></i> Contact</div><span className="badge badge-grey">Read-only</span></div>
                  <div className="g3">
                    <div className="fg"><label className="lbl">Primary Email</label><input className="ctrl" readOnly value={detail?.email || '—'} /></div>
                    <div className="fg"><label className="lbl">Mobile / WhatsApp</label><input className="ctrl" readOnly value={detail?.phone || '—'} /></div>
                  </div>
                </div>
                {/* Only rendered when the student has a refugee record —
                    GET /students/refugee/{guid} resolves to null otherwise.
                    Changes go through Student Master (handleManageRefugee). */}
                {refugeeDetail && (
                  <div className="card">
                    <div className="card-hdr">
                      <div className="card-title"><i className="lni lni-shield"></i> Refugee Details</div>
                      <span className="badge badge-grey">Read-only</span>
                    </div>
                    <div className="g3">
                      <div className="fg"><label className="lbl">Refugee Status</label><input className="ctrl" readOnly value="Refugee" /></div>
                      <div className="fg"><label className="lbl">Refugee ID</label><input className="ctrl" readOnly value={refugeeDetail.refugeeId || '—'} /></div>
                      <div className="fg">
                        <label className="lbl">Supporting Document</label>
                        {refugeeDetail.documentUrl
                          ? <button className="btn btn-neu" onClick={() => setDocPreviewOpen(true)}><i className="lni lni-eye"></i> View Document</button>
                          : <input className="ctrl" readOnly value="—" />}
                      </div>
                    </div>
                    <div className="info-box"><i className="lni lni-information" style={{ color: 'var(--b700)', fontSize: 15, flexShrink: 0 }}></i><div style={{ fontSize: 12 }}>To grant or remove refugee status, use the Refugee Status field in the banner above — it opens Student Master.</div></div>
                  </div>
                )}
                {/* Profile Info is display-only for now — no update endpoint wired yet.
                    Restore these (and the editable inputs above) once editing is supported. */}
                {/* <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginBottom: 20 }}>
                  <button className="btn btn-neu">Discard</button>
                  {permissions.edit && <button className="btn btn-primary" onClick={() => showToast('Profile saved', 'ok')}><i className="lni lni-save"></i> Save Profile</button>}
                </div> */}
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
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleIssueCard}
                        disabled={issueOrRenewIdCard.isPending}
                      >
                        <i className="lni lni-credit-cards"></i> {issueOrRenewIdCard.isPending ? 'Issuing…' : 'Issue Card'}
                      </button>
                      {currentCard && (
                        <>
                          <button className="btn btn-neu btn-sm" onClick={handleRenewCard} disabled={issueOrRenewIdCard.isPending}>
                            <i className="lni lni-reload"></i> Renew
                          </button>
                          <button className="btn btn-neu btn-sm" onClick={handleSaveCard} disabled={updateIdCardDates.isPending}>
                            <i className="lni lni-save"></i> Save Dates
                          </button>
                        </>
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
                        {/* Batch Time confirmed on the id-cards DTO itself (card.batchTimeInfo.
                            batchTime), 2026-09-07. Nationality isn't on the id-cards DTO —
                            resolved from the student detail record (see `nationality` above). */}
                        <div><span style={{ color: 'rgba(255,255,255,.55)' }}>Batch Time</span> {card?.batchTimeInfo?.batchTime || '—'}</div>
                        <div><span style={{ color: 'rgba(255,255,255,.55)' }}>Nationality</span> {nationality}</div>
                        <div><span style={{ color: 'rgba(255,255,255,.55)' }}>Joining</span> {joiningDate ? formatDate(joiningDate) : '—'}</div>
                        <div><span style={{ color: 'rgba(255,255,255,.55)' }}>Expiry</span> {expiryDate ? formatDate(expiryDate) : '—'}</div>
                      </div>
                      <div className="id-bar" style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'inherit', letterSpacing: 'normal', textTransform: 'none' }}>
                        <span>REG NO {student.studentRegNo || detail?.regNo}</span>
                        <span>PRINTED {currentCard?.issueDate ? formatDate(currentCard.issueDate) : '—'}</span>
                      </div>
                    </div>
                    <div className="flex gap-2" style={{ justifyContent: 'center', marginTop: 12 }}>
                      {/* <button className="btn btn-neu btn-sm" onClick={handleDownloadCard}><i className="lni lni-download"></i> Download</button> */}
                      <button className="btn btn-primary btn-sm" onClick={handlePrintCard}><i className="lni lni-printer"></i> Print</button>
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

      {docPreviewOpen && refugeeDocUrl && (
        <div className="modal-overlay open">
          <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr"><div className="modal-title"><i className="lni lni-files"></i> Refugee Supporting Document</div><button className="modal-close" onClick={() => setDocPreviewOpen(false)}>✕</button></div>
            <div style={{ height: '70vh', background: 'var(--g100)', borderRadius: 'var(--rsm)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {refugeeDocIsImage
                ? <img src={refugeeDocUrl} alt="Refugee supporting document" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                : <iframe src={refugeeDocUrl} title="Refugee supporting document" style={{ width: '100%', height: '100%', border: 0 }} />}
            </div>
            <div className="modal-footer">
              <a className="btn btn-neu" href={refugeeDocUrl} target="_blank" rel="noopener noreferrer"><i className="lni lni-exit-up"></i> Open in New Tab</a>
              <button className="btn btn-primary" onClick={() => setDocPreviewOpen(false)}>Close</button>
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
