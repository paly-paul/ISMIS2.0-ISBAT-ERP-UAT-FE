'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import { ScrollTable } from '@/components/ScrollTable'
import { EmptyState } from '@/components/EmptyState'
import { Pagination } from '@/components/Pagination'
import { StudentLookup } from '@/components/student/StudentLookup'
import { BaselinePanel } from '@/components/student/BaselinePanel'
import { StudentDto } from '@/lib/api/student/student'
import { useDropoutStudents, useRejoinCandidate, useRejoinBatches, useRejoinStudent } from '@/hooks/student/useDropoutRejoin'
import { useBatchTimes } from '@/hooks/config/useBatchTimes'

// Ported from isbat_student_module.html's Intake Transfer page. Only the
// "Dropout Rejoin" reason has a real backend contract — students/dropout-
// rejoin/*.md, wired below via useDropoutRejoin — and it only applies to
// REGSTATUS = 3 (DropOut) students, so it gets its own picker (the dropout
// list) rather than the free-text StudentLookup used elsewhere. Deferment /
// period-shift transfers have no endpoint anywhere (confirmed against the
// students/ doc set) and stay page-local mock data below.
const TARGET_INTAKES = [
  { value: '20251', label: 'Spring 2025 (20251)', fee: '$780' },
  { value: '20252', label: 'Fall 2025 (20252)', fee: '$780' },
  { value: '20261', label: 'Spring 2026 (20261)', fee: '$800' },
]
const DEFERMENT_REASONS = ['Deferment — Medical', 'Deferment — Job / Relocation', 'Deferment — Personal', 'Administrative Correction']

type Mode = 'dropout' | 'deferment'

// useSearchParams() requires a Suspense boundary above it (Next.js App
// Router) — see the wrapping default export at the bottom of this file,
// same split Student Profile uses for the same reason.
function IntakeTransferContent() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const [mode, setMode] = useState<Mode>('dropout')

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div><div className="pg-title">Dropout Rejoin</div><div className="pg-sub">Move a dropped-out student back into an active intake cohort</div></div>
        </div>

        <div className="flex gap-2 mb-4">
          <button className={`btn ${mode === 'dropout' ? 'btn-primary' : 'btn-neu'}`} onClick={() => setMode('dropout')}>
            <i className="lni lni-reload"></i> Dropout Rejoin
          </button>
          {/* Deferment / Period Shift — commented out per request, 2026-09-03.
          <button className={`btn ${mode === 'deferment' ? 'btn-primary' : 'btn-neu'}`} onClick={() => setMode('deferment')}>
            <i className="lni lni-calendar"></i> Deferment / Period Shift
          </button>
          */}
        </div>

        {mode === 'dropout' ? <DropoutRejoinPanel showToast={showToast} /> : <DefermentPanel showToast={showToast} />}
      </div>
      <Toast toast={toast} />
    </>
  )
}

export default function Page() {
  return (
    <Suspense>
      <IntakeTransferContent />
    </Suspense>
  )
}

// ---------------------------------------------------------------------------
// Dropout Rejoin — real flow against students/dropout-rejoin/*.md.
// ---------------------------------------------------------------------------
function DropoutRejoinPanel({ showToast }: { showToast: (msg: string, type?: string) => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Student Profile's action menu links here as
  // /student/intake-transfer?studentGuid=<guid> — unlike the free-text
  // StudentLookup pages, this panel picks students off a fixed dropout list
  // (GetEligibleDropoutStudents), so there's no "load by guid" step to
  // preload: seeding selectedGuid straight from the URL and letting
  // useRejoinCandidate below fetch it directly works whether or not that
  // guid happens to also be in the visible list. If the linked student
  // isn't actually a dropout, this resolves to the existing
  // "Couldn't Load Candidate" state below rather than a silent no-op.
  const [selectedGuid, setSelectedGuid] = useState<string | null>(() => searchParams.get('studentGuid'))
  const { data: dropouts = [], isLoading: listLoading, isError: listError } = useDropoutStudents(true)
  const { data: candidate, isLoading: candidateLoading, isError: candidateError } = useRejoinCandidate(selectedGuid, !!selectedGuid)

  const [page, setPage] = useState(1)
  const itemsPerPage = 10
  const totalCount = dropouts.length
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage))
  const paginatedDropouts = dropouts.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  useEffect(() => {
    setPage(1)
  }, [dropouts.length])
  const rejoin = useRejoinStudent()

  const [targetSemester, setTargetSemester] = useState('')
  const [targetBatchTime, setTargetBatchTime] = useState('')
  const [targetBatch, setTargetBatch] = useState('')
  const [targetFeeHead, setTargetFeeHead] = useState('')
  const [remarks, setRemarks] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Batch Time — a plain global list (Morning/Evening/etc.), same source
  // Admission's own filing form uses, not something the candidate response
  // carries. Sits ahead of Target Batch in the form since get-rejoin-batches.md
  // needs both the semester and this before it can return anything.
  const { data: batchTimes = [] } = useBatchTimes()
  // The real batch dropdown for this form (get-rejoin-batches.md) — replaces
  // candidate.availableBatches entirely rather than falling back to it, since
  // that list isn't scoped to a batch time at all. Only fires once both
  // targetSemester and targetBatchTime are picked.
  const { data: rejoinBatches = [], isFetching: isRejoinBatchesLoading } = useRejoinBatches(candidate?.studentGuid ?? null, targetSemester || null, targetBatchTime || null, !!candidate)

  // Seed the dropdowns once the candidate's restricted option lists arrive.
  // Each list can come back missing entirely (not just empty) on a real
  // response — see the note on RejoinCandidateDto — so every read below
  // falls back to [] rather than assuming the array is always there. Batch
  // Time/Target Batch aren't seeded here — Batch Time has no candidate-
  // supplied default to seed from, and Target Batch now depends on it.
  useEffect(() => {
    if (!candidate) { setTargetSemester(''); setTargetBatchTime(''); setTargetBatch(''); setTargetFeeHead(''); return }
    setTargetSemester(candidate.currentSemesterGuid || candidate.availableSemesters?.[0]?.semesterGuid || '')
    setTargetFeeHead(candidate.availableFeeHeads?.[0]?.feeHdGuid || '')
  }, [candidate])

  // The batch list is scoped to (semester, batch time) together — whichever
  // one just changed, whatever was previously picked for Target Batch no
  // longer necessarily applies, same cascading-reset convention Programme
  // Transfer's own semester→batch chain uses.
  useEffect(() => { setTargetBatch('') }, [targetSemester, targetBatchTime])

  function handlePick(studentGuid: string) { setSelectedGuid(studentGuid); setRemarks('') }
  function handleClear() {
    setSelectedGuid(null); setRemarks(''); setConfirmOpen(false)
    // Drop ?studentGuid= so a page revisit doesn't reseed the same guid.
    if (searchParams.get('studentGuid')) router.replace('/student/intake-transfer')
  }

  const targetSemesterOpt = candidate?.availableSemesters?.find(s => s.semesterGuid === targetSemester)
  const targetBatchOpt = rejoinBatches.find(b => b.batchGuid === targetBatch)
  const targetFeeHeadOpt = candidate?.availableFeeHeads?.find(f => f.feeHdGuid === targetFeeHead)
  const canExecute = !!(targetSemester && targetBatch && targetFeeHead)

  function executeRejoin() {
    if (!candidate || !canExecute) return
    rejoin.mutate(
      { studentGuid: candidate.studentGuid, payload: { newSemesterGuid: targetSemester, newBatchGuid: targetBatch, newFeeGuid: targetFeeHead } },
      {
        onSuccess: () => { showToast(`${candidate.studentName} rejoined`, 'ok'); setConfirmOpen(false); handleClear() },
        onError: (error: Error) => showToast(error.message || 'Could not rejoin student', 'err'),
      },
    )
  }

  if (!selectedGuid) {
    return (
      <div className="card">
        <div className="card-hdr"><div className="card-title"><i className="lni lni-reload"></i> Dropout Students</div></div>
        {listError ? (
          <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load the dropout list. Please try again.</div>
        ) : (
          <>
            <ScrollTable>
              <table>
                <thead><tr><th>Student</th><th>Reg No.</th><th>Programme</th><th>Semester</th><th>Batch</th><th>Eligibility</th><th></th></tr></thead>
                <tbody>
                  {listLoading ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 16, fontSize: 12.5, color: 'var(--g400)' }}>Loading dropout students…</td></tr>
                  ) : paginatedDropouts.length === 0 ? (
                    <EmptyState colSpan={7} title="No dropout students" subtitle="There are no students currently marked as dropped out." />
                  ) : paginatedDropouts.map(d => (
                    <tr key={d.studentGuid}>
                      <td className="font-bold">{d.studentName}</td>
                      <td className="font-mono">{d.studentRegNo}</td>
                      <td>{d.programName || '—'}</td>
                      <td>{d.semesterName || '—'}</td>
                      <td>{d.batchCode || '—'}</td>
                      <td>
                        {d.canRejoin
                          ? <span className="badge badge-green">Fees Cleared</span>
                          : <span className="badge badge-amber">Fees Pending</span>}
                      </td>
                      <td><button className="btn btn-neu btn-sm" onClick={() => handlePick(d.studentGuid)}><i className="lni lni-arrow-right"></i> Rejoin</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollTable>
            {dropouts.length > 0 && (
              <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="dropout students" onPageChange={setPage} />
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <button className="btn btn-neu btn-sm mb-4" onClick={handleClear}><i className="lni lni-arrow-left"></i> Back to Dropout List</button>

      {candidateLoading && <div className="empty"><div className="empty-title">Loading candidate…</div></div>}

      {candidateError && (
        <div className="empty">
          <div className="empty-icon"><i className="lni lni-warning"></i></div>
          <div className="empty-title">Couldn&apos;t Load Candidate</div>
          <div className="empty-sub">This student may no longer be a dropout, or has no active history/programme on record.</div>
        </div>
      )}

      {candidate && (
        <>
          <BaselinePanel
            label="Current Standing (Read-Only)"
            items={[
              { label: 'Student', value: candidate.studentName },
              { label: 'Reg No.', value: candidate.studentRegNo, accent: true },
              { label: 'Programme', value: candidate.currentProgramName || '—' },
              { label: 'Current Semester', value: candidate.currentSemesterName || '—' },
              { label: 'Status', value: <span style={{ color: 'var(--red)' }}>Dropped Out</span> },
            ]}
          />
          <div className="g2">
            <div className="card">
              <div className="card-hdr"><div className="card-title"><i className="lni lni-reload"></i> Rejoin Parameters</div></div>
              <div className="fg">
                <label className="lbl">Target Semester <span className="req">*</span></label>
                <SearchSelect
                  placeholder="— Select semester —"
                  options={(candidate.availableSemesters ?? []).map(s => ({ value: s.semesterGuid, label: s.semName }))}
                  value={targetSemester}
                  onChange={setTargetSemester}
                />
                <div style={{ fontSize: 11.5, color: 'var(--g500)', marginTop: 4 }}>Restricted to the student&apos;s current semester and the next one.</div>
              </div>
              <div className="fg">
                <label className="lbl">Batch Time <span className="req">*</span></label>
                <SearchSelect
                  placeholder="— Select batch time —"
                  disabled={!targetSemester}
                  options={batchTimes.map(bt => ({ value: bt.batchTimeGuid, label: bt.batchTime }))}
                  value={targetBatchTime}
                  onChange={setTargetBatchTime}
                />
              </div>
              <div className="fg">
                <label className="lbl">Target Batch <span className="req">*</span></label>
                <SearchSelect
                  placeholder={isRejoinBatchesLoading ? 'Loading batches…' : '— Select batch —'}
                  disabled={!targetSemester || !targetBatchTime}
                  options={rejoinBatches.map(b => ({ value: b.batchGuid, label: b.batchCode }))}
                  value={targetBatch}
                  onChange={setTargetBatch}
                />
              </div>
              <div className="fg">
                <label className="lbl">Fee Head <span className="req">*</span></label>
                <SearchSelect
                  placeholder="— Select fee head —"
                  options={(candidate.availableFeeHeads ?? []).map(f => ({ value: f.feeHdGuid, label: `${f.feeCode} — ${f.feeDesc}` }))}
                  value={targetFeeHead}
                  onChange={setTargetFeeHead}
                />
              </div>
              <div className="fg"><label className="lbl">Remarks</label><textarea className="ctrl" rows={3} placeholder="Optional notes (not sent to the server — the endpoint takes no remarks field)." value={remarks} onChange={e => setRemarks(e.target.value)} /></div>
              <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-neu" onClick={handleClear}>Cancel</button>
                <button className="btn btn-primary" disabled={!canExecute} onClick={() => setConfirmOpen(true)}><i className="lni lni-checkmark"></i> Rejoin Student</button>
              </div>
            </div>
            <div className="card">
              <div className="card-hdr"><div className="card-title"><i className="lni lni-information"></i> What Happens</div></div>
              <div style={{ fontSize: 12.5, color: 'var(--g700)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>The student&apos;s active history row is deactivated and cloned into a new row under the target semester/batch/fee, marked <strong>&quot;DropOut Rejoined&quot;</strong>.</div>
                <div>Registration status on the new row is set based on whether registration fees are already paid.</div>
                <div>An audit record of this rejoin is written. This cannot be undone from this page.</div>
              </div>
            </div>
          </div>
        </>
      )}

      {confirmOpen && candidate && targetSemesterOpt && targetBatchOpt && targetFeeHeadOpt && (
        <div className="modal-overlay open" onClick={() => setConfirmOpen(false)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr"><div className="modal-title"><i className="lni lni-warning" style={{ color: 'var(--red)' }}></i> Confirm Rejoin</div><button className="modal-close" onClick={() => setConfirmOpen(false)}>✕</button></div>
            <div>
              <div className="danger-box" style={{ marginBottom: 16 }}><i className="lni lni-warning" style={{ color: 'var(--red)', fontSize: 16, flexShrink: 0 }}></i><div><strong>This cannot be undone.</strong> The student&apos;s dropout history is closed and a new active row is opened under the destination semester/batch/fee.</div></div>
              <div style={{ fontSize: 13, color: 'var(--g700)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 12 }}><span style={{ fontWeight: 600, width: 140, color: 'var(--g500)' }}>Student</span><span>{candidate.studentName} — {candidate.studentRegNo}</span></div>
                <div style={{ display: 'flex', gap: 12 }}><span style={{ fontWeight: 600, width: 140, color: 'var(--g500)' }}>To semester</span><span style={{ color: 'var(--b700)', fontWeight: 700 }}>{targetSemesterOpt.semName}</span></div>
                <div style={{ display: 'flex', gap: 12 }}><span style={{ fontWeight: 600, width: 140, color: 'var(--g500)' }}>To batch</span><span>{targetBatchOpt.batchCode}</span></div>
                <div style={{ display: 'flex', gap: 12 }}><span style={{ fontWeight: 600, width: 140, color: 'var(--g500)' }}>Fee head</span><span>{targetFeeHeadOpt.feeCode}</span></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-neu" onClick={() => setConfirmOpen(false)} disabled={rejoin.isPending}>Cancel</button>
              <button className="btn btn-danger" onClick={executeRejoin} disabled={rejoin.isPending}><i className="lni lni-checkmark"></i> {rejoin.isPending ? 'Rejoining…' : 'Confirm & Rejoin'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Deferment / Period Shift — no backend contract exists for this workflow
// anywhere in the students/ docs; target intakes/fee re-mapping stay
// page-local mock data, same as before this page grew a Dropout Rejoin mode.
// ---------------------------------------------------------------------------
function DefermentPanel({ showToast }: { showToast: (msg: string, type?: string) => void }) {
  const [student, setStudent] = useState<StudentDto | null>(null)
  const [targetIntake, setTargetIntake] = useState(TARGET_INTAKES[0].value)
  const [targetBatch, setTargetBatch] = useState('BSc.IT-2025A · Day')
  const [reason, setReason] = useState(DEFERMENT_REASONS[0])
  const [discount, setDiscount] = useState(0)
  const [remarks, setRemarks] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleLoad(s: StudentDto) { setStudent(s); showToast(`${s.studentName} loaded`, 'ok') }
  function handleClear() { setStudent(null); setTargetIntake(TARGET_INTAKES[0].value); setTargetBatch('BSc.IT-2025A · Day'); setReason(DEFERMENT_REASONS[0]); setDiscount(0); setRemarks('') }

  const target = TARGET_INTAKES.find(i => i.value === targetIntake)

  return (
    <>
      <StudentLookup onLoad={handleLoad} onClear={handleClear} loaded={!!student} />

      {!student && (
        <div className="empty">
          <div className="empty-icon"><i className="lni lni-calendar"></i></div>
          <div className="empty-title">No Student Loaded</div>
          <div className="empty-sub">Search for a student to shift their enrollment intake period.</div>
        </div>
      )}

      {student && (
        <>
          <BaselinePanel
            label="Current Intake (Read-Only)"
            items={[
              { label: 'Student', value: student.studentName },
              { label: 'Current Intake', value: 'Spring 2024 (20241)' },
              { label: 'Current Batch', value: student.batchCode || '—', accent: true },
              { label: 'Semester', value: student.semesterName || '—' },
              { label: 'Fee Structure', value: 'Local · $750/sem' },
              { label: 'Status', value: <span style={{ color: 'var(--green)' }}>Active</span> },
            ]}
          />
          <div className="g2">
            <div className="card">
              <div className="card-hdr"><div className="card-title"><i className="lni lni-calendar"></i> Intake Transfer Parameters</div></div>
              <div className="fg"><label className="lbl">Target Intake Period <span className="req">*</span></label>
                <SearchSelect
                  placeholder="— Select target intake —"
                  options={TARGET_INTAKES.map(i => ({ value: i.value, label: i.label }))}
                  value={targetIntake}
                  onChange={setTargetIntake}
                />
              </div>
              {target && (
                <div className="fg"><label className="lbl">Assign to Batch in Target Intake <span className="req">*</span></label>
                  <SearchSelect
                    placeholder="— Select batch —"
                    options={['BSc.IT-2025A · Day', 'BSc.IT-2025B · Evening']}
                    value={targetBatch}
                    onChange={setTargetBatch}
                  />
                </div>
              )}
              <div className="fg"><label className="lbl">Transfer Reason <span className="req">*</span></label>
                <SearchSelect
                  placeholder="— Select reason —"
                  options={DEFERMENT_REASONS}
                  value={reason}
                  onChange={setReason}
                />
              </div>
              <div className="fg">
                <label className="lbl">Discount Override (%)</label>
                <input className="ctrl" type="number" min={0} max={100} value={discount} style={{ maxWidth: 100 }} onChange={e => setDiscount(Number(e.target.value))} />
                <div style={{ fontSize: 11.5, color: 'var(--g500)', marginTop: 4 }}>0 = no discount. Finance role required for any discount.</div>
              </div>
              <div className="fg"><label className="lbl">Mandatory Remarks <span className="req">*</span></label><textarea className="ctrl" rows={3} placeholder="Detail the circumstances leading to this intake shift…" value={remarks} onChange={e => setRemarks(e.target.value)} /></div>
              <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-neu" onClick={handleClear}>Cancel</button>
                <button className="btn btn-primary" onClick={() => setConfirmOpen(true)}><i className="lni lni-checkmark"></i> Execute Intake Transfer</button>
              </div>
            </div>
            <div>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-hdr"><div className="card-title"><i className="lni lni-dollar"></i> Fee Re-mapping Preview</div></div>
                {!target ? (
                  <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--g400)', fontSize: 13 }}><i className="lni lni-calendar" style={{ fontSize: 28, display: 'block', marginBottom: 8 }}></i>Select a target intake to preview fee re-mapping</div>
                ) : (
                  <>
                    <div className="delta">
                      <div className="delta-hdr"><i className="lni lni-dollar"></i> Intake Fee Comparison</div>
                      <div className="delta-row"><span className="delta-lbl">Current intake fee</span><span className="delta-val">$750 / semester</span></div>
                      <div className="delta-row"><span className="delta-lbl">Target intake fee</span><span className="delta-val changed">{target.fee} / semester</span></div>
                      <div className="delta-row"><span className="delta-lbl">Outstanding balance</span><span className="delta-val" style={{ color: 'var(--amber)' }}>$450 (carries over)</span></div>
                      <div className="delta-total"><span>Effective from</span><span style={{ color: 'var(--b700)' }}>Target Semester 1</span></div>
                    </div>
                    <div className="danger-box mt-3"><i className="lni lni-warning" style={{ color: 'var(--red)', fontSize: 15, flexShrink: 0, marginTop: 1 }}></i><div style={{ fontSize: 12 }}><strong>Ledger purge:</strong> All unbilled future tokens will be recalculated using the target intake fee template. Outstanding balance carries over.</div></div>
                  </>
                )}
              </div>
              <div className="card">
                <div className="card-hdr"><div className="card-title"><i className="lni lni-alarm-clock"></i> Intake History</div></div>
                <div className="timeline">
                  <div className="tl-item"><div className="tl-dot done"><i className="lni lni-checkmark"></i></div><div><div className="tl-label">Spring 2024 (20241)</div><div className="tl-meta">Initial intake at registration · Jan 2024</div></div></div>
                  <div className="tl-item"><div className="tl-dot cur"><i className="lni lni-calendar"></i></div><div><div className="tl-label">Current — Spring 2024</div><div className="tl-meta">No intake transfers on record</div></div></div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {confirmOpen && student && target && (
        <div className="modal-overlay open" onClick={() => setConfirmOpen(false)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr"><div className="modal-title"><i className="lni lni-warning" style={{ color: 'var(--red)' }}></i> Confirm Intake Transfer</div><button className="modal-close" onClick={() => setConfirmOpen(false)}>✕</button></div>
            <div>
              <div className="danger-box" style={{ marginBottom: 16 }}><i className="lni lni-warning" style={{ color: 'var(--red)', fontSize: 16, flexShrink: 0 }}></i><div><strong>Ledger purge will occur.</strong> All pending unbilled tokens will be recalculated against the target intake fee template. Outstanding balance carries over.</div></div>
              <div style={{ fontSize: 13, color: 'var(--g700)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 12 }}><span style={{ fontWeight: 600, width: 140, color: 'var(--g500)' }}>Student</span><span>{student.studentName}</span></div>
                <div style={{ display: 'flex', gap: 12 }}><span style={{ fontWeight: 600, width: 140, color: 'var(--g500)' }}>From intake</span><span>Spring 2024 (20241)</span></div>
                <div style={{ display: 'flex', gap: 12 }}><span style={{ fontWeight: 600, width: 140, color: 'var(--g500)' }}>To intake</span><span style={{ color: 'var(--b700)', fontWeight: 700 }}>{target.label}</span></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-neu" onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { showToast('Intake transfer executed', 'ok'); setConfirmOpen(false) }}><i className="lni lni-checkmark"></i> Confirm &amp; Execute</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
