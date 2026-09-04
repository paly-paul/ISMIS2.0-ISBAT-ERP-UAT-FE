import { useResitConfig } from '@/hooks/assessment/useResitConfigs'
import { useIntakes } from '@/hooks/academic/useIntakes'

interface ResitConfigViewModalProps {
  isOpen: boolean
  onClose: () => void
  onEdit: () => void
  viewingGuid: string | null
}

export function ResitConfigViewModal({ isOpen, onClose, onEdit, viewingGuid }: ResitConfigViewModalProps) {
  const { data, isLoading } = useResitConfig(viewingGuid, isOpen)
  const { data: intakes } = useIntakes()

  if (!isOpen) return null

  const intakeDesc = intakes?.find(i => i.intakeGuid === data?.academicIntakeGuid)?.description || 'Unknown Intake'

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal modal-md modal-flex" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue" style={{ display: 'flex', alignItems: 'center', paddingRight: 16 }}>
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span><i className="lni lni-eye"></i> View Resit Config</span>
          </div>
          
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, marginRight: 16 }}>
            {data?.isActive ? (
              <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: 'rgba(34, 197, 94, 0.2)', border: '1px solid rgba(34, 197, 94, 0.4)', padding: '3px 8px', borderRadius: 4 }}>
                Active
              </span>
            ) : (
              <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: 'rgba(239, 68, 68, 0.5)', border: '1px solid rgba(239, 68, 68, 0.6)', padding: '3px 8px', borderRadius: 4 }}>
                Inactive
              </span>
            )}
          </div>
          <button className="modal-close" onClick={onClose} style={{ marginLeft: 0 }}><i className="lni lni-close"></i></button>
        </div>

        <div className="modal-scroll p-6 bg-white flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[150px]">
              <span className="text-g400">Loading details...</span>
            </div>
          ) : data ? (
            <div className="flex flex-col gap-6">
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-[11.5px] font-bold text-g500 uppercase tracking-wide mb-1.5">Reference Code</div>
                  <div className="text-[14px] text-g900 font-semibold p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    {data.refCode || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[11.5px] font-bold text-g500 uppercase tracking-wide mb-1.5">Academic Intake</div>
                  <div className="text-[14px] text-g900 font-semibold p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    {intakeDesc}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-[11.5px] font-bold text-blue-500 uppercase tracking-wide mb-1.5">Start Date</div>
                  <div className="text-[14px] text-g900 font-semibold p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
                    {data.startDate ? new Date(data.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[11.5px] font-bold text-blue-500 uppercase tracking-wide mb-1.5">End Date</div>
                  <div className="text-[14px] text-g900 font-semibold p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
                    {data.endDate ? new Date(data.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="flex items-center justify-center min-h-[150px] text-g500 italic">
              Data not found.
            </div>
          )}
        </div>

        <div className="modal-footer border-t border-slate-200">
          <span className="flex-1"></span>
          <button className="btn btn-neu" onClick={onEdit} disabled={isLoading || !data} style={{ marginRight: 8 }}>
            <i className="lni lni-pencil"></i> Edit Details
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
