'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import { TableSearch, TableSearchResult } from '@/components/TableSearch'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { Pagination } from '@/components/Pagination'
import { FilterTh } from '@/components/FilterTh'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { SuccessPopup } from '@/components/modals/shared/SuccessPopup'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import {
  useUeCourseUnits,
  useUeQuestionSummary,
  useUeQuestions,
  useVerifyUeQuestions,
} from '@/hooks/assessment/useUeQuestions'
import { UeQuestionDto, UeCourseUnitDto } from '@/lib/api/assessment/ueQuestions'
import { UeQuestionModal } from '@/components/modals/assessment/UeQuestionModal'
import { ViewUeQuestionModal } from '@/components/modals/assessment/ViewUeQuestionModal'

export default function QpUploadVettingPage() {
  const permissions = usePagePermissions()

  // ── Mode Tabs ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'faculty' | 'vetting'>('faculty')

  // ── Filters & Scoping ─────────────────────────────────────────────────────
  const [selectedCourseUnitGuid, setSelectedCourseUnitGuid] = useState<string>('')
  const [ueType, setUeType] = useState<number>(0) // 0 = Theory, 1 = Practical
  const [activeLevel, setActiveLevel] = useState<number>(1) // 1 = Sec A, 2 = Sec B, 3 = Sec C

  // ── Table Search & Pagination ─────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  // ── Column Filter Dropdowns ───────────────────────────────────────────────
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [filters, setFilters] = useState<Record<string, string[]>>({})

  const handleFilterSelect = (col: string, vals: string[]) => {
    setFilters(prev => ({ ...prev, [col]: vals }))
    setOpenFilter(null)
  }

  // ── Modals State ──────────────────────────────────────────────────────────
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<UeQuestionDto | null>(null)
  const [viewingQuestion, setViewingQuestion] = useState<UeQuestionDto | null>(null)
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false)
  const [successModal, setSuccessModal] = useState<{ title: string; subtitle: string } | null>(null)

  // ── Toast State ───────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Data Queries ──────────────────────────────────────────────────────────
  const { data: courseUnits = [], isLoading: isCuLoading } = useUeCourseUnits()

  // Auto-select first unit
  useEffect(() => {
    if (courseUnits.length > 0 && !selectedCourseUnitGuid) {
      setSelectedCourseUnitGuid(courseUnits[0].courseUnitGuid)
    }
  }, [courseUnits, selectedCourseUnitGuid])

  const selectedUnit = useMemo(() => {
    return courseUnits.find(cu => cu.courseUnitGuid === selectedCourseUnitGuid)
  }, [courseUnits, selectedCourseUnitGuid])

  const {
    data: summary = { totalCount: 0, sectionACount: 0, sectionBCount: 0, sectionCCount: 0, isVerified: false },
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useUeQuestionSummary(selectedCourseUnitGuid, 5, ueType)

  const {
    data: questions = [],
    isLoading: isQuestionsLoading,
    refetch: refetchQuestions,
  } = useUeQuestions(selectedCourseUnitGuid, 5, activeLevel, ueType)

  const verifyMut = useVerifyUeQuestions()

  // ── Questions Filtering & Pagination ──────────────────────────────────────
  const filteredQuestions = useMemo(() => {
    let list = [...questions]

    // Status column filter
    const statusFilter = filters['status']
    if (statusFilter && statusFilter.length > 0) {
      list = list.filter(item => {
        const itemStatus = item.isVerified ? 'Verified' : 'Draft'
        return statusFilter.includes(itemStatus)
      })
    }

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        item =>
          item.questionText?.toLowerCase().includes(q) ||
          item.answerText?.toLowerCase().includes(q) ||
          item.option1Text?.toLowerCase().includes(q) ||
          item.option2Text?.toLowerCase().includes(q) ||
          item.option3Text?.toLowerCase().includes(q) ||
          item.option4Text?.toLowerCase().includes(q)
      )
    }

    return list
  }, [questions, search, filters])

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / pageSize))
  const paginatedQuestions = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredQuestions.slice(start, start + pageSize)
  }, [filteredQuestions, page])

  const searchResults: TableSearchResult[] = useMemo(() => {
    return filteredQuestions.slice(0, 8).map(q => ({
      id: q.questionGuid,
      primary: q.questionText || '',
      secondary: q.questionType === 1 ? 'MCQ' : 'Descriptive',
    }))
  }, [filteredQuestions])

  useEffect(() => {
    setPage(1)
  }, [activeLevel, search, selectedCourseUnitGuid, ueType, filters])

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleOpenAddModal = () => {
    setEditingQuestion(null)
    setIsAddEditModalOpen(true)
  }

  const handleOpenEditModal = (q: UeQuestionDto) => {
    setEditingQuestion(q)
    setIsAddEditModalOpen(true)
  }

  const handleConfirmVerify = () => {
    if (!selectedCourseUnitGuid) return
    verifyMut.mutate(
      { courseUnitGuid: selectedCourseUnitGuid, category: 5, ueType },
      {
        onSuccess: (count) => {
          setIsVerifyDialogOpen(false)
          setSuccessModal({
            title: 'Question Paper Verified & Locked',
            subtitle: `${count} questions across Sections A, B, and C have been officially verified and locked against edits.`,
          })
          refetchSummary()
          refetchQuestions()
        },
        onError: (err: any) => {
          const msg = err?.message || 'Verification failed. Required permission: assessment.qpvetting.verify'
          showToast(msg, 'error')
        },
      }
    )
  }

  // Options for SearchSelect
  const courseUnitOptions = useMemo(() => {
    return courseUnits.map(cu => ({
      value: cu.courseUnitGuid,
      label: `${cu.courseUnitCode ? cu.courseUnitCode + ' – ' : ''}${cu.courseUnitName || 'Untitled Unit'}`,
    }))
  }, [courseUnits])

  const isLocked = Boolean(summary.isVerified)

  return (
    <div className="page active" id="page-qp-vetting">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Question Paper Vetting</div>
          <div className="pg-sub">Faculty upload · Committee split-pane review · Lock on verify</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isLocked && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenAddModal}
              disabled={!selectedCourseUnitGuid}
            >
              <i className="lni lni-plus"></i> Add Question
            </button>
          )}
          {!isLocked && summary.totalCount > 0 && (
            <button
              type="button"
              className="btn btn-neu"
              onClick={() => setIsVerifyDialogOpen(true)}
              disabled={verifyMut.isPending}
            >
              <i className="lni lni-shield"></i> Verify Paper
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs (Faculty Upload vs Vetting Committee) ────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5 mb-6">
        <button
          type="button"
          className={`btn ${activeTab === 'faculty' ? 'btn-primary' : 'btn-neu'} flex items-center gap-2 text-xs font-semibold`}
          onClick={() => setActiveTab('faculty')}
        >
          <i className="lni lni-upload"></i>
          <span>Faculty Upload</span>
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'vetting' ? 'btn-primary' : 'btn-neu'} flex items-center gap-2 text-xs font-semibold`}
          onClick={() => setActiveTab('vetting')}
        >
          <i className="lni lni-users"></i>
          <span>Vetting Committee</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ml-1 ${
            activeTab === 'vetting' ? 'bg-white/20 text-white' : 'bg-red-50 text-red-600 border border-red-100'
          }`}>
            {courseUnits.length}
          </span>
        </button>
      </div>

      {/* ── Tab 1: Faculty Upload & Question Paper Workspace ───────────────── */}
      {activeTab === 'faculty' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          
          {/* Left Column: Scope Selection & UG Pattern Reminder */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            
            <div className="card p-5">
              <div className="card-title mb-4">
                <span className="ctitle-icon"><i className="lni lni-agenda"></i></span> Selection & Scope
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">
                    Subject / Course Unit <span className="text-red-500">*</span>
                  </label>
                  <SearchSelect
                    options={courseUnitOptions}
                    value={selectedCourseUnitGuid}
                    onChange={setSelectedCourseUnitGuid}
                    placeholder="Select Course Unit"
                    className="w-full"
                    disabled={isCuLoading}
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">
                    Exam Type
                  </label>
                  <div className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-800 flex items-center justify-between">
                    <span>
                      {ueType === 1
                        ? 'University Examination (Practical)'
                        : 'University Examination (Theory)'}
                    </span>
                    <span className="badge badge-blue text-[10.5px] font-semibold">
                      {ueType === 1 ? 'Practical' : 'Theory'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* UG Pattern Reminder Box */}
            <div className="card p-5">
              <div className="card-title mb-2">
                <span className="ctitle-icon"><i className="lni lni-information"></i></span> UG Pattern Reminder
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 text-[12.5px] text-slate-700 leading-relaxed shadow-inner space-y-1">
                <div><strong className="text-slate-800">Sec A:</strong> 10 MCQ (2m each) — prepare 20</div>
                <div><strong className="text-slate-800">Sec B:</strong> Any 4 of 6 (15m each) — prepare 12</div>
                <div><strong className="text-slate-800">Sec C:</strong> Any 1 of 2 (20m each) — prepare 4</div>
                <div className="text-slate-500 pt-1 border-t border-slate-200 mt-1">Total: 100 marks (prorated to weightage)</div>
              </div>
            </div>

            {/* Locked State Warning Banner */}
            {isLocked ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3.5 flex gap-3 text-[12.5px] text-emerald-900 items-start shadow-sm">
                <div className="mt-0.5 text-emerald-600"><i className="lni lni-lock text-[16px]"></i></div>
                <div>
                  <strong className="font-semibold text-emerald-950">
                    {selectedUnit?.courseUnitCode || 'Course Unit'} is locked.
                  </strong>{' '}
                  Question paper was officially verified by the committee. Editing and additions are disabled.
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3.5 flex gap-3 text-[12.5px] text-amber-900 items-start shadow-sm">
                <div className="mt-0.5 text-amber-600"><i className="lni lni-timer text-[16px]"></i></div>
                <div>
                  <strong className="font-semibold text-amber-950">Draft Mode:</strong> Add questions to Sections A, B, and C below. Once prepared, the Vetting Committee will verify and sign off.
                </div>
              </div>
            )}

          </div>

          {/* Right Column: Section Tabs, Summary Bar & Questions Table */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="card p-3 text-center">
                <div className="text-[11px] font-bold text-slate-500 uppercase">Total Qs</div>
                <div className="text-[20px] font-extrabold text-slate-900 mt-0.5">
                  {isSummaryLoading ? '—' : summary.totalCount}
                </div>
              </div>
              <div className="card p-3 text-center cursor-pointer hover:border-purple-300" onClick={() => setActiveLevel(1)}>
                <div className="text-[11px] font-bold text-purple-700 uppercase">Sec A (MCQ)</div>
                <div className="text-[20px] font-extrabold text-purple-900 mt-0.5">
                  {isSummaryLoading ? '—' : summary.sectionACount}
                </div>
              </div>
              <div className="card p-3 text-center cursor-pointer hover:border-blue-300" onClick={() => setActiveLevel(2)}>
                <div className="text-[11px] font-bold text-blue-700 uppercase">Sec B (15m)</div>
                <div className="text-[20px] font-extrabold text-blue-900 mt-0.5">
                  {isSummaryLoading ? '—' : summary.sectionBCount}
                </div>
              </div>
              <div className="card p-3 text-center cursor-pointer hover:border-indigo-300" onClick={() => setActiveLevel(3)}>
                <div className="text-[11px] font-bold text-indigo-700 uppercase">Sec C (20m)</div>
                <div className="text-[20px] font-extrabold text-indigo-900 mt-0.5">
                  {isSummaryLoading ? '—' : summary.sectionCCount}
                </div>
              </div>
            </div>

            {/* Questions Table Card */}
            <div className="card">
              
              {/* Card Header with Section Pills & Search */}
              <div className="card-hdr flex-wrap gap-3">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveLevel(1)}
                    className={`btn btn-sm ${
                      activeLevel === 1 ? 'btn-primary' : 'btn-neu'
                    } text-xs font-semibold`}
                  >
                    Section A ({summary.sectionACount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveLevel(2)}
                    className={`btn btn-sm ${
                      activeLevel === 2 ? 'btn-primary' : 'btn-neu'
                    } text-xs font-semibold`}
                  >
                    Section B ({summary.sectionBCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveLevel(3)}
                    className={`btn btn-sm ${
                      activeLevel === 3 ? 'btn-primary' : 'btn-neu'
                    } text-xs font-semibold`}
                  >
                    Section C ({summary.sectionCCount})
                  </button>
                </div>

                <TableSearch
                  className="w-56"
                  placeholder="Search questions..."
                  value={search}
                  onChange={setSearch}
                  results={searchResults}
                  onSelect={(r) => setSearch(r.primary)}
                />
              </div>

              {/* Scrollable Table */}
              <ScrollTable>
                <table style={{ fontSize: '11.5px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}></th>
                      <th style={{ width: 85 }}>TYPE</th>
                      <th>QUESTION STATEMENT</th>
                      <th>ANSWER KEY</th>
                      <FilterTh
                        label="STATUS"
                        opts={['Verified', 'Draft']}
                        isOpen={openFilter === 'status'}
                        activeFilter={filters['status'] || []}
                        onToggle={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'status' ? null : 'status') }}
                        onSelect={(vals) => handleFilterSelect('status', vals)}
                        onClear={() => handleFilterSelect('status', [])}
                        onClose={() => setOpenFilter(null)}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {isQuestionsLoading ? (
                      <TableLoadingState colSpan={5} title="Loading section questions…" />
                    ) : paginatedQuestions.length === 0 ? (
                      <EmptyState
                        colSpan={5}
                        title="No questions found in this section"
                        subtitle={isLocked ? 'Verified questions may be hidden for regular lecturers.' : 'Click "+ Add Question" above to prepare questions.'}
                        hasFilters={Boolean(search || filters['status']?.length)}
                        onClearFilters={() => { setSearch(''); setFilters({}); }}
                      />
                    ) : (
                      paginatedQuestions.map((q) => {
                        const isMcq = q.questionType === 1
                        return (
                          <tr key={q.questionGuid} className="hover:bg-slate-50/60">
                            <td>
                              <ActionMenu>
                                <button
                                  className="btn btn-neu btn-sm"
                                  onClick={() => setViewingQuestion(q)}
                                >
                                  <i className="lni lni-search-alt" /> View Details
                                </button>
                                {!isLocked && !q.isVerified && (
                                  <button
                                    className="btn btn-neu btn-sm"
                                    onClick={() => handleOpenEditModal(q)}
                                  >
                                    <i className="lni lni-pencil" /> Edit Question
                                  </button>
                                )}
                              </ActionMenu>
                            </td>
                            <td>
                              {isMcq ? (
                                <span className="badge badge-purple text-[10px]">MCQ</span>
                              ) : (
                                <span className="badge bg-slate-100 text-slate-700 text-[10px] border border-slate-200">
                                  Descriptive
                                </span>
                              )}
                            </td>
                            <td>
                              <div className="font-medium text-slate-900 line-clamp-2 pr-2">
                                {q.questionText}
                              </div>
                            </td>
                            <td>
                              <div className="text-slate-600 line-clamp-1 max-w-xs">
                                {isMcq ? (
                                  <span className="font-semibold text-emerald-800">
                                    ✓ {q.answerText}
                                  </span>
                                ) : (
                                  <span className="italic text-slate-500">
                                    {q.answerText ? q.answerText.slice(0, 40) + '...' : '—'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              {q.isVerified ? (
                                <span className="badge badge-green">✓ Verified</span>
                              ) : (
                                <span className="badge badge-amber">Draft</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </ScrollTable>

              {/* Pagination */}
              {filteredQuestions.length > pageSize && (
                <div className="p-3 border-t border-slate-100">
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    totalCount={filteredQuestions.length}
                    onPageChange={setPage}
                  />
                </div>
              )}

            </div>

          </div>

        </div>
      )}

      {/* ── Tab 2: Vetting Committee Queue ─────────────────────────────────── */}
      {activeTab === 'vetting' && (
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">
              <span className="ctitle-icon"><i className="lni lni-users"></i></span> Vetting Queue
              <span className="card-badge">{courseUnits.length}</span>
            </div>
            <TableSearch
              className="w-64"
              placeholder="Search course units..."
              value={search}
              onChange={setSearch}
              results={courseUnits.map(cu => ({ id: cu.courseUnitGuid, primary: cu.courseUnitName || '', secondary: cu.courseUnitCode || '' }))}
              onSelect={(r) => setSearch(r.primary)}
            />
          </div>

          <ScrollTable>
            <table style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th style={{ width: 140 }}>SUBJECT CODE</th>
                  <th>COURSE UNIT NAME</th>
                  <th style={{ width: 140 }}>INTAKE</th>
                  <th style={{ width: 160 }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {isCuLoading ? (
                  <TableLoadingState colSpan={5} title="Loading vetting queue…" />
                ) : courseUnits.length === 0 ? (
                  <EmptyState colSpan={5} title="No course units found in queue" />
                ) : (
                  courseUnits.map((cu) => (
                    <VettingQueueRow
                      key={cu.courseUnitGuid}
                      cu={cu}
                      onOpenReview={(guid) => {
                        setSelectedCourseUnitGuid(guid)
                        setActiveTab('faculty')
                      }}
                    />
                  ))
                )}
              </tbody>
            </table>
          </ScrollTable>

          {courseUnits.length > pageSize && (
            <div className="p-3 border-t border-slate-100">
              <Pagination
                page={page}
                totalPages={Math.ceil(courseUnits.length / pageSize)}
                totalCount={courseUnits.length}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Add / Edit Question Modal ────────────────────────────────────────── */}
      <UeQuestionModal
        isOpen={isAddEditModalOpen}
        onClose={() => setIsAddEditModalOpen(false)}
        courseUnitGuid={selectedCourseUnitGuid}
        courseUnitCode={selectedUnit?.courseUnitCode ?? undefined}
        courseUnitName={selectedUnit?.courseUnitName ?? undefined}
        ueType={ueType}
        defaultLevel={activeLevel}
        question={editingQuestion}
        onSuccess={() => {
          refetchSummary()
          refetchQuestions()
        }}
        showToast={showToast}
      />

      {/* ── View Question Modal ──────────────────────────────────────────────── */}
      <ViewUeQuestionModal
        isOpen={Boolean(viewingQuestion)}
        onClose={() => setViewingQuestion(null)}
        question={viewingQuestion}
        courseUnitCode={selectedUnit?.courseUnitCode ?? undefined}
        courseUnitName={selectedUnit?.courseUnitName ?? undefined}
        onEdit={(q) => handleOpenEditModal(q)}
      />

      {/* ── Confirm Verification Dialog ──────────────────────────────────────── */}
      {isVerifyDialogOpen && (
        <div className="modal-overlay open" style={{ zIndex: 650 }}>
          <div className="modal modal-md flex flex-col" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-hdr modal-hdr-blue shrink-0">
              <div className="modal-title flex items-center gap-2">
                <i className="lni lni-shield"></i>
                <span>Confirm Paper Verification</span>
              </div>
              <button type="button" className="modal-close" onClick={() => setIsVerifyDialogOpen(false)}>
                <i className="lni lni-close"></i>
              </button>
            </div>

            <div className="modal-body p-5 flex flex-col gap-4 bg-slate-50">
              <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs leading-relaxed text-slate-700">
                You are officially signing off and locking the Question Paper for:
                <div className="font-bold text-slate-900 mt-1 text-sm">
                  {selectedUnit?.courseUnitCode} — {selectedUnit?.courseUnitName}
                </div>
                <div className="text-purple-700 font-semibold mt-0.5">
                  Mode: {ueType === 0 ? 'Theory (UE 0)' : 'Practical (UE 1)'}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-1.5 text-slate-700">
                <div className="flex justify-between">
                  <span>Section A (Level 1 — MCQs):</span>
                  <strong>{summary.sectionACount} questions</strong>
                </div>
                <div className="flex justify-between">
                  <span>Section B (Level 2 — 15m):</span>
                  <strong>{summary.sectionBCount} questions</strong>
                </div>
                <div className="flex justify-between">
                  <span>Section C (Level 3 — 20m):</span>
                  <strong>{summary.sectionCCount} questions</strong>
                </div>
                <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-slate-900">
                  <span>Total Questions to Verify:</span>
                  <span className="text-emerald-700 font-bold">{summary.totalCount}</span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 text-xs flex items-start gap-2">
                <i className="lni lni-warning text-amber-600 text-base shrink-0 mt-0.5"></i>
                <span>
                  <strong>Caution:</strong> Verifying signs off all sections at once. Once verified, this Question Paper is permanently locked and questions cannot be modified.
                </span>
              </div>
            </div>

            <div className="modal-ftr p-3 bg-white border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                className="btn btn-neu btn-sm"
                onClick={() => setIsVerifyDialogOpen(false)}
                disabled={verifyMut.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm flex items-center gap-1.5"
                onClick={handleConfirmVerify}
                disabled={verifyMut.isPending}
              >
                {verifyMut.isPending && <i className="lni lni-reload animate-spin text-xs"></i>}
                <span>Confirm & Sign-Off</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success Popup Modal ──────────────────────────────────────────────── */}
      {successModal && (
        <div className="modal-overlay open" style={{ zIndex: 700 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <SuccessPopup
              title={successModal.title}
              subtitle={successModal.subtitle}
              onClose={() => setSuccessModal(null)}
            />
          </div>
        </div>
      )}

      {/* ── Toast Notification ───────────────────────────────────────────────── */}
      <Toast toast={toast} />
    </div>
  )
}

// ── Vetting Queue Row Component with Dynamic Action Button ───────────────────

function VettingQueueRow({
  cu,
  onOpenReview,
}: {
  cu: UeCourseUnitDto
  onOpenReview: (guid: string) => void
}) {
  const { data: summary, isLoading } = useUeQuestionSummary(cu.courseUnitGuid, 5, 0)
  const totalCount = summary?.totalCount ?? 0
  const isVerified = Boolean(summary?.isVerified)
  const hasQuestions = totalCount > 0

  return (
    <tr className="hover:bg-slate-50">
      <td>
        <ActionMenu>
          <button
            className="btn btn-neu btn-sm"
            disabled={!hasQuestions || isVerified}
            onClick={() => onOpenReview(cu.courseUnitGuid)}
          >
            <i className="lni lni-search-alt" />{' '}
            {!hasQuestions ? 'No Questions' : isVerified ? 'Verified' : 'Open for Review'}
          </button>
        </ActionMenu>
      </td>
      <td>
        <span className="font-mono font-bold text-blue-700 text-[12px]">
          {cu.courseUnitCode || '—'}
        </span>
      </td>
      <td className="font-semibold text-slate-800">
        {cu.courseUnitName || 'Untitled Unit'}
      </td>
      <td>
        <span className="badge bg-slate-100 text-slate-600 text-[10.5px]">
          Active Intake
        </span>
      </td>
      <td>
        {isLoading ? (
          <button
            type="button"
            disabled
            className="btn btn-neu btn-sm opacity-60 cursor-not-allowed flex items-center gap-1.5 text-xs"
          >
            <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            <span>Checking…</span>
          </button>
        ) : !hasQuestions ? (
          <button
            type="button"
            disabled
            title="No questions added for this course unit yet"
            className="btn btn-neu btn-sm opacity-50 cursor-not-allowed flex items-center gap-1.5 text-xs text-slate-400"
          >
            <i className="lni lni-ban" />
            <span>No Questions</span>
          </button>
        ) : isVerified ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-600 text-white shadow-sm shrink-0">
            <i className="lni lni-checkmark-circle text-xs" /> Verified
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onOpenReview(cu.courseUnitGuid)}
            title={`Review ${totalCount} uploaded questions`}
            className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm text-xs"
          >
            <i className="lni lni-pencil-alt" />
            <span>Open for Review ({totalCount})</span>
          </button>
        )}
      </td>
    </tr>
  )
}

