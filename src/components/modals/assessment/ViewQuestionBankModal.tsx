'use client'

import React, { useState, useMemo } from 'react'
import { ScrollTable } from '@/components/ScrollTable'
import { TableSearch } from '@/components/TableSearch'
import { ActionMenu } from '@/components/ActionMenu'
import { QuestionPreviewItem } from '@/hooks/assessment/useQuestionBank'
import { QuestionEditModal } from './QuestionEditModal'
import { RichTextDisplay } from '@/components/RichTextEditor'
import { useQuestions, useDeleteQuestion, useUpdateQuestion, useCreateQuestion } from '@/hooks/assessment/useQuestions'
import { QuestionDto } from '@/lib/api/assessment/questions'

export interface ExistingQuestionBank {
  id: string
  fileName: string
  categoryId: string
  categoryName: string
  courseUnitGuid: string
  courseUnitCode: string
  courseUnitName: string
  academicIntake?: string
  intakeGuid?: string
  uploadedBy: string
  uploadedDate: string
  fileSize: string
  status: 'Active' | 'Archived' | 'Draft'
  questions: QuestionPreviewItem[]
}

interface ViewQuestionBankModalProps {
  isOpen: boolean
  bank: ExistingQuestionBank | null
  onClose: () => void
  onUpdateBankQuestions: (bankId: string, updatedQuestions: QuestionPreviewItem[]) => void
  showToast: (msg: string, type?: string) => void
}

export function ViewQuestionBankModal({
  isOpen,
  bank,
  onClose,
  onUpdateBankQuestions,
  showToast,
}: ViewQuestionBankModalProps) {
  const [filterType, setFilterType] = useState<'ALL' | 'MCQ' | 'DQ'>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [editingQuestion, setEditingQuestion] = useState<QuestionPreviewItem | null>(null)
  const [viewingDetailQuestion, setViewingDetailQuestion] = useState<QuestionPreviewItem | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)

  // Fetch live questions from backend
  const { data: liveQuestionsDto, isLoading: isLoadingQuestions } = useQuestions(
    bank?.courseUnitGuid || '',
    Number(bank?.categoryId || 0),
    bank?.intakeGuid || '',
    isOpen && Boolean(bank)
  )

  const deleteMut = useDeleteQuestion()
  const updateMut = useUpdateQuestion()
  const createMut = useCreateQuestion()

  const questions: QuestionPreviewItem[] = useMemo(() => {
    if (isLoadingQuestions || !liveQuestionsDto) {
      // Fallback to local array while loading or if fetching fails
      return bank?.questions || []
    }
    return liveQuestionsDto.map((q, idx) => ({
      slNo: String(idx + 1), // Generate sequential number for display
      questionType: q.questionType === 1 ? 'MCQ' : 'DQ',
      question: q.questionText || '',
      option1: q.option1Text || '',
      option2: q.option2Text || '',
      option3: q.option3Text || '',
      option4: q.option4Text || '',
      answer: q.answerText || '',
      level: q.level ? String(q.level) : '',
      questionGuid: q.questionGuid,
    }))
  }, [liveQuestionsDto, bank?.questions, isLoadingQuestions])

  const mcqCount = useMemo(() => questions.filter(q => q.questionType === 'MCQ').length, [questions])
  const dqCount = useMemo(() => questions.filter(q => q.questionType === 'DQ').length, [questions])

  const filteredQuestions = useMemo(() => {
    return questions.filter((item) => {
      if (filterType !== 'ALL' && item.questionType !== filterType) {
        return false
      }
      if (searchQuery.trim()) {
        const needle = searchQuery.toLowerCase()
        const matchQ = item.question?.toLowerCase().includes(needle)
        const matchAns = item.answer?.toLowerCase().includes(needle)
        const matchOpts =
          item.option1?.toLowerCase().includes(needle) ||
          item.option2?.toLowerCase().includes(needle) ||
          item.option3?.toLowerCase().includes(needle) ||
          item.option4?.toLowerCase().includes(needle)
        return matchQ || matchAns || matchOpts
      }
      return true
    })
  }, [questions, filterType, searchQuery])

  if (!isOpen || !bank) return null

  const handleSaveQuestion = (updated: QuestionPreviewItem) => {
    if (isAddingNew) {
      if (!liveQuestionsDto) {
        // Fallback local update for mock data
        const updatedList = [...questions, updated]
        onUpdateBankQuestions(bank.id, updatedList)
        setEditingQuestion(null)
        setIsAddingNew(false)
        showToast(`New question added locally!`, 'success')
        return
      }

      // Add new question via API
      createMut.mutate({
        courseUnitGuid: bank.courseUnitGuid,
        category: Number(bank.categoryId),
        intakeGuid: bank.intakeGuid || '',
        questionType: updated.questionType === 'MCQ' ? 1 : 2,
        level: updated.level ? Number(updated.level) : null,
        questionText: updated.question,
        option1Text: updated.option1 || null,
        option2Text: updated.option2 || null,
        option3Text: updated.option3 || null,
        option4Text: updated.option4 || null,
        answerText: updated.answer,
      }, {
        onSuccess: () => {
          showToast(`New question added successfully!`, 'success')
          setEditingQuestion(null)
          setIsAddingNew(false)
        },
        onError: (err: any) => {
          showToast(err.message || 'Failed to add question', 'error')
        }
      })
      return
    }

    if (updated.questionGuid) {
      // Update existing DB question
      updateMut.mutate({
        guid: updated.questionGuid,
        payload: {
          questionType: updated.questionType === 'MCQ' ? 1 : 2,
          level: updated.level ? Number(updated.level) : null,
          questionText: updated.question,
          option1Text: updated.option1 || null,
          option2Text: updated.option2 || null,
          option3Text: updated.option3 || null,
          option4Text: updated.option4 || null,
          answerText: updated.answer,
        }
      }, {
        onSuccess: () => {
          showToast(`Question updated successfully!`, 'success')
          setEditingQuestion(null)
        },
        onError: (err: any) => {
          showToast(err.message || 'Failed to update question', 'error')
        }
      })
    } else {
      // Fallback local update (for purely mock preview data)
      const updatedList = questions.map((q) => (q.slNo === updated.slNo ? updated : q))
      onUpdateBankQuestions(bank.id, updatedList)
      setEditingQuestion(null)
      showToast(`Question #${updated.slNo} updated locally!`, 'success')
    }
  }

  const handleDeleteQuestion = (slNo: string) => {
    const qToDelete = questions.find(q => q.slNo === slNo)
    if (qToDelete && qToDelete.questionGuid) {
      if (confirm('Are you sure you want to delete this question from the database?')) {
        deleteMut.mutate(qToDelete.questionGuid, {
          onSuccess: () => {
            showToast(`Question deleted successfully.`, 'success')
          },
          onError: (err: any) => {
            showToast(err.message || 'Failed to delete question.', 'error')
          }
        })
      }
    } else {
      const updatedList = questions.filter((q) => q.slNo !== slNo)
      onUpdateBankQuestions(bank.id, updatedList)
      showToast(`Question #${slNo} removed from question bank locally.`, 'success')
    }
  }

  const handleAddNewClick = () => {
    setIsAddingNew(true)
    setEditingQuestion({
      slNo: String(questions.length + 1),
      questionType: 'MCQ',
      question: '',
      option1: '',
      option2: '',
      option3: '',
      option4: '',
      answer: '',
      level: '1',
    })
  }

  return (
    <>
      <div className="modal-overlay open" style={{ zIndex: 520 }}>
        <div
          className="modal modal-xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: 1100, maxHeight: '90vh' }}
        >
          {/* Modal Header */}
          <div className="modal-hdr modal-hdr-blue shrink-0 flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center text-white text-lg">
                <i className="lni lni-library"></i>
              </div>
              <div>
                <div className="modal-title flex items-center gap-2 text-base font-bold">
                  <span>Question Bank: {bank.fileName}</span>
                  <span className="badge badge-green text-xs">{bank.status}</span>
                </div>
                <div className="text-xs text-blue-100 flex items-center gap-2 mt-0.5">
                  <span className="font-mono font-semibold">{bank.courseUnitCode}</span>
                  <span>•</span>
                  <span>{bank.courseUnitName}</span>
                  <span>•</span>
                  <span className="bg-white/15 px-2 py-0.5 rounded text-[11px] font-medium">{bank.categoryName}</span>
                  <span>•</span>
                  <span>{bank.uploadedDate}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="modal-close text-white hover:bg-white/20 p-1.5 rounded transition"
              onClick={onClose}
            >
              <i className="lni lni-close text-base"></i>
            </button>
          </div>

          {/* Modal Body */}
          <div className="modal-body p-5 flex flex-col gap-4 bg-slate-50 overflow-y-auto flex-1">
            {/* KPI Summary Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
              <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Total Questions</div>
                <div className="text-xl font-bold text-slate-900 mt-0.5">{questions.length}</div>
              </div>
              <div className="bg-purple-50/70 border border-purple-200/70 rounded-lg p-3 shadow-xs">
                <div className="text-[11px] uppercase tracking-wider text-purple-700 font-semibold">MCQ (Multiple Choice)</div>
                <div className="text-xl font-bold text-purple-900 mt-0.5">{mcqCount}</div>
              </div>
              <div className="bg-blue-50/70 border border-blue-200/70 rounded-lg p-3 shadow-xs">
                <div className="text-[11px] uppercase tracking-wider text-blue-700 font-semibold">DQ (Descriptive)</div>
                <div className="text-xl font-bold text-blue-900 mt-0.5">{dqCount}</div>
              </div>
              <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-lg p-3 shadow-xs">
                <div className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold">Bank Scope</div>
                <div className="text-xs font-bold text-emerald-900 mt-1 truncate" title={bank.courseUnitName}>
                  {bank.courseUnitCode}
                </div>
              </div>
            </div>

            {/* Action Bar (Add New, Filters, Search) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm flex items-center gap-1.5"
                  onClick={handleAddNewClick}
                >
                  <i className="lni lni-plus"></i>
                  <span>Add Question</span>
                </button>
                <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg">
                <button
                  type="button"
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    filterType === 'ALL'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  onClick={() => setFilterType('ALL')}
                >
                  All ({questions.length})
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    filterType === 'MCQ'
                      ? 'bg-white text-purple-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  onClick={() => setFilterType('MCQ')}
                >
                  MCQ ({mcqCount})
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    filterType === 'DQ'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  onClick={() => setFilterType('DQ')}
                >
                  DQ ({dqCount})
                </button>
              </div>
              </div>

              <TableSearch
                className="w-full sm:w-80"
                placeholder="Search question text or answer..."
                value={searchQuery}
                onChange={setSearchQuery}
                results={filteredQuestions.slice(0, 5).map((q) => ({
                  id: q.slNo,
                  primary: q.question,
                  secondary: `${q.questionType} • Ans: ${q.answer}`,
                }))}
                onSelect={(r) => setSearchQuery(r.primary)}
              />
            </div>

            {/* Questions Table */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs flex-1">
              <ScrollTable>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 80, textAlign: 'center' }}>ACTIONS</th>
                      <th style={{ width: 55, textAlign: 'center' }}>SL</th>
                      <th style={{ width: 80, textAlign: 'center' }}>TYPE</th>
                      <th style={{ minWidth: 260, maxWidth: 420 }}>QUESTION</th>
                      <th style={{ minWidth: 240 }}>OPTIONS</th>
                      <th style={{ minWidth: 150 }}>ANSWER</th>
                      <th style={{ width: 75, textAlign: 'center' }}>LEVEL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuestions.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--g400)' }}>
                          <i className="lni lni-search text-2xl block mb-2 opacity-50"></i>
                          No questions found matching your filter or search query.
                        </td>
                      </tr>
                    ) : (
                      filteredQuestions.map((q, idx) => (
                        <tr key={idx}>
                          {/* Actions: Direct Edit & Action Menu */}
                          <td style={{ textAlign: 'center' }}>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                className="btn btn-neu btn-sm px-2 py-1 flex items-center gap-1 text-amber-700 hover:bg-amber-50"
                                onClick={() => setEditingQuestion(q)}
                                title="Edit this question"
                              >
                                <i className="lni lni-pencil-alt text-xs"></i>
                                <span className="text-xs font-semibold">Edit</span>
                              </button>
                              <ActionMenu tooltip="More options">
                                <button
                                  type="button"
                                  className="btn btn-neu btn-sm flex items-center gap-1.5"
                                  onClick={() => setViewingDetailQuestion(q)}
                                >
                                  <i className="lni lni-eye text-indigo-600"></i>
                                  <span>View Details</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-neu btn-sm flex items-center gap-1.5"
                                  onClick={() => setEditingQuestion(q)}
                                >
                                  <i className="lni lni-pencil-alt text-amber-600"></i>
                                  <span>Edit Question</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-neu btn-sm flex items-center gap-1.5 text-red-600"
                                  onClick={() => handleDeleteQuestion(q.slNo)}
                                >
                                  <i className="lni lni-trash-can"></i>
                                  <span>Delete Question</span>
                                </button>
                              </ActionMenu>
                            </div>
                          </td>

                          {/* SL NO */}
                          <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: 'var(--g500)' }}>
                            {q.slNo}
                          </td>

                          {/* Question Type */}
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${q.questionType === 'MCQ' ? 'badge-purple' : 'badge-blue'}`}>
                              {q.questionType}
                            </span>
                          </td>

                          {/* Question Text */}
                          <td style={{ whiteSpace: 'normal', minWidth: 260, maxWidth: 420, lineHeight: 1.5, color: 'var(--g800)' }}>
                            <div className="font-medium"><RichTextDisplay content={q.question} /></div>
                          </td>

                          {/* Options */}
                          <td style={{ whiteSpace: 'normal', minWidth: 240 }}>
                            {q.questionType === 'MCQ' ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                                <div className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 truncate" title={q.option1}>
                                  <strong className="text-slate-400 mr-1">A:</strong>{q.option1}
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 truncate" title={q.option2}>
                                  <strong className="text-slate-400 mr-1">B:</strong>{q.option2}
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 truncate" title={q.option3}>
                                  <strong className="text-slate-400 mr-1">C:</strong>{q.option3}
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 truncate" title={q.option4}>
                                  <strong className="text-slate-400 mr-1">D:</strong>{q.option4}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Descriptive (No options)</span>
                            )}
                          </td>

                          {/* Answer */}
                          <td style={{ whiteSpace: 'normal', minWidth: 150 }}>
                            <span className="inline-block bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] px-2 py-0.5 rounded font-medium">
                              <RichTextDisplay content={q.answer} />
                            </span>
                          </td>

                          {/* Level */}
                          <td style={{ textAlign: 'center' }}>
                            {q.level ? (
                              <span className="badge badge-neu text-xs font-mono font-semibold">
                                L{q.level}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </ScrollTable>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modal-footer shrink-0 flex items-center justify-between p-4 bg-white border-t border-slate-200">
            <div className="text-xs text-slate-500">
              Showing <strong>{filteredQuestions.length}</strong> of <strong>{questions.length}</strong> questions in this bank.
            </div>
            <button type="button" className="btn btn-neu" onClick={onClose}>
              Close Window
            </button>
          </div>
        </div>
      </div>

      {/* ── Sub-modal for Detailed View ─────────────────────────────────────── */}
      {viewingDetailQuestion && (
        <div className="modal-overlay open" style={{ zIndex: 610 }}>
          <div
            className="modal modal-md flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 640 }}
          >
            <div className="modal-hdr modal-hdr-blue shrink-0">
              <div className="modal-title flex items-center gap-2">
                <i className="lni lni-eye"></i>
                <span>Question Details — #{viewingDetailQuestion.slNo}</span>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setViewingDetailQuestion(null)}
              >
                <i className="lni lni-close"></i>
              </button>
            </div>
            <div className="modal-body p-5 flex flex-col gap-3 bg-slate-50 overflow-y-auto max-h-[70vh]">
              <div className="flex items-center gap-2">
                <span className={`badge ${viewingDetailQuestion.questionType === 'MCQ' ? 'badge-purple' : 'badge-blue'}`}>
                  {viewingDetailQuestion.questionType}
                </span>
                {viewingDetailQuestion.level && (
                  <span className="badge badge-neu">Level {viewingDetailQuestion.level}</span>
                )}
              </div>
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Question</div>
                <div className="text-sm font-medium text-slate-800"><RichTextDisplay content={viewingDetailQuestion.question} /></div>
              </div>
              {viewingDetailQuestion.questionType === 'MCQ' && (
                <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs space-y-1.5 text-xs">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Options</div>
                  <div><strong>A:</strong> {viewingDetailQuestion.option1}</div>
                  <div><strong>B:</strong> {viewingDetailQuestion.option2}</div>
                  <div><strong>C:</strong> {viewingDetailQuestion.option3}</div>
                  <div><strong>D:</strong> {viewingDetailQuestion.option4}</div>
                </div>
              )}
              <div className="bg-emerald-50 p-3.5 rounded-lg border border-emerald-200 text-xs">
                <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Answer Key</div>
                <div className="font-semibold text-emerald-900"><RichTextDisplay content={viewingDetailQuestion.answer} /></div>
              </div>
            </div>
            <div className="modal-footer shrink-0 flex items-center justify-end p-3.5 bg-white border-t border-slate-200">
              <button
                type="button"
                className="btn btn-neu"
                onClick={() => setViewingDetailQuestion(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-modal for Editing Question ──────────────────────────────────── */}
      {editingQuestion && (
        <QuestionEditModal
          question={editingQuestion}
          questions={questions}
          initialIndex={Math.max(0, questions.findIndex(q => q.slNo === editingQuestion.slNo))}
          bankTitle={bank.fileName}
          onClose={() => {
            setEditingQuestion(null)
            setIsAddingNew(false)
          }}
          onSave={handleSaveQuestion}
          onSaveAll={(updatedList) => {
            onUpdateBankQuestions(bank.id, updatedList)
            showToast('Question bank saved!', 'success')
          }}
        />
      )}
    </>
  )
}
