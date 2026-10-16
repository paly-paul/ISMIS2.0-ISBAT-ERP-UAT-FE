'use client'

import React from 'react'
import { UeQuestionDto } from '@/lib/api/assessment/ueQuestions'

interface ViewUeQuestionModalProps {
  isOpen: boolean
  onClose: () => void
  question: UeQuestionDto | null
  courseUnitCode?: string
  courseUnitName?: string
  onEdit?: (question: UeQuestionDto) => void
}

export function ViewUeQuestionModal({
  isOpen,
  onClose,
  question,
  courseUnitCode,
  courseUnitName,
  onEdit,
}: ViewUeQuestionModalProps) {
  if (!isOpen || !question) return null

  const getSectionLabel = (lvl: number | null) => {
    switch (lvl) {
      case 1: return 'Section A (Level 1 — MCQs)'
      case 2: return 'Section B (Level 2 — 15m)'
      case 3: return 'Section C (Level 3 — 20m)'
      default: return 'Section A'
    }
  }

  const isMcq = question.questionType === 1
  const isVerified = Boolean(question.isVerified)

  const options = [
    { label: 'A', text: question.option1Text },
    { label: 'B', text: question.option2Text },
    { label: 'C', text: question.option3Text },
    { label: 'D', text: question.option4Text },
  ].filter(o => o.text !== null && o.text !== undefined && o.text !== '')

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
            <i className="lni lni-search-alt"></i>
            <span>Question Details</span>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            <i className="lni lni-close"></i>
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body p-5 flex flex-col gap-4 bg-slate-50 overflow-y-auto max-h-[72vh]">
          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white border border-slate-200 rounded-lg shadow-sm text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-500">Subject:</span>
              <span className="font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold border border-indigo-200">
                {courseUnitCode || 'Unit'} {courseUnitName ? `— ${courseUnitName}` : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge badge-purple">{getSectionLabel(question.level)}</span>
              <span className="badge bg-blue-50 text-blue-700 border border-blue-200">
                {isMcq ? 'MCQ' : 'Descriptive'}
              </span>
              {isVerified ? (
                <span className="badge badge-green">✓ Verified</span>
              ) : (
                <span className="badge badge-amber">Pending Vetting</span>
              )}
            </div>
          </div>

          {/* Question Text Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Question Statement
            </div>
            <div className="text-xs text-slate-900 font-medium leading-relaxed whitespace-pre-wrap">
              {question.questionText}
            </div>
          </div>

          {/* MCQ Options */}
          {isMcq && (
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-col gap-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Options
              </div>
              <div className="grid grid-cols-1 gap-2">
                {options.map((opt) => {
                  const isCorrect = (opt.text ?? '').trim() === (question.answerText ?? '').trim()
                  return (
                    <div
                      key={opt.label}
                      className={`p-2.5 rounded border text-xs flex items-center justify-between transition-colors ${
                        isCorrect
                          ? 'border-emerald-300 bg-emerald-50/60 text-emerald-950 font-semibold'
                          : 'border-slate-200 bg-slate-50/40 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                          isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {opt.label}
                        </span>
                        <span>{opt.text}</span>
                      </div>
                      {isCorrect && (
                        <span className="badge badge-green text-[10px] font-bold py-0.5 px-2">
                          ✓ Correct Key
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Answer Key / Solution */}
          <div className="bg-white border border-slate-200 rounded-lg p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {isMcq ? 'Correct Answer Key' : 'Model Answer & Evaluation Guidelines'}
            </div>
            <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
              {question.answerText || '—'}
            </div>
          </div>

          {/* Verification Audit Stamp */}
          {isVerified && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 flex items-center gap-2">
              <i className="lni lni-shield text-emerald-600 text-base shrink-0"></i>
              <div>
                Verified on{' '}
                <strong className="font-semibold">
                  {question.verifiedDate ? new Date(question.verifiedDate).toLocaleString() : 'N/A'}
                </strong>
                {question.verifiedBy && (
                  <span className="text-emerald-700 ml-1 font-mono text-[11px]">
                    (Verifier ID: {question.verifiedBy})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-ftr p-3 bg-white border-t border-slate-200 flex justify-between gap-2 shrink-0">
          <div>
            {!isVerified && onEdit && (
              <button
                type="button"
                className="btn btn-neu btn-sm flex items-center gap-1.5"
                onClick={() => {
                  onClose()
                  onEdit(question)
                }}
              >
                <i className="lni lni-pencil text-xs"></i> Edit Question
              </button>
            )}
          </div>
          <button
            type="button"
            className="btn btn-neu btn-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
