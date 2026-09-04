'use client'
import { useEffect, useState } from 'react'
import { ScrollTable } from '@/components/ScrollTable'
import { SearchSelect } from '@/components/SearchSelect'
import { Toast } from '@/components/Toast'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { useIntakes } from '@/hooks/academic/useIntakes'
import { useSpecializationBatchesByIntake, useSpecializationBatchContext, useSpecializationStudentsInBatch, useAssignSpecialization } from '@/hooks/student/useSpecialization'

// Same 10-per-page convention as the rest of the app (see e.g.
// academic/intake-master's own PAGE_SIZE) — students-in-batch comes back
// unpaginated (no page params documented on the endpoint), so this is
// paginated client-side rather than left to render the whole batch's
// roster in one unbroken scroll.
const PAGE_SIZE = 10

// Ported from isbat_student_module.html's Specialization Management page,
// then rewired to the real students/student-specialization/*.md endpoints.
// The real workflow is intake -> batch -> stream + a checklist of that
// batch's students to assign the stream to — there is no endpoint anywhere
// that lists specializations independent of a batch, so the old mock
// "Specializations" master table (name/programme/headcount, edit-in-place)
// doesn't map onto this API and was replaced with the actual assignment
// flow. Discount Management (a different, unrelated resource) used to share
// this page, was split out into its own /student/discount-management page,
// and was later removed from the Students module entirely (2026-09-02) —
// it duplicated Finance > Discounts (the catalogue CRUD) and Finance >
// Discount Allocation (the per-student assignment) both already cover.
export default function Page() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const { data: intakes = [] } = useIntakes()
  const [intakeGuid, setIntakeGuid] = useState('')
  const [batchGuid, setBatchGuid] = useState('')
  const [streamGuid, setStreamGuid] = useState('')
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const { data: batches = [] } = useSpecializationBatchesByIntake(intakeGuid || null)
  const { data: context } = useSpecializationBatchContext(batchGuid || null)
  const { data: students = [], isLoading: studentsLoading } = useSpecializationStudentsInBatch(batchGuid || null)
  const assignSpecialization = useAssignSpecialization()
  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(students, PAGE_SIZE)

  // Batch/stream/checklist all reset whenever the intake changes — a batch
  // guid from the old intake means nothing once the batch dropdown's own
  // options have been swapped out.
  useEffect(() => { setBatchGuid(''); setStreamGuid(''); setChecked(new Set()) }, [intakeGuid])
  useEffect(() => { setStreamGuid(''); setChecked(new Set()); setPage(1) }, [batchGuid, setPage])

  function toggleStudent(guid: string) {
    setChecked(prev => { const next = new Set(prev); if (next.has(guid)) next.delete(guid); else next.add(guid); return next })
  }
  function toggleAll() {
    setChecked(prev => prev.size === students.length ? new Set() : new Set(students.map(s => s.studentGuid)))
  }

  function handleAssign() {
    if (!batchGuid || !streamGuid) { showToast('Select a batch and a stream first', 'warn'); return }
    if (checked.size === 0) { showToast('Select at least one student', 'warn'); return }
    assignSpecialization.mutate({ batchGuid, streamGuid, studentGuids: [...checked] }, {
      onSuccess: () => { showToast(`Specialization assigned to ${checked.size} student(s)`, 'ok'); setChecked(new Set()) },
      onError: () => showToast('Could not assign specialization', 'err'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div><div className="pg-title">Specialization Management</div><div className="pg-sub">Assign specialization streams by batch</div></div>
        </div>
        <div className="card">
          <div className="card-hdr"><div className="card-title"><i className="lni lni-graduation"></i> Assign Specialization</div></div>

          <div className="g2 mb-[14px]">
            <div className="fg">
              <div className="lbl">Intake <span className="req">*</span></div>
              <SearchSelect placeholder="— Select Intake —" options={intakes.map(i => ({ value: i.intakeGuid, label: i.description }))} value={intakeGuid} onChange={setIntakeGuid} />
            </div>
            <div className="fg">
              <div className="lbl">Batch <span className="req">*</span></div>
              <SearchSelect placeholder="— Select Batch —" disabled={!intakeGuid} options={batches.map(b => ({ value: b.batchGuid, label: b.batchCode }))} value={batchGuid} onChange={setBatchGuid} />
            </div>
          </div>

          {context && (
            <div className="text-xs mb-[14px]" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div><span className="text-muted">Programme: </span><span className="font-bold">{context.programName}</span></div>
              <div><span className="text-muted">Semester: </span><span className="font-bold">{context.semesterName}</span></div>
            </div>
          )}

          <div className="fg mb-[14px]">
            <div className="lbl">Stream <span className="req">*</span></div>
            <SearchSelect
              placeholder="— Select Stream —"
              disabled={!batchGuid}
              options={(context?.streams ?? []).map(s => ({ value: s.streamGuid, label: `${s.streamCode} — ${s.streamName}` }))}
              value={streamGuid}
              onChange={setStreamGuid}
            />
          </div>

          <div className="sec-divider" style={{ marginTop: 0 }}>Students in Batch</div>
          {!batchGuid ? (
            <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Select an intake and batch to load its students.</div>
          ) : studentsLoading ? (
            <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading students…</div>
          ) : students.length === 0 ? (
            <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No students in this batch.</div>
          ) : (
            <>
              <ScrollTable className="no-sticky-col">
                <table>
                  <thead><tr><th style={{ width: 32 }}><input type="checkbox" checked={checked.size === students.length} onChange={toggleAll} /></th><th>Reg No</th><th>Student</th><th>Current Stream</th></tr></thead>
                  <tbody>
                    {pageItems.map(s => (
                      <tr key={s.studentGuid}>
                        <td><input type="checkbox" checked={checked.has(s.studentGuid)} onChange={() => toggleStudent(s.studentGuid)} /></td>
                        <td className="font-mono text-blue">{s.studentRegNo ?? '—'}</td>
                        <td><strong>{s.studentName}</strong></td>
                        <td className="text-muted">{s.currentStreamName ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollTable>
              <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="students" onPageChange={setPage} />
            </>
          )}

          <div className="flex justify-end mt-4">
            <button className="btn btn-primary" onClick={handleAssign} disabled={assignSpecialization.isPending}>
              <i className="lni lni-checkmark-circle"></i> {assignSpecialization.isPending ? 'Assigning…' : `Assign Specialization${checked.size ? ` (${checked.size})` : ''}`}
            </button>
          </div>
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}
