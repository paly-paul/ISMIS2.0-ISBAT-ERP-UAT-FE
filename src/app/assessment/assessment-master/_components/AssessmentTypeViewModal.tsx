'use client'
import { useAssessmentType } from '@/hooks/assessment/useAssessmentTypes'

interface Props {
  isOpen: boolean
  onClose: () => void
  onEdit: () => void
  viewingGuid: string | null
}

export function AssessmentTypeViewModal({ isOpen, onClose, onEdit, viewingGuid }: Props) {
  const { data: record, isLoading } = useAssessmentType(viewingGuid, isOpen)

  if (!isOpen) return null

  return (
    <div className="modal-overlay open">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title">
            <i className="lni lni-eye"></i> Assessment Type Details
          </div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="p-5 relative min-h-[150px]">
          {isLoading && (
            <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
              <span className="text-g500">Loading details...</span>
            </div>
          )}

          {record && !isLoading && (
            <div className="g2">
              <div className="fg">
                <label className="text-[var(--fs-xs)] text-g500 block mb-1">Assessment Code</label>
                <div className="font-mono text-g900 font-medium">{record.assessmentCode}</div>
              </div>
              
              <div className="fg">
                <label className="text-[var(--fs-xs)] text-g500 block mb-1">Assessment Name</label>
                <div className="text-g900 font-medium">{record.assessmentName}</div>
              </div>

              <div className="fg">
                <label className="text-[var(--fs-xs)] text-g500 block mb-1">Fee Clearance Amount</label>
                <div className="text-g900 font-mono">
                  {record.feeClearance !== null ? record.feeClearance.toFixed(2) : <span className="text-g400">—</span>}
                </div>
              </div>

              <div className="fg">
                <label className="text-[var(--fs-xs)] text-g500 block mb-1">Display Fee Clearance</label>
                <div className="text-g900 font-mono">
                  {record.displayFeeClearance !== null ? record.displayFeeClearance.toFixed(2) : <span className="text-g400">—</span>}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer flex justify-between">
          <button className="btn btn-primary" onClick={onEdit} disabled={isLoading}>
            <i className="lni lni-pencil"></i> Edit Fee
          </button>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
