'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import { ScrollTable } from '@/components/ScrollTable'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { BaselinePanel } from '@/components/student/BaselinePanel'
import { SuccessPopup } from '@/components/modals/shared/SuccessPopup'
import { usePassoutCandidates, usePassoutCandidateDetail, useConfirmPassout } from '@/hooks/student/usePassoutConfirmation'
// import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import { AuthError } from '@/lib/api/client'

const PAGE_SIZE = 10
const PROGRAM_GROUPS = [
  { value: '', label: 'PCSE & PCIM (all)' },
  { value: 'PCSE', label: 'PCSE' },
  { value: 'PCIM', label: 'PCIM' },
]

// students/passout-confirmation/*.md — PCSE/PCIM have no M_PROGRAM_UNITS/
// T_EXAM_RESULT rows anywhere, so there's nothing for a marks-based Passout
// check to evaluate. Staff browse/search this deliberately unfiltered list
// (not narrowed to "final semester") and manually confirm completion; the
// confirm action re-verifies REGSTATUS = 1 + PCSE/PCIM server-side rather
// than trusting this list. Same list→candidate-detail→confirm-modal flow as
// Dropout Rejoin (intake-transfer/page.tsx), which the confirm doc itself
// cites as the pattern this shares (clone-and-deactivate on confirm).
//
// useSearchParams() requires a Suspense boundary above it (Next.js App
// Router) — same split intake-transfer/Student Profile use for the same
// reason.
function PassoutConfirmationContent() {
  // Permission checks disabled for now — every action is allowed. Restore the
  // line below (and the import above) to gate actions by the menu permissions again.
  // const permissions = usePagePermissions()
  const permissions = { add: true, edit: true, delete: true }
  const router = useRouter()
  const searchParams = useSearchParams()

  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const [selectedGuid, setSelectedGuid] = useState<string | null>(() => searchParams.get('studentGuid'))

  const [search, setSearch] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const [programGroup, setProgramGroup] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => { setCommittedSearch(search.trim()); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  const { data: candidatesPage, isLoading: listLoading, isError: listError } = usePassoutCandidates(
    page, PAGE_SIZE, { searchTerm: committedSearch || undefined, programGroup: programGroup || undefined },
  )
  const candidates = candidatesPage?.items ?? []
  const totalCount = candidatesPage?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const { data: candidate, isLoading: candidateLoading, isError: candidateError } = usePassoutCandidateDetail(selectedGuid, !!selectedGuid)

  const [remarks, setRemarks] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [successInfo, setSuccessInfo] = useState<{ title: string; subtitle: string } | null>(null)

  const confirmPassout = useConfirmPassout()

  function handlePick(studentGuid: string) { setSelectedGuid(studentGuid); setRemarks('') }
  function handleClear() {
    setSelectedGuid(null); setRemarks(''); setConfirmOpen(false)
    // Drop ?studentGuid= so a page revisit doesn't reseed the same guid.
    if (searchParams.get('studentGuid')) router.replace('/student/passout-confirmation')
  }

  function handleConfirmClick() {
    if (!permissions.edit) { showToast('You do not have permission to confirm Passout.', 'warn'); return }
    setConfirmOpen(true)
  }

  function executeConfirm() {
    if (!candidate) return
    confirmPassout.mutate(
      { studentGuid: candidate.studentGuid, payload: { remarks: remarks.trim() || undefined } },
      {
        onSuccess: () => {
          setSuccessInfo({
            title: 'Passout Confirmed',
            subtitle: `${candidate.studentName} (${candidate.studentRegNo}) has been marked as Passout.`,
          })
        },
        onError: (error: Error) => {
          showToast(error instanceof AuthError ? error.message : (error.message || 'Could not confirm Passout. Please try again.'), 'err')
        },
      },
    )
  }

  function closeConfirmModal() {
    setConfirmOpen(false)
    const wasSuccess = !!successInfo
    setSuccessInfo(null)
    if (wasSuccess) handleClear()
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Passout Confirmation</div>
            <div className="pg-sub">PCSE / PCIM students — manually confirm programme completion</div>
          </div>
          {selectedGuid && (
            <button className="btn btn-neu btn-sm" onClick={handleClear}><i className="lni lni-arrow-left"></i> Back to Candidates</button>
          )}
        </div>

        {!selectedGuid ? (
          <div className="card">
            <div className="card-hdr">
              <div className="card-title"><span className="ctitle-icon"><i className="lni lni-graduation"></i></span> Passout Candidates</div>
              <div className="flex gap-2" style={{ alignItems: 'center' }}>
                <div style={{ width: 190 }}>
                  <SearchSelect
                    placeholder="Programme Group"
                    options={PROGRAM_GROUPS}
                    value={programGroup}
                    onChange={v => { setProgramGroup(v); setPage(1) }}
                  />
                </div>
                <div className="inp-wrap w-64">
                  <span className="inp-icon"><i className="lni lni-search-alt"></i></span>
                  <input
                    className="ctrl"
                    type="text"
                    placeholder="Search by name or reg no…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { setCommittedSearch(search.trim()); setPage(1) } }}
                  />
                </div>
              </div>
            </div>

            {listError ? (
              <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load Passout candidates. Please try again.</div>
            ) : (
              <>
                <ScrollTable>
                  <table>
                    <thead><tr><th style={{ textAlign: 'left' }}>Student</th><th>Reg No.</th><th>Programme</th><th>Group</th><th>Batch</th><th></th></tr></thead>
                    <tbody>
                      {listLoading ? (
                        <TableLoadingState colSpan={6} title="Loading candidates…" />
                      ) : candidates.length === 0 ? (
                        <EmptyState
                          colSpan={6}
                          hasFilters={!!committedSearch || !!programGroup}
                          onClearFilters={() => { setSearch(''); setCommittedSearch(''); setProgramGroup(''); setPage(1) }}
                          title="No Passout candidates"
                          subtitle="No currently-Registered PCSE/PCIM students match this search."
                        />
                      ) : candidates.map(c => (
                        <tr key={c.studentGuid}>
                          <td className="font-bold" style={{ textAlign: 'left' }}>{c.studentName}</td>
                          <td className="font-mono">{c.studentRegNo}</td>
                          <td>{c.programName || '—'}</td>
                          <td><span className="badge badge-blue">{c.programGroup}</span></td>
                          <td>{c.batchCode || '—'}</td>
                          <td><button className="btn btn-neu btn-sm" onClick={() => handlePick(c.studentGuid)}><i className="lni lni-arrow-right"></i> Review</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollTable>
                <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="candidates" onPageChange={setPage} />
              </>
            )}
          </div>
        ) : (
          <>
            {candidateLoading && <div className="empty"><div className="empty-title">Loading candidate…</div></div>}

            {candidateError && (
              <div className="empty">
                <div className="empty-icon"><i className="lni lni-warning"></i></div>
                <div className="empty-title">Couldn&apos;t Load Candidate</div>
                <div className="empty-sub">This student may no longer have an active registration on record.</div>
              </div>
            )}

            {candidate && (
              <>
                <BaselinePanel
                  label="Current Standing (Read-Only)"
                  items={[
                    { label: 'Student', value: candidate.studentName },
                    { label: 'Reg No.', value: candidate.studentRegNo, accent: true },
                    { label: 'Programme', value: candidate.programName || '—' },
                    { label: 'Programme Group', value: candidate.programGroup },
                    { label: 'Semester', value: candidate.semesterName || '—' },
                    { label: 'Campus', value: candidate.campusName || '—' },
                    { label: 'Batch', value: candidate.batchCode || '—' },
                    { label: 'Status', value: <span style={{ color: 'var(--green)' }}>Registered</span> },
                  ]}
                />
                <div className="g2">
                  <div className="card">
                    <div className="card-hdr"><div className="card-title"><i className="lni lni-graduation"></i> Confirm Passout</div></div>
                    <div className="fg">
                      <label className="lbl">Remarks</label>
                      <textarea
                        className="ctrl"
                        rows={3}
                        placeholder="Optional — e.g. &quot;Confirmed complete per registrar records dated …&quot;"
                        value={remarks}
                        maxLength={500}
                        onChange={e => setRemarks(e.target.value)}
                      />
                      <div style={{ fontSize: 11.5, color: 'var(--g500)', marginTop: 4 }}>Appended to the audit record as &quot;Passout Confirmed: …&quot;. Max 500 characters.</div>
                    </div>
                    <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-neu" onClick={handleClear}>Cancel</button>
                      {permissions.edit && <button className="btn btn-primary" onClick={handleConfirmClick}><i className="lni lni-checkmark"></i> Confirm Passout</button>}
                    </div>
                  </div>
                  <div className="card">
                    <div className="card-hdr"><div className="card-title"><i className="lni lni-information"></i> What Happens</div></div>
                    <div style={{ fontSize: 12.5, color: 'var(--g700)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>The student is re-verified server-side as currently <strong>Registered</strong> and in a <strong>PCSE/PCIM</strong> programme before anything changes.</div>
                      <div>The active history row is deactivated and cloned into a new row with status <strong>Passout</strong> — enrollment fields (programme/batch/semester/fee) carry over unchanged.</div>
                      <div>Your account and the confirmation time are recorded permanently on the new row — with no marks data behind this group, that record is the entire evidence for this status change.</div>
                      <div>This cannot be undone from this page.</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {confirmOpen && candidate && (
        <div className="modal-overlay open confirm-modal-overlay">
          <div className="modal modal-md confirm-modal-pop" onClick={e => e.stopPropagation()}>
            {successInfo ? (
              <SuccessPopup title={successInfo.title} subtitle={successInfo.subtitle} onClose={closeConfirmModal} />
            ) : (
              <>
                <div className="modal-hdr"><div className="modal-title"><i className="lni lni-warning" style={{ color: 'var(--red)' }}></i> Confirm Passout</div><button className="modal-close" onClick={closeConfirmModal}><i className="lni lni-close"></i></button></div>
                <div>
                  <div className="danger-box" style={{ marginBottom: 16 }}>
                    <i className="lni lni-warning" style={{ color: 'var(--red)', fontSize: 16, flexShrink: 0 }}></i>
                    <div><strong>This cannot be undone.</strong> Confirming again once this student is Passout will fail — it doesn&apos;t create a duplicate record.</div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--g700)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 12 }}><span style={{ fontWeight: 600, width: 140, color: 'var(--g500)' }}>Student</span><span>{candidate.studentName} — {candidate.studentRegNo}</span></div>
                    <div style={{ display: 'flex', gap: 12 }}><span style={{ fontWeight: 600, width: 140, color: 'var(--g500)' }}>Programme</span><span>{candidate.programName || '—'}</span></div>
                    <div style={{ display: 'flex', gap: 12 }}><span style={{ fontWeight: 600, width: 140, color: 'var(--g500)' }}>New status</span><span style={{ color: 'var(--b700)', fontWeight: 700 }}>Passout</span></div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-neu" onClick={closeConfirmModal} disabled={confirmPassout.isPending}>Cancel</button>
                  <button className="btn btn-danger" onClick={executeConfirm} disabled={confirmPassout.isPending || !permissions.edit}>
                    <i className="lni lni-checkmark"></i> {confirmPassout.isPending ? 'Confirming…' : 'Confirm & Passout'}
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

export default function Page() {
  return (
    <Suspense>
      <PassoutConfirmationContent />
    </Suspense>
  )
}
