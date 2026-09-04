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
import { useBatchTransferDetail, useEligibleBatches, useBatchTransferHistory, useExecuteBatchTransfer } from '@/hooks/student/useBatchTransfer'
import { formatDateTime } from '@/lib/date'

// Ported from isbat_student_module.html's Batch Transfer page. Confirmed
// via students/batch-transfer/*.md (2026-08-19) — a real, dedicated batch-
// transfer surface, now wired in place of the earlier students/resume/*
// ("Student Resuming") reuse this page used before. That reuse is gone:
// this endpoint only ever moves a student's batch within the same program
// (POST's own request body is just newBatchGuid + remarks — no
// semester/fee, which is why Target Semester/Destination Fee Head were
// already removed from this form), has its own real GET history endpoint
// (the resume-based wiring had none, so Transfer History always rendered
// empty), and writes its own T_BATCH_TRANSFER audit trail. Discount
// Override / Reason / Supporting Document below are still page-local only
// (commented out per earlier request) — none of those three are part of
// this endpoint's payload either.
const REASONS = ['Dropout Rejoin', 'Deferment', 'Job / Relocation', 'Medical', 'Schedule Preference', 'Administrative Correction']

// useSearchParams() requires a Suspense boundary above it (Next.js App
// Router) — see the wrapping default export at the bottom of this file,
// same split Student Profile uses for the same reason.
function BatchTransferContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Student Profile's action menu links here as
  // /student/batch-transfer?studentGuid=<guid> instead of requiring a second
  // StudentLookup search for the student already open there — same
  // deep-link convention Student Master's own "View" action uses to reach
  // Profile itself. See Profile's own studentGuidParam comment for the full
  // rationale; this is the same pattern, just seeding `student` here
  // instead of `detail`.
  const studentGuidParam = searchParams.get('studentGuid')
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [student, setStudent] = useState<StudentDto | null>(null)
  const [transferType, setTransferType] = useState<'batch' | 'intake'>('batch')
  const [targetBatch, setTargetBatch] = useState('')
  const [discount, setDiscount] = useState(0)
  const [reason, setReason] = useState(REASONS[0])
  const [remarks, setRemarks] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const effectiveStudentGuid = student?.studentGuid ?? studentGuidParam
  const { data: guidLoadedStudent } = useStudent(effectiveStudentGuid ?? null, !!effectiveStudentGuid)
  useEffect(() => {
    if (!student && studentGuidParam && guidLoadedStudent) setStudent(normalizeStudentDetail(guidLoadedStudent, effectiveStudentGuid))
  }, [student, studentGuidParam, guidLoadedStudent, effectiveStudentGuid])

  const { data: detail, isLoading: detailLoading } = useBatchTransferDetail(
    student?.studentGuid ?? null,
    { studentRegNo: student?.studentRegNo ?? '', studentName: student?.studentName ?? '' },
    !!student,
  )
  // isError/error surfaced explicitly — confirmed live, GetEligibleBatches
  // 400s with `bad_request` ("Could not resolve program and semester for
  // the student's current batch.") for some students (a data-integrity gap
  // on their current batch record, not something retrying or picking a
  // different value here fixes). Left silent, that read as "this student
  // just has no eligible batches" — a real backend failure misreported as a
  // normal empty state — so it's shown to the cashier instead.
  const { data: eligibleBatches = [], isLoading: eligibleLoading, isError: eligibleError, error: eligibleErrorObj } = useEligibleBatches(student?.studentGuid ?? null, !!student)
  const { data: history = [], isLoading: historyLoading } = useBatchTransferHistory(student?.studentGuid ?? null, !!student)
  const executeBatchTransfer = useExecuteBatchTransfer()

  // Seed the Target Batch dropdown once eligible batches arrive.
  useEffect(() => {
    setTargetBatch(eligibleBatches[0]?.batchGuid ?? '')
  }, [eligibleBatches])

  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function handleLoad(s: StudentDto) { setStudent(s); showToast(`${s.studentName} loaded`, 'ok') }
  function handleClear() {
    setStudent(null); setDiscount(0); setReason(REASONS[0]); setRemarks('')
    // Drop ?studentGuid= so the effect above doesn't immediately reload the
    // same student right back in — same reasoning as Profile's own clear.
    if (studentGuidParam) router.replace('/student/batch-transfer')
  }

  const targetBatchOpt = eligibleBatches.find(b => b.batchGuid === targetBatch)
  const canExecute = !!(student && targetBatch)

  function executeTransfer() {
    if (!student || !targetBatch) return
    executeBatchTransfer.mutate(
      { studentGuid: student.studentGuid, input: { newBatchGuid: targetBatch, remarks: remarks.trim() || null } },
      {
        onSuccess: () => { showToast('Batch transfer executed', 'ok'); setConfirmOpen(false); setRemarks('') },
        onError: (error: Error) => showToast(error.message || 'Could not execute transfer', 'err'),
      },
    )
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr"><div><div className="pg-title">Batch Transfer</div><div className="pg-sub">Reassign a student to a different batch or shift their intake period</div></div></div>

        <StudentLookup onLoad={handleLoad} onClear={handleClear} loaded={!!student} />

        {!student && (
          <div className="empty">
            <div className="empty-icon"><i className="lni lni-shuffle"></i></div>
            <div className="empty-title">No Student Loaded</div>
            <div className="empty-sub">Search for a student to load their baseline profile before making transfer changes.</div>
          </div>
        )}

        {student && (
          <>
            <div className="warn-box" style={{ marginBottom: 16 }}>
              <i className="lni lni-warning" style={{ color: 'var(--amber)', fontSize: 16, flexShrink: 0, marginTop: 1 }}></i>
              <div><strong>Finance Team Restricted.</strong> Batch changes rewrite the student&apos;s unbilled ledger. Only Finance/Accounts staff on the campus network may execute this action.</div>
            </div>

            {/* Sourced from GetBatchTransferDetail now — resolves Campus/
                Intake/Fee Structure server-side, which StudentDto alone
                never carried (those were '—' placeholders before). Falls
                back to the lookup's own StudentDto fields while detail is
                still loading, so the panel isn't empty for a beat. */}
            <BaselinePanel
              label="Active Baseline Profile (Read-Only)"
              items={[
                { label: 'Student Name', value: detail?.studentName ?? student.studentName },
                { label: 'Student Reg No.', value: detail?.studentNum ?? student.studentRegNo },
                { label: 'Programme', value: detail?.programName ?? (student.programName || '—') },
                { label: 'Campus', value: detail?.campusName ?? '—' },
                { label: 'Semester', value: detail?.semesterName ?? (student.semesterName || '—') },
                { label: 'Current Batch', value: detail?.currentBatchCode ?? (student.batchCode || '—'), accent: true },
                { label: 'Intake', value: detail?.intakeDescription ?? '—' },
                { label: 'Fee Structure', value: detail?.feeCode ? `${detail.feeCode}${detail.feeDesc && detail.feeDesc !== detail.feeCode ? ` — ${detail.feeDesc}` : ''}` : '—' },
              ]}
            />

            <div className="g2">
              <div>
                <div className="card">
                  <div className="card-hdr"><div className="card-title"><i className="lni lni-shuffle"></i> Transfer Parameters</div></div>
                  {/* Transfer Type — commented out per request.
                  <div className="fg">
                    <label className="lbl">Transfer Type <span className="req">*</span></label>
                    <label className={`rcard${transferType === 'batch' ? ' sel' : ''}`} onClick={() => setTransferType('batch')}>
                      <input type="radio" name="bt-type" checked={transferType === 'batch'} readOnly />
                      <div><div className="rcard-lbl">Batch / Schedule Transfer</div><div className="rcard-sub">Move within the same programme — e.g. Day to Evening schedule. Rewrites unbilled ledger to destination batch fee template.</div></div>
                    </label>
                    <label className={`rcard${transferType === 'intake' ? ' sel' : ''}`} onClick={() => setTransferType('intake')}>
                      <input type="radio" name="bt-type" checked={transferType === 'intake'} readOnly />
                      <div><div className="rcard-lbl">Intake / Period Shift</div><div className="rcard-sub">Move to a different intake cohort. Used for dropouts rejoining or deferrals — see the dedicated Intake Transfer page for this.</div></div>
                    </label>
                  </div>
                  */}
                  {/* Target Semester / Destination Fee Head fields removed
                      per request (2026-09-01) — GetEligibleBatches/
                      PostBatchTransfer confirm this endpoint only ever
                      moves the batch within the student's current program;
                      there's no semester/fee parameter to submit at all. */}
                  <div className="fg">
                    <label className="lbl">Target Batch <span className="req">*</span></label>
                    <SearchSelect
                      placeholder="— Select destination batch —"
                      options={eligibleBatches.map(b => ({ value: b.batchGuid, label: b.batchCode }))}
                      value={targetBatch}
                      onChange={setTargetBatch}
                      disabled={eligibleLoading || eligibleError || !student}
                    />
                    {eligibleError && (
                      <div className="danger-box mt-2">
                        <i className="lni lni-warning" style={{ color: 'var(--red)', fontSize: 14, flexShrink: 0 }}></i>
                        <div style={{ fontSize: 12 }}>
                          Couldn&apos;t load eligible batches: {eligibleErrorObj instanceof Error ? eligibleErrorObj.message : 'an unexpected error occurred'}. This student&apos;s current batch record has a data issue on the backend — batch transfer can&apos;t proceed until it's corrected there.
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Discount Override — commented out per request.
                  <div className="fg">
                    <label className="lbl">Discount Override (0–100%) <span className="req">*</span></label>
                    <div className="flex gap-2" style={{ alignItems: 'center' }}>
                      <input className="ctrl" type="number" min={0} max={100} value={discount} style={{ maxWidth: 100 }} onChange={e => setDiscount(Number(e.target.value))} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--g700)' }}>% — Finance role required for &gt;0%</span>
                    </div>
                    {discount > 0 && (
                      <div className="warn-box mt-2"><i className="lni lni-warning" style={{ color: 'var(--amber)', fontSize: 14, flexShrink: 0 }}></i><div style={{ fontSize: 12 }}>Discount override above 0% requires Finance Manager approval. An approval request will be auto-logged.</div></div>
                    )}
                  </div>
                  */}
                  {/* Reason — commented out per request.
                  <div className="fg"><label className="lbl">Reason <span className="req">*</span></label>
                    <SearchSelect
                      placeholder="— Select reason —"
                      options={REASONS}
                      value={reason}
                      onChange={setReason}
                    />
                  </div>
                  */}
                  {/* Remarks now actually reaches the API — PostBatchTransfer's
                      own `remarks` field, stored on the transfer audit record. */}
                  <div className="fg"><label className="lbl">Mandatory Remarks <span className="req">*</span></label><textarea className="ctrl" rows={3} placeholder="Describe the reason. Required and will be logged permanently." value={remarks} onChange={e => setRemarks(e.target.value)} /></div>
                  {/* Supporting Document — commented out per request.
                  <div className="fg">
                    <label className="lbl">Supporting Document</label>
                    <div style={{ border: '2px dashed var(--g300)', borderRadius: 'var(--rxs)', padding: 16, textAlign: 'center', cursor: 'pointer', background: 'var(--surface)' }}>
                      <i className="lni lni-upload" style={{ fontSize: 20, color: 'var(--g400)' }}></i>
                      <div style={{ fontSize: 12, color: 'var(--g500)', marginTop: 6 }}>Drop file or click to upload (PDF · max 5MB)</div>
                    </div>
                  </div>
                  */}
                  <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn btn-neu" onClick={handleClear}>Cancel</button>
                    <button className="btn btn-primary" disabled={!canExecute} onClick={() => setConfirmOpen(true)}><i className="lni lni-checkmark"></i> Execute Transfer</button>
                  </div>
                </div>
              </div>
              <div>
                <div className="card">
                  <div className="card-hdr"><div className="card-title"><i className="lni lni-alarm-clock"></i> Transfer History</div></div>
                  <ScrollTable>
                    <table>
                      <thead><tr><th>Transfer Code</th><th>Transfer Date</th><th>Old Batch</th><th>New Batch</th></tr></thead>
                      <tbody>
                        {historyLoading ? (
                          <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--g400)', fontSize: 12.5 }}>Loading transfer history…</td></tr>
                        ) : history.length === 0 ? (
                          <EmptyState colSpan={4} title="No transfers on record" subtitle="This student hasn't been moved between batches yet." />
                        ) : (
                          history.map(r => (
                            <tr key={r.batchTransferGuid}>
                              <td className="font-mono text-blue">{r.transferCode ?? '—'}</td>
                              <td>{formatDateTime(r.transferDate)}</td>
                              <td>{r.oldBatchCode ?? '—'}</td>
                              <td>{r.newBatchCode ?? '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </ScrollTable>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {confirmOpen && student && targetBatchOpt && (
        <div className="modal-overlay open" onClick={() => setConfirmOpen(false)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr"><div className="modal-title"><i className="lni lni-warning" style={{ color: 'var(--red)' }}></i> Confirm Batch Transfer</div><button className="modal-close" onClick={() => setConfirmOpen(false)}>✕</button></div>
            <div>
              <div className="danger-box" style={{ marginBottom: 16 }}><i className="lni lni-warning" style={{ color: 'var(--red)', fontSize: 16, flexShrink: 0 }}></i><div><strong>This cannot be undone.</strong> The student's active history is deactivated and cloned into a new row under the destination batch.</div></div>
              <div style={{ fontSize: 13, color: 'var(--g700)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 12 }}><span style={{ fontWeight: 600, width: 120, color: 'var(--g500)' }}>Student</span><span>{student.studentName} — {student.studentNum}</span></div>
                <div style={{ display: 'flex', gap: 12 }}><span style={{ fontWeight: 600, width: 120, color: 'var(--g500)' }}>From batch</span><span style={{ fontFamily: 'monospace' }}>{detail?.currentBatchCode ?? student.batchCode ?? '—'}</span></div>
                <div style={{ display: 'flex', gap: 12 }}><span style={{ fontWeight: 600, width: 120, color: 'var(--g500)' }}>To batch</span><span style={{ fontFamily: 'monospace', color: 'var(--b700)' }}>{targetBatchOpt.batchCode}</span></div>
                {remarks.trim() && (
                  <div style={{ display: 'flex', gap: 12 }}><span style={{ fontWeight: 600, width: 120, color: 'var(--g500)' }}>Remarks</span><span>{remarks.trim()}</span></div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-neu" onClick={() => setConfirmOpen(false)} disabled={executeBatchTransfer.isPending}>Cancel</button>
              <button className="btn btn-danger" onClick={executeTransfer} disabled={executeBatchTransfer.isPending}><i className="lni lni-checkmark"></i> {executeBatchTransfer.isPending ? 'Executing…' : 'Confirm & Execute'}</button>
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
      <BatchTransferContent />
    </Suspense>
  )
}
