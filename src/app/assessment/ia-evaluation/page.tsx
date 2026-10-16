'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import { Toast } from '@/components/Toast'
import { DocumentPreviewModal } from '@/components/modals/shared/DocumentPreviewModal'
import { TableLoadingState } from '@/components/TableLoadingState'
import { EmptyState } from '@/components/EmptyState'
import { useIntakes } from '@/hooks/academic/useIntakes'
import {
  usePendingEvaluations,
  useStudentsForEvaluation,
  useStudentQuestions,
  useSaveQuestionMark,
  useFinalizeStudent,
  useEvaluatedList,
} from '@/hooks/assessment/useIaEvaluation'
import {
  PendingEvaluationDto,
  StudentForEvaluationDto,
  QuestionForEvaluationDto,
} from '@/lib/api/assessment/iaEvaluation'

const EMPTY_ARRAY: any[] = []

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: '2', label: 'Course Work 1 (CW1)' },
  { value: '3', label: 'Course Work 2 (CW2)' },
  { value: '1', label: 'Test' },
]

type NavigationStep = 'dashboard' | 'roster' | 'detail'
type RosterStatusTab = 'All' | 'Pending' | 'Evaluated'

export default function IaEvaluationPage() {
  // ── Navigation Flow: Step 1 (Dashboard) -> Step 2 (Roster) -> Step 3 (Detail) ──
  const [currentStep, setCurrentStep] = useState<NavigationStep>('dashboard')

  // Selected coursework/test row for Roster and Detail
  const [selectedCoursework, setSelectedCoursework] = useState<PendingEvaluationDto | null>(null)

  // Selected student for Detail view
  const [selectedStudent, setSelectedStudent] = useState<StudentForEvaluationDto | null>(null)

  // Dashboard tab: 'pending' ("To Do") vs 'evaluated' ("Done")
  const [dashboardTab, setDashboardTab] = useState<'pending' | 'evaluated'>('pending')

  // Roster status filter tab: 'All' | 'Pending' | 'Evaluated'
  const [rosterStatusTab, setRosterStatusTab] = useState<RosterStatusTab>('All')

  // ── 1. Academic Intake Selection ──────────────────────────────────────────
  const { data: intakesData, isLoading: isIntakesLoading } = useIntakes()
  const [selectedIntakeGuid, setSelectedIntakeGuid] = useState<string>('')

  // Automatically select current intake or first available
  useEffect(() => {
    if (intakesData && intakesData.length > 0 && !selectedIntakeGuid) {
      const current = intakesData.find(i => i.currentIntake) || intakesData[0]
      if (current) setSelectedIntakeGuid(current.intakeGuid)
    }
  }, [intakesData, selectedIntakeGuid])

  const intakeOptions = useMemo(() => {
    if (!intakesData || !intakesData.length) return []
    return intakesData.map(i => ({
      value: i.intakeGuid,
      label: `${i.description || `Intake ${i.intakeCode}`}${i.currentIntake ? ' (Current)' : ''}`,
    }))
  }, [intakesData])

  // ── 2. Dashboard Data Hooks ───────────────────────────────────────────────
  const {
    data: pendingUnitsData,
    isLoading: isPendingLoading,
    isFetching: isPendingFetching,
    error: pendingError,
    refetch: refetchPending,
  } = usePendingEvaluations(selectedIntakeGuid, Boolean(selectedIntakeGuid))
  const pendingUnits = pendingUnitsData ?? EMPTY_ARRAY

  const {
    data: evaluatedUnitsData,
    isLoading: isEvaluatedLoading,
    isFetching: isEvaluatedFetching,
    error: evaluatedError,
    refetch: refetchEvaluated,
  } = useEvaluatedList(selectedIntakeGuid, Boolean(selectedIntakeGuid))
  const evaluatedUnits = evaluatedUnitsData ?? EMPTY_ARRAY

  // Assessment Category Filter (Dashboard)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [dashboardSearch, setDashboardSearch] = useState<string>('')

  // Filter pending coursework rows
  const filteredPendingUnits = useMemo(() => {
    let list = pendingUnits.filter(u => {
      const name = u.unitName?.trim()
      return Boolean(name && name.toLowerCase() !== 'null' && name !== 'undefined')
    })
    if (selectedCategory) {
      const catNum = Number(selectedCategory)
      list = list.filter(u => u.category === catNum)
    }
    if (dashboardSearch.trim()) {
      const q = dashboardSearch.toLowerCase()
      list = list.filter(
        u =>
          (u.unitCode && u.unitCode.toLowerCase().includes(q)) ||
          (u.unitName && u.unitName.toLowerCase().includes(q)) ||
          (u.categoryLabel && u.categoryLabel.toLowerCase().includes(q))
      )
    }
    return list
  }, [pendingUnits, selectedCategory, dashboardSearch])

  // Filter evaluated coursework rows
  const filteredEvaluatedUnits = useMemo(() => {
    let list = evaluatedUnits.filter(u => {
      const name = u.unitName?.trim()
      return Boolean(name && name.toLowerCase() !== 'null' && name !== 'undefined')
    })
    if (selectedCategory) {
      const catNum = Number(selectedCategory)
      list = list.filter(u => u.category === catNum)
    }
    if (dashboardSearch.trim()) {
      const q = dashboardSearch.toLowerCase()
      list = list.filter(
        u =>
          (u.unitCode && u.unitCode.toLowerCase().includes(q)) ||
          (u.unitName && u.unitName.toLowerCase().includes(q)) ||
          (u.categoryLabel && u.categoryLabel.toLowerCase().includes(q))
      )
    }
    return list
  }, [evaluatedUnits, selectedCategory, dashboardSearch])

  // ── 3. Step 2: Student Roster API Hook ────────────────────────────────────
  // Always query all students so overall roster counts (Total, Pending, Evaluated) remain accurate
  const {
    data: studentsResponse,
    isLoading: isStudentsLoading,
    isFetching: isStudentsFetching,
    error: studentsError,
    refetch: refetchStudents,
  } = useStudentsForEvaluation(
    selectedCoursework?.category,
    selectedCoursework?.courseworkOrTestGuid,
    undefined,
    Boolean(selectedCoursework && currentStep !== 'dashboard')
  )

  const allStudents = studentsResponse?.students ?? EMPTY_ARRAY

  // Computed counts for roster status tabs (derived from full roster)
  const rosterCounts = useMemo(() => {
    let pending = 0
    let evaluated = 0
    allStudents.forEach(s => {
      if (s.evaluationStatus === 'Evaluated') evaluated++
      else pending++
    })
    return {
      total: allStudents.length,
      pending,
      evaluated,
    }
  }, [allStudents])

  // Search filter & Status tab filter for students on Roster
  const [studentSearch, setStudentSearch] = useState<string>('')
  const displayedStudents = useMemo(() => {
    let list = allStudents
    if (rosterStatusTab === 'Pending') {
      list = list.filter(s => s.evaluationStatus === 'Pending')
    } else if (rosterStatusTab === 'Evaluated') {
      list = list.filter(s => s.evaluationStatus === 'Evaluated')
    }
    if (!studentSearch.trim()) return list
    const q = studentSearch.toLowerCase()
    return list.filter(
      s =>
        (s.studentName && s.studentName.toLowerCase().includes(q)) ||
        (s.studentRegNo && s.studentRegNo.toLowerCase().includes(q))
    )
  }, [allStudents, rosterStatusTab, studentSearch])

  // ── 4. Step 3: Student Questions API Hook ─────────────────────────────────
  const {
    data: questionsData,
    isLoading: isQuestionsLoading,
    isFetching: isQuestionsFetching,
    error: questionsError,
    refetch: refetchQuestions,
  } = useStudentQuestions(
    selectedCoursework?.category,
    selectedCoursework?.courseworkOrTestGuid,
    selectedStudent?.studentGuid,
    Boolean(selectedCoursework && selectedStudent && currentStep === 'detail')
  )

  // Local state copy of questions for optimistic score updates
  const [localQuestions, setLocalQuestions] = useState<QuestionForEvaluationDto[]>([])

  useEffect(() => {
    if (questionsData && Array.isArray(questionsData) && questionsData.length > 0) {
      setLocalQuestions(questionsData)
    } else if (!isQuestionsLoading && (!questionsData || questionsData.length === 0)) {
      setLocalQuestions(prev => (prev.length === 0 ? prev : EMPTY_ARRAY))
    }
  }, [questionsData, isQuestionsLoading])

  // Active question index in detail view
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0)
  const currentQuestion = useMemo<QuestionForEvaluationDto | null>(() => {
    if (!localQuestions.length) return null
    return localQuestions[activeQuestionIndex] || localQuestions[0]
  }, [localQuestions, activeQuestionIndex])

  // Form inputs for scoring
  const [markInput, setMarkInput] = useState<string>('')
  const [finalizeComment, setFinalizeComment] = useState<string>('')
  const [isScorecardOpen, setIsScorecardOpen] = useState<boolean>(false)
  const [isQuestionExpanded, setIsQuestionExpanded] = useState<boolean>(false)
  // Student's attached answer file, previewed inline (DocumentPreviewModal).
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null)

  // Sync mark input whenever current question changes
  useEffect(() => {
    if (currentQuestion) {
      const val =
        currentQuestion.mark !== null && currentQuestion.mark !== undefined
          ? String(currentQuestion.mark)
          : ''
      setMarkInput(prev => (prev === val ? prev : val))
    } else {
      setMarkInput('')
    }
  }, [currentQuestion?.questionGuid, currentQuestion?.mark, activeQuestionIndex])

  // ── Toast Alerts ──────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Surface load failures — the API layer no longer falls back to mock data
  const loadError = pendingError || evaluatedError || studentsError || questionsError
  useEffect(() => {
    if (loadError) showToast((loadError as Error).message || 'Failed to load evaluation data.', 'error')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadError])

  // ── Refresh Handler ───────────────────────────────────────────────────────
  const [isManualRefreshing, setIsManualRefreshing] = useState(false)
  const isRefreshing =
    isManualRefreshing ||
    isPendingFetching ||
    isEvaluatedFetching ||
    isStudentsFetching ||
    isQuestionsFetching

  const handleRefresh = async () => {
    setIsManualRefreshing(true)
    try {
      const results =
        currentStep === 'dashboard' ? await Promise.all([refetchPending(), refetchEvaluated()])
        : currentStep === 'roster' ? [await refetchStudents()]
        : currentStep === 'detail' ? [await refetchQuestions()]
        : []
      if (results.some(r => r.isError)) {
        showToast('Failed to refresh data.', 'error')
        return
      }
      showToast('Evaluation data refreshed from server!', 'success')
    } catch {
      showToast('Failed to refresh data.', 'error')
    } finally {
      setIsManualRefreshing(false)
    }
  }

  // ── Mutations: Save Mark & Finalize Student ────────────────────────────────
  const saveMarkMutation = useSaveQuestionMark()
  const finalizeStudentMutation = useFinalizeStudent()

  // Save mark for current question
  const handleSaveMark = async (questionToSave?: QuestionForEvaluationDto, markValue?: string) => {
    const q = questionToSave || currentQuestion
    const val = markValue !== undefined ? markValue : markInput

    if (!selectedCoursework || !selectedStudent || !q) return

    if (!q.questionGuid) {
      showToast('Question ID is missing. Please refresh questions.', 'error')
      return
    }

    if (val.trim() === '' || isNaN(Number(val))) {
      showToast('Please enter a valid numeric mark.', 'error')
      return
    }

    const numMark = Number(val)
    if (numMark < 0) {
      showToast('Mark cannot be negative.', 'error')
      return
    }

    const maxAllowed = q.maxMark ?? 100
    if (numMark > maxAllowed) {
      showToast(`Mark cannot exceed maximum marks (${maxAllowed}).`, 'error')
      return
    }

    try {
      await saveMarkMutation.mutateAsync({
        category: selectedCoursework.category,
        courseworkOrTestGuid: selectedCoursework.courseworkOrTestGuid,
        studentGuid: selectedStudent.studentGuid,
        questionGuid: q.questionGuid,
        mark: numMark,
      })

      // Update local question mark
      setLocalQuestions(prev =>
        prev.map(item => (item.questionGuid === q.questionGuid ? { ...item, mark: numMark } : item))
      )

      showToast(`Mark (${numMark}) saved for Question ${activeQuestionIndex + 1}!`, 'success')

      // Auto advance to next question if using bottom button
      if (!questionToSave && activeQuestionIndex < localQuestions.length - 1) {
        setActiveQuestionIndex(prev => prev + 1)
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to save question mark.', 'error')
    }
  }

  // Finalize student evaluation
  const handleFinalize = async () => {
    if (!selectedCoursework || !selectedStudent) return

    // Auto-save mark on current question if entered but not saved yet
    const trimmedMark = markInput.trim()
    if (currentQuestion && currentQuestion.questionGuid && trimmedMark !== '') {
      const numMark = Number(trimmedMark)
      if (!isNaN(numMark) && numMark >= 0 && numMark <= (currentQuestion.maxMark ?? 100)) {
        if (currentQuestion.mark !== numMark) {
          try {
            await saveMarkMutation.mutateAsync({
              category: selectedCoursework.category,
              courseworkOrTestGuid: selectedCoursework.courseworkOrTestGuid,
              studentGuid: selectedStudent.studentGuid,
              questionGuid: currentQuestion.questionGuid,
              mark: numMark,
            })
            setLocalQuestions(prev =>
              prev.map(item =>
                item.questionGuid === currentQuestion.questionGuid ? { ...item, mark: numMark } : item
              )
            )
          } catch (err) {
            console.warn('Could not auto-save mark before finalization:', err)
          }
        }
      }
    }

    const markedCount = localQuestions.filter(q => q.mark !== null && q.mark !== undefined).length
    const minRequired = selectedStudent.minQuestion || localQuestions.length

    if (markedCount < minRequired) {
      showToast(
        `At least ${minRequired} question(s) must be marked before finalizing. Currently marked: ${markedCount}.`,
        'error'
      )
      return
    }

    try {
      const res = await finalizeStudentMutation.mutateAsync({
        category: selectedCoursework.category,
        courseworkOrTestGuid: selectedCoursework.courseworkOrTestGuid,
        studentGuid: selectedStudent.studentGuid,
        comment: finalizeComment.trim() || undefined,
      })

      showToast(
        `Finalized ${selectedStudent.studentName || 'student'}! Total: ${res.totalMark} / ${res.totalMaxMark} marks.`,
        'success'
      )

      setFinalizeComment('')

      // Refetch all queries to update dashboard and roster counts
      refetchStudents()
      refetchPending()
      refetchEvaluated()

      // Auto-advance via nextStudentGuid if returned by server
      if (res.nextStudentGuid) {
        const nextStd = allStudents.find(s => s.studentGuid === res.nextStudentGuid)
        if (nextStd) {
          setSelectedStudent(nextStd)
          setActiveQuestionIndex(0)
        } else {
          // If not in current list, create minimal DTO and load
          setSelectedStudent({
            studentGuid: res.nextStudentGuid,
            studentName: 'Next Student',
            studentRegNo: null,
            minQuestion: selectedStudent.minQuestion,
            evaluationStatus: 'Pending',
            mark: null,
            maxMark: null,
            comment: null,
            evaluatedDate: null,
          })
          setActiveQuestionIndex(0)
        }
      } else {
        // No remaining pending students: return to roster
        showToast('Student evaluation finalized successfully!', 'success')
        setCurrentStep('roster')
        setSelectedStudent(null)
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to finalize student evaluation.', 'error')
    }
  }

  // Running scorecard stats
  const scorecardStats = useMemo(() => {
    let markedCount = 0
    let totalScore = 0
    let totalMax = 0

    localQuestions.forEach(q => {
      totalMax += q.maxMark ?? 0
      if (q.mark !== null && q.mark !== undefined) {
        markedCount++
        totalScore += q.mark
      }
    })

    return { markedCount, totalScore, totalMax }
  }, [localQuestions])

  // Navigation handlers
  const handleOpenCourseworkRoster = (cw: PendingEvaluationDto) => {
    setSelectedCoursework(cw)
    setRosterStatusTab('All')
    setStudentSearch('')
    setCurrentStep('roster')
  }

  const handleOpenStudentDetail = (std: StudentForEvaluationDto) => {
    setSelectedStudent(std)
    setActiveQuestionIndex(0)
    setFinalizeComment(std.comment || '')
    setIsScorecardOpen(false)
    setCurrentStep('detail')
  }

  const handleBackToDashboard = () => {
    setCurrentStep('dashboard')
    setSelectedCoursework(null)
    setSelectedStudent(null)
  }

  const handleBackToRoster = () => {
    setCurrentStep('roster')
    setSelectedStudent(null)
  }

  // Format ISO date
  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return '—'
    try {
      const d = new Date(isoStr)
      if (isNaN(d.getTime())) return isoStr
      return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoStr
    }
  }

  // Initials for avatar
  const getInitials = (name?: string | null) => {
    if (!name) return 'ST'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <div className="page active" id="page-ia-evaluation">
      {/* ── Breadcrumbs & Navigation Header ─────────────────────────────────── */}
      <div className="pg-hdr flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1 flex-wrap">
            <span
              onClick={handleBackToDashboard}
              className={`hover:text-blue-600 transition-colors ${
                currentStep !== 'dashboard' ? 'cursor-pointer font-medium' : 'font-bold text-slate-700'
              }`}
            >
              IA Evaluation
            </span>

            {selectedCoursework && (
              <>
                <i className="lni lni-chevron-right text-[10px] text-slate-400"></i>
                <span
                  onClick={handleBackToRoster}
                  className={`hover:text-blue-600 transition-colors ${
                    currentStep === 'detail' ? 'cursor-pointer font-medium' : 'font-bold text-slate-700'
                  }`}
                  title={selectedCoursework.unitName || ''}
                >
                  {selectedCoursework.unitCode || 'Unit'} ({selectedCoursework.categoryLabel})
                </span>
              </>
            )}

            {selectedStudent && (
              <>
                <i className="lni lni-chevron-right text-[10px] text-slate-400"></i>
                <span className="font-bold text-slate-800 truncate max-w-xs">
                  {selectedStudent.studentName || 'Student Detail'}
                </span>
              </>
            )}
          </div>

          {/* Title */}
          <div className="pg-title flex items-center gap-2 flex-wrap">
            <span>
              {currentStep === 'dashboard'
                ? 'Internal Assessment Evaluation'
                : currentStep === 'roster'
                ? `Student Roster — ${selectedCoursework?.unitName || selectedCoursework?.unitCode}`
                : `Evaluation Detail — ${selectedStudent?.studentName}`}
            </span>
            {currentStep === 'dashboard' && (
              <span className="badge badge-purple text-[11px] font-semibold">
                Coursework &amp; Test Workflow
              </span>
            )}
            {currentStep === 'roster' && selectedCoursework && (
              <span className="badge badge-blue text-[11px] font-semibold">
                {selectedCoursework.categoryLabel}
              </span>
            )}
            {currentStep === 'detail' && selectedStudent && (
              <span
                className={`badge text-[11px] font-semibold ${
                  selectedStudent.evaluationStatus === 'Evaluated' ? 'badge-emerald' : 'badge-amber'
                }`}
              >
                {selectedStudent.evaluationStatus}
              </span>
            )}
          </div>
          <div className="pg-sub text-xs text-slate-500">
            {currentStep === 'dashboard'
              ? 'Select an academic intake, pick a coursework/test row, and proceed to evaluate student submissions.'
              : currentStep === 'roster'
              ? 'Filter students by status (All / Pending / Evaluated) and click a student to view or score questions.'
              : selectedStudent?.evaluationStatus === 'Evaluated'
              ? 'Read-only evaluation review showing finalized marks and teacher remarks.'
              : 'Review submitted questions, grade marks per question, and finalize student total.'}
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {currentStep === 'roster' && (
            <button
              type="button"
              onClick={handleBackToDashboard}
              className="btn btn-neu btn-sm flex items-center gap-1.5 text-xs font-semibold"
            >
              <i className="lni lni-arrow-left"></i>
              <span>Back to Coursework List</span>
            </button>
          )}

          {currentStep === 'detail' && (
            <button
              type="button"
              onClick={handleBackToRoster}
              className="btn btn-neu btn-sm flex items-center gap-1.5 text-xs font-semibold"
            >
              <i className="lni lni-arrow-left"></i>
              <span>Back to Student Roster</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="btn btn-neu btn-sm flex items-center gap-1.5 text-xs font-semibold"
            title="Refresh current data from live server"
          >
            <i className={`lni lni-reload ${isRefreshing ? 'animate-spin text-blue-600' : ''}`}></i>
            <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          STEP 1: LANDING DASHBOARD (To Do / Done Tabs)
         ═══════════════════════════════════════════════════════════════════════ */}
      {currentStep === 'dashboard' && (
        <div className="space-y-4">
          {/* Top Scope Filters Card */}
          <div className="card p-4 shadow-sm border border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
              {/* 1. Academic Intake */}
              <div className="lg:col-span-4 sm:col-span-6 col-span-12 flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Academic Intake <span className="text-red-500">*</span>
                </label>
                <SearchSelect
                  options={intakeOptions}
                  value={selectedIntakeGuid}
                  onChange={setSelectedIntakeGuid}
                  placeholder={isIntakesLoading ? 'Loading intakes...' : 'Select intake'}
                  className="w-full text-xs"
                />
              </div>

              {/* 2. Assessment Category Filter */}
              <div className="lg:col-span-3 sm:col-span-6 col-span-12 flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Category Filter
                </label>
                <SearchSelect
                  options={CATEGORY_OPTIONS}
                  value={selectedCategory}
                  onChange={setSelectedCategory}
                  placeholder="All Categories"
                  className="w-full text-xs"
                />
              </div>

              {/* 3. Search input */}
              <div className="lg:col-span-5 col-span-12 flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Search Unit / Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by course unit code or name..."
                    value={dashboardSearch}
                    onChange={e => setDashboardSearch(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <i className="lni lni-search-alt absolute left-2.5 top-2.5 text-slate-400 text-xs"></i>
                </div>
              </div>
            </div>
          </div>

          {/* Dashboard Tabs: "To Do" (Pending) vs "Done" (Evaluated) */}
          <div className="card p-0 shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 pt-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDashboardTab('pending')}
                  className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                    dashboardTab === 'pending'
                      ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-2xs'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="lni lni-hourglass"></i>
                  <span>To Do (Pending Evaluation)</span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      dashboardTab === 'pending'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {filteredPendingUnits.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDashboardTab('evaluated')}
                  className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                    dashboardTab === 'evaluated'
                      ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-2xs'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="lni lni-checkmark-circle"></i>
                  <span>Done (Fully Evaluated)</span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      dashboardTab === 'evaluated'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {filteredEvaluatedUnits.length}
                  </span>
                </button>
              </div>

              <div className="pb-3 text-xs text-slate-500 font-medium hidden sm:block">
                Click any row or &quot;Open Roster&quot; to inspect student submissions
              </div>
            </div>

            {/* Coursework Cards */}
            <div className="p-5 bg-slate-50/50">
              {dashboardTab === 'pending' ? (
                isPendingLoading || isPendingFetching ? (
                  <TableLoadingState
                    colSpan={1}
                    title="Loading pending coursework units…"
                    subtitle="Fetching pending evaluation tasks from server..."
                  />
                ) : filteredPendingUnits.length === 0 ? (
                  <EmptyState
                    colSpan={1}
                    title="No pending coursework units"
                    subtitle={
                      selectedCategory || dashboardSearch
                        ? 'No coursework units match your category or search filter.'
                        : 'All coursework and tests for this intake have been completed!'
                    }
                    hasFilters={Boolean(selectedCategory || dashboardSearch)}
                    onClearFilters={() => {
                      setSelectedCategory('')
                      setDashboardSearch('')
                    }}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredPendingUnits.map((u, idx) => (
                      <div
                        key={`${u.category}-${u.courseworkOrTestGuid}-${idx}`}
                        onClick={() => handleOpenCourseworkRoster(u)}
                        className="group relative bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-5 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-bl-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <div className="flex justify-between items-start mb-4 gap-3">
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1 truncate">
                              {u.unitCode || 'NO CODE'}
                            </span>
                            <h3 className="text-sm font-extrabold text-slate-800 line-clamp-2 leading-snug group-hover:text-blue-700 transition-colors">
                              {u.unitName || 'Unnamed Unit'}
                            </h3>
                          </div>
                          <span className="badge badge-purple text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 shadow-sm border border-purple-100">
                            {u.categoryLabel}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-5 flex-1">
                          <div className="bg-slate-50/80 rounded-xl p-3 flex flex-col items-center justify-center border border-slate-100 group-hover:bg-white group-hover:border-slate-200 transition-colors">
                            <span className="text-xl font-black text-slate-700">{u.attendedCount}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">Attended</span>
                          </div>
                          <div className="bg-amber-50/80 rounded-xl p-3 flex flex-col items-center justify-center border border-amber-100/50 group-hover:bg-amber-50 group-hover:border-amber-200 transition-colors">
                            <span className="text-xl font-black text-amber-600">{u.pendingCount}</span>
                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wide mt-0.5">Pending</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                            <i className="lni lni-users text-slate-400"></i>
                            {u.studyingCount} Enrolled
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm rounded-lg px-4 text-[11px] font-bold shadow-md shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow flex items-center gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenCourseworkRoster(u);
                            }}
                          >
                            Open Roster
                            <i className="lni lni-arrow-right group-hover:translate-x-0.5 transition-transform"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : isEvaluatedLoading || isEvaluatedFetching ? (
                <TableLoadingState
                  colSpan={1}
                  title="Loading evaluated coursework history…"
                  subtitle="Fetching completed evaluation records from server..."
                />
              ) : filteredEvaluatedUnits.length === 0 ? (
                <EmptyState
                  colSpan={1}
                  title="No evaluated coursework units"
                  subtitle={
                    selectedCategory || dashboardSearch
                      ? 'No completed units match your category or search filter.'
                      : 'No coursework units have been finalized yet for this intake.'
                  }
                  hasFilters={Boolean(selectedCategory || dashboardSearch)}
                  onClearFilters={() => {
                    setSelectedCategory('')
                    setDashboardSearch('')
                  }}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredEvaluatedUnits.map((u, idx) => (
                    <div
                      key={`${u.category}-${u.courseworkOrTestGuid}-${idx}`}
                      onClick={() => handleOpenCourseworkRoster(u)}
                      className="group relative bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-5 shadow-sm hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-50 to-teal-50/50 rounded-bl-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      <div className="flex justify-between items-start mb-4 gap-3">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1 truncate">
                            {u.unitCode || 'NO CODE'}
                          </span>
                          <h3 className="text-sm font-extrabold text-slate-800 line-clamp-2 leading-snug group-hover:text-emerald-700 transition-colors">
                            {u.unitName || 'Unnamed Unit'}
                          </h3>
                        </div>
                        <span className="badge badge-purple text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 shadow-sm border border-purple-100">
                          {u.categoryLabel}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-5 flex-1">
                        <div className="bg-slate-50/80 rounded-xl p-3 flex flex-col items-center justify-center border border-slate-100 group-hover:bg-white group-hover:border-slate-200 transition-colors">
                          <span className="text-xl font-black text-slate-700">{u.attendedCount}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">Attended</span>
                        </div>
                        <div className="bg-emerald-50/80 rounded-xl p-3 flex flex-col items-center justify-center border border-emerald-100/50 group-hover:bg-emerald-50 group-hover:border-emerald-200 transition-colors">
                          <span className="text-xl font-black text-emerald-600">{u.evaluatedCount}</span>
                          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide mt-0.5 flex items-center gap-1">
                            <i className="lni lni-checkmark-circle"></i> Done
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                          <i className="lni lni-users text-slate-400"></i>
                          {u.studyingCount} Enrolled
                        </div>
                        <button
                          type="button"
                          className="btn btn-neu btn-sm rounded-lg px-4 text-[11px] font-bold shadow-sm group-hover:shadow-md transition-shadow flex items-center gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCourseworkRoster(u);
                          }}
                        >
                          <i className="lni lni-eye"></i>
                          View Roster
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          STEP 2: STUDENT ROSTER VIEW (The Changed Endpoint)
         ═══════════════════════════════════════════════════════════════════════ */}
      {currentStep === 'roster' && selectedCoursework && (
        <div className="space-y-4">
          {/* Header Summary Banner Card */}
          <div className="card p-4 shadow-sm border border-slate-200 bg-gradient-to-r from-blue-50/40 via-white to-slate-50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-blue-700 text-sm">
                    {selectedCoursework.unitCode}
                  </span>
                  <span className="badge badge-purple text-[10.5px] font-semibold">
                    {selectedCoursework.categoryLabel}
                  </span>
                  {studentsResponse?.programmeName && (
                    <span className="badge badge-neu text-[10.5px] font-semibold">
                      {studentsResponse.programmeName}
                    </span>
                  )}
                  {studentsResponse?.semesterName && (
                    <span className="badge badge-neu text-[10.5px] font-semibold">
                      {studentsResponse.semesterName}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-extrabold text-slate-900 m-0">
                  {studentsResponse?.unitName || selectedCoursework.unitName}
                </h2>
              </div>

              {/* Counts Pills */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-center shadow-2xs">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Roster</div>
                  <div className="text-base font-extrabold text-slate-800">{rosterCounts.total}</div>
                </div>
                <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-center shadow-2xs">
                  <div className="text-[10px] uppercase font-bold text-amber-700">Pending</div>
                  <div className="text-base font-extrabold text-amber-800">{rosterCounts.pending}</div>
                </div>
                <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-center shadow-2xs">
                  <div className="text-[10px] uppercase font-bold text-emerald-700">Evaluated</div>
                  <div className="text-base font-extrabold text-emerald-800">{rosterCounts.evaluated}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Roster Controls: Status Filter Tabs & Search */}
          <div className="card p-4 shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 w-fit">
                {(['All', 'Pending', 'Evaluated'] as RosterStatusTab[]).map(tab => {
                  const isActive = rosterStatusTab === tab
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setRosterStatusTab(tab)}
                      className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>{tab}</span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                          isActive
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {tab === 'All'
                          ? rosterCounts.total
                          : tab === 'Pending'
                          ? rosterCounts.pending
                          : rosterCounts.evaluated}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Student Search */}
              <div className="relative sm:w-80 w-full">
                <input
                  type="text"
                  placeholder="Search student name or registration no..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors"
                />
                <i className="lni lni-search-alt absolute left-2.5 top-2.5 text-slate-400 text-xs"></i>
              </div>
            </div>
          </div>

          {/* Student Roster Table */}
          <div className="card p-0 shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-left w-12">#</th>
                    <th className="p-3 text-left w-36">Reg No</th>
                    <th className="p-3 text-left">Student Name</th>
                    <th className="p-3 text-center w-28">Min Qs</th>
                    <th className="p-3 text-center w-32">Status</th>
                    <th className="p-3 text-center w-36">Total Mark</th>
                    <th className="p-3 text-left w-44">Evaluated Date</th>
                    <th className="p-3 text-left">Remarks</th>
                    <th className="p-3 text-center w-32">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isStudentsLoading || isStudentsFetching ? (
                    <TableLoadingState
                      colSpan={9}
                      title="Loading student roster…"
                      subtitle="Fetching submitted student records from live endpoint..."
                    />
                  ) : displayedStudents.length === 0 ? (
                    <EmptyState
                      colSpan={9}
                      title="No students found"
                      subtitle={
                        studentSearch
                          ? 'No students match your search filter.'
                          : `No ${rosterStatusTab.toLowerCase()} students found for this coursework.`
                      }
                      hasFilters={Boolean(studentSearch || rosterStatusTab !== 'All')}
                      onClearFilters={() => {
                        setStudentSearch('')
                        setRosterStatusTab('All')
                      }}
                    />
                  ) : (
                    displayedStudents.map((std, idx) => {
                      const isEvaluated = std.evaluationStatus === 'Evaluated'
                      return (
                        <tr
                          key={std.studentGuid}
                          onClick={() => handleOpenStudentDetail(std)}
                          className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                        >
                          <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-slate-800">
                            {std.studentRegNo || '—'}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                                  isEvaluated
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {getInitials(std.studentName)}
                              </div>
                              <span className="font-bold text-slate-900">{std.studentName}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[11px]">
                              {std.minQuestion}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`badge text-[10.5px] font-bold px-2.5 py-0.5 rounded-full ${
                                isEvaluated ? 'badge-emerald' : 'badge-amber'
                              }`}
                            >
                              {isEvaluated ? '✓ Evaluated' : '⌛ Pending'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {isEvaluated && std.mark !== null ? (
                              <span className="font-bold text-emerald-700 text-[12.5px]">
                                {std.mark} <span className="text-slate-400 text-xs font-normal">/ {std.maxMark ?? 100}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-600 text-[11.5px]">
                            {isEvaluated ? formatDate(std.evaluatedDate) : '—'}
                          </td>
                          <td className="p-3 text-slate-600 truncate max-w-xs" title={std.comment || ''}>
                            {std.comment ? (
                              <span className="italic">&ldquo;{std.comment}&rdquo;</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleOpenStudentDetail(std)}
                              className={`btn btn-sm text-[11px] font-semibold flex items-center justify-center gap-1 mx-auto ${
                                isEvaluated ? 'btn-neu' : 'btn-primary'
                              }`}
                            >
                              <i className={`lni ${isEvaluated ? 'lni-eye' : 'lni-pencil'}`}></i>
                              <span>{isEvaluated ? 'View Marks' : 'Evaluate'}</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          STEP 3: STUDENT EVALUATION DETAIL VIEW (Questions Breakdown)
         ═══════════════════════════════════════════════════════════════════════ */}
      {currentStep === 'detail' && selectedCoursework && selectedStudent && (
        <div className="space-y-4">
          {/* Header Card: Evaluated vs Pending */}
          {selectedStudent.evaluationStatus === 'Evaluated' ? (
            /* ── Evaluated Header: Read-only summary from roster response ── */
            <div className="card p-5 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-white border border-emerald-200 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-emerald-200/60">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="badge badge-emerald text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <i className="lni lni-checkmark-circle"></i> Evaluated &amp; Finalized
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Reg No: {selectedStudent.studentRegNo || '—'}
                    </span>
                  </div>
                  <h2 className="text-xl font-extrabold text-slate-900 m-0">
                    {selectedStudent.studentName}
                  </h2>
                  <div className="text-xs text-slate-600 flex items-center gap-2">
                    <span>{studentsResponse?.unitName || selectedCoursework.unitName}</span>
                    <span>·</span>
                    <span>{selectedCoursework.categoryLabel}</span>
                  </div>
                </div>

                {/* Final Score & Evaluated Date Badges */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="px-4 py-2 bg-white border border-emerald-200 rounded-xl shadow-xs text-center">
                    <div className="text-[10.5px] uppercase font-bold text-emerald-800">Final Awarded Score</div>
                    <div className="text-xl font-extrabold text-emerald-700">
                      {selectedStudent.mark ?? '—'}{' '}
                      <span className="text-xs text-slate-400 font-normal">
                        / {selectedStudent.maxMark ?? '—'}
                      </span>
                    </div>
                  </div>

                  <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-xs text-left">
                    <div className="text-[10.5px] uppercase font-bold text-slate-400">Evaluated On</div>
                    <div className="text-xs font-bold text-slate-800">
                      {formatDate(selectedStudent.evaluatedDate)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Teacher Remarks / Comment */}
              {selectedStudent.comment && (
                <div className="mt-3 text-xs text-emerald-950 bg-white/80 border border-emerald-200/80 rounded-lg p-3 flex items-start gap-2">
                  <i className="lni lni-bubble text-emerald-600 text-sm shrink-0 mt-0.5"></i>
                  <div>
                    <strong className="font-semibold text-emerald-900">Teacher Remarks: </strong>
                    <span className="italic">{selectedStudent.comment}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── Pending Header: Live Scoring Desk & Progress ── */
            <div className="card p-4 bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-white border border-blue-200 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="badge badge-amber text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <i className="lni lni-hourglass"></i> Pending Evaluation
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Reg No: {selectedStudent.studentRegNo || '—'}
                    </span>
                  </div>
                  <h2 className="text-xl font-extrabold text-slate-900 m-0">
                    {selectedStudent.studentName}
                  </h2>
                  <div className="text-xs text-slate-600 flex items-center gap-2">
                    <span>{studentsResponse?.unitName || selectedCoursework.unitName}</span>
                    <span>·</span>
                    <span>{selectedCoursework.categoryLabel}</span>
                  </div>
                </div>

                {/* Progress Indicators & Scorecard Toggle */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-center shadow-2xs">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Questions Graded</div>
                    <div className="text-sm font-extrabold text-slate-800">
                      {scorecardStats.markedCount} / {localQuestions.length}
                      <span className="text-[10px] font-normal text-slate-500 ml-1">
                        (Min: {selectedStudent.minQuestion})
                      </span>
                    </div>
                  </div>

                  <div className="px-3.5 py-1.5 bg-white border border-blue-200 rounded-lg text-center shadow-2xs">
                    <div className="text-[10px] uppercase font-bold text-blue-600">Running Total</div>
                    <div className="text-sm font-extrabold text-blue-700">
                      {scorecardStats.totalScore} / {scorecardStats.totalMax} Marks
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsScorecardOpen(!isScorecardOpen)}
                    className={`btn btn-sm ${
                      isScorecardOpen ? 'btn-primary' : 'btn-neu'
                    } flex items-center gap-1 text-xs font-semibold`}
                  >
                    <i className="lni lni-bar-chart"></i>
                    <span>{isScorecardOpen ? 'Hide Scorecard' : 'Scorecard'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Optional Scorecard Drawer Table */}
          {isScorecardOpen && (
            <div className="card p-4 bg-slate-50 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Marks Scorecard Breakdown
                </span>
                <span className="text-xs font-semibold text-blue-700">
                  Total Awarded: {scorecardStats.totalScore} / {scorecardStats.totalMax} Marks
                </span>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2 text-left w-20">Question</th>
                      <th className="p-2 text-left w-20">Section</th>
                      <th className="p-2 text-left">Question Brief</th>
                      <th className="p-2 text-center w-24">Max Mark</th>
                      <th className="p-2 text-center w-24">Awarded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localQuestions.map((q, idx) => (
                      <tr
                        key={q.questionGuid}
                        onClick={() => setActiveQuestionIndex(idx)}
                        className={`border-b border-slate-100 hover:bg-blue-50/50 cursor-pointer transition-colors ${
                          idx === activeQuestionIndex ? 'bg-blue-50/70 font-semibold' : ''
                        }`}
                      >
                        <td className="p-2 font-bold text-slate-700">Q{idx + 1}</td>
                        <td className="p-2 text-slate-500">
                          {q.section ? `Sec ${String.fromCharCode(64 + q.section)}` : 'Sec A'}
                        </td>
                        <td className="p-2 text-slate-600 truncate max-w-xs">{q.questionText}</td>
                        <td className="p-2 text-center text-slate-600">{q.maxMark}</td>
                        <td className="p-2 text-center font-bold">
                          {q.mark === null || q.mark === undefined ? (
                            <span className="text-slate-400 italic">Unmarked</span>
                          ) : (
                            <span className="text-emerald-700">{q.mark}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Main Question Evaluation Workspace ───────────────────────────── */}
          {isQuestionsLoading || isQuestionsFetching ? (
            <div className="card p-12 text-center border border-slate-200">
              <div className="tbl-empty-inner">
                <div className="tbl-loading-icon-wrap">
                  <i className="lni lni-reload animate-spin text-blue-600" />
                </div>
                <div className="tbl-empty-title">Loading student submission…</div>
                <div className="tbl-empty-sub">Fetching answered questions and attachments</div>
              </div>
            </div>
          ) : localQuestions.length === 0 ? (
            <div className="card p-12 text-center border border-slate-200">
              <div className="tbl-empty-inner">
                <div className="tbl-empty-icon-wrap">
                  <i className="lni lni-inbox text-slate-400" />
                </div>
                <div className="tbl-empty-title">No questions found</div>
                <div className="tbl-empty-sub">This student has not submitted any answers for this coursework.</div>
              </div>
            </div>
          ) : selectedStudent.evaluationStatus === 'Evaluated' ? (
            /* ═══════════════════════════════════════════════════════════════════
               EVALUATED STUDENT: READ-ONLY QUESTIONS LIST
               No mark inputs, no Save/Finalize buttons
               ═══════════════════════════════════════════════════════════════════ */
            <div className="space-y-4">
              {localQuestions.map((q, idx) => (
                <div key={q.questionGuid || idx} className="card p-5 border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="badge bg-slate-800 text-white text-xs font-bold px-2.5 py-1 rounded-md">
                        Question {idx + 1}
                      </span>
                      {q.section && (
                        <span className="badge bg-slate-100 text-slate-700 text-xs font-semibold px-2 py-0.5 rounded">
                          Section {String.fromCharCode(64 + q.section)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Score:</span>
                      <span className="badge badge-emerald text-xs font-bold px-2.5 py-1 rounded-md">
                        {q.mark ?? '—'} / {q.maxMark ?? 10} Marks
                      </span>
                    </div>
                  </div>

                  {/* Question Statement */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-900 font-medium leading-relaxed">
                    {/<[a-z][\s\S]*>/i.test(q.questionText || '') ? (
                      <div
                        className="rich-editor-content"
                        dangerouslySetInnerHTML={{ __html: q.questionText || '' }}
                      />
                    ) : (
                      <div className="whitespace-pre-line">{q.questionText}</div>
                    )}
                  </div>

                  {/* Student Answer & File Attachment */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Student Answer
                      </span>
                      {q.answerFileUrl && (
                        <a
                          href={q.answerFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-xs font-semibold"
                        >
                          <i className="lni lni-paperclip"></i>
                          <span>{q.answerFileName || 'Download Attachment'}</span>
                          <i className="lni lni-download text-[10px]"></i>
                        </a>
                      )}
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 leading-relaxed min-h-[60px]">
                      {q.answerText ? (
                        /<[a-z][\s\S]*>/i.test(q.answerText) ? (
                          <div
                            className="rich-editor-content"
                            dangerouslySetInnerHTML={{ __html: q.answerText }}
                          />
                        ) : (
                          <div className="whitespace-pre-line">{q.answerText}</div>
                        )
                      ) : (
                        <span className="text-slate-400 italic">No typed answer provided.</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ═══════════════════════════════════════════════════════════════════
               PENDING STUDENT: INTERACTIVE SCORING DESK
               Editable inputs, Save Mark button, Finalize button
               ═══════════════════════════════════════════════════════════════════ */
            <div className="card p-5 shadow-sm border border-slate-200 space-y-4">
              {/* Question Navigation Tabs */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="badge bg-blue-600 text-white font-bold text-xs px-2.5 py-1 rounded-md">
                    Question {activeQuestionIndex + 1} of {localQuestions.length}
                  </span>
                  {currentQuestion?.section && (
                    <span className="badge bg-slate-100 text-slate-700 font-bold text-xs px-2 py-1 rounded-md">
                      Section {String.fromCharCode(64 + currentQuestion.section)}
                    </span>
                  )}
                  <span className="text-xs text-slate-500 font-semibold">
                    [ Max Mark: {currentQuestion?.maxMark ?? 10} ]
                  </span>
                </div>

                {/* Prev / Next Question Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={activeQuestionIndex === 0}
                    onClick={() => setActiveQuestionIndex(prev => prev - 1)}
                    className="btn btn-neu btn-sm text-xs disabled:opacity-40"
                  >
                    <i className="lni lni-chevron-left"></i> Prev
                  </button>
                  <button
                    type="button"
                    disabled={activeQuestionIndex === localQuestions.length - 1}
                    onClick={() => setActiveQuestionIndex(prev => prev + 1)}
                    className="btn btn-neu btn-sm text-xs disabled:opacity-40"
                  >
                    Next <i className="lni lni-chevron-right"></i>
                  </button>
                </div>
              </div>

              {/* Question Statement */}
              {currentQuestion && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/70">
                    <div className="text-[11px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5">
                      <i className="lni lni-question-circle text-blue-600 text-xs"></i>
                      <span>Question Statement</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsQuestionExpanded(!isQuestionExpanded)}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 px-2 py-0.5 rounded hover:bg-blue-50"
                    >
                      <i className={`lni lni-${isQuestionExpanded ? 'chevron-up' : 'chevron-down'} text-[10px]`}></i>
                      <span>{isQuestionExpanded ? 'Collapse' : 'Expand'}</span>
                    </button>
                  </div>

                  <div className={`transition-all ${isQuestionExpanded ? 'max-h-none' : 'max-h-[140px] overflow-y-auto pr-2'}`}>
                    {/<[a-z][\s\S]*>/i.test(currentQuestion.questionText || '') ? (
                      <div
                        className="font-semibold text-[13.5px] text-slate-900 leading-relaxed rich-editor-content"
                        dangerouslySetInnerHTML={{ __html: currentQuestion.questionText || '' }}
                      />
                    ) : (
                      <div className="font-semibold text-[13.5px] text-slate-900 leading-relaxed whitespace-pre-line">
                        {currentQuestion.questionText}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Student's Answer & File Attachment */}
              {currentQuestion && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11.5px] uppercase font-bold tracking-wider text-slate-500">
                      Student&apos;s Answer
                    </label>
                    {currentQuestion.answerFileUrl && (
                      <div className="flex items-center bg-blue-50 border border-blue-200 text-blue-700 rounded-md text-xs font-semibold overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setPreviewFile({ url: currentQuestion.answerFileUrl!, name: currentQuestion.answerFileName || 'Attached Answer' })}
                          className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-blue-100 transition-colors"
                          title="View file"
                        >
                          <i className="lni lni-eye"></i>
                          <span>{currentQuestion.answerFileName || 'View Attached Answer'}</span>
                        </button>
                        <a
                          href={currentQuestion.answerFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center px-2 py-1 border-l border-blue-200 text-slate-500 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                          title="Download file"
                          aria-label="Download file"
                        >
                          <i className="lni lni-download"></i>
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-slate-300 rounded-xl p-4 min-h-[100px] max-h-[180px] overflow-y-auto text-[13px] text-slate-800 leading-relaxed font-sans shadow-inner">
                    {currentQuestion.answerText ? (
                      /<[a-z][\s\S]*>/i.test(currentQuestion.answerText) ? (
                        <div
                          className="rich-editor-content"
                          dangerouslySetInnerHTML={{ __html: currentQuestion.answerText }}
                        />
                      ) : (
                        <div className="whitespace-pre-line">{currentQuestion.answerText}</div>
                      )
                    ) : (
                      <span className="text-slate-400 italic">No typed answer provided. Check attached file.</span>
                    )}
                  </div>
                </div>
              )}

              {/* Editable Mark Input & Question Save Mark Button */}
              {currentQuestion && (() => {
                const isLastQuestion = activeQuestionIndex === localQuestions.length - 1
                return (
                  <div className="space-y-4 pt-2">
                    <div className={`grid grid-cols-1 ${isLastQuestion ? 'sm:grid-cols-12' : 'sm:grid-cols-8'} gap-4 items-end`}>
                      {/* Mark Input */}
                      <div className={`${isLastQuestion ? 'sm:col-span-5' : 'sm:col-span-8'} flex flex-col gap-1.5`}>
                        <label className="text-[11.5px] font-bold uppercase tracking-wider text-slate-700">
                          Mark Scored (Max: {currentQuestion.maxMark ?? 10}) <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="any"
                            min={0}
                            max={currentQuestion.maxMark ?? 100}
                            placeholder={`0 - ${currentQuestion.maxMark ?? 10}`}
                            value={markInput}
                            onChange={e => setMarkInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleSaveMark()
                              }
                            }}
                            className="ctrl w-full font-bold text-sm text-slate-900 focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveMark()}
                            disabled={saveMarkMutation.isPending}
                            className="btn btn-primary h-[38px] px-4 flex items-center gap-1 font-semibold text-xs shrink-0 shadow-xs"
                          >
                            <i
                              className={`lni ${
                                saveMarkMutation.isPending
                                  ? 'lni-reload animate-spin'
                                  : isLastQuestion
                                  ? 'lni-save'
                                  : 'lni-arrow-right'
                              }`}
                            ></i>
                            <span>
                              {saveMarkMutation.isPending
                                ? 'Saving…'
                                : isLastQuestion
                                ? 'Save Mark'
                                : 'Save & Next'}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Teacher Remarks Box: ONLY SHOWN ON THE LAST QUESTION */}
                      {isLastQuestion && (
                        <div className="sm:col-span-7 flex flex-col gap-1.5">
                          <label className="text-[11.5px] font-bold uppercase tracking-wider text-slate-700">
                            Finalize Remarks / Teacher Feedback (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Good coverage of concepts, clear diagrams..."
                            value={finalizeComment}
                            onChange={e => setFinalizeComment(e.target.value)}
                            className="ctrl w-full text-xs h-[38px]"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Bottom Action Strip: Summary & Finalize Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100 mt-2">
                <div className="text-xs text-slate-600">
                  <span>Questions Graded: </span>
                  <strong className="text-slate-900 font-bold">
                    {scorecardStats.markedCount} / {localQuestions.length}
                  </strong>
                  <span className="text-slate-400 ml-2">
                    (Min required: {selectedStudent.minQuestion || localQuestions.length})
                  </span>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={handleFinalize}
                    disabled={finalizeStudentMutation.isPending}
                    className="btn h-[38px] px-5 flex items-center gap-1.5 font-bold text-xs shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                    title="Save current mark and finalize student evaluation"
                  >
                    <i
                      className={`lni ${
                        finalizeStudentMutation.isPending ? 'lni-reload animate-spin' : 'lni-checkmark-circle'
                      } font-bold`}
                    ></i>
                    <span>{finalizeStudentMutation.isPending ? 'Finalizing…' : 'Finalize Student'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <DocumentPreviewModal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        url={previewFile?.url ?? null}
        title={previewFile?.name}
      />

      {/* ── Toast Alert ─────────────────────────────────────────────────────── */}
      <Toast toast={toast} />
    </div>
  )
}
