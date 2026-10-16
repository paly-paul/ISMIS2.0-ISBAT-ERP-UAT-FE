'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ModalProps } from '../types'
import { SearchSelect } from '@/components/SearchSelect'
import { useStudentRefugeeDetails, useAssignRefugeeStatus, useUpdateRefugeeStatus, useRemoveRefugeeStatus } from '@/hooks/student/useRefugee'
import { useCountries } from '@/hooks/config/useCountries'

interface Props extends ModalProps {
  studentGuid: string | null
  studentName?: string
}

// Same refugee-status assign/remove workflow already on the Student Profile
// page (students/student-refugee/*.md), pulled out into its own modal so
// Student Master's row action menu can grant/view/edit/remove refugee status
// without a trip through Profile first. Reuses the same hooks, so both
// entry points share one cache — granting status here is reflected on
// Profile's own refugee row immediately (react-query invalidation, see
// useRefugee.ts) and vice versa.
export function StudentRefugeeModal({ isOpen, onClose, showToast, studentGuid, studentName }: Props) {
  const router = useRouter()
  const { data: refugeeDetail, isLoading } = useStudentRefugeeDetails(studentGuid, isOpen)
  const assignRefugeeStatus = useAssignRefugeeStatus()
  const updateRefugeeStatus = useUpdateRefugeeStatus()
  const removeRefugeeStatus = useRemoveRefugeeStatus()
  // Existing refugees open read-only; Edit swaps in the same form as assign
  // (PUT takes the same fields, document included).
  const [editing, setEditing] = useState(false)
  // CountryGuid — confirmed (post-assign-refugee-status.md) as a real guid
  // field on the student entity, not a legacy numeric code, so the option's
  // own countryGuid is sent as-is; no index/position workaround needed.
  const { data: countries = [] } = useCountries(isOpen)
  const countryOptions = countries.map(c => ({ value: c.countryGuid, label: c.countryName }))

  const [countryGuid, setCountryGuid] = useState('')
  const [refugeeId, setRefugeeId] = useState('')
  const [remarks, setRemarks] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  // Supporting-document preview — same popup as Student Profile's refugee
  // row. Images render as <img>; anything else (PDF, etc.) goes in an
  // iframe and relies on the browser's viewer.
  const [docPreviewOpen, setDocPreviewOpen] = useState(false)
  const refugeeDocUrl = refugeeDetail?.documentUrl ?? null
  const refugeeDocIsImage = !!refugeeDocUrl && /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(refugeeDocUrl)

  useEffect(() => {
    if (!isOpen) return
    setCountryGuid('')
    setRefugeeId('')
    setRemarks('')
    setDocFile(null)
    setDocPreviewOpen(false)
    setEditing(false)
  }, [isOpen])

  if (!isOpen || !studentGuid) return null

  // Assign/edit only raise a request, so they continue to the approval page
  // with this student's review open; Fee Structure Transfer follows once it's
  // approved there. Remove takes effect immediately, so it still goes
  // straight to Fee Structure Transfer. `notice` carries the success message
  // across — the toast here would unmount with this page.
  function goToApproval(guid: string, notice: 'submitted' | 'updated') {
    onClose()
    router.push(`/student/refugee-approval?studentGuid=${encodeURIComponent(guid)}&notice=${notice}`)
  }

  function goToFeeTransfer(guid: string) {
    onClose()
    router.push(`/student/fee-structure-transfer?studentGuid=${encodeURIComponent(guid)}&notice=refugee-removed`)
  }

  function startEdit() {
    setCountryGuid('')
    setRefugeeId(refugeeDetail?.refugeeId ?? '')
    setRemarks(refugeeDetail?.remarks ?? '')
    setDocFile(null)
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

  return (
    <>
    <div className="modal-overlay open">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr"><div className="modal-title"><i className="lni lni-shield"></i> Refugee Status</div><button className="modal-close" onClick={onClose}>✕</button></div>
        <div>
          {studentName && <div className="fg"><label className="lbl">Student</label><input className="ctrl" readOnly value={studentName} /></div>}

          {isLoading ? (
            <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading refugee status…</div>
          ) : refugeeDetail && !editing ? (
            <>
              <div className="info-box mb-3"><i className="lni lni-information" style={{ color: 'var(--b700)', fontSize: 15, flexShrink: 0 }}></i><div style={{ fontSize: 12.5 }}>
                {refugeeDetail.refugeeAssignmentStatus === 1
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
                <input className="ctrl" type="file" onChange={e => setDocFile(e.target.files?.[0] ?? null)} />
                <div style={{ fontSize: 11.5, color: 'var(--g500)', marginTop: 4 }}>
                  {editing ? 'Required — upload the document again, it replaces the one on record.' : 'Required — the request is rejected without it.'}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          {editing
            ? <button className="btn btn-neu" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
            : <button className="btn btn-neu" onClick={onClose}>Close</button>}
          {!isLoading && (
            refugeeDetail && !editing ? (
              <>
                <button className="btn btn-neu" onClick={startEdit} disabled={removeRefugeeStatus.isPending}>
                  <i className="lni lni-pencil"></i> Edit
                </button>
                <button className="btn btn-primary" style={{ background: 'var(--red)' }} onClick={handleRemove} disabled={removeRefugeeStatus.isPending}>
                  <i className="lni lni-close"></i> {removeRefugeeStatus.isPending ? 'Removing…' : 'Remove Status'}
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <i className="lni lni-checkmark"></i> {saving ? 'Saving…' : editing ? 'Save Changes' : 'Grant Status'}
              </button>
            )
          )}
        </div>
      </div>
    </div>

    {/* Sibling of the main overlay (not nested) so a click on this
        overlay doesn't bubble up and close the Refugee Status modal too. */}
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
    </>
  )
}
