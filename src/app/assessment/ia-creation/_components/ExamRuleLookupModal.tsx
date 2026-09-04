import { useExamRules } from '@/hooks/assessment/useExamRules'
import { ScrollTable } from '@/components/ScrollTable'

interface ExamRuleLookupModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (guid: string) => void
}

export function ExamRuleLookupModal({ isOpen, onClose, onSelect }: ExamRuleLookupModalProps) {
  const { data, isLoading } = useExamRules(1, 100, '', isOpen)
  const rules = data?.items?.filter(r => r.status !== 3) || []

  if (!isOpen) return null

  return (
    <div className="modal-overlay open" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal modal-flex" style={{ maxWidth: '1000px', borderRadius: '12px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue" style={{ display: 'flex', alignItems: 'center', padding: '16px 20px' }}>
          <div className="modal-title text-white font-medium text-base">
            Select Exam Rule
          </div>
          <button className="modal-close text-white hover:text-white/80 transition-colors ml-auto bg-transparent border-none cursor-pointer" onClick={onClose}>
            <i className="lni lni-close" style={{ fontSize: '18px' }}></i>
          </button>
        </div>

        <div className="modal-scroll p-4 bg-white flex-1 overflow-y-auto">
          <ScrollTable>
            <table className="text-sm border-collapse w-full">
              <thead>
                <tr className="bg-[#001f5c] text-white">
                  <th className="py-2 px-3 border-r border-white/20">Rule Code</th>
                  <th className="py-2 px-3 border-r border-white/20">Rule Name</th>
                  <th className="py-2 px-2 border-r border-white/20 text-center leading-tight">Sec. A<br/>Total Qns</th>
                  <th className="py-2 px-2 border-r border-white/20 text-center leading-tight">Sec. A Max<br/>Attempting Qns</th>
                  <th className="py-2 px-2 border-r border-white/20 text-center leading-tight">Sec. A Max<br/>Marks</th>
                  <th className="py-2 px-2 border-r border-white/20 text-center leading-tight">Sec. A Type<br/>(MCQ/DQ)</th>
                  <th className="py-2 px-2 border-r border-white/20 text-center leading-tight">Sec. B<br/>Total Qns</th>
                  <th className="py-2 px-2 border-r border-white/20 text-center leading-tight">Sec. B Max<br/>Attempting Qns</th>
                  <th className="py-2 px-2 border-r border-white/20 text-center leading-tight">Sec. B Max<br/>Marks</th>
                  <th className="py-2 px-2 border-r border-white/20 text-center leading-tight">Sec. C<br/>Total Qns</th>
                  <th className="py-2 px-2 border-r border-white/20 text-center leading-tight">Sec. C Max<br/>Attempting Qns</th>
                  <th className="py-2 px-2 text-center leading-tight">Sec. C Max<br/>Marks</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={12} className="text-center py-8 text-slate-500">Loading rules...</td></tr>
                ) : rules.length === 0 ? (
                  <tr><td colSpan={12} className="text-center py-8 text-slate-500">No exam rules found.</td></tr>
                ) : (
                  rules.map((rule, idx) => {
                    const sA = rule.sections?.[0] || (rule as any).sectionA
                    const sB = rule.sections?.[1] || (rule as any).sectionB
                    const sC = rule.sections?.[2] || (rule as any).sectionC
                    const getType = (type?: number | null) => {
                      if (type === 1) return 'MQ'
                      if (type === 2) return 'DQ'
                      return '0'
                    }
                    return (
                      <tr 
                        key={rule.examRuleGuid} 
                        className={`cursor-pointer hover:bg-blue-50 transition-colors border-b border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f8f9fa]'}`}
                        onClick={() => {
                          onSelect(rule.examRuleGuid)
                          onClose()
                        }}
                      >
                        <td className="px-3 py-2 border-r border-slate-200 font-mono text-[13px] text-[#3a6bc9] font-medium">{rule.ruleCode}</td>
                        <td className="px-3 py-2 border-r border-slate-200 font-medium text-[13px] whitespace-nowrap">{rule.ruleName}</td>
                        
                        {/* Sec A */}
                        <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600">{sA?.maxQuestions ?? 0}</td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600">{sA?.attemptQuestions ?? 0}</td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600">{sA?.mark ?? 0}</td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600">{getType(sA?.type)}</td>

                        {/* Sec B */}
                        <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600">{sB?.maxQuestions ?? 0}</td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600">{sB?.attemptQuestions ?? 0}</td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600">{sB?.mark ?? 0}</td>

                        {/* Sec C */}
                        <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600">{sC?.maxQuestions ?? 0}</td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600">{sC?.attemptQuestions ?? 0}</td>
                        <td className="px-2 py-2 text-center text-slate-600">{sC?.mark ?? 0}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </ScrollTable>
        </div>
      </div>
    </div>
  )
}
