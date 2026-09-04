'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { useBatch } from '@/hooks/academic/useBatches'
import { useProgramMasters } from '@/hooks/academic/useProgramMaster'
import { useIntakes } from '@/hooks/academic/useIntakes'
import { useSemestersForProgram } from '@/hooks/academic/useSemesters'
import { useStreams } from '@/hooks/config/useStreams'
import { useBatchTimes } from '@/hooks/config/useBatchTimes'
import { useEmployees } from '@/hooks/employee/useEmployees'
import { AuthError } from '@/lib/api/client'

interface ViewBatchModalProps extends ModalProps {
  batchGuid: string | null
  onEdit?: () => void
  canEdit?: boolean
}

function Field({ label, value, mono, wide }: { label: string; value: React.ReactNode; mono?: boolean; wide?: boolean }) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--g500)', marginBottom: '4px' }}>{label}</div>
      <div className={mono ? 'font-mono' : undefined} style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

export function ViewBatchModal({ isOpen, onClose, showToast, batchGuid, onEdit, canEdit }: ViewBatchModalProps) {
  const { data: batch, isLoading, isError, error } = useBatch(batchGuid, isOpen)
  const { data: programs = [] }   = useProgramMasters()
  const { data: intakes = [] }    = useIntakes()
  const { data: streams = [] }    = useStreams()
  const { data: batchTimes = [] } = useBatchTimes()
  const { data: employees = [] }  = useEmployees()

  const [programGuid, setProgramGuid] = useState('')
  const { data: semesters = [] } = useSemestersForProgram(programGuid, !!programGuid)

  const [intakeGuid, setIntakeGuid]       = useState('')
  const [semesterGuid, setSemesterGuid]   = useState('')
  const [streamGuid, setStreamGuid]       = useState('')
  const [batchTimeGuid, setBatchTimeGuid] = useState('')
  const [inChargeIdx, setInChargeIdx]     = useState('')
  const [startDate, setStartDate]         = useState('')
  const [endDate, setEndDate]             = useState('')

  useEffect(() => {
    if (!isOpen || !batch) return
    setProgramGuid(batch.programGuid)
    setIntakeGuid('')
    setSemesterGuid(batch.semesterGuid)
    setStreamGuid(batch.streamGuid)
    setBatchTimeGuid(batch.batchTimeGuid)
    setInChargeIdx('')
    setStartDate(batch.bStartDate ? batch.bStartDate.slice(0, 10) : '')
    setEndDate(batch.bEndDate ? batch.bEndDate.slice(0, 10) : '')
  }, [isOpen, batch])

  if (!isOpen) return null

  function handleClose() {
    onClose()
  }

  if (isError) {
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

  if (isLoading || !batch) {
    return (
      <div className="modal-overlay open" id="edit-batch-modal">
        <div className="modal modal-xl modal-flex" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Batch</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div className="modal-scroll" style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading batch details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="edit-batch-modal">
      <div className="modal modal-lg modal-flex" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Batch — <span className="font-mono">{batch.batchCode}</span></div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="modal-scroll" style={{ padding: '20px clamp(14px, 4vw, 22px)' }}>
          <div className="view-detail-grid">
            <Field label="Programme" value={programs.find(p => p.programGuid === programGuid)?.programName || '—'} />
            <Field label="Semester" value={semesters.find(s => s.semesterGuid === semesterGuid)?.semName || '—'} />
            <Field label="Specialization" value={streams.find(s => s.streamGuid === streamGuid)?.streamName || '—'} />
            
            <div style={{ gridColumn: '1 / -1', height: '1px', background: 'var(--g200)', margin: '8px 0' }} />
            
            <Field label="Batch Time" value={batchTimes.find(b => b.batchTimeGuid === batchTimeGuid)?.batchTime || '—'} />
            <Field label="Start Date" value={startDate || '—'} />
            <Field label="End Date" value={endDate || '—'} />
          </div>
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--g200)' }}>
          <span className="flex-1"></span>
          {canEdit && onEdit && (
            <button className="btn btn-neu" onClick={onEdit}>
              <i className="lni lni-pencil"></i> Edit
            </button>
          )}
          <button className="btn btn-primary" onClick={handleClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
