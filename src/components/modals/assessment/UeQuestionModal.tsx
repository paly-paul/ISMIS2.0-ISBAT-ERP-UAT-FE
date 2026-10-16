'use client'

import React, { useState, useEffect } from 'react'
import { UeQuestionDto, SaveUeQuestionRequest } from '@/lib/api/assessment/ueQuestions'
import { useCreateUeQuestion, useUpdateUeQuestion } from '@/hooks/assessment/useUeQuestions'
import { RichTextEditor, isHtmlEmpty } from '@/components/RichTextEditor'

interface UeQuestionModalProps {
  isOpen: boolean
  onClose: () => void
  courseUnitGuid: string
  courseUnitCode?: string
  courseUnitName?: string
  ueType: number // 0 = Theory, 1 = Practical
  defaultLevel?: number // 1 = Sec A, 2 = Sec B, 3 = Sec C
  question?: UeQuestionDto | null
  onSuccess: () => void
  showToast: (msg: string, type?: string) => void
}

export function UeQuestionModal({
  isOpen,
  onClose,
  courseUnitGuid,
  courseUnitCode,
  courseUnitName,
  ueType,
  defaultLevel = 1,
  question,
  onSuccess,
  showToast,
}: UeQuestionModalProps) {
  const isEdit = Boolean(question?.questionGuid)

  const [questionType, setQuestionType] = useState<number>(question?.questionType ?? 1)
  const [level, setLevel] = useState<number>(question?.level ?? defaultLevel)
  const [questionText, setQuestionText] = useState<string>(question?.questionText ?? '')
  const [option1Text, setOption1Text] = useState<string>(question?.option1Text ?? '')
  const [option2Text, setOption2Text] = useState<string>(question?.option2Text ?? '')
  const [option3Text, setOption3Text] = useState<string>(question?.option3Text ?? '')
  const [option4Text, setOption4Text] = useState<string>(question?.option4Text ?? '')
  const [selectedCorrectOptionIndex, setSelectedCorrectOptionIndex] = useState<number>(0)
  const [descriptiveAnswer, setDescriptiveAnswer] = useState<string>(question?.answerText ?? '')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const createMut = useCreateUeQuestion()
  const updateMut = useUpdateUeQuestion()

  useEffect(() => {
    if (question) {
      setQuestionType(question.questionType ?? 1)
      setLevel(question.level ?? defaultLevel)
      setQuestionText(question.questionText ?? '')
      setOption1Text(question.option1Text ?? '')
      setOption2Text(question.option2Text ?? '')
      setOption3Text(question.option3Text ?? '')
      setOption4Text(question.option4Text ?? '')

      const ans = (question.answerText ?? '').trim()
      if (ans && question.questionType === 1) {
        if (ans === question.option1Text?.trim()) setSelectedCorrectOptionIndex(0)
        else if (ans === question.option2Text?.trim()) setSelectedCorrectOptionIndex(1)
        else if (ans === question.option3Text?.trim()) setSelectedCorrectOptionIndex(2)
        else if (ans === question.option4Text?.trim()) setSelectedCorrectOptionIndex(3)
        else setSelectedCorrectOptionIndex(0)
      } else {
        setDescriptiveAnswer(question.answerText ?? '')
      }
    } else {
      setQuestionType(1)
      setLevel(defaultLevel)
      setQuestionText('')
      setOption1Text('')
      setOption2Text('')
      setOption3Text('')
      setOption4Text('')
      setSelectedCorrectOptionIndex(0)
      setDescriptiveAnswer('')
    }
    setErrorMsg(null)
  }, [question, defaultLevel, isOpen])

  if (!isOpen) return null

  const isVerified = Boolean(question?.isVerified)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (isVerified) {
      setErrorMsg('This question has already been verified and can no longer be edited.')
      return
    }

    if (isHtmlEmpty(questionText)) {
      setErrorMsg('Question text cannot be left blank!')
      return
    }

    let resolvedAnswer = ''

    if (questionType === 1) {
      const o1 = option1Text.trim()
      const o2 = option2Text.trim()
      const o3 = option3Text.trim()
      const o4 = option4Text.trim()

      if (!o1) { setErrorMsg('Option 1 cannot be left blank!'); return }
      if (!o2) { setErrorMsg('Option 2 cannot be left blank!'); return }
      if (!o3) { setErrorMsg('Option 3 cannot be left blank!'); return }
      if (!o4) { setErrorMsg('Option 4 cannot be left blank!'); return }

      const opts = [o1, o2, o3, o4]
      const uniqueOpts = new Set(opts.map(o => o.toLowerCase()))
      if (uniqueOpts.size < 4) {
        setErrorMsg('Options should not duplicate!')
        return
      }

      resolvedAnswer = opts[selectedCorrectOptionIndex]
      if (!resolvedAnswer) {
        setErrorMsg('Please select a valid correct option.')
        return
      }
    } else {
      if (isHtmlEmpty(descriptiveAnswer)) {
        setErrorMsg('Answer text cannot be left blank!')
        return
      }
      resolvedAnswer = descriptiveAnswer.trim()
    }

    const payload: SaveUeQuestionRequest = {
      courseUnitGuid,
      category: 5,
      questionType,
      level,
      questionText: questionText.trim(),
      option1Text: questionType === 1 ? option1Text.trim() : null,
      option2Text: questionType === 1 ? option2Text.trim() : null,
      option3Text: questionType === 1 ? option3Text.trim() : null,
      option4Text: questionType === 1 ? option4Text.trim() : null,
      answerText: resolvedAnswer,
      universityExamType: ueType,
    }

    if (isEdit && question?.questionGuid) {
      updateMut.mutate(
        { guid: question.questionGuid, payload },
        {
          onSuccess: () => {
            showToast('Question updated successfully.', 'success')
            onSuccess()
            onClose()
          },
          onError: (err: any) => {
            const msg = err?.message || 'Failed to update question.'
            setErrorMsg(msg)
          },
        }
      )
    } else {
      createMut.mutate(payload, {
        onSuccess: () => {
          showToast('Question created successfully.', 'success')
          onSuccess()
          onClose()
        },
        onError: (err: any) => {
          const msg = err?.message || 'Failed to create question.'
          setErrorMsg(msg)
        },
      })
    }
  }

  const isPending = createMut.isPending || updateMut.isPending

  return (
    <div className="modal-overlay open" style={{ zIndex: 650 }}>
      <div
        className="modal modal-lg flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 720 }}
      >
        {/* Modal Header */}
        <div className="modal-hdr modal-hdr-blue shrink-0">
          <div className="modal-title flex items-center gap-2">
            <i className={isEdit ? 'lni lni-pencil-alt' : 'lni lni-plus'}></i>
            <span>{isEdit ? 'Edit UE Question' : 'Add University Exam Question'}</span>
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={isPending}>
            <i className="lni lni-close"></i>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="modal-body p-5 flex flex-col gap-4 bg-slate-50 overflow-y-auto max-h-[72vh]">
            
            {/* Scope Badge Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white border border-slate-200 rounded-lg shadow-sm text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-500">Subject:</span>
                <span className="font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold border border-indigo-200">
                  {courseUnitCode || 'Unit'} {courseUnitName ? `— ${courseUnitName}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-purple">Category: University Exam</span>
                <span className="badge bg-blue-50 text-blue-700 border border-blue-200">
                  {ueType === 0 ? 'Theory' : 'Practical'}
                </span>
              </div>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-900 rounded-lg p-3 text-xs flex items-center gap-2">
                <i className="lni lni-warning text-red-600 text-base shrink-0"></i>
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}

            {isVerified && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 text-xs flex items-center gap-2">
                <i className="lni lni-lock text-amber-600 text-base shrink-0"></i>
                <span className="font-medium">
                  <strong>Locked:</strong> This question has already been verified and cannot be edited.
                </span>
              </div>
            )}

            {/* Section Level & Question Type Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Section / Level <span className="text-red-500">*</span>
                </label>
                <select
                  disabled={isVerified}
                  value={level}
                  onChange={(e) => setLevel(Number(e.target.value))}
                  className="ctrl w-full text-xs font-medium"
                >
                  <option value={1}>Section A (Level 1 — MCQs / 2 marks)</option>
                  <option value={2}>Section B (Level 2 — 15 marks)</option>
                  <option value={3}>Section C (Level 3 — 20 marks)</option>
                </select>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Question Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isVerified}
                    className={`py-1.5 px-3 rounded text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                      questionType === 1
                        ? 'bg-purple-50 border-purple-300 text-purple-800 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                    onClick={() => setQuestionType(1)}
                  >
                    <i className="lni lni-list"></i> MCQ
                  </button>
                  <button
                    type="button"
                    disabled={isVerified}
                    className={`py-1.5 px-3 rounded text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                      questionType === 2
                        ? 'bg-purple-50 border-purple-300 text-purple-800 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                    onClick={() => setQuestionType(2)}
                  >
                    <i className="lni lni-text-format"></i> Descriptive
                  </button>
                </div>
              </div>
            </div>

            {/* Question Text */}
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Question Statement <span className="text-red-500">*</span>
              </label>
              <RichTextEditor
                disabled={isVerified || isPending}
                placeholder="Enter the question statement clearly..."
                value={questionText}
                onChange={setQuestionText}
                minHeight={110}
              />
            </div>

            {/* MCQ Options */}
            {questionType === 1 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-700">
                    Options & Correct Answer <span className="text-red-500">*</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Select radio button for the correct key
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {[
                    { label: 'A', val: option1Text, set: setOption1Text, idx: 0 },
                    { label: 'B', val: option2Text, set: setOption2Text, idx: 1 },
                    { label: 'C', val: option3Text, set: setOption3Text, idx: 2 },
                    { label: 'D', val: option4Text, set: setOption4Text, idx: 3 },
                  ].map(opt => (
                    <div
                      key={opt.label}
                      className={`flex items-center gap-2 p-2 rounded border transition-all ${
                        selectedCorrectOptionIndex === opt.idx
                          ? 'border-purple-300 bg-purple-50/30'
                          : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="correctKey"
                        disabled={isVerified}
                        checked={selectedCorrectOptionIndex === opt.idx}
                        onChange={() => setSelectedCorrectOptionIndex(opt.idx)}
                        className="cursor-pointer"
                      />
                      <span className="w-5 text-xs font-bold text-slate-600">{opt.label}.</span>
                      <input
                        type="text"
                        disabled={isVerified}
                        value={opt.val}
                        onChange={e => opt.set(e.target.value)}
                        placeholder={`Option ${opt.label}`}
                        className="ctrl flex-1 text-xs"
                      />
                      {selectedCorrectOptionIndex === opt.idx && (
                        <span className="badge badge-green text-[10px] py-0.5 px-2 font-bold">
                          ✓ Correct Key
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Model Answer / Key Solution <span className="text-red-500">*</span>
                </label>
                <RichTextEditor
                  disabled={isVerified || isPending}
                  placeholder="Enter model answer and evaluation guidelines..."
                  value={descriptiveAnswer}
                  onChange={setDescriptiveAnswer}
                  minHeight={110}
                />
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="modal-ftr p-3 bg-white border-t border-slate-200 flex justify-end gap-2 shrink-0">
            <button
              type="button"
              className="btn btn-neu btn-sm"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm flex items-center gap-1.5"
              disabled={isPending || isVerified}
            >
              {isPending && <i className="lni lni-reload animate-spin text-xs"></i>}
              <span>{isEdit ? 'Save Changes' : 'Create Question'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
