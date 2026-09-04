import { useState, useEffect } from 'react'
import { SuccessPopup } from '@/components/modals/shared/SuccessPopup'
import { useCreateExamRule, useExamRule, useUpdateExamRule } from '@/hooks/assessment/useExamRules'
import { ExamRuleSectionDto } from '@/lib/api/assessment/examRule'

interface ExamRuleFormModalProps {
  isOpen: boolean
  onClose: () => void
  showToast: (msg: string, type?: string) => void
  editingGuid: string | null
}

interface SectionState {
  id: string
  title: string
  max: string
  attempt: string
  mark: string
  type: string
}

export function ExamRuleFormModal({ isOpen, onClose, showToast, editingGuid }: ExamRuleFormModalProps) {
  const isEdit = !!editingGuid
  const { data: existingData, isLoading } = useExamRule(editingGuid, isOpen && isEdit)
  const createMut = useCreateExamRule()
  const updateMut = useUpdateExamRule()

  const [ruleName, setRuleName] = useState('')
  const [sections, setSections] = useState<SectionState[]>([])
  const [activeTab, setActiveTab] = useState<string>('A')
  
  const [showSuccess, setShowSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (isEdit && existingData) {
        setRuleName(existingData.ruleName || '')
        const rawSections = existingData.sections?.length
          ? existingData.sections
          : [
              (existingData as any).sectionA,
              (existingData as any).sectionB,
              (existingData as any).sectionC
            ].filter(sec => sec && sec.maxQuestions > 0)

        const mapped = rawSections.map((sec: any, idx: number) => ({
          id: String.fromCharCode(65 + idx),
          title: `Section ${String.fromCharCode(65 + idx)}`,
          max: sec.maxQuestions?.toString() || '',
          attempt: sec.attemptQuestions?.toString() || '',
          mark: sec.mark?.toString() || '',
          type: sec.type?.toString() || '1'
        }))
        setSections(mapped.length > 0 ? mapped : [{ id: 'A', title: 'Section A', max: '', attempt: '', mark: '', type: '1' }])
      } else if (!isEdit) {
        setRuleName('')
        setSections([{ id: 'A', title: 'Section A', max: '', attempt: '', mark: '', type: '1' }])
      }
      setActiveTab('A')
      setErrorMsg('')
    }
  }, [isOpen, isEdit, existingData])

  const totalMarks = sections.reduce((acc, sec) => {
    if (sec.mark && sec.attempt) {
      return acc + (parseFloat(sec.mark) * parseInt(sec.attempt))
    }
    return acc
  }, 0)

  function handleAddSection() {
    const nextChar = String.fromCharCode(65 + sections.length)
    setSections([...sections, { id: nextChar, title: `Section ${nextChar}`, max: '', attempt: '', mark: '', type: '1' }])
    setActiveTab(nextChar)
  }

  function handleRemoveSection(id: string) {
    if (sections.length <= 1) return setErrorMsg('At least one section is required.')
    
    // Remove the section and re-letter the remaining sections
    const newSections = sections.filter(s => s.id !== id).map((s, idx) => {
      const char = String.fromCharCode(65 + idx)
      return { ...s, id: char, title: `Section ${char}` }
    })
    
    setSections(newSections)
    if (activeTab === id) setActiveTab(newSections[0].id)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    
    if (!ruleName.trim()) return setErrorMsg('Rule Name is required.')
    if (sections.length === 0) return setErrorMsg('At least one section is required.')
    
    if (totalMarks > 100) return setErrorMsg('Total marks should not exceed 100.')

    try {
      const payloadSections: ExamRuleSectionDto[] = sections.map(sec => {
        const m = parseInt(sec.max)
        const a = parseInt(sec.attempt)
        if (a > m) throw new Error(`In ${sec.title}: Attempt Questions cannot exceed Max Questions.`)
        if (m <= 0 || a <= 0) throw new Error(`In ${sec.title}: Questions must be greater than 0.`)
        if (parseFloat(sec.mark) <= 0) throw new Error(`In ${sec.title}: Mark must be greater than 0.`)
        
        return {
          maxQuestions: m,
          attemptQuestions: a,
          mark: parseFloat(sec.mark),
          type: parseInt(sec.type)
        }
      })

      const payload = {
        ruleName: ruleName.trim(),
        sections: payloadSections,
        // Backend compatibility
        sectionA: payloadSections[0] || null,
        sectionB: payloadSections[1] || null,
        sectionC: payloadSections[2] || null
      }

      if (isEdit) {
        await updateMut.mutateAsync({ guid: editingGuid, input: payload })
      } else {
        await createMut.mutateAsync(payload)
      }
      setShowSuccess(true)
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed')
    }
  }

  function handleSuccessClose() {
    setShowSuccess(false)
    onClose()
  }

  if (!isOpen) return null

  if (showSuccess) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup 
            title={isEdit ? 'Rule Updated' : 'Rule Created'}
            subtitle={isEdit ? 'Exam rule has been updated successfully.' : 'New exam rule has been created successfully.'}
            onClose={handleSuccessClose}
          />
        </div>
      </div>
    )
  }

  const activeSectionData = sections.find(s => s.id === activeTab) || sections[0]
  const setSec = (id: string, updates: Partial<SectionState>) => {
    setSections(sections.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal modal-lg flex flex-col" onClick={e => e.stopPropagation()} style={{ height: '80vh', maxHeight: '600px' }}>
        <div className="modal-hdr modal-hdr-blue shrink-0">
          <div className="modal-title">{isEdit ? 'Edit Exam Rule' : 'New Exam Rule'}</div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="modal-body p-0 flex flex-col flex-1 overflow-hidden">
            {isLoading && isEdit ? (
              <div className="p-6 text-center text-g500">Loading...</div>
            ) : (
              <>
                <div className="p-4 border-b border-slate-200 bg-white shrink-0">
                  <div className="fg mb-0">
                    <label className="lbl">Rule Name <span className="text-clr-red">*</span></label>
                    <input 
                      type="text" 
                      className="ctrl" 
                      placeholder="e.g. Standard MCQ Test" 
                      value={ruleName}
                      onChange={e => setRuleName(e.target.value)}
                      required
                      maxLength={100}
                    />
                  </div>
                </div>
                
                <div className="flex flex-1 overflow-hidden bg-slate-50">
                  {/* Left Sidebar Tabs */}
                  <div className="w-1/3 sm:w-56 border-r border-slate-200 bg-slate-100 p-3 overflow-y-auto flex flex-col">
                    <div className="text-[11px] font-bold text-g500 mb-3 px-1 uppercase tracking-wider">
                      SECTIONS ({sections.length})
                    </div>
                    
                    {sections.map((sec) => {
                      const isActive = activeTab === sec.id;
                      const secMarks = (sec.mark && sec.attempt) ? parseFloat(sec.mark) * parseInt(sec.attempt) : 0;
                      
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => setActiveTab(sec.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-[10px] mb-2 flex items-center gap-3 transition-colors ${
                            isActive 
                              ? 'bg-[var(--b500)] text-white shadow-sm' 
                              : 'hover:bg-slate-200 text-g700'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isActive ? 'bg-white/20' : 'bg-slate-200'}`}>
                            <i className={`lni lni-layout ${isActive ? 'text-white' : 'text-g500'}`}></i>
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span className={`text-[13px] font-semibold truncate leading-tight ${isActive ? 'text-white' : 'text-g800'}`}>
                              {sec.title}
                            </span>
                            <span className={`text-[11px] truncate mt-0.5 ${isActive ? 'text-blue-100' : 'text-g500'}`}>
                              {secMarks > 0 ? `Max Marks: ${secMarks}` : 'Not configured'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                    
                    <button 
                      type="button"
                      onClick={handleAddSection}
                      disabled={sections.length >= 10}
                      className="w-full mt-2 py-2.5 px-3 border border-dashed border-primary/40 rounded-[10px] text-primary hover:bg-primary/5 text-sm font-medium flex items-center justify-center gap-2 transition-colors bg-white"
                    >
                      <i className="lni lni-plus"></i> Add Section
                    </button>
                  </div>

                  {/* Right Content Area */}
                  <div className="flex-1 p-6 overflow-y-auto bg-white">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-g800">{activeSectionData?.title} Configuration</h3>
                      {sections.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => handleRemoveSection(activeSectionData!.id)}
                          className="btn btn-ghost btn-sm text-clr-red"
                        >
                          <i className="lni lni-trash-can"></i> Remove
                        </button>
                      )}
                    </div>
                    
                    {activeSectionData && (
                      <div className="space-y-4 max-w-sm">
                        <div className="fg mb-0">
                          <label className="lbl">Question Type</label>
                          <select className="ctrl" value={activeSectionData.type} onChange={e => setSec(activeSectionData.id, { type: e.target.value })}>
                            <option value="1">MCQ</option>
                            <option value="2">Descriptive</option>
                          </select>
                        </div>
                        <div className="fg mb-0">
                          <label className="lbl">Max Questions Available</label>
                          <input type="number" min="1" className="ctrl" required value={activeSectionData.max} onChange={e => setSec(activeSectionData.id, { max: e.target.value })} />
                        </div>
                        <div className="fg mb-0">
                          <label className="lbl">Questions to Attempt</label>
                          <input type="number" min="1" className="ctrl" required value={activeSectionData.attempt} onChange={e => setSec(activeSectionData.id, { attempt: e.target.value })} />
                        </div>
                        <div className="fg mb-0">
                          <label className="lbl">Marks per Question</label>
                          <input type="number" min="0.1" step="0.1" className="ctrl" required value={activeSectionData.mark} onChange={e => setSec(activeSectionData.id, { mark: e.target.value })} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                  <div className="text-sm font-semibold text-g700">
                    Total Marks: <span className={`font-mono ml-1 ${totalMarks > 100 ? 'text-clr-red' : 'text-green-600'}`}>{totalMarks}</span>
                    <span className="text-xs text-g400 font-normal ml-1">/ 100</span>
                  </div>
                  {errorMsg && <div className="text-clr-red text-xs">{errorMsg}</div>}
                </div>
              </>
            )}
          </div>
          
          <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50 shrink-0">
            <button type="button" className="btn btn-neu" onClick={onClose} disabled={createMut.isPending || updateMut.isPending}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={createMut.isPending || updateMut.isPending || totalMarks > 100 || (isLoading && isEdit)}>
              {createMut.isPending || updateMut.isPending ? 'Saving...' : (isEdit ? 'Update Rule' : 'Create Rule')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
