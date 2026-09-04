'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import { ScrollTable } from '@/components/ScrollTable'
import { EmptyState } from '@/components/EmptyState'
import { StudentLookup } from '@/components/student/StudentLookup'
import { BaselinePanel } from '@/components/student/BaselinePanel'
import { StudentDto, normalizeStudentDetail } from '@/lib/api/student/student'
import { useStudent } from '@/hooks/student/useStudents'
import { useProgramMasters } from '@/hooks/academic/useProgramMaster'
import { useSemestersForProgram } from '@/hooks/academic/useSemesters'
import {
  useProgramTransferDetail,
  useProgramTransferBatches,
  useProgramTransferFeeStructures,
  useProgramTransferHistory,
  usePostProgramTransfer,
} from '@/hooks/student/useProgramTransfer'

// Ported from isbat_student_module.html's Programme Transfer page, then
// rewired to the real students/program-transfer/*.md endpoints (2026-08-18/
// 28) — New Batch/New Semester/New Fee Structure and the transfer history
// grid used to be mock (TARGET_BATCHES/TARGET_SEMESTERS/TARGET_FEE_
// STRUCTURES/TRANSFER_HISTORY constants); all four, plus the actual submit,
// are real now. New Programme still comes from the Programme Master catalog
// (useProgramMasters) same as before. New Semester comes from
// useSemestersForProgram, scoped to the *target* programme — New Batch then
// cascades off (targetProg, targetSemester) via
// GET /program-transfer/batches, and New Fee Structure off targetProg alone
// via GET /program-transfer/fee-structures.
const TARGET_PROGRAMMES_FALLBACK = [{ value: '', label: 'No programmes available' }]

// calcType is documented ("1" = Amount, "2" = Percentage) on the
// student-discounts assign/update endpoints; StudentDetailDto carries the
// same field for whatever discount is already resolved onto the student —
// same helper as student/profile's own Discount display.
//
// transferDetail (program-transfer/detail — this page's own primary data
// source) turns out to carry its own, more specific discountCode/
// discountName/discountAmtPer/discountCalcType (confirmed live, 2026-09-04)
// that the generic student-detail fields below don't reliably mirror for
// this particular programme/fee assignment — a real student with an active
// "Lumpsum Discount" there still showed "None" reading detail alone. Prefer
// transferDetail's own fields when present; detail's stay the fallback for
// whenever transferDetail doesn't have one (e.g. mock mode, which never
// populates its discount fields at all).
function formatDiscount(
  transferDetail: { discountName: string | null; discountAmtPer?: number | null; discountCalcType?: number | null } | undefined,
  detail: { discountStatus: string | null; calcType: string | null; amtPer: number | null } | undefined,
) {
  if (transferDetail?.discountName) {
    const kind = transferDetail.discountCalcType === 2 ? '%' : transferDetail.discountCalcType === 1 ? 'Amt' : ''
    return transferDetail.discountAmtPer != null ? `${transferDetail.discountName} — ${transferDetail.discountAmtPer}${kind}` : transferDetail.discountName
  }
  if (!detail?.discountStatus || detail.discountStatus === 'Cancelled' || detail.discountStatus === 'CancelledImmediate') return 'None'
  const kind = detail.calcType === '2' ? '%' : detail.calcType === '1' ? 'Amt' : ''
  return detail.amtPer != null ? `${detail.amtPer}${kind}` : detail.discountStatus
}

// useSearchParams() requires a Suspense boundary above it (Next.js App
// Router) — see the wrapping default export at the bottom of this file,
// same split Student Profile uses for the same reason.
function ProgTransferContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Student Profile's action menu links here as
  // /student/prog-transfer?studentGuid=<guid> instead of requiring a second
  // StudentLookup search for the student already open there — same
  // deep-link convention Student Master's own "View" action uses to reach
  // Profile itself.
  const studentGuidParam = searchParams.get('studentGuid')
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [student, setStudent] = useState<StudentDto | null>(null)
  const effectiveStudentGuid = student?.studentGuid ?? studentGuidParam
  const { data: detail } = useStudent(effectiveStudentGuid ?? null, !!effectiveStudentGuid)
  // Once the deep-linked guid's detail resolves, seed `student` from it —
  // same effect Profile itself uses for its own ?studentGuid= param.
  useEffect(() => {
    if (!student && studentGuidParam && detail) setStudent(normalizeStudentDetail(detail, effectiveStudentGuid))
  }, [student, studentGuidParam, detail, effectiveStudentGuid])
  const { data: transferDetail } = useProgramTransferDetail(student?.studentGuid ?? null)
  const { data: history = [] } = useProgramTransferHistory(student?.studentGuid ?? null)
  const postProgramTransfer = usePostProgramTransfer()

  const { data: programmes = [] } = useProgramMasters()
  const programOptions = programmes.length > 0
    ? programmes.map(p => ({ value: p.programGuid, label: p.programName }))
    : TARGET_PROGRAMMES_FALLBACK

  const [targetProg, setTargetProg] = useState('')
  const [targetSemester, setTargetSemester] = useState('')
  const [targetBatch, setTargetBatch] = useState('')
  const [targetFeeStructure, setTargetFeeStructure] = useState('')
  const [remarks, setRemarks] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data: semesters = [] } = useSemestersForProgram(targetProg || null, !!targetProg)
  const { data: batches = [] } = useProgramTransferBatches(targetProg || null, targetSemester || null)
  const { data: feeStructures = [] } = useProgramTransferFeeStructures(targetProg || null)

  // Each dropdown resets once whatever it cascades from changes — a
  // semester/batch/fee guid picked for the old target programme means
  // nothing once the programme itself has been swapped out.
  useEffect(() => { setTargetSemester(''); setTargetBatch(''); setTargetFeeStructure('') }, [targetProg])
  useEffect(() => { setTargetBatch('') }, [targetSemester])

  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  function handleLoad(s: StudentDto) { setStudent(s); showToast(`${s.studentName} loaded`, 'ok') }
  function handleClear() {
    setStudent(null); setTargetProg(''); setTargetSemester(''); setTargetBatch(''); setTargetFeeStructure(''); setRemarks('')
    // Drop ?studentGuid= so the effect above doesn't immediately reload the
    // same student right back in — same reasoning as Profile's own clear.
    if (studentGuidParam) router.replace('/student/prog-transfer')
  }

  const target = programOptions.find(p => p.value === targetProg)
  const targetSemesterLabel = semesters.find(s => s.semesterGuid === targetSemester)?.semName ?? ''
  const targetBatchLabel = batches.find(b => b.batchGuid === targetBatch)?.batchCode ?? ''

  function executeTransfer() {
    if (!student || !targetProg || !targetBatch || !targetSemester || !targetFeeStructure) return
    postProgramTransfer.mutate(
      { studentGuid: student.studentGuid, input: { newProgramGuid: targetProg, newBatchGuid: targetBatch, newSemesterGuid: targetSemester, newFeeGuid: targetFeeStructure, remarks: remarks.trim() || null } },
      {
        onSuccess: result => { showToast(`Programme transfer executed — ${result.programTransferCode}`, 'ok'); setConfirmOpen(false); handleClear() },
        onError: (error: Error) => { showToast(error.message || 'Could not execute programme transfer', 'err'); setConfirmOpen(false) },
      }
    )
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr"><div><div className="pg-title">Programme Transfer</div><div className="pg-sub">Move a student to a different academic programme</div></div></div>

        <StudentLookup onLoad={handleLoad} onClear={handleClear} loaded={!!student} />

        {!student && (
          <div className="empty">
            <div className="empty-icon"><i className="lni lni-graduation"></i></div>
            <div className="empty-title">No Student Loaded</div>
            <div className="empty-sub">Search for a student before executing a programme transfer.</div>
          </div>
        )}

        {student && (
          <>
            <div className="info-box" style={{ marginBottom: 16 }}>
              <i className="lni lni-information" style={{ color: 'var(--b700)', fontSize: 16, flexShrink: 0, marginTop: 1 }}></i>
              <div><strong>Academic Registrar Access.</strong> The previous programme track is archived as read-only — no history is deleted.</div>
            </div>

            <BaselinePanel
              label="Current Programme (Read-Only)"
              items={[
                { label: 'Student Name', value: student.studentName },
                { label: 'Programme', value: transferDetail?.programName ?? student.programName ?? '—' },
                { label: 'Campus', value: transferDetail?.campusName ?? '—' },
                { label: 'Semester', value: transferDetail?.semesterName ?? student.semesterName ?? '—' },
                { label: 'Intake', value: transferDetail?.intakeDescription ?? '—' },
                { label: 'Fee Structure', value: transferDetail?.feeDesc ?? '—' },
                { label: 'Admission Type', value: transferDetail?.admissionTypeLabel ?? transferDetail?.admissionType ?? '—' },
              ]}
            />

            <div className="g2">
              <div className="card">
                <div className="card-hdr"><div className="card-title"><i className="lni lni-shuffle"></i> Transfer Parameters</div></div>
                <div className="fg"><label className="lbl">New Programme <span className="req">*</span></label>
                  <SearchSelect
                    placeholder="— Select new programme —"
                    options={programOptions}
                    value={targetProg}
                    onChange={setTargetProg}
                  />
                </div>
                <div className="fg"><label className="lbl">New Semester <span className="req">*</span></label>
                  <SearchSelect placeholder="— Select new semester —" disabled={!targetProg} options={semesters.map(s => ({ value: s.semesterGuid, label: s.semName }))} value={targetSemester} onChange={setTargetSemester} />
                </div>
                <div className="fg"><label className="lbl">New Batch <span className="req">*</span></label>
                  <SearchSelect placeholder="— Select new batch —" disabled={!targetSemester} options={batches.map(b => ({ value: b.batchGuid, label: b.batchCode }))} value={targetBatch} onChange={setTargetBatch} />
                </div>
                <div className="fg"><label className="lbl">New Fee Structure <span className="req">*</span></label>
                  <SearchSelect placeholder="— Select new fee structure —" disabled={!targetProg} options={feeStructures.map(f => ({ value: f.feeHdGuid, label: f.feeDesc }))} value={targetFeeStructure} onChange={setTargetFeeStructure} />
                </div>
                {/* Discount — display only, not editable here (per request); real
                    value from the student's own discount assignment, same field
                    Student Profile's own Discount row reads. */}
                <div className="fg"><label className="lbl">Discount</label><input className="ctrl" readOnly value={formatDiscount(transferDetail, detail)} /></div>
                <div className="fg"><label className="lbl">Remarks</label><textarea className="ctrl" rows={3} maxLength={100} placeholder="Reason for programme transfer… (max 100 chars)" value={remarks} onChange={e => setRemarks(e.target.value)} /></div>
                <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn btn-neu" onClick={handleClear}>Cancel</button>
                  <button className="btn btn-primary" disabled={!targetProg || !targetSemester || !targetBatch || !targetFeeStructure} onClick={() => setConfirmOpen(true)}><i className="lni lni-checkmark"></i> Execute Transfer</button>
                </div>
              </div>
              <div className="card">
                <div className="card-hdr"><div className="card-title"><i className="lni lni-alarm-clock"></i> Programme Transfer History</div></div>
                <ScrollTable>
                  <table>
                    <thead>
                      <tr>
                        <th>Transfer Code</th><th>Transfer Date</th>
                        <th>Old Programme</th>
                        <th>New Programme</th><th>New Batch</th><th>New Semester</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.length === 0
                        ? <EmptyState colSpan={6} title="No transfers on record" subtitle="This student hasn't been moved between programmes yet." />
                        : history.map(r => (
                          <tr key={r.programTransferId}>
                            <td className="font-mono text-blue">{r.programTransferCode}</td>
                            <td>{r.programTransferDate.slice(0, 10)}</td>
                            <td>{r.oldProgramName ?? '—'}</td>
                            <td>{r.newProgramName ?? '—'}</td>
                            <td>{r.newBatchCode ?? '—'}</td>
                            <td>{r.newSemesterName ?? '—'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </ScrollTable>
              </div>
            </div>
          </>
        )}
      </div>

      {confirmOpen && student && target && (
        <div className="modal-overlay open" onClick={() => setConfirmOpen(false)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr"><div className="modal-title"><i className="lni lni-warning" style={{ color: 'var(--amber)' }}></i> Confirm Programme Transfer</div><button className="modal-close" onClick={() => setConfirmOpen(false)}>✕</button></div>
            <div>
              <div className="warn-box" style={{ marginBottom: 16 }}><i className="lni lni-warning" style={{ color: 'var(--amber)', fontSize: 16, flexShrink: 0 }}></i><div><strong>Current programme track will be archived.</strong> Records will be preserved as read-only. The student will be registered fresh in the target programme.</div></div>
              <div style={{ fontSize: 13, color: 'var(--g700)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 12 }}><span style={{ fontWeight: 600, width: 140, color: 'var(--g500)' }}>Student</span><span>{student.studentName}</span></div>
                <div style={{ display: 'flex', gap: 12 }}><span style={{ fontWeight: 600, width: 140, color: 'var(--g500)' }}>From programme</span><span>{transferDetail?.programName ?? student.programName ?? '—'}</span></div>
                <div style={{ display: 'flex', gap: 12 }}><span style={{ fontWeight: 600, width: 140, color: 'var(--g500)' }}>To programme</span><span style={{ color: 'var(--b700)', fontWeight: 700 }}>{target.label}</span></div>
                <div style={{ display: 'flex', gap: 12 }}><span style={{ fontWeight: 600, width: 140, color: 'var(--g500)' }}>New batch</span><span>{targetBatchLabel || '—'}</span></div>
                <div style={{ display: 'flex', gap: 12 }}><span style={{ fontWeight: 600, width: 140, color: 'var(--g500)' }}>New semester</span><span>{targetSemesterLabel || '—'}</span></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-neu" onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={executeTransfer} disabled={postProgramTransfer.isPending}>
                <i className="lni lni-checkmark"></i> {postProgramTransfer.isPending ? 'Executing…' : 'Confirm & Execute'}
              </button>
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
      <ProgTransferContent />
    </Suspense>
  )
}
