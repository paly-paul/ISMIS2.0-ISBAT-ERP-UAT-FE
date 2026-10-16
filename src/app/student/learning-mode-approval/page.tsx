'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { Pagination } from '@/components/Pagination'
import { BaselinePanel } from '@/components/student/BaselinePanel'
import {
  usePendingLearningModeApprovals,
  useStudentLearningModeDetail,
  useApproveLearningModeChange,
} from '@/hooks/student/useLearningMode'
import { downloadDocument } from '@/lib/documentViewer'
import { DocumentPreviewModal } from '@/components/modals/shared/DocumentPreviewModal'
// import { usePagePermissions } from '@/hooks/users/usePagePermissions'

// Approval queue for learning-mode change requests raised on
// /student/learning-mode. Same list → review shape as Dropout Rejoin:
//  - List: GET /students/learning-mode/pending-approvals (server-paged,
//    every campus) — get-pending-learning-mode-approvals.md.
//  - Review: GET /students/learning-mode/{studentGuid} for the request's
//    remarks and document, then POST .../{studentGuid}/approve.
// There is no reject endpoint, so a request can only be approved here.

const PAGE_SIZE = 10

function initials(name: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

// useSearchParams() requires a Suspense boundary above it — see the default
// export at the bottom of this file.
function LearningModeApprovalContent() {
  // Permission checks disabled for now — every action is allowed. Restore the
  // line below (and the import above) to gate actions by the menu permissions again.
  // const permissions = usePagePermissions()
  const permissions = { add: true, edit: true, delete: true }
  const router = useRouter()
  const searchParams = useSearchParams()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // ---- List --------------------------------------------------------------
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  // Debounced — each keystroke would otherwise be its own request.
  useEffect(() => {
    const t = setTimeout(() => { if (searchInput.trim() !== search) { setSearch(searchInput.trim()); setPage(1) } }, 400)
    return () => clearTimeout(t)
  }, [searchInput, search])
  const { data, isLoading: listLoading, isError: listError } = usePendingLearningModeApprovals(search, page, PAGE_SIZE)
  const requests = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  // Approving the last row on the last page leaves that page empty.
  useEffect(() => { if (data && page > totalPages) setPage(totalPages) }, [data, page, totalPages])

  // ---- Review ------------------------------------------------------------
  // Picked from the list, or deep-linked from Learning Mode's "Review it →"
  // link as ?studentGuid=<guid>.
  const [selectedGuid, setSelectedGuid] = useState<string | null>(() => searchParams.get('studentGuid'))
  const { data: detail, isLoading: detailLoading, isError: detailError } = useStudentLearningModeDetail(selectedGuid)
  const approve = useApproveLearningModeChange()
  const [docPreviewOpen, setDocPreviewOpen] = useState(false)

  function backToList() {
    setSelectedGuid(null); setDocPreviewOpen(false)
    // Drop ?studentGuid= so a revisit doesn't reopen the same request.
    if (searchParams.get('studentGuid')) router.replace('/student/learning-mode-approval')
  }

  function handleApprove() {
    if (!permissions.edit || !selectedGuid || !detail) return
    approve.mutate(selectedGuid, {
      onSuccess: result => { showToast(`Approved — ${result.studentName ?? 'student'} is now in ${result.learningModeLabel ?? 'the requested mode'}.`, 'ok'); backToList() },
      onError: (error: Error) => showToast(error.message || 'Could not approve the request.', 'error'),
    })
  }

  const isPending = detail?.learningModeChangeStatus === 1
  const requestedLabel = detail?.requestedLearningModeLabel ?? detail?.learningModeLabel ?? '—'
  const docUrl = detail?.learningModeChangeDocumentUrl ?? null

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div><div className="pg-title">Learning Mode Approval</div><div className="pg-sub">Review and approve requested learning mode changes</div></div>
        </div>

        {!selectedGuid ? (
          <div className="card">
            <div className="card-hdr">
              <div className="card-title"><i className="lni lni-hourglass"></i> Awaiting Approval</div>
              <div className="flex gap-2" style={{ alignItems: 'center' }}>
                {totalCount > 0 && <span className="badge badge-amber">{totalCount} pending</span>}
                <div className="inp-wrap w-64">
                  <i className="lni lni-search-alt inp-icon"></i>
                  <input className="ctrl" placeholder="Search by Student No., Reg No. or name…" value={searchInput} onChange={e => setSearchInput(e.target.value)} />
                </div>
              </div>
            </div>
            {listError ? (
              <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load pending requests. Please try again.</div>
            ) : listLoading ? (
              <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading pending requests…</div>
            ) : requests.length === 0 ? (
              <div className="empty">
                <div className="empty-icon"><i className="lni lni-checkmark-circle"></i></div>
                <div className="empty-title">{search ? 'No matches' : 'Nothing to approve'}</div>
                <div className="empty-sub">{search ? 'No pending request matches your search.' : 'No learning mode changes are waiting for approval.'}</div>
              </div>
            ) : (
              <>
                <div className="person-list">
                  {requests.map(r => (
                    <div key={r.studentGuid} className="person-row">
                      <div className="person-row-av">{initials(r.studentName)}</div>
                      <div className="person-row-main">
                        <div className="person-row-name">{r.studentName ?? '—'}</div>
                        <div className="person-row-sub">
                          {(r.studentNum || r.studentRegNo) && <span className="font-mono">{r.studentNum || r.studentRegNo}</span>}
                          {(r.studentNum || r.studentRegNo) && (r.programName || r.semesterName || r.batchCode) && ' · '}
                          {[r.programName, r.semesterName, r.batchCode].filter(Boolean).join(' · ')}
                        </div>
                        <div className="person-row-meta">
                          {r.currentLearningModeLabel && <>
                            <span>{r.currentLearningModeLabel}</span>
                            <i className="lni lni-arrow-right" style={{ fontSize: 10 }}></i>
                          </>}
                          <span className="badge badge-blue">{r.requestedLearningModeLabel ?? '—'}</span>
                          {r.remarks && <span className="truncate" style={{ maxWidth: 320 }} title={r.remarks}>· {r.remarks}</span>}
                        </div>
                      </div>
                      <button className="btn btn-neu btn-sm" onClick={() => setSelectedGuid(r.studentGuid)}><i className="lni lni-eye"></i> Review</button>
                    </div>
                  ))}
                </div>
                <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="pending requests" onPageChange={setPage} />
              </>
            )}
          </div>
        ) : (
          <>
            <button className="btn btn-neu btn-sm mb-4" onClick={backToList}><i className="lni lni-arrow-left"></i> Back to Approval List</button>

            {detailLoading ? (
              <div className="empty"><div className="empty-title">Loading request…</div></div>
            ) : detailError || !detail ? (
              <div className="empty">
                <div className="empty-icon"><i className="lni lni-warning"></i></div>
                <div className="empty-title">Couldn&apos;t Load Request</div>
                <div className="empty-sub">The student may not exist, or the request couldn&apos;t be fetched.</div>
              </div>
            ) : !isPending ? (
              <div className="empty">
                <div className="empty-icon"><i className="lni lni-checkmark-circle"></i></div>
                <div className="empty-title">No Pending Request</div>
                <div className="empty-sub">
                  {detail.learningModeChangeStatus === 2
                    ? `${detail.studentName ?? 'This student'}'s change to ${detail.learningModeLabel ?? 'the requested mode'} has already been approved.`
                    : `${detail.studentName ?? 'This student'} has no learning mode change awaiting approval.`}
                </div>
              </div>
            ) : (
              <>
                <BaselinePanel
                  label="Request Details (Read-Only)"
                  items={[
                    { label: 'Student', value: detail.studentName ?? '—' },
                    { label: 'Student No.', value: detail.studentNum || detail.studentRegNo || '—', accent: true },
                    { label: 'Programme', value: detail.programName ?? '—' },
                    { label: 'Semester', value: detail.semesterName ?? '—' },
                    { label: 'Requested Mode', value: <span style={{ color: 'var(--b700)', fontWeight: 700 }}>{requestedLabel}</span> },
                    { label: 'Status', value: <span style={{ color: 'var(--amber)' }}>{detail.learningModeChangeStatusLabel ?? 'Applied'} — pending approval</span> },
                  ]}
                />

                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-hdr"><div className="card-title"><i className="lni lni-comments"></i> Remarks &amp; Document</div></div>
                  <div className="fg">
                    <label className="lbl">Remarks</label>
                    <div className="ctrl" style={{ height: 'auto', minHeight: 60, whiteSpace: 'pre-wrap', background: 'var(--g100)' }}>
                      {detail.learningModeChangeRemarks || <span className="text-g400">No remarks provided.</span>}
                    </div>
                  </div>
                  <div className="fg">
                    <label className="lbl">Supporting Document</label>
                    {docUrl ? (
                      <div className="flex gap-2">
                        <button className="btn btn-neu" onClick={() => setDocPreviewOpen(true)}><i className="lni lni-eye"></i> View Document</button>
                        <button className="btn btn-neu" onClick={() => downloadDocument(docUrl)}><i className="lni lni-download"></i> Download</button>
                      </div>
                    ) : (
                      <input className="ctrl" readOnly value="No document found" />
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="card-hdr"><div className="card-title"><i className="lni lni-checkmark-circle"></i> Decision</div></div>
                  <div style={{ fontSize: 12.5, color: 'var(--g600)', marginBottom: 12 }}>
                    Approving makes <strong>{requestedLabel}</strong> the student&apos;s active learning mode for attendance, finance and exam eligibility.
                  </div>
                  <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn btn-neu" onClick={backToList} disabled={approve.isPending}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleApprove} disabled={approve.isPending || !permissions.edit}>
                      <i className="lni lni-checkmark"></i> {approve.isPending ? 'Approving…' : 'Approve'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
      <Toast toast={toast} />
      <DocumentPreviewModal
        isOpen={docPreviewOpen && !!docUrl}
        onClose={() => setDocPreviewOpen(false)}
        url={docUrl}
        title={`Supporting Document — ${detail?.studentName ?? 'Student'}`}
      />
    </>
  )
}

export default function Page() {
  return (
    <Suspense>
      <LearningModeApprovalContent />
    </Suspense>
  )
}
