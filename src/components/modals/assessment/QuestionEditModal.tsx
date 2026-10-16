'use client'

import React, { useState, useEffect } from 'react'
import { QuestionPreviewItem } from '@/hooks/assessment/useQuestionBank'

export interface QuestionEditModalProps {
  question?: QuestionPreviewItem
  questions?: QuestionPreviewItem[]
  initialIndex?: number
  bankTitle?: string
  onClose: () => void
  onSave: (updated: QuestionPreviewItem) => void
  onSaveAll?: (updatedList: QuestionPreviewItem[]) => void
}

import { RichTextEditor } from '@/components/RichTextEditor'

export function QuestionEditModal({
  question,
  questions,
  initialIndex = 0,
  bankTitle,
  onClose,
  onSave,
  onSaveAll,
}: QuestionEditModalProps) {
  // Determine question list: either questions array or single question in array
  const rawList: QuestionPreviewItem[] =
    questions && questions.length > 0
      ? questions
      : question
      ? [question]
      : [
          {
            slNo: '1',
            questionType: 'MCQ',
            question: '',
            option1: '',
            option2: '',
            option3: '',
            option4: '',
            answer: '',
            level: '1',
          },
        ]

  const [allQuestions, setAllQuestions] = useState<QuestionPreviewItem[]>(rawList)
  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    if (question && questions) {
      const found = questions.findIndex(q => q.slNo === question.slNo)
      if (found >= 0) return found
    }
    return Math.min(Math.max(0, initialIndex), rawList.length - 1)
  })

  // Synchronize internal state if questions prop changes
  useEffect(() => {
    if (questions && questions.length > 0) {
      setAllQuestions(questions)
    }
  }, [questions])

  const activeQuestion = allQuestions[currentIndex] || rawList[0]
  const [formData, setFormData] = useState<QuestionPreviewItem>({ ...activeQuestion })

  // When active index changes, update formData
  useEffect(() => {
    if (allQuestions[currentIndex]) {
      setFormData({ ...allQuestions[currentIndex] })
    }
  }, [currentIndex, allQuestions])

  const handleChange = (field: keyof QuestionPreviewItem, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Switch to another question, saving the current one
  const handleSelectIndex = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= allQuestions.length) return
    const updatedList = allQuestions.map((q, idx) => (idx === currentIndex ? formData : q))
    setAllQuestions(updatedList)
    onSave(formData)
    if (onSaveAll) onSaveAll(updatedList)
    setCurrentIndex(newIndex)
    setFormData({ ...updatedList[newIndex] })
  }

  const handleSaveCurrent = () => {
    const updatedList = allQuestions.map((q, idx) => (idx === currentIndex ? formData : q))
    setAllQuestions(updatedList)
    onSave(formData)
    if (onSaveAll) onSaveAll(updatedList)
  }

  const handleSaveAndNext = () => {
    handleSaveCurrent()
    if (currentIndex < allQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setFormData({ ...allQuestions[currentIndex + 1] })
    }
  }

  const isMultiQuestions = allQuestions.length > 1

  return (
    <div className="modal-overlay open" style={{ zIndex: 650 }}>
      <div
        className="modal modal-lg flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 940 }}
      >
        {/* Modal Header */}
        <div className="modal-hdr modal-hdr-blue shrink-0 flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <i className="lni lni-pencil-alt text-lg"></i>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base">Question View & Update</span>
              {bankTitle && (
                <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded font-mono truncate max-w-[280px]">
                  {bankTitle}
                </span>
              )}
            </div>
          </div>
          <button type="button" className="modal-close text-white hover:bg-white/20 p-1.5 rounded transition" onClick={onClose}>
            <i className="lni lni-close text-base"></i>
          </button>
        </div>

        {/* Multi-Question Selector Bar (when bank has multiple questions) */}
        {isMultiQuestions && (
          <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <i className="lni lni-layers text-indigo-600"></i>
              <span>Question {currentIndex + 1} of {allQuestions.length}</span>
            </div>

            {/* Question Quick Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
              {allQuestions.map((q, idx) => {
                const isActive = idx === currentIndex
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectIndex(idx)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-all shrink-0 flex items-center gap-1 ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-200/70 border-slate-200'
                    }`}
                    title={`Go to Question #${q.slNo || idx + 1}`}
                  >
                    <span>Q{idx + 1}</span>
                    <span className={`text-[10px] px-1 py-0.2 rounded font-normal ${
                      isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {q.questionType}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Prev / Next mini buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="btn btn-neu btn-sm px-2 py-0.5 text-xs"
                onClick={() => handleSelectIndex(currentIndex - 1)}
                disabled={currentIndex === 0}
                title="Previous Question"
              >
                <i className="lni lni-chevron-left"></i>
              </button>
              <button
                type="button"
                className="btn btn-neu btn-sm px-2 py-0.5 text-xs"
                onClick={() => handleSelectIndex(currentIndex + 1)}
                disabled={currentIndex === allQuestions.length - 1}
                title="Next Question"
              >
                <i className="lni lni-chevron-right"></i>
              </button>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="modal-body p-6 flex flex-col gap-5 bg-white overflow-y-auto max-h-[72vh]">
          {/* Top Controls: Type, Level, Ref No */}
          <div className="flex flex-wrap items-center gap-6 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-slate-700">Question Type<span className="text-red-500">*</span></span>
              <select
                className="border border-slate-300 rounded px-2.5 py-1 bg-slate-50 font-medium text-slate-800 text-sm focus:outline-none focus:border-indigo-500"
                value={formData.questionType}
                onChange={e => handleChange('questionType', e.target.value)}
              >
                <option value="DQ">DQ</option>
                <option value="MCQ">MCQ</option>
              </select>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-slate-700">Section</span>
              <select
                className="border border-slate-300 rounded px-2.5 py-1 bg-slate-50 text-slate-800 text-sm focus:outline-none focus:border-indigo-500"
                value={formData.level || ''}
                onChange={e => handleChange('level', e.target.value)}
              >
                <option value="">--Select--</option>
                <option value="1">Section A</option>
                <option value="2">Section B</option>
                <option value="3">Section C</option>
              </select>
            </div>
            <div className="flex items-center gap-2 text-sm ml-auto">
              <span className="font-semibold text-slate-700">Question Ref No:</span>
              <span className="font-mono font-bold text-indigo-700 text-base">{formData.slNo || currentIndex + 1}</span>
            </div>
          </div>

          {/* Question Text Editor */}
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="font-semibold text-sm text-slate-700 w-24 shrink-0 pt-2">Question</div>
            <div className="flex-1 w-full">
              <RichTextEditor
                value={formData.question}
                onChange={val => handleChange('question', val)}
                placeholder="Enter question text here..."
                minHeight={120}
              />
            </div>
          </div>

          {/* MCQ Options */}
          {formData.questionType === 'MCQ' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="font-semibold text-sm text-slate-700 w-24 shrink-0 pt-2 text-right pr-2">Option 1</div>
                <div className="flex-1 w-full">
                  <RichTextEditor
                    value={formData.option1}
                    onChange={val => handleChange('option1', val)}
                    placeholder="Enter Option 1..."
                    minHeight={65}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="font-semibold text-sm text-slate-700 w-24 shrink-0 pt-2 text-right pr-2">Option 2</div>
                <div className="flex-1 w-full">
                  <RichTextEditor
                    value={formData.option2}
                    onChange={val => handleChange('option2', val)}
                    placeholder="Enter Option 2..."
                    minHeight={65}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="font-semibold text-sm text-slate-700 w-24 shrink-0 pt-2 text-right pr-2">Option 3</div>
                <div className="flex-1 w-full">
                  <RichTextEditor
                    value={formData.option3}
                    onChange={val => handleChange('option3', val)}
                    placeholder="Enter Option 3..."
                    minHeight={65}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="font-semibold text-sm text-slate-700 w-24 shrink-0 pt-2 text-right pr-2">Option 4</div>
                <div className="flex-1 w-full">
                  <RichTextEditor
                    value={formData.option4}
                    onChange={val => handleChange('option4', val)}
                    placeholder="Enter Option 4..."
                    minHeight={65}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Correct Answer Field */}
          <div className="flex flex-col sm:flex-row gap-4 items-center pt-2">
            <div className="font-bold text-sm text-emerald-700 w-24 shrink-0 pt-2">Correct Answer</div>
            <div className="flex-1 w-full">
              <input
                type="text"
                className="w-full border border-emerald-300 bg-emerald-50 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-emerald-500 text-emerald-900 shadow-xs"
                value={formData.answer}
                onChange={e => handleChange('answer', e.target.value)}
                placeholder={formData.questionType === 'MCQ' ? "Type exact option text as answer key" : "Type model answer or evaluation rubric"}
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer shrink-0 flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 border-t border-slate-200">
          {/* Stepper buttons (when multiple questions) */}
          {isMultiQuestions ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-neu btn-sm flex items-center gap-1"
                onClick={() => handleSelectIndex(currentIndex - 1)}
                disabled={currentIndex === 0}
              >
                <i className="lni lni-chevron-left"></i> Previous
              </button>
              <button
                type="button"
                className="btn btn-neu btn-sm flex items-center gap-1"
                onClick={() => handleSelectIndex(currentIndex + 1)}
                disabled={currentIndex === allQuestions.length - 1}
              >
                Next <i className="lni lni-chevron-right"></i>
              </button>
            </div>
          ) : (
            <div></div>
          )}

          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-neu" onClick={onClose}>
              Cancel
            </button>

            {isMultiQuestions && currentIndex < allQuestions.length - 1 && (
              <button
                type="button"
                className="btn btn-primary bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1.5"
                onClick={handleSaveAndNext}
              >
                <span>Update & Next</span>
                <i className="lni lni-arrow-right"></i>
              </button>
            )}

            <button type="button" className="btn btn-primary" onClick={handleSaveCurrent}>
              Update Question
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
