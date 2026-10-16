'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import { StudentLookup } from '@/components/student/StudentLookup'
import { BaselinePanel } from '@/components/student/BaselinePanel'
import { useStudentRefugeeDetails, useAssignRefugeeStatus, useUpdateRefugeeStatus, useRemoveRefugeeStatus } from '@/hooks/student/useRefugee'
import { useCountries } from '@/hooks/config/useCountries'
import { StudentDto } from '@/lib/api/student/student'

// Finance's own entry point to the refugee-status workflow — the same
// grant / view / edit / remove operations as Student Master's
// StudentRefugeeModal (students/student-refugee/*.md), laid out as a page:
// look a student up, then manage their status inline. Same hooks, so both
// entry points share one cache (useRefugee.ts invalidation).

export default function FinanceRefugeeStatusPage() {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const [student, setStudent] = useState<StudentDto | null>(null)
  const studentGuid = student?.studentGuid ?? null
  const { data: refugeeDetail, isLoading } = useStudentRefugeeDetails(studentGuid, !!studentGuid)
  const assignRefugeeStatus = useAssignRefugeeStatus()
  const updateRefugeeStatus = useUpdateRefugeeStatus()
  const removeRefugeeStatus = useRemoveRefugeeStatus()

  // Existing refugees open read-only; Edit swaps in the same form as assign
  // (PUT takes the same fields, document included).
  const [editing, setEditing] = useState(false)
  const { data: countries = [] } = useCountries(!!studentGuid)
  const countryOptions = countries.map(c => ({ value: c.countryGuid, label: c.countryName }))
  const [countryGuid, setCountryGuid] = useState('')
  const [refugeeId, setRefugeeId] = useState('')
  const [remarks, setRemarks] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  // Bumped to clear the native file input, which can't be reset via state.
  const [fileInputKey, setFileInputKey] = useState(0)
  const [docPreviewOpen, setDocPreviewOpen] = useState(false)
  const refugeeDocUrl = refugeeDetail?.documentUrl ?? null
  const refugeeDocIsImage = !!refugeeDocUrl && /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(refugeeDocUrl)

  function resetForm() {
    setCountryGuid('')
    setRefugeeId('')
    setRemarks('')
    setDocFile(null)
    setFileInputKey(k => k + 1)
    setDocPreviewOpen(false)
    setEditing(false)
  }

  function handleLoad(s: StudentDto) { setStudent(s); resetForm() }
  function handleClear() { setStudent(null); resetForm() }

  // Same redirects as the Student Master modal: assign/edit → approval page
  // (Fee Structure Transfer follows the approval), remove → Fee Structure
  // Transfer. `notice` carries the success message to the next page.
  function goToApproval(guid: string, notice: 'submitted' | 'updated') {
    router.push(`/student/refugee-approval?studentGuid=${encodeURIComponent(guid)}&notice=${notice}`)
  }

  function goToFeeTransfer(guid: string) {
    router.push(`/student/fee-structure-transfer?studentGuid=${encodeURIComponent(guid)}&notice=refugee-removed`)
  }

  function startEdit() {
    setCountryGuid('')
    setRefugeeId(refugeeDetail?.refugeeId ?? '')
    setRemarks(refugeeDetail?.remarks ?? '')
    setDocFile(null)
    setFileInputKey(k => k + 1)
    setEditing(true)
  }

  function handleSave() {
    if (!studentGuid) return
    if (!countryGuid) { showToast('Country is required.', 'warn'); return }
    if (!refugeeId.trim()) { showToast('Refugee ID is required.', 'warn'); return }
    if (refugeeId.trim().length > 20) { showToast('Refugee ID must be 20 characters or fewer.', 'warn'); return }
    if (!remarks.trim()) { showToast('Remarks are required.', 'warn'); return }
    if (!docFile) { showToast('A supporting document is required.', 'warn'); return }
    const guid = studentGuid
    const payload = { studentGuid: guid, countryGuid, refugeeId: refugeeId.trim(), remarks: remarks.trim(), document: docFile }
    // Both assign and edit only raise a request now — it takes effect once
    // approved on /student/refugee-approval.
    if (editing) {
      updateRefugeeStatus.mutate(payload, {
        onSuccess: () => goToApproval(guid, 'updated'),
        onError: (error: Error) => showToast(error.message || 'Could not update refugee status', 'err'),
      })
    } else {
      assignRefugeeStatus.mutate(payload, {
        onSuccess: () => goToApproval(guid, 'submitted'),
        onError: (error: Error) => showToast(error.message || 'Could not assign refugee status', 'err'),
      })
    }
  }

  function handleRemove() {
    if (!studentGuid) return
    const guid = studentGuid
    removeRefugeeStatus.mutate(guid, {
      onSuccess: () => goToFeeTransfer(guid),
      onError: (error: Error) => showToast(error.message || 'Could not remove refugee status', 'err'),
    })
  }

  const saving = assignRefugeeStatus.isPending || updateRefugeeStatus.isPending
  const hasStatus = !!refugeeDetail
  const isPendingApproval = refugeeDetail?.refugeeAssignmentStatus === 1

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div><div className="pg-title">Refugee Status</div><div className="pg-sub">Grant, update or remove a student&apos;s refugee status</div></div>
        </div>

        <StudentLookup onLoad={handleLoad} onClear={handleClear} loaded={!!student} />

        {!student ? (
          <div className="empty">
            <div className="empty-icon"><i className="lni lni-shield"></i></div>
            <div className="empty-title">No Student Loaded</div>
            <div className="empty-sub">Search for a student to view or manage their refugee status.</div>
          </div>
        ) : (
          <>
            <BaselinePanel
              label="Student (Read-Only)"
              items={[
                { label: 'Student', value: student.studentName || '—' },
                { label: 'Reg No.', value: student.studentRegNo || student.studentNum || '—', accent: true },
                { label: 'Programme', value: student.programName || '—' },
                { label: 'Semester', value: student.semesterName || '—' },
                { label: 'Refugee Status', value: isLoading ? '…' : isPendingApproval ? <span style={{ color: 'var(--amber)', fontWeight: 700 }}>Pending approval</span> : hasStatus ? <span style={{ color: 'var(--green)', fontWeight: 700 }}>Refugee</span> : <span className="text-g500">Not a refugee</span> },
              ]}
            />

            <div className="card">
              <div className="card-hdr">
                <div className="card-title"><i className="lni lni-shield"></i> {hasStatus && !editing ? 'Refugee Status on Record' : editing ? 'Edit Refugee Status' : 'Grant Refugee Status'}</div>
              </div>

              {isLoading ? (
                <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading refugee status…</div>
              ) : hasStatus && !editing ? (
                <>
                  <div className="info-box mb-3"><i className="lni lni-information" style={{ color: 'var(--b700)', fontSize: 15, flexShrink: 0 }}></i><div style={{ fontSize: 12.5 }}>
                    {isPendingApproval
                      ? 'A refugee status request for this student is pending approval.'
                      : 'This student already has refugee status on record.'}
                  </div></div>
                  <div className="fg"><label className="lbl">Refugee ID</label><input className="ctrl" readOnly value={refugeeDetail.refugeeId ?? '—'} /></div>
                  <div className="fg"><label className="lbl">Remarks</label><input className="ctrl" readOnly value={refugeeDetail.remarks || '—'} /></div>
                  <div className="fg">
                    <label className="lbl">Supporting Document</label>
                    {refugeeDocUrl
                      ? <div><button className="btn btn-neu" onClick={() => setDocPreviewOpen(true)}><i className="lni lni-eye"></i> View Document</button></div>
                      : <input className="ctrl" readOnly value="—" />}
                  </div>
                </>
              ) : (
                <>
                  <div className="fg">
                    <label className="lbl">Country <span className="req">*</span></label>
                    <SearchSelect placeholder="-- Select Country --" options={countryOptions} value={countryGuid} onChange={setCountryGuid} />
                  </div>
                  <div className="fg"><label className="lbl">Refugee ID <span className="req">*</span></label><input className="ctrl" maxLength={20} value={refugeeId} onChange={e => setRefugeeId(e.target.value)} placeholder="Refugee document/registration number" /></div>
                  <div className="fg"><label className="lbl">Remarks <span className="req">*</span></label><textarea className="ctrl" rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. UNHCR verified" /></div>
                  <div className="fg">
                    <label className="lbl">Supporting Document <span className="req">*</span></label>
                    <input key={fileInputKey} className="ctrl" type="file" onChange={e => setDocFile(e.target.files?.[0] ?? null)} />
                    <div style={{ fontSize: 11.5, color: 'var(--g500)', marginTop: 4 }}>
                      {editing ? 'Required — upload the document again, it replaces the one on record.' : 'Required — the request is rejected without it.'}
                    </div>
                  </div>
                </>
              )}

              {!isLoading && (
                <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                  {hasStatus && !editing ? (
                    <>
                      <button className="btn btn-neu" onClick={startEdit} disabled={removeRefugeeStatus.isPending}>
                        <i className="lni lni-pencil"></i> Edit
                      </button>
                      <button className="btn btn-primary" style={{ background: 'var(--red)' }} onClick={handleRemove} disabled={removeRefugeeStatus.isPending}>
                        <i className="lni lni-close"></i> {removeRefugeeStatus.isPending ? 'Removing…' : 'Remove Status'}
                      </button>
                    </>
                  ) : (
                    <>
                      {editing && <button className="btn btn-neu" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>}
                      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        <i className="lni lni-checkmark"></i> {saving ? 'Saving…' : editing ? 'Save Changes' : 'Grant Status'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
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
