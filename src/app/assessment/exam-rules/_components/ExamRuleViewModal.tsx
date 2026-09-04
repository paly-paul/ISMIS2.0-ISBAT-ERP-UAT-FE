import { useState, useEffect } from 'react'
import { useExamRule } from '@/hooks/assessment/useExamRules'

interface ExamRuleViewModalProps {
  isOpen: boolean
  onClose: () => void
  onEdit: () => void
  viewingGuid: string | null
}

export function ExamRuleViewModal({ isOpen, onClose, onEdit, viewingGuid }: ExamRuleViewModalProps) {
  const { data, isLoading } = useExamRule(viewingGuid, isOpen)
  const [sectionAccordion, setSectionAccordion] = useState(0)

  useEffect(() => {
    if (isOpen) {
      setSectionAccordion(0)
    }
  }, [isOpen])

  if (!isOpen) return null

  const sections = data?.sections?.length 
    ? data.sections.map((sec: any, idx: number) => ({
        id: String.fromCharCode(65 + idx),
        title: `Section ${String.fromCharCode(65 + idx)}`,
        data: sec
      }))
    : [
        { id: 'A', title: 'Section A', data: (data as any)?.sectionA },
        { id: 'B', title: 'Section B', data: (data as any)?.sectionB },
        { id: 'C', title: 'Section C', data: (data as any)?.sectionC }
      ].filter(s => s.data && s.data.maxQuestions > 0)

  const displaySections = sections.length > 0 ? sections : [{ id: 'A', title: 'Section A', data: null }]

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal modal-lg modal-flex" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue" style={{ display: 'flex', alignItems: 'center', paddingRight: 16 }}>
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span><i className="lni lni-eye"></i> View Exam Rule {data?.ruleCode ? `— ${data.ruleCode}` : ''}</span>
            {data?.ruleName && (
              <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)', background: 'rgba(0,0,0,0.15)', padding: '2px 8px', borderRadius: 4 }}>
                {data.ruleName}
              </span>
            )}
          </div>
          
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, marginRight: 16 }}>
            {data?.totalMark != null && (
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,0.2)', padding: '4px 10px', borderRadius: 6 }}>
                Total Marks: {data.totalMark}
              </span>
            )}
            {data?.status === 2 && (
              <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: 'rgba(34, 197, 94, 0.2)', border: '1px solid rgba(34, 197, 94, 0.4)', padding: '3px 8px', borderRadius: 4 }}>
                Active
              </span>
            )}
          </div>
          <button className="modal-close" onClick={onClose} style={{ marginLeft: 0 }}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div className="modal-scroll" style={{ padding: '24px', flex: 1, overflowY: 'auto', background: '#fff' }}>
            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
                <span style={{ color: 'var(--g400)' }}>Loading rule details…</span>
              </div>
            ) : data ? (
              <>
                
                <div className="flex flex-col gap-3">
                  {displaySections.map((s, si) => {
                    const isOpen = sectionAccordion === si;
                    return (
                      <div key={s.id} style={{ border: '1.5px solid var(--b100)', borderRadius: 'var(--rsm)', overflow: 'hidden' }}>
                        <button
                          type="button"
                          onClick={() => setSectionAccordion(isOpen ? -1 : si)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', width: '100%', background: isOpen ? 'var(--b50)' : 'var(--white)', border: 'none', borderBottom: isOpen ? '1px solid var(--b100)' : 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
                        >
                          <span className="badge badge-blue" style={{ flexShrink: 0 }}>Sec {s.id}</span>
                          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--b700)' }}>{s.title} Configuration</span>
                          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--g400)', marginRight: 8 }}>{s.data ? `Max Marks: ${(s.data.attemptQuestions || 0) * (s.data.mark || 0)}` : 'Not configured'}</span>
                          <i className="lni lni-chevron-down" style={{ fontSize: 11, color: 'var(--g400)', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }} />
                        </button>
                        <div style={{ overflow: 'hidden', maxHeight: isOpen ? 1200 : 0, transition: 'max-height 0.3s ease' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', rowGap: '20px', columnGap: '24px', padding: 24 }}>
                            {!s.data ? (
                              <div style={{ gridColumn: 'span 3', color: 'var(--g500)', fontSize: 14, fontStyle: 'italic' }}>This section is not configured.</div>
                            ) : (
                              <>
                                <div>
                                  <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Question Type</div>
                                  <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{s.data.type === 1 ? 'MCQ' : 'Descriptive'}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Max Questions Available</div>
                                  <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }} className="font-mono">{s.data.maxQuestions}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Questions to Attempt</div>
                                  <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }} className="font-mono">{s.data.attemptQuestions}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Marks per Question</div>
                                  <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }} className="font-mono">{s.data.mark}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Total Section Marks</div>
                                  <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }} className="font-mono">{(s.data.attemptQuestions || 0) * (s.data.mark || 0)}</div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--g200)' }}>
          <span className="flex-1"></span>
          <button className="btn btn-neu" onClick={onEdit} disabled={isLoading || !data} style={{ marginRight: 8 }}>
            <i className="lni lni-pencil"></i> Edit Rule
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
