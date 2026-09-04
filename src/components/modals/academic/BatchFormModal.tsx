'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import DatePicker from '@/components/DatePicker'
import { BatchCreateInput, BatchUpdateInput, EMPTY_GUID } from '@/lib/api/academic/batch'
import { useBatch } from '@/hooks/academic/useBatches'
import { useProgramMasters } from '@/hooks/academic/useProgramMaster'
import { useIntakes } from '@/hooks/academic/useIntakes'
import { useSemestersForProgram } from '@/hooks/academic/useSemesters'
import { useStreams } from '@/hooks/config/useStreams'
import { useBatchTimes } from '@/hooks/config/useBatchTimes'
import { useEmployees } from '@/hooks/employee/useEmployees'
import { AuthError } from '@/lib/api/client'

// Create and Edit share this form — same fields, just different prefill,
// locked fields, and which mutation runs on submit.
interface BatchFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  batchGuid: string | null
  createBatch: {
    mutate: (input: BatchCreateInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateBatch: {
    mutate: (variables: { guid: string; input: BatchUpdateInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

// Programme/Semester/Stream/Batch Time/Batch In-Charge/Intake are all real guids (BatchCreateInput/
// BatchUpdateInput in lib/api/academic/batch.ts). bInCharge/pHead come back as the all-zero sentinel
// guid from GET /batches/:guid when unassigned — treated as unset.
export function BatchFormModal({ isOpen, onClose, showToast, mode, batchGuid, createBatch, updateBatch }: BatchFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: batch, isLoading, isError, error } = useBatch(batchGuid, isOpen && isEdit)
  const { data: programs = [] }   = useProgramMasters()
  const { data: intakes = [] }    = useIntakes()
  const { data: streams = [] }    = useStreams()
  const { data: batchTimes = [] } = useBatchTimes()
  const { data: employees = [] }  = useEmployees()

  const [programGuid, setProgramGuid] = useState('')
  const { data: semesters = [] } = useSemestersForProgram(programGuid, !!programGuid)

  const programOptions   = programs.map(p => ({ value: p.programGuid, label: `${p.programName} (${p.programCode})` }))
  const intakeOptions    = intakes.map(i => ({ value: i.intakeGuid, label: `${i.intakeCode} — ${i.description}` }))
  const semesterOptions  = semesters.map(s => ({ value: s.semesterGuid, label: s.semName }))
  const streamOptions    = streams.map(s => ({ value: s.streamGuid, label: s.streamName }))
  const batchTimeOptions = batchTimes.map(b => ({ value: b.batchTimeGuid, label: b.batchTime }))
  const advisorOptions   = employees.map(e => ({ value: e.employeeGuid, label: e.empName }))

  const [saved, setSaved]     = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [intakeGuid, setIntakeGuid]       = useState('')
  const [semesterGuid, setSemesterGuid]   = useState('')
  const [streamGuid, setStreamGuid]       = useState('')
  const [batchTimeGuid, setBatchTimeGuid] = useState('')
  const [inChargeGuid, setInChargeGuid]   = useState('')
  const [pHeadGuid, setPHeadGuid]         = useState('')
  const [startDate, setStartDate]         = useState('')
  const [endDate, setEndDate]             = useState('')
  const [errors, setErrors]               = useState<Record<string, string>>({})

  // Every field prefills from the fetched record on Edit — GET returns real
  // guids for all of Programme/Semester/Stream/Batch Time/Intake/In-Charge.
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && batch) {
      setProgramGuid(batch.programGuid)
      setIntakeGuid(batch.intakeGuid)
      setSemesterGuid(batch.semesterGuid)
      setStreamGuid(batch.streamGuid)
      setBatchTimeGuid(batch.batchTimeGuid)
      setInChargeGuid(batch.bInCharge && batch.bInCharge !== EMPTY_GUID ? batch.bInCharge : '')
      setPHeadGuid(batch.pHead && batch.pHead !== EMPTY_GUID ? batch.pHead : '')
      setStartDate(batch.bStartDate ? batch.bStartDate.slice(0, 10) : '')
      setEndDate(batch.bEndDate ? batch.bEndDate.slice(0, 10) : '')
      setErrors({})
    } else if (!isEdit) {
      setProgramGuid(''); setIntakeGuid(''); setSemesterGuid(''); setStreamGuid(''); setBatchTimeGuid(''); setInChargeGuid('')
      setPHeadGuid('')
      setStartDate(''); setEndDate(''); setErrors({})
    }
  }, [isOpen, isEdit, batch])

  if (!isOpen) return null

  function handleClose() {
    setSaved(false); setFailure(null)
    setProgramGuid(''); setIntakeGuid(''); setSemesterGuid(''); setStreamGuid(''); setBatchTimeGuid(''); setInChargeGuid('')
    setPHeadGuid('')
    setStartDate(''); setEndDate(''); setErrors({})
    onClose()
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!programGuid)    e.programGuid = 'Please select a Programme'
    if (!intakeGuid)     e.intakeGuid = 'Please select an Intake'
    if (!semesterGuid)   e.semesterGuid = 'Please select a Semester'
    if (!streamGuid)     e.streamGuid = 'Please select a Specialization'
    if (!batchTimeGuid)  e.batchTimeGuid = 'Please select a Batch Time'
    if (!inChargeGuid)   e.inChargeGuid = 'Please select a Batch In-Charge'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const input: BatchCreateInput = {
      programGuid,
      semesterGuid,
      streamGuid,
      batchTimeGuid,
      bStartDate: startDate ? `${startDate}T00:00:00` : null,
      bEndDate: endDate ? `${endDate}T00:00:00` : null,
      bInCharge: inChargeGuid,
      intakeGuid,
      pHead: pHeadGuid || null,
    }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Batch updated successfully' : 'Batch created successfully') }
    const onError = (error: Error) => setFailure(error.message || `Failed to ${isEdit ? 'update' : 'create'} batch. Please try again.`)

    if (isEdit && batchGuid) {
      updateBatch.mutate({ guid: batchGuid, input }, { onSuccess, onError })
    } else {
      createBatch.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateBatch.isPending : createBatch.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Batch Updated!' : 'Batch Created!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new batch has been saved successfully.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (failure) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup title={isEdit ? "Couldn't Update Batch" : "Couldn't Create Batch"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Batch"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load batch details.') : 'Failed to load batch details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !batch)) {
    return (
      <div className="modal-overlay open" id="edit-batch-modal">
        <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Batch</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading batch details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-batch-modal' : 'new-batch-modal'}>
      <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title">
            <i className={`lni ${isEdit ? 'lni-pencil' : 'lni-users'}`}></i> {isEdit ? `Edit Batch — ${batch!.batchCode}` : 'Create New Batch'}
          </div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="g3">
          {/* Intake/Programme/Semester/Batch Time are locked on Edit — the
              batch's students are already enrolled against this exact
              combination, so changing any of them here would silently
              re-scope an existing cohort rather than create a new one.
              Still prefilled and still sent in the update payload as-is,
              just not user-editable. */}
          <div className="fg">
            <div className="lbl">Intake <span className="req">*</span></div>
            <SearchSelect placeholder="— Select intake —" options={intakeOptions} value={intakeGuid} disabled={isEdit} onChange={isEdit ? undefined : (val => { setIntakeGuid(val); if (errors.intakeGuid) setErrors(p => ({ ...p, intakeGuid: '' })) })} />
            {errors.intakeGuid && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.intakeGuid}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Programme <span className="req">*</span></div>
            <SearchSelect
              placeholder="— Select programme —"
              options={programOptions}
              value={programGuid}
              disabled={isEdit}
              onChange={isEdit ? undefined : (val => { setProgramGuid(val); setSemesterGuid(''); if (errors.programGuid) setErrors(p => ({ ...p, programGuid: '' })) })}
            />
            {errors.programGuid && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.programGuid}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Semester <span className="req">*</span></div>
            <SearchSelect placeholder={programGuid ? '— Select semester —' : 'Select a programme first'} options={semesterOptions} value={semesterGuid} disabled={isEdit} onChange={isEdit ? undefined : (val => { setSemesterGuid(val); if (errors.semesterGuid) setErrors(p => ({ ...p, semesterGuid: '' })) })} />
            {errors.semesterGuid && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.semesterGuid}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Specialization <span className="req">*</span></div>
            <SearchSelect placeholder="— Select specialization —" options={streamOptions} value={streamGuid} onChange={val => { setStreamGuid(val); if (errors.streamGuid) setErrors(p => ({ ...p, streamGuid: '' })) }} />
            {errors.streamGuid && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.streamGuid}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Batch Time <span className="req">*</span></div>
            <SearchSelect placeholder="— Select batch time —" options={batchTimeOptions} value={batchTimeGuid} disabled={isEdit} onChange={isEdit ? undefined : (val => { setBatchTimeGuid(val); if (errors.batchTimeGuid) setErrors(p => ({ ...p, batchTimeGuid: '' })) })} />
            {errors.batchTimeGuid && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.batchTimeGuid}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Batch In-Charge <span className="req">*</span></div>
            <SearchSelect placeholder="— Select faculty member —" options={advisorOptions} value={inChargeGuid} onChange={val => { setInChargeGuid(val); if (errors.inChargeGuid) setErrors(p => ({ ...p, inChargeGuid: '' })) }} />
            {errors.inChargeGuid && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.inChargeGuid}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Programme Head</div>
            <SearchSelect placeholder="— Select faculty member —" options={advisorOptions} value={pHeadGuid} onChange={setPHeadGuid} />
          </div>
          <div className="fg"><div className="lbl">Start Date</div><DatePicker value={startDate} onChange={setStartDate} /></div>
          <div className="fg"><div className="lbl">End Date</div><DatePicker value={endDate} onChange={setEndDate} /></div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Creating…') : (isEdit ? 'Update Batch' : 'Create Batch')}
          </button>
        </div>
      </div>
    </div>
  )
}
