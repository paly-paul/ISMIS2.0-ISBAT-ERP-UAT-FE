'use client'
import { useEffect, useRef, useState } from 'react'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
// import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import { SuccessPopup } from '@/components/modals/shared/SuccessPopup'
import { useSearchStudentsInfinite, useStudentProfile } from '@/hooks/finance/usePaymentConsole'
import { refugeeLabel, studCategoryLabel } from '@/lib/api/finance/paymentConsole'
import { useStudent } from '@/hooks/student/useStudents'
import { useTerminationReasonsDropdown } from '@/hooks/student/useTerminationReasons'
import { useTerminateStudent } from '@/hooks/student/useStudentTermination'
import { AuthError } from '@/lib/api/client'

// Terminates a student mid-program — POST /students/{studentGuid}/terminate
// (student-termination/post-terminate-student.md), per request (2026-09-15).
// Student search reuses Payment Console's own generic search/profile flow
// (useSearchStudentsInfinite/useStudentProfile — same one Payment Refund and
// NCHE & Guild Payment already reuse) rather than a dedicated picker, since
// none is documented for this workflow. Termination itself is irreversible
// (sets StudActive = 0, a terminal state later fee-recalculation can't
// revert — see the doc's own description) — gated behind the same
// confirm-modal-overlay/confirm-modal-pop → SuccessPopup swap
// NCHE & Guild Payment's own Delete flow uses for its one other
// no-undo action on this app.

function applicantName(a: { firstName: string | null; lastName: string | null }) {
  return `${a.firstName ?? ''}${a.lastName ? ` ${a.lastName}` : ''}`.trim() || '—'
}
const MIN_SEARCH_CHARS = 3

function searchResultName(a: { studentName: string | null; firstName: string | null }) {
  return a.studentName || a.firstName || '—'
}
function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '—'
}

export default function TerminateStudentPage() {
  // Permission checks disabled for now — every action is allowed. Restore the
  // line below (and the import above) to gate actions by the menu permissions again.
  // const permissions = usePagePermissions()
  const permissions = { add: true, edit: true, delete: true }
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // Same live-typing infinite-scroll search dropdown as Payment Refund's/
  // NCHE & Guild's own Student Search — opens on focus, narrows as you type.
  const [search, setSearch] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const searchBoxRef = useRef<HTMLDivElement>(null)
  const [selectedApplicationGuid, setSelectedApplicationGuid] = useState<string | null>(null)
  const [selectedStudentGuidHint, setSelectedStudentGuidHint] = useState<string | null>(null)

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

  // Same 3-character minimum as Discount Allocation — the backend's search
  // only returns results from 3 characters. Empty still lists everyone.
  const searchTermLen = committedSearch.trim().length
  const searchTooShort = searchTermLen > 0 && searchTermLen < MIN_SEARCH_CHARS
  const {
    data: searchPages, fetchNextPage, hasNextPage, isFetchingNextPage,
    isFetching: isSearching, isError: isSearchError,
  } = useSearchStudentsInfinite(
    committedSearch, 20,
    searchFocused && !searchTooShort,
  )
  const matches = searchTooShort ? [] : searchPages?.pages.flatMap(p => p.items) ?? []

  function handleSearchResultsScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!hasNextPage || isFetchingNextPage) return
    const el = e.currentTarget
    if (el.scrollTop > 0 && el.scrollHeight - el.scrollTop - el.clientHeight < 48) fetchNextPage()
  }

  const { data: profile, isLoading: isProfileLoading, isError: isProfileError } = useStudentProfile(selectedApplicationGuid, !!selectedApplicationGuid, selectedStudentGuidHint)
  const studentGuid = profile?.studentGuid ?? selectedStudentGuidHint ?? null

  // Current active/inactive status — resolved off get-student-by-guid, the
  // one field the Payment Console profile shape above doesn't carry
  // (StudentDetailDto.studActive). Only fetched once a real studentGuid is
  // known (an application with no linked student record yet has nothing to
  // terminate — see the "select a student" empty state below).
  const { data: studentDetail, isLoading: isStudentDetailLoading } = useStudent(studentGuid, !!studentGuid)

  // Students terminated from this page during the current visit. The live
  // GET /students/{guid} response doesn't include studActive (confirmed
  // 2026-09-28), so without this the page can't tell a student it just
  // terminated from an active one. Lost on reload — until the backend
  // exposes studActive, a reload shows the status as unknown, not Active.
  const [terminatedGuids, setTerminatedGuids] = useState<Set<string>>(new Set())
  const terminatedHere = !!studentGuid && terminatedGuids.has(studentGuid)
  const alreadyTerminated = terminatedHere || studentDetail?.studActive === 0
  // Status badge: Terminated once terminated (here or already on the
  // server), otherwise Active — per request, 2026-10-01. Reg status itself
  // is shown separately in the facts grid below.
  const statusLabel = alreadyTerminated ? 'Terminated' : 'Active'

  const { data: reasons = [], isLoading: isReasonsLoading } = useTerminationReasonsDropdown('', true)
  const [terminationReasonGuid, setTerminationReasonGuid] = useState('')
  const [remarks, setRemarks] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [successInfo, setSuccessInfo] = useState<{ title: string; subtitle: string } | null>(null)

  const terminateStudent = useTerminateStudent()
  const selectedReason = reasons.find(r => r.terminationReasonGuid === terminationReasonGuid)

  function resetForm() {
    setTerminationReasonGuid('')
    setRemarks('')
  }

  function selectStudent(applicationGuid: string, name: string, studentGuidHint: string | null) {
    setSelectedApplicationGuid(applicationGuid)
    setSelectedStudentGuidHint(studentGuidHint)
    setSearch(name)
    setCommittedSearch('')
    setSearchFocused(false)
    resetForm()
    showToast(`Loaded: ${name}`, 'success')
  }

  function clearSelection() {
    setSelectedApplicationGuid(null)
    setSelectedStudentGuidHint(null)
    setSearch('')
    setCommittedSearch('')
    resetForm()
  }

  function handleClear() {
    clearSelection()
    showToast('Form cleared.', 'warn')
  }

  function handleTerminateClick() {
    // if (!permissions.add) { showToast('You do not have permission to terminate students.', 'warn'); return }
    if (!studentGuid) { showToast('This application has no linked student record — nothing to terminate.', 'warn'); return }
    if (alreadyTerminated) { showToast('This student is already terminated.', 'warn'); return }
    if (!terminationReasonGuid) { showToast('Please select a termination reason.', 'warn'); return }
    setConfirmOpen(true)
  }

  function confirmTerminate() {
    if (!studentGuid || !selectedReason) return
    terminateStudent.mutate(
      { studentGuid, input: { terminationReasonGuid, remarks: remarks.trim() || null } },
      {
        onSuccess: () => {
          setTerminatedGuids(prev => new Set(prev).add(studentGuid))
          setSuccessInfo({
            title: 'Student Terminated',
            subtitle: `${applicantName(profile ?? { firstName: null, lastName: null })} has been terminated — reason: ${selectedReason.reasonName}.`,
          })
          resetForm()
        },
        onError: (error: Error) => {
          showToast(error instanceof AuthError ? error.message : (error.message || 'Failed to terminate student. Please try again.'), 'error')
        },
      },
    )
  }

  function closeConfirm() {
    // The terminated student stays on screen (badge flips to Terminated via
    // terminatedGuids) — "New Search" in the header clears the page.
    setConfirmOpen(false)
    setSuccessInfo(null)
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Terminate Student</div>
            <div className="pg-sub">Search student → pick a reason → terminate</div>
          </div>
          {selectedApplicationGuid && (
            <button className="btn btn-neu" onClick={handleClear}><i className="lni lni-reload"></i> New Search</button>
          )}
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-search-alt"></i></span> Student Search</div>
          </div>
          <div className="fg" style={{ marginBottom: 0, position: 'relative' }} ref={searchBoxRef}>
            <div className="lbl">Search by Applicant Name, Ref No, Phone, or Email <span className="req">*</span></div>
            <div className="inp-wrap">
              <span className="inp-icon"><i className="lni lni-search-alt"></i></span>
              <input
                className="ctrl"
                type="text"
                placeholder="e.g. APP20222/667 or Tumukunde Alice"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={e => { if (e.key === 'Enter') setCommittedSearch(search.trim()) }}
              />
            </div>

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
                {searchTooShort ? (
                  <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Type at least {MIN_SEARCH_CHARS} characters to search.</div>
                ) : isSearching && matches.length === 0 ? (
                  <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Searching…</div>
                ) : isSearchError ? (
                  <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Search failed. Please try again.</div>
                ) : matches.length === 0 ? (
                  <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No matching applications found.</div>
                ) : (
                  <>
                    {matches.map(a => (
                      <div
                        key={a.applicationGuid}
                        className="cursor-pointer px-3 py-2 hover:bg-b50 border-b border-g100 last:border-b-0"
                        onMouseDown={() => selectStudent(a.applicationGuid, searchResultName(a), a.studentGuid)}
                      >
                        <div className="font-bold">{searchResultName(a)}</div>
                        <div className="text-g500" style={{ fontSize: 11 }}>{a.appRefNo}{a.phone ? ` · ${a.phone}` : ''}{a.emailId ? ` · ${a.emailId}` : ''}</div>
                      </div>
                    ))}
                    {isFetchingNextPage && (
                      <div className="text-g400 text-center" style={{ padding: 10, fontSize: 11.5 }}>Loading more…</div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {selectedApplicationGuid && (
          <>
            {isProfileLoading ? (
              <div className="card text-g400 text-center" style={{ padding: 24, fontSize: 12.5 }}>Loading profile…</div>
            ) : isProfileError || !profile ? (
              <div className="card text-clr-red text-center" style={{ padding: 24, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load this student&apos;s profile.</div>
            ) : (
              <div className="card p-0 overflow-hidden">
                <div className="pc-hero">
                  <div className="pc-hero-top">
                    <div className="pc-hero-avatar">{initialsFor(applicantName(profile))}</div>
                    <div className="flex-1 min-w-0">
                      <div className="pc-hero-name truncate">{applicantName(profile)}</div>
                      <div className="pc-hero-sub truncate">{profile.programName ?? '—'}</div>
                      <span className="pc-hero-badge"><i className="lni lni-bookmark"></i> {profile.appRefNo}</span>
                    </div>
                    {!isStudentDetailLoading && (studentDetail || alreadyTerminated) && (
                      <div className="pc-hero-actions pc-hero-actions-top">
                        <span className={`badge ${alreadyTerminated ? 'badge-red' : 'badge-green'}`}>{statusLabel}</span>
                      </div>
                    )}
                  </div>
                  <div className="pc-hero-facts">
                    <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Semester</span><span className="pc-hero-fact-val" title={profile.semesterName ?? '—'}>{profile.semesterName ?? '—'}</span></div>
                    <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Intake</span><span className="pc-hero-fact-val" title={profile.intakeCode && profile.intakeCode !== 'null' ? profile.intakeCode : '—'}>{profile.intakeCode && profile.intakeCode !== 'null' ? profile.intakeCode : '—'}</span></div>
                    <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Batch</span><span className="pc-hero-fact-val" title={profile.batchCode ?? '—'}>{profile.batchCode ?? '—'}</span></div>
                    <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Reg No</span><span className="pc-hero-fact-val" title={profile.studentRegNo ?? '—'}>{profile.studentRegNo ?? '—'}</span></div>
                    <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Phone</span><span className="pc-hero-fact-val" title={profile.phone ?? '—'}>{profile.phone ?? '—'}</span></div>
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

            {!studentGuid && !isProfileLoading && profile && (
              <div className="card text-center" style={{ padding: 24 }}>
                <i className="lni lni-warning" style={{ color: 'var(--amber)', fontSize: 20 }}></i>
                <div className="font-bold text-g700 mt-2" style={{ fontSize: 13.5 }}>No linked student record</div>
                <div className="text-g400 mt-1" style={{ fontSize: 12.5 }}>This application has never been registered as a student — there is nothing to terminate.</div>
              </div>
            )}

            {studentGuid && alreadyTerminated && (
              <div className="warn-box">
                <i className="lni lni-warning" style={{ color: 'var(--amber)', fontSize: 15, flexShrink: 0, marginTop: 1 }}></i>
                <div>This student has already been terminated. Search for another student to continue.</div>
              </div>
            )}

            {studentGuid && !alreadyTerminated && (
              <div className="card">
                <div className="card-hdr">
                  <div className="card-title"><span className="ctitle-icon"><i className="lni lni-shield"></i></span> Termination</div>
                </div>

                <div className="fg mb-[14px]">
                  <div className="lbl">Termination Reason <span className="req">*</span></div>
                  <SearchSelect
                    placeholder="— Select a reason —"
                    options={reasons.map(r => ({ value: r.terminationReasonGuid, label: r.reasonName }))}
                    value={terminationReasonGuid}
                    onChange={setTerminationReasonGuid}
                    disabled={isReasonsLoading || reasons.length === 0}
                  />
                  {isReasonsLoading ? (
                    <div className="text-g400 mt-1" style={{ fontSize: 11 }}>Loading termination reasons…</div>
                  ) : reasons.length === 0 ? (
                    <div className="text-g400 mt-1" style={{ fontSize: 11 }}>No termination reasons configured yet — add one in Termination Reason Master first.</div>
                  ) : null}
                </div>

                <div className="fg mb-4">
                  <div className="lbl">Remarks</div>
                  <textarea className="ctrl" rows={2} placeholder="Reason detail captured on the student's record" value={remarks} onChange={e => setRemarks(e.target.value)} />
                </div>

                <div className="flex gap-[10px] justify-end flex-wrap">
                  <button className="btn btn-neu" onClick={resetForm}><i className="lni lni-close"></i> Cancel</button>
                  <button className="btn btn-danger" disabled={!terminationReasonGuid} onClick={handleTerminateClick}>
                    <i className="lni lni-shield"></i> Terminate Student
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirm-then-success flow — same confirm-modal-overlay/
          confirm-modal-pop + modal-hdr-blue markup, swapped over to the
          shared SuccessPopup once the mutation actually succeeds, as
          NCHE & Guild Payment's own Delete confirm step uses. Termination
          is irreversible, same reasoning as that Delete action. */}
      {confirmOpen && (
        <div className="modal-overlay open confirm-modal-overlay">
          <div className="modal modal-sm confirm-modal-pop" onClick={e => e.stopPropagation()}>
            {successInfo ? (
              <SuccessPopup title={successInfo.title} subtitle={successInfo.subtitle} onClose={closeConfirm} />
            ) : (
              <>
                <div className="modal-hdr modal-hdr-blue">
                  <div className="modal-title">Confirm Termination</div>
                  <button className="modal-close" onClick={closeConfirm}><i className="lni lni-close"></i></button>
                </div>
                <div style={{ padding: '18px 20px', fontSize: 13.5, color: 'var(--g700)', lineHeight: 1.6 }}>
                  Terminate <strong>{applicantName(profile ?? { firstName: null, lastName: null })}</strong> with reason <strong>{selectedReason?.reasonName}</strong>? This sets the student inactive and cannot be undone from this page.
                </div>
                <div className="modal-footer">
                  <button className="btn btn-neu" onClick={closeConfirm}>Cancel</button>
                  <button className="btn btn-danger" disabled={terminateStudent.isPending} onClick={confirmTerminate}>
                    <i className="lni lni-shield"></i> {terminateStudent.isPending ? 'Terminating…' : 'Confirm & Terminate'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </>
  )
}
