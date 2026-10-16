'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import { ScrollTable } from '@/components/ScrollTable'
import { EmptyState } from '@/components/EmptyState'
import { Pagination } from '@/components/Pagination'
import { ActionMenu } from '@/components/ActionMenu'
import { StudentLookup } from '@/components/student/StudentLookup'
import { BaselinePanel } from '@/components/student/BaselinePanel'
import { StudentDto, normalizeStudentDetail } from '@/lib/api/student/student'
import { useStudent } from '@/hooks/student/useStudents'
import { SuccessPopup } from '@/components/modals/shared/SuccessPopup'
import { useFeeTransferContext, useFeeTransferHistory, useExecuteFeeTransfer } from '@/hooks/student/useFeeTransfer'
import { useProgramTransferFeeStructures } from '@/hooks/student/useProgramTransfer'
// import { usePagePermissions } from '@/hooks/users/usePagePermissions'

// useSearchParams() requires a Suspense boundary above it (Next.js App
// Router) — see the wrapping default export at the bottom of this file.
function FeeStructureTransferContent() {
  // Permission checks disabled for now — every action is allowed. Restore the
  // line below (and the import above) to gate actions by the menu permissions again.
  // const permissions = usePagePermissions()
  const permissions = { add: true, edit: true, delete: true }
  const router = useRouter()
  const searchParams = useSearchParams()
  // The refugee flow redirects here as
  // /student/fee-structure-transfer?studentGuid=<guid> after an approval
  // (Refugee Status Approval) or a removal — same deep-link convention as
  // Batch Transfer.
  const studentGuidParam = searchParams.get('studentGuid')
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // Success message handed over by the refugee flow's redirect
  // (?notice=refugee-approved|refugee-removed) — the previous page's own
  // toast unmounts on navigation. Ref-guarded against Strict Mode's double
  // effect.
  const noticeShown = useRef(false)
  useEffect(() => {
    if (noticeShown.current) return
    noticeShown.current = true
    const notice = searchParams.get('notice')
    if (notice === 'refugee-approved') showToast('Refugee status approved — review the fee structure below', 'ok')
    else if (notice === 'refugee-removed') showToast('Refugee status removed — review the fee structure below', 'ok')
  }, [searchParams])

  const [student, setStudent] = useState<StudentDto | null>(null)

  const { data: guidLoadedStudent } = useStudent(studentGuidParam, !student && !!studentGuidParam)
  useEffect(() => {
    if (!student && studentGuidParam && guidLoadedStudent) setStudent(normalizeStudentDetail(guidLoadedStudent, studentGuidParam))
  }, [student, studentGuidParam, guidLoadedStudent])
  const [targetFeeStructure, setTargetFeeStructure] = useState('')
  const [applyPrevious, setApplyPrevious] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  
  const [page, setPage] = useState(1)
  const itemsPerPage = 10
  
  // Queries
  const { data: ctx, isFetching: loadingCtx } = useFeeTransferContext(student?.studentGuid || null, !!student)
  const { data: history = [], isFetching: loadingHistory } = useFeeTransferHistory(student?.studentGuid || null, !!student)
  const executeTransfer = useExecuteFeeTransfer()

  // Target fee structures from API
  const { data: feeStructuresRaw = [], isFetching: loadingFeeStructures } = useProgramTransferFeeStructures(ctx?.programGuid || null)
  
  const feeStructures = feeStructuresRaw
    .filter(f => f.feeHdGuid !== ctx?.currentFeeGuid)
    .map(f => ({
      value: f.feeHdGuid,
      label: f.feeCode
    }))

  function handleLoad(s: StudentDto) { setStudent(s); showToast(`${s.studentName} loaded`, 'ok') }
  function handleClear() {
    setStudent(null)
    setTargetFeeStructure('')
    setApplyPrevious(false)
    setRemarks('')
    // Drop ?studentGuid= so the effect above doesn't reload the same student.
    if (studentGuidParam) router.replace('/student/fee-structure-transfer')
  }

  const totalCount = history.length
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage))
  const paginatedHistory = history.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  const canExecute = !!(student && targetFeeStructure && remarks.trim() && !executeTransfer.isPending)

  function handleSubmit() {
    if (!permissions.edit || !canExecute || !student) return
    executeTransfer.mutate({
      studentGuid: student.studentGuid,
      payload: {
        newFeeGuid: targetFeeStructure,
        changeAllSemesters: applyPrevious,
        remarks: remarks.trim()
      }
    }, {
      onSuccess: () => {
        setShowSuccess(true)
        setTargetFeeStructure('')
        setApplyPrevious(false)
        setRemarks('')
      },
      onError: (err: any) => {
        showToast(err.message || 'Transfer failed', 'error')
      }
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Fee Structure Transfer</div>
            <div className="pg-sub">Transfer student to a new fee structure</div>
          </div>
        </div>

        <StudentLookup onLoad={handleLoad} onClear={handleClear} loaded={!!student} />

        {!student && (
          <div className="empty">
            <div className="empty-icon"><i className="lni lni-dollar"></i></div>
            <div className="empty-title">No Student Loaded</div>
            <div className="empty-sub">Search for a student to view and transfer their fee structure.</div>
          </div>
        )}

        {student && (
          <>
            <BaselinePanel
              label={loadingCtx ? "Student Details (Loading...)" : "Student Details (Read-Only)"}
              items={[
                { label: 'Name', value: ctx?.studentName || student.studentName },
                { label: 'Student Number', value: ctx?.studentRegNo || student.studentNum || student.studentRegNo || '—' },
                { label: 'Programme', value: ctx?.programName || student.programName || '—' },
                { label: 'Campus', value: ctx?.campusName || 'ISBAT University - Main Campus' },
                { label: 'Semester', value: ctx?.semesterName || student.semesterName || '—' },
                { label: 'Batch', value: ctx?.batchName || student.batchCode || '—', accent: true },
                { label: 'Intake', value: ctx?.intakeName || '—' },
                { label: 'Fee Structure', value: ctx?.currentFeeDesc || '—' },
              ]}
            />
            
            {/* 
            <div style={{ color: 'var(--red)', fontWeight: 700, marginBottom: 16, marginTop: -8, marginLeft: 20 }}>
              Discount : 011230354-100%
            </div>
            */}

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-hdr"><div className="card-title"><i className="lni lni-shuffle"></i> Transfer Parameters</div></div>
              <div className="g2">
                <div className="fg">
                  <label className="lbl">New Fee Structure <span className="req">*</span></label>
                  <SearchSelect
                    placeholder="-Select-"
                    options={feeStructures}
                    value={targetFeeStructure}
                    onChange={setTargetFeeStructure}
                  />
                </div>
                <div className="fg" style={{ alignSelf: 'center', marginTop: 24 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--g700)', fontWeight: 500 }}>
                    <input type="checkbox" checked={applyPrevious} onChange={e => setApplyPrevious(e.target.checked)} />
                    Fee change apply to previous semester also
                  </label>
                </div>
                <div className="fg" style={{ gridColumn: '1 / -1' }}>
                  <label className="lbl">Remarks <span className="req">*</span></label>
                  {/* post-fee-transfer.md: remarks max 500 characters. */}
                  <textarea className="ctrl" rows={3} maxLength={500} placeholder="Provide details for this transfer..." value={remarks} onChange={e => setRemarks(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
                {permissions.edit && (
                  <button className="btn btn-primary" disabled={!canExecute} onClick={handleSubmit}>
                    {executeTransfer.isPending ? <i className="lni lni-spinner lni-spin"></i> : <i className="lni lni-checkmark"></i>} Submit
                  </button>
                )}
                <button className="btn btn-neu" onClick={handleClear}>Cancel</button>
              </div>
            </div>

            <div className="card">
              <div className="card-hdr">
                <div className="card-title">
                  <i className="lni lni-alarm-clock"></i> Fee Structure Transfers
                  {loadingHistory && <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--g500)', fontWeight: 400 }}>(Loading...)</span>}
                </div>
              </div>
              <ScrollTable>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <th>Transfer Code</th>
                      <th>Transfer Date</th>
                      <th>Old Fee</th>
                      <th>New Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedHistory.length === 0 ? (
                      <EmptyState colSpan={5} title="No transfers found" subtitle="This student has no fee structure transfer history." />
                    ) : (
                      paginatedHistory.map(r => (
                        <tr key={r.feeTransferGuid}>
                          <td>
                            <ActionMenu>
                              <button className="btn btn-neu btn-sm" onClick={() => alert('View action triggered')}><i className="lni lni-eye"></i> View</button>
                            </ActionMenu>
                          </td>
                          <td className="font-mono text-blue">{r.transferCode}</td>
                          <td>{new Date(r.transferDate).toLocaleDateString('en-GB')}</td>
                          <td>{r.oldFeeDesc || r.oldFeeCode || '—'}</td>
                          <td>{r.newFeeDesc || r.newFeeCode || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </ScrollTable>
              {history.length > 0 && (
                <div style={{ padding: '0 16px 16px' }}>
                  <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="entries" onPageChange={setPage} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {showSuccess && (
        <div className="modal-overlay open" style={{ zIndex: 9999 }}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <SuccessPopup 
              title="Transfer Successful" 
              subtitle="The student's fee structure has been transferred successfully." 
              onClose={() => setShowSuccess(false)} 
            />
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
      <FeeStructureTransferContent />
    </Suspense>
  )
}
