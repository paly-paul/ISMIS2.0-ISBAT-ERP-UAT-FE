'use client'

import React from 'react'
import { useExamRules } from '@/hooks/assessment/useExamRules'
import { ScrollTable } from '@/components/ScrollTable'

interface ExamRuleLookupModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (guid: string) => void
  selectedGuid?: string | null
  // Resit coursework uses Section A only — tint those columns.
  highlightSectionA?: boolean
}

export function ExamRuleLookupModal({
  isOpen,
  onClose,
  onSelect,
  selectedGuid,
  highlightSectionA,
}: ExamRuleLookupModalProps) {
  const { data, isLoading } = useExamRules(1, 100, '', isOpen)
  const rules = data?.items?.filter(r => r.status !== 3) || []

  const secAHead = highlightSectionA ? { background: 'var(--b700)' } : undefined
  const secACell = highlightSectionA
    ? { background: 'var(--b50)', color: 'var(--b800)', fontWeight: 600 }
    : undefined

  if (!isOpen) return null

  const getType = (type?: number | null, maxQns?: number | null) => {
    if (maxQns != null && maxQns <= 0) return '—'
    if (type === 1) return 'MQ'
    if (type === 2) return 'DQ'
    return '—'
  }

  return (
    <div className="modal-overlay open" style={{ zIndex: 1100 }} onClick={onClose}>
      <div
        className="modal modal-flex"
        style={{
          maxWidth: '1360px',
          width: '94vw',
          maxHeight: '90vh',
          borderRadius: '12px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Standard Modal Header */}
        <div
          className="modal-hdr modal-hdr-blue"
          style={{ display: 'flex', alignItems: 'center', padding: '16px 20px' }}
        >
          <div className="modal-title text-white font-medium text-base">
            Select Exam Rule
          </div>
          <button
            className="modal-close text-white hover:text-white/80 transition-colors ml-auto bg-transparent border-none cursor-pointer"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="lni lni-close" style={{ fontSize: '18px' }}></i>
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="modal-scroll p-4 bg-white flex-1 overflow-y-auto">
          <ScrollTable>
            <table className="text-sm border-collapse w-full">
              <thead>
                <tr className="bg-[#001f5c] text-white">
                  <th className="py-2.5 px-3 border-r border-white/20 whitespace-nowrap text-left">Rule Code</th>
                  <th className="py-2.5 px-3 border-r border-white/20 whitespace-nowrap text-left">Rule Name</th>

                  {/* Sec A */}
                  <th className="py-2 px-2 border-r border-white/20 text-center leading-tight whitespace-nowrap" style={secAHead}>
                    Sec. A<br />Total Qns
                  </th>
                  <th className="py-2 px-2 border-r border-white/20 text-center leading-tight whitespace-nowrap" style={secAHead}>
                    Sec. A Max<br />Attempting Qns
                  </th>
                  <th className="py-2 px-2 border-r border-white/20 text-center leading-tight whitespace-nowrap" style={secAHead}>
                    Sec. A Max<br />Marks
                  </th>
                  <th className="py-2 px-2 border-r border-white/20 text-center leading-tight whitespace-nowrap" style={secAHead}>
                    Sec. A Type<br />(MCQ/DQ)
                  </th>

                  {/* Sec B */}
                  <th className="py-2 px-2 border-r border-white/20 text-center leading-tight whitespace-nowrap">
                    Sec. B<br />Total Qns
                  </th>
                  <th className="py-2 px-2 border-r border-white/20 text-center leading-tight whitespace-nowrap">
                    Sec. B Max<br />Attempting Qns
                  </th>
                  <th className="py-2 px-2 border-r border-white/20 text-center leading-tight whitespace-nowrap">
                    Sec. B Max<br />Marks
                  </th>
                  <th className="py-2 px-2 border-r border-white/20 text-center leading-tight whitespace-nowrap">
                    Sec. B Type<br />(MCQ/DQ)
                  </th>

                  {/* Sec C */}
                  <th className="py-2 px-2 border-r border-white/20 text-center leading-tight whitespace-nowrap">
                    Sec. C<br />Total Qns
                  </th>
                  <th className="py-2 px-2 border-r border-white/20 text-center leading-tight whitespace-nowrap">
                    Sec. C Max<br />Attempting Qns
                  </th>
                  <th className="py-2 px-2 border-r border-white/20 text-center leading-tight whitespace-nowrap">
                    Sec. C Max<br />Marks
                  </th>
                  <th className="py-2 px-2 text-center leading-tight whitespace-nowrap">
                    Sec. C Type<br />(MCQ/DQ)
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={14} className="text-center py-8 text-slate-500">
                      Loading rules...
                    </td>
                  </tr>
                ) : rules.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="text-center py-8 text-slate-500">
                      No exam rules found.
                    </td>
                  </tr>
                ) : (
                  rules.map((rule, idx) => {
                    const sA = rule.sections?.[0] || (rule as any).sectionA
                    const sB = rule.sections?.[1] || (rule as any).sectionB
                    const sC = rule.sections?.[2] || (rule as any).sectionC
                    const isSelected = selectedGuid === rule.examRuleGuid

                    return (
                      <tr
                        key={rule.examRuleGuid}
                        className={`cursor-pointer hover:bg-blue-50 transition-colors border-b border-slate-200 ${
                          isSelected
                            ? 'bg-blue-50 font-medium'
                            : idx % 2 === 0
                            ? 'bg-white'
                            : 'bg-[#f8f9fa]'
                        }`}
                        onClick={() => {
                          onSelect(rule.examRuleGuid)
                          onClose()
                        }}
                      >
                        <td className="px-3 py-2 border-r border-slate-200 font-mono text-[13px] text-[#3a6bc9] font-medium whitespace-nowrap">
                          {rule.ruleCode}
                        </td>
                        <td className="px-3 py-2 border-r border-slate-200 font-medium text-[13px] whitespace-nowrap">
                          {rule.ruleName}
                        </td>

                        {/* Sec A */}
                        <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600" style={secACell}>
                          {sA?.maxQuestions ?? 0}
                        </td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600" style={secACell}>
                          {sA?.attemptQuestions ?? 0}
                        </td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600" style={secACell}>
                          {sA?.mark ?? 0}
                        </td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600 font-medium" style={secACell}>
                          {getType(sA?.type, sA?.maxQuestions)}
                        </td>

                        {/* Sec B */}
                        <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600">
                          {sB?.maxQuestions ?? 0}
                        </td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600">
                          {sB?.attemptQuestions ?? 0}
                        </td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600">
                          {sB?.mark ?? 0}
                        </td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600 font-medium">
                          {getType(sB?.type, sB?.maxQuestions)}
                        </td>

                        {/* Sec C */}
                        <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600">
                          {sC?.maxQuestions ?? 0}
                        </td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600">
                          {sC?.attemptQuestions ?? 0}
                        </td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600">
                          {sC?.mark ?? 0}
                        </td>
                        <td className="px-2 py-2 text-center text-slate-600 font-medium">
                          {getType(sC?.type, sC?.maxQuestions)}
                        </td>
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
