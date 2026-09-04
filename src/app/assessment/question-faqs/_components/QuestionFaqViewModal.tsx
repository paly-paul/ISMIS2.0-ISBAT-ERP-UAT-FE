import { useQuestionFaq } from '@/hooks/assessment/useQuestionFaqs'

interface QuestionFaqViewModalProps {
  isOpen: boolean
  onClose: () => void
  onEdit: () => void
  viewingGuid: string | null
}

export function QuestionFaqViewModal({ isOpen, onClose, onEdit, viewingGuid }: QuestionFaqViewModalProps) {
  const { data, isLoading } = useQuestionFaq(viewingGuid, isOpen)

  if (!isOpen) return null

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal modal-md modal-flex" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue" style={{ display: 'flex', alignItems: 'center', paddingRight: 16 }}>
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span><i className="lni lni-eye"></i> View Question FAQ</span>
          </div>
          
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, marginRight: 16 }}>
            {data?.status === 2 && (
              <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: 'rgba(34, 197, 94, 0.2)', border: '1px solid rgba(34, 197, 94, 0.4)', padding: '3px 8px', borderRadius: 4 }}>
                Approved
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
              <div>
                <div className="text-[11.5px] font-bold text-g500 uppercase tracking-wide mb-1.5">Question</div>
                <div className="text-[15px] text-g900 font-semibold leading-relaxed p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  {data.questionText || '—'}
                </div>
              </div>

              <div>
                <div className="text-[11.5px] font-bold text-g500 uppercase tracking-wide mb-1.5">Answer</div>
                <div className="text-[14px] text-g700 leading-relaxed whitespace-pre-wrap p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
                  {data.answerText || '—'}
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
            <i className="lni lni-pencil"></i> Edit Answer
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
