'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { Pagination } from '@/components/Pagination'
import { BaselinePanel } from '@/components/student/BaselinePanel'
import {
  usePendingRefugeeApprovals,
  useStudentRefugeeDetails,
  useApproveRefugeeStatus,
  PendingRefugeeApprovalRow,
} from '@/hooks/student/useRefugee'
import { useCountries } from '@/hooks/config/useCountries'
import { downloadDocument } from '@/lib/documentViewer'
import { DocumentPreviewModal } from '@/components/modals/shared/DocumentPreviewModal'
// import { usePagePermissions } from '@/hooks/users/usePagePermissions'

// Approval queue for refugee-status requests raised from Student Master /
// Finance > Refugee Status. Same list → review shape as Learning Mode Approval:
//  - List: GET /students/refugee/pending-approvals (server-paged, every
//    campus) — get-pending-refugee-approvals.md.
//  - Review: GET /students/refugee/{studentGuid} for the current status,
//    remarks and a fresh document URL, then POST .../{studentGuid}/approve.
// There is no reject endpoint, so a request can only be approved here.
// The assign/edit forms redirect here with the student's review open; an
// approval then continues to Fee Structure Transfer.
// The detail doesn't return countryGuid — only the list row does — so the
// country is shown from the picked row (blank when deep-linked).

const PAGE_SIZE = 10

function initials(name: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

// useSearchParams() requires a Suspense boundary above it — see the default
// export at the bottom of this file.
function RefugeeApprovalContent() {
  // Permission checks disabled for now — every action is allowed. Restore the
  // line below (and the import above) to gate actions by the menu permissions again.
  // const permissions = usePagePermissions()
  const permissions = { add: true, edit: true, delete: true }
  const router = useRouter()
  const searchParams = useSearchParams()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // Success message handed over by the assign/edit forms, which redirect
  // here (?notice=submitted|updated) and would otherwise unmount their own
  // toast. Ref-guarded so Strict Mode's double effect doesn't show it twice.
  const noticeShown = useRef(false)
  useEffect(() => {
    if (noticeShown.current) return
    noticeShown.current = true
    const notice = searchParams.get('notice')
    if (notice === 'submitted') showToast('Refugee status request submitted — pending approval', 'ok')
    else if (notice === 'updated') showToast('Refugee status update submitted — pending approval', 'ok')
  }, [searchParams])

  const { data: countries = [] } = useCountries()
  function countryName(guid: string | null | undefined) {
    if (!guid) return null
    return countries.find(c => c.countryGuid === guid)?.countryName ?? null
  }

  // ---- List --------------------------------------------------------------
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  // Debounced — each keystroke would otherwise be its own request.
  useEffect(() => {
    const t = setTimeout(() => { if (searchInput.trim() !== search) { setSearch(searchInput.trim()); setPage(1) } }, 400)
    return () => clearTimeout(t)
  }, [searchInput, search])
  const { data, isLoading: listLoading, isError: listError } = usePendingRefugeeApprovals(search, page, PAGE_SIZE)
  const requests = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  // Approving the last row on the last page leaves that page empty.
  useEffect(() => { if (data && page > totalPages) setPage(totalPages) }, [data, page, totalPages])

  // ---- Review ------------------------------------------------------------
  // Picked from the list, or deep-linked as ?studentGuid=<guid>.
  const [selectedGuid, setSelectedGuid] = useState<string | null>(() => searchParams.get('studentGuid'))
  const [selectedRow, setSelectedRow] = useState<PendingRefugeeApprovalRow | null>(null)
  const { data: detail, isLoading: detailLoading, isError: detailError } = useStudentRefugeeDetails(selectedGuid, true)
  const approve = useApproveRefugeeStatus()
  const [docPreviewOpen, setDocPreviewOpen] = useState(false)

  function openReview(row: PendingRefugeeApprovalRow) {
    setSelectedRow(row); setSelectedGuid(row.studentGuid)
  }

  function backToList() {
    setSelectedGuid(null); setSelectedRow(null); setDocPreviewOpen(false)
    // Drop ?studentGuid= so a revisit doesn't reopen the same request.
    if (searchParams.get('studentGuid')) router.replace('/student/refugee-approval')
  }

  function handleApprove() {
    if (!permissions.edit || !selectedGuid || !detail) return
    const guid = selectedGuid
    approve.mutate(guid, {
      // Refugee status changes the student's applicable fees, so an approval
      // continues to Fee Structure Transfer with this student preloaded; the
      // success message travels as ?notice= (this page's toast would unmount).
      onSuccess: () => router.push(`/student/fee-structure-transfer?studentGuid=${encodeURIComponent(guid)}&notice=refugee-approved`),
      onError: (error: Error) => showToast(error.message || 'Could not approve the request.', 'error'),
    })
  }

  const isPending = detail?.refugeeAssignmentStatus === 1
  // Detail is re-fetched on open, so its pre-signed URL is the fresher one.
  const docUrl = detail?.documentUrl ?? selectedRow?.documentUrl ?? null
  const remarks = detail?.remarks ?? selectedRow?.remarks ?? null
  const country = countryName(selectedRow?.countryGuid)

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div><div className="pg-title">Refugee Status Approval</div><div className="pg-sub">Review and approve requested refugee status assignments</div></div>
        </div>

        {!selectedGuid ? (
          <div className="card">
            <div className="card-hdr">
              <div className="card-title"><i className="lni lni-hourglass"></i> Awaiting Approval</div>
              <div className="flex gap-2" style={{ alignItems: 'center' }}>
                {totalCount > 0 && <span className="badge badge-amber">{totalCount} pending</span>}
                <div className="inp-wrap w-64">
                  <i className="lni lni-search-alt inp-icon"></i>
                  <input className="ctrl" placeholder="Search by Student No., Refugee ID or name…" value={searchInput} onChange={e => setSearchInput(e.target.value)} />
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
                <div className="empty-sub">{search ? 'No pending request matches your search.' : 'No refugee status requests are waiting for approval.'}</div>
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
                          <span className="badge badge-blue font-mono">{r.refugeeId ?? '—'}</span>
                          {countryName(r.countryGuid) && <span>{countryName(r.countryGuid)}</span>}
                          {r.remarks && <span className="truncate" style={{ maxWidth: 320 }} title={r.remarks}>· {r.remarks}</span>}
                        </div>
                      </div>
                      <button className="btn btn-neu btn-sm" onClick={() => openReview(r)}><i className="lni lni-eye"></i> Review</button>
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
            ) : detailError ? (
              <div className="empty">
                <div className="empty-icon"><i className="lni lni-warning"></i></div>
                <div className="empty-title">Couldn&apos;t Load Request</div>
                <div className="empty-sub">The request couldn&apos;t be fetched. Please try again.</div>
              </div>
            ) : !detail || !isPending ? (
              <div className="empty">
                <div className="empty-icon"><i className="lni lni-checkmark-circle"></i></div>
                <div className="empty-title">No Pending Request</div>
                <div className="empty-sub">
                  {detail?.refugeeAssignmentStatus === 2
                    ? `${detail.studentName ?? 'This student'}'s refugee status has already been approved.`
                    : `${detail?.studentName ?? selectedRow?.studentName ?? 'This student'} has no refugee status request awaiting approval.`}
                </div>
              </div>
            ) : (
              <>
                <BaselinePanel
                  label="Request Details (Read-Only)"
                  items={[
                    { label: 'Student', value: detail.studentName ?? '—' },
                    { label: 'Student No.', value: selectedRow?.studentNum || detail.studentRegNo || '—', accent: true },
                    { label: 'Programme', value: detail.programName ?? '—' },
                    { label: 'Semester', value: detail.semesterName ?? '—' },
                    { label: 'Refugee ID', value: <span className="font-mono" style={{ color: 'var(--b700)', fontWeight: 700 }}>{detail.refugeeId ?? '—'}</span> },
                    { label: 'Country of Origin', value: country ?? '—' },
                    { label: 'Status', value: <span style={{ color: 'var(--amber)' }}>{detail.refugeeAssignmentStatusLabel ?? 'Applied'} — pending approval</span> },
                  ]}
                />

                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-hdr"><div className="card-title"><i className="lni lni-comments"></i> Remarks &amp; Document</div></div>
                  <div className="fg">
                    <label className="lbl">Remarks</label>
                    <div className="ctrl" style={{ height: 'auto', minHeight: 60, whiteSpace: 'pre-wrap', background: 'var(--g100)' }}>
                      {remarks || <span className="text-g400">No remarks provided.</span>}
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
                    Approving activates refugee status for <strong>{detail.studentName ?? 'this student'}</strong> and syncs the country of origin to their admission record. Fees and downstream systems will treat the student as a refugee from then on.
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
        title={`Refugee Document — ${detail?.studentName ?? 'Student'}`}
      />
    </>
  )
}

export default function Page() {
  return (
    <Suspense>
      <RefugeeApprovalContent />
    </Suspense>
  )
}
