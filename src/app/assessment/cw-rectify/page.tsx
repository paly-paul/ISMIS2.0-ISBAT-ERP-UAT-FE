'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import { Toast } from '@/components/Toast'
import {
  useCwIntakes,
  useCwCourseUnits,
  useCwCourseworks,
  useCwStudents,
  useCwSubmissionSummary,
  useCwRecheck,
  useDeleteCwSubmission,
  useReopenCwSubmission,
  useReevaluateCwSubmission,
} from '@/hooks/assessment/useCwRectification'
import { CwSubmissionStatus, CwRecheckQuestion } from '@/lib/api/assessment/cwRectification'

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string | null | undefined): string {
  if (!name) return 'ST'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

const STATUS_CONFIG: Record<
  CwSubmissionStatus,
  { label: string; badgeCls: string; dotCls: string }
> = {
  NotSubmitted: {
    label: 'Not submitted',
    badgeCls: 'bg-[#EEF0F5] text-[#4A5170] border border-[#DCE0EA]',
    dotCls: 'bg-[#767E99]',
  },
  Saved: {
    label: 'Saved (Incomplete)',
    badgeCls: 'bg-[#FFF4E5] text-[#B76E00] border border-[#FFE2B3]',
    dotCls: 'bg-[#B76E00]',
  },
  Submitted: {
    label: 'Submitted · awaiting evaluation',
    badgeCls: 'bg-[#FBF0DC] text-[#966311] border border-[#EFD8A2]',
    dotCls: 'bg-[#966311]',
  },
  Evaluated: {
    label: 'Evaluated',
    badgeCls: 'bg-[#E7F5EE] text-[#1F7A54] border border-[#BFE3D1]',
    dotCls: 'bg-[#1F7A54]',
  },
}

export default function CwRectificationPage() {
  // ── Toast State ─────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const showToast = (msg: string, type: string = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Cascading Filter State ──────────────────────────────────────────────────
  const [selectedIntakeGuid, setSelectedIntakeGuid] = useState<string>('')
  const [selectedCourseUnitGuid, setSelectedCourseUnitGuid] = useState<string>('')
  const [selectedCourseworkGuid, setSelectedCourseworkGuid] = useState<string>('')
  const [selectedStudentGuid, setSelectedStudentGuid] = useState<string>('')



  // ── 1. Fetch Intakes ────────────────────────────────────────────────────────
  const { data: intakes = [], isLoading: isIntakesLoading } = useCwIntakes()

  // Auto-select first intake if none is selected
  useEffect(() => {
    if (!selectedIntakeGuid && intakes.length > 0) {
      setSelectedIntakeGuid(intakes[0].intakeGuid)
    }
  }, [intakes, selectedIntakeGuid])

  // ── 2. Fetch Course Units ───────────────────────────────────────────────────
  const { data: courseUnits = [], isLoading: isUnitsLoading } = useCwCourseUnits(
    selectedIntakeGuid,
    Boolean(selectedIntakeGuid)
  )

  // Filter out course units where courseUnitName is null, empty, or 'null'
  const validCourseUnits = useMemo(() => {
    return courseUnits.filter(u => {
      const name = u.courseUnitName?.trim()
      return Boolean(name && name.toLowerCase() !== 'null' && name !== 'undefined')
    })
  }, [courseUnits])

  // Auto-select first valid course unit when intake changes
  useEffect(() => {
    if (validCourseUnits.length > 0) {
      const exists = validCourseUnits.some(u => u.courseUnitGuid === selectedCourseUnitGuid)
      if (!exists) {
        setSelectedCourseUnitGuid(validCourseUnits[0].courseUnitGuid)
      }
    } else {
      setSelectedCourseUnitGuid('')
    }
  }, [validCourseUnits, selectedCourseUnitGuid])

  // ── 3. Fetch Courseworks ────────────────────────────────────────────────────
  const { data: courseworks = [], isLoading: isCourseworksLoading } = useCwCourseworks(
    selectedIntakeGuid,
    selectedCourseUnitGuid,
    Boolean(selectedIntakeGuid && selectedCourseUnitGuid)
  )

  // Auto-select first coursework when course unit changes
  useEffect(() => {
    if (courseworks.length > 0) {
      const exists = courseworks.some(cw => cw.courseworkGuid === selectedCourseworkGuid)
      if (!exists) {
        setSelectedCourseworkGuid(courseworks[0].courseworkGuid)
      }
    } else {
      setSelectedCourseworkGuid('')
    }
  }, [courseworks, selectedCourseworkGuid])

  // Current coursework object
  const activeCoursework = useMemo(() => {
    return courseworks.find(cw => cw.courseworkGuid === selectedCourseworkGuid) || courseworks[0]
  }, [courseworks, selectedCourseworkGuid])

  const courseworkNumber = activeCoursework?.courseworkNumber ?? 1

  // ── 4. Fetch Students ───────────────────────────────────────────────────────
  const { data: students = [], isLoading: isStudentsLoading } = useCwStudents(
    selectedIntakeGuid,
    selectedCourseUnitGuid,
    courseworkNumber,
    Boolean(selectedIntakeGuid && selectedCourseUnitGuid && courseworkNumber)
  )

  // Auto-select first student when coursework changes
  useEffect(() => {
    if (students.length > 0) {
      const exists = students.some(s => s.studentGuid === selectedStudentGuid)
      if (!exists) {
        setSelectedStudentGuid(students[0].studentGuid)
      }
    } else {
      setSelectedStudentGuid('')
    }
  }, [students, selectedStudentGuid])

  // ── 5. Fetch Submission Summary ─────────────────────────────────────────────
  const {
    data: summary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useCwSubmissionSummary(
    selectedCourseworkGuid,
    selectedStudentGuid,
    Boolean(selectedCourseworkGuid && selectedStudentGuid)
  )

  // ── 6. Viewer State (Recheck / Walkthrough) ─────────────────────────────────
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false)
  const [viewerIndex, setViewerIndex] = useState<number>(0)

  // Fetch recheck Q&A only when student can recheck & viewer is open
  const { data: recheckData, isLoading: isRecheckLoading } = useCwRecheck(
    selectedCourseworkGuid,
    selectedStudentGuid,
    Boolean(isViewerOpen && summary?.canRecheck)
  )

  // Reset viewer index when student or coursework changes
  useEffect(() => {
    setViewerIndex(0)
  }, [selectedCourseworkGuid, selectedStudentGuid])

  // ── 7. Action Confirm Modals & Mutations ────────────────────────────────────
  const [confirmAction, setConfirmAction] = useState<'delete' | 'reopen' | 'reevaluate' | null>(null)
  const [reEvalReason, setReEvalReason] = useState<string>('')

  const deleteMutation = useDeleteCwSubmission()
  const reopenMutation = useReopenCwSubmission()
  const reevaluateMutation = useReevaluateCwSubmission()

  const isMutating =
    deleteMutation.isPending || reopenMutation.isPending || reevaluateMutation.isPending

  // ── Handle Find Button Click ───────────────────────────────────────────────
  const handleFindSubmission = () => {
    refetchSummary()
    const student = students.find(s => s.studentGuid === selectedStudentGuid)
    if (student) {
      showToast(`Refreshed submission for ${student.studentName || 'Student'}`, 'success')
    } else {
      showToast('Select a valid student to find submission', 'info')
    }
  }

  // ── Action Handlers ────────────────────────────────────────────────────────
  const handleExecuteAction = (actionId: string) => {
    if (actionId === 'recheck') {
      setIsViewerOpen(prev => !prev)
      return
    }
    if (actionId === 'delete') {
      setConfirmAction('delete')
    } else if (actionId === 'reopen') {
      setConfirmAction('reopen')
    } else if (actionId === 'reevaluate') {
      setConfirmAction('reevaluate')
    }
  }

  const handleConfirmAction = async () => {
    if (!selectedCourseworkGuid || !selectedStudentGuid) return

    try {
      if (confirmAction === 'delete') {
        const res = await deleteMutation.mutateAsync({
          courseworkGuid: selectedCourseworkGuid,
          studentGuid: selectedStudentGuid,
        })
        showToast(res.message || 'Submission deleted. Student can restart.', 'success')
      } else if (confirmAction === 'reopen') {
        const res = await reopenMutation.mutateAsync({
          courseworkGuid: selectedCourseworkGuid,
          studentGuid: selectedStudentGuid,
        })
        showToast(res.message || 'Coursework reopened. Resubmission enabled.', 'success')
      } else if (confirmAction === 'reevaluate') {
        const res = await reevaluateMutation.mutateAsync({
          courseworkGuid: selectedCourseworkGuid,
          studentGuid: selectedStudentGuid,
        })
        showToast(res.message || 'Evaluation revoked. Script awaiting re-marking.', 'success')
      }
    } catch (err: any) {
      showToast(err?.message || 'Action failed. Please check network.', 'error')
    } finally {
      setConfirmAction(null)
      setReEvalReason('')
      setIsViewerOpen(false)
    }
  }

  // ── Transform Dropdown Options ─────────────────────────────────────────────
  const intakeOptions = useMemo(() => {
    return intakes.map(i => ({
      value: i.intakeGuid,
      label: `${i.description || 'Intake ' + i.intakeCode} (${i.intakeCode})`,
    }))
  }, [intakes])

  const courseUnitOptions = useMemo(() => {
    return validCourseUnits.map(u => {
      const name = u.courseUnitName!.trim()
      const code = u.courseUnitCode?.trim()
      let label = name
      if (code && !name.toLowerCase().includes(code.toLowerCase())) {
        label = `${name} (${code})`
      }
      return {
        value: u.courseUnitGuid,
        label,
      }
    })
  }, [validCourseUnits])

  const courseworkOptions = useMemo(() => {
    return courseworks.map(cw => ({
      value: cw.courseworkGuid,
      label: cw.label || `CW ${cw.courseworkNumber}`,
    }))
  }, [courseworks])

  const studentOptions = useMemo(() => {
    return students.map(s => ({
      value: s.studentGuid,
      label: `${s.studentName || 'Student'} (${s.studentRegNo || 'N/A'})`,
    }))
  }, [students])

  // Current active student
  const activeStudent = useMemo(() => {
    return students.find(s => s.studentGuid === selectedStudentGuid)
  }, [students, selectedStudentGuid])

  // Current active unit
  const activeCourseUnit = useMemo(() => {
    return validCourseUnits.find(u => u.courseUnitGuid === selectedCourseUnitGuid) || validCourseUnits[0]
  }, [validCourseUnits, selectedCourseUnitGuid])

  // ── Dynamic Status & Actions Derived Directly from Backend Response ────────
  const currentStatus: CwSubmissionStatus = useMemo(() => {
    return summary?.status || 'NotSubmitted'
  }, [summary?.status])

  // ── Actions Validity Calculation strictly from Backend permissions ────────
  const actionsList = useMemo(() => {
    return [
      {
        id: 'delete',
        title: 'Delete submission',
        desc: 'Clears saved answers so the student can restart fresh. Legal only before final submission.',
        isEnabled: Boolean(summary?.canDelete),
        ctaLabel: 'Delete',
      },
      {
        id: 'reopen',
        title: 'Reopen for resubmission',
        desc: 'Student regains access to resubmit — use for wrong-file upload or submission error.',
        isEnabled: Boolean(summary?.canReopen),
        ctaLabel: 'Reopen',
      },
      {
        id: 'reevaluate',
        title: 'Send back for re-evaluation',
        desc: 'Clears awarded marks and returns script to the lecturer for re-marking.',
        isEnabled: Boolean(summary?.canReevaluate),
        ctaLabel: 'Re-evaluate',
      },
      {
        id: 'recheck',
        title: 'View answers & marks',
        desc: 'Read-only walkthrough of every question, the student’s answer and awarded marks.',
        isEnabled: Boolean(summary?.canRecheck),
        ctaLabel: isViewerOpen ? 'Close' : 'Open',
      },
    ]
  }, [
    summary?.canDelete,
    summary?.canReopen,
    summary?.canReevaluate,
    summary?.canRecheck,
    isViewerOpen,
  ])

  const enabledCount = actionsList.filter(a => a.isEnabled).length
  const actionsHint = isSummaryLoading
    ? 'Checking submission status...'
    : enabledCount > 0
    ? `${enabledCount} action${enabledCount > 1 ? 's' : ''} available for ${STATUS_CONFIG[currentStatus].label}`
    : `No actions available for status "${STATUS_CONFIG[currentStatus].label}"`

  // Questions for Viewer (Pure live from backend recheck API)
  const questionsList = useMemo(() => {
    return recheckData?.questions ?? []
  }, [recheckData?.questions])

  const currentQ = questionsList[viewerIndex] || null

  return (
    <div className="page active" id="page-cw-rectification">
      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="pg-hdr flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div className="flex-1 min-w-0">
          <div className="pg-title flex items-center gap-2 flex-wrap">
            <span>Coursework Rectification</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              Live Gateway
            </span>
          </div>
          <div className="pg-sub text-xs text-slate-500">
            Reopen, delete, re-evaluate or review a student&apos;s coursework from one consolidated lookup — only actions valid for the current state are enabled.
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleFindSubmission}
            disabled={isSummaryLoading}
            className="btn btn-neu h-[36px] px-3.5 flex items-center gap-1.5 text-xs font-semibold hover:bg-slate-50 transition-colors"
            title="Refresh current submission"
          >
            <i className={`lni lni-reload ${isSummaryLoading ? 'animate-spin' : ''}`}></i>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Lookup Panel (Filterbar & Summary Strip) ──────────────────────── */}
      <div className="bg-white border border-[#E1E4EE] rounded-xl shadow-[0_1px_2px_rgba(26,31,48,0.04),0_6px_20px_-8px_rgba(26,31,48,0.10)] mb-4 overflow-hidden">
        {/* Filter Bar */}
        <div className="p-3.5 sm:p-4 flex items-end gap-2.5 bg-slate-50/40 overflow-x-auto">
          {/* 1. Academic Intake */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[130px]">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#767E99] flex items-center justify-between whitespace-nowrap">
              <span>Academic intake</span>
              {isIntakesLoading && <span className="text-[10px] text-blue-600 font-normal">Loading...</span>}
            </label>
            <SearchSelect
              options={intakeOptions}
              value={selectedIntakeGuid}
              onChange={val => {
                setSelectedIntakeGuid(val)
                setSelectedCourseUnitGuid('')
                setSelectedCourseworkGuid('')
                setSelectedStudentGuid('')
              }}
              isLoading={isIntakesLoading}
              placeholder="Select Intake..."
              className="w-full text-xs"
            />
          </div>

          {/* 2. Course Unit */}
          <div className="flex flex-col gap-1.5 flex-[1.2] min-w-[140px]">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#767E99] flex items-center justify-between whitespace-nowrap">
              <span>Course unit</span>
              {isUnitsLoading && <span className="text-[10px] text-blue-600 font-normal">Loading...</span>}
            </label>
            <SearchSelect
              options={courseUnitOptions}
              value={selectedCourseUnitGuid}
              onChange={val => {
                setSelectedCourseUnitGuid(val)
                setSelectedCourseworkGuid('')
                setSelectedStudentGuid('')
              }}
              isLoading={isUnitsLoading}
              disabled={!selectedIntakeGuid || courseUnitOptions.length === 0}
              placeholder={
                courseUnitOptions.length === 0 ? 'No units found' : 'Select Course Unit...'
              }
              className="w-full text-xs"
            />
          </div>

          {/* 3. Assessment Attempt (CW 1 / CW 2) */}
          <div className="flex flex-col gap-1.5 w-[100px] shrink-0">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#767E99] flex items-center justify-between whitespace-nowrap">
              <span>Attempt</span>
              {isCourseworksLoading && <span className="text-[10px] text-blue-600 font-normal">...</span>}
            </label>
            <SearchSelect
              options={courseworkOptions}
              value={selectedCourseworkGuid}
              onChange={val => {
                setSelectedCourseworkGuid(val)
                setSelectedStudentGuid('')
              }}
              isLoading={isCourseworksLoading}
              disabled={!selectedCourseUnitGuid || courseworkOptions.length === 0}
              placeholder="Select CW..."
              className="w-full text-xs"
            />
          </div>

          {/* 4. Student */}
          <div className="flex flex-col gap-1.5 flex-[1.4] min-w-[150px]">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#767E99] flex items-center justify-between whitespace-nowrap">
              <span>Student</span>
              {isStudentsLoading && <span className="text-[10px] text-blue-600 font-normal">Loading...</span>}
            </label>
            <SearchSelect
              options={studentOptions}
              value={selectedStudentGuid}
              onChange={setSelectedStudentGuid}
              isLoading={isStudentsLoading}
              disabled={!selectedCourseworkGuid || studentOptions.length === 0}
              placeholder={studentOptions.length === 0 ? 'No students found' : 'Select Student...'}
              className="w-full text-xs"
            />
          </div>

          {/* Find Button (always in same line) */}
          <button
            type="button"
            onClick={handleFindSubmission}
            disabled={!selectedStudentGuid || isSummaryLoading}
            className="btn btn-primary h-[38px] px-4 flex items-center gap-1.5 shrink-0 text-xs font-semibold disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap shadow-xs"
          >
            <svg
              className={`w-3.5 h-3.5 ${isSummaryLoading ? 'animate-spin' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <line x1="20" y1="20" x2="15.2" y2="15.2" />
            </svg>
            <span>{isSummaryLoading ? 'Finding...' : 'Find'}</span>
          </button>
        </div>

        {/* Summary Strip */}
        <div className="p-4 flex items-center gap-6 flex-wrap border-t border-[#E1E4EE] bg-[#FAFBFE]">
          {/* Student Avatar & Name */}
          <div className="flex items-center gap-3 flex-[1_1_240px]">
            <div className="w-[40px] h-[40px] rounded-[10px] bg-[#EBEEFA] text-[#28357D] border border-[#D3D9F3] flex items-center justify-center font-bold text-[13px] shrink-0 shadow-xs">
              {getInitials(summary?.studentName || activeStudent?.studentName)}
            </div>
            <div>
              <div className="font-bold text-[14.5px] text-[#1A1F30]">
                {summary?.studentName || activeStudent?.studentName || 'No student selected'}
              </div>
              <div className="text-[#767E99] text-[12.5px] font-mono">
                {summary?.studentRegNo || activeStudent?.studentRegNo || '—'}
              </div>
            </div>
          </div>

          {/* Unit Info */}
          <div className="flex flex-col gap-0.5">
            <div className="text-[10.5px] uppercase font-bold tracking-wider text-[#767E99]">
              Course Unit
            </div>
            <div className="text-[13px] text-[#4A5170] font-semibold truncate max-w-[200px]" title={activeCourseUnit?.courseUnitName || ''}>
              {activeCourseUnit
                ? (activeCourseUnit.courseUnitName && activeCourseUnit.courseUnitCode
                    ? `${activeCourseUnit.courseUnitName} (${activeCourseUnit.courseUnitCode})`
                    : activeCourseUnit.courseUnitName || activeCourseUnit.courseUnitCode || 'Course Unit')
                : '—'}
            </div>
          </div>

          {/* Submitted Date */}
          <div className="flex flex-col gap-0.5">
            <div className="text-[10.5px] uppercase font-bold tracking-wider text-[#767E99]">
              Submitted
            </div>
            <div className="text-[13px] text-[#4A5170] font-semibold">
              {summary?.submittedDate ? formatDate(summary.submittedDate) : '—'}
            </div>
          </div>

          {/* Status Pill */}
          <div className="flex items-center">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold whitespace-nowrap ${STATUS_CONFIG[currentStatus].badgeCls}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[currentStatus].dotCls}`}></span>
              {STATUS_CONFIG[currentStatus].label}
            </span>
          </div>

          {/* Mark */}
          <div className="ml-auto text-right">
            <div className="text-[10.5px] uppercase font-bold tracking-wider text-[#767E99]">
              Mark Awarded
            </div>
            <div className="text-[18px] font-bold font-mono text-[#1A1F30]">
              {summary?.mark !== null && summary?.mark !== undefined ? (
                <>
                  {summary.mark}
                  {summary?.maxMark != null && (
                    <span className="text-[#767E99] font-medium text-[13.5px]">
                      &nbsp;/&nbsp;{summary.maxMark}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[#767E99] font-normal text-[13px] italic">
                  {currentStatus === 'Submitted'
                    ? 'awaiting evaluation'
                    : currentStatus === 'Saved'
                    ? 'saved (incomplete)'
                    : 'not evaluated'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Available Actions Section ──────────────────────────────────────── */}
      <div className="flex items-baseline justify-between mt-6 mb-2.5 px-1">
        <h2 className="text-[13px] uppercase font-bold tracking-wider text-[#767E99] m-0">
          Available actions
        </h2>
        <span className="text-[12px] text-[#767E99] font-normal">{actionsHint}</span>
      </div>

      {/* ── Action Rows List ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        {actionsList.map(action => {
          const isEnabled = action.isEnabled

          // Styling per action
          let iconBox = '&#128465;'
          let iconStyle = 'bg-[#EEF0F5] text-[#767E99] border-[#DCE0EA]'
          let btnStyle = 'bg-[#EEF0F5] border border-[#DCE0EA] text-[#767E99] cursor-not-allowed'

          if (action.id === 'delete') {
            iconBox = '&#128465;'
            if (isEnabled) {
              iconStyle = 'bg-[#FBECEA] text-[#A6392F] border-[#EFC7C1]'
              btnStyle =
                'border border-[#A6392F] text-[#A6392F] hover:bg-[#FBECEA] cursor-pointer shadow-xs active:scale-[0.98]'
            }
          } else if (action.id === 'reopen') {
            iconBox = '&#128275;'
            if (isEnabled) {
              iconStyle = 'bg-[#FBF0DC] text-[#966311] border-[#EFD8A2]'
              btnStyle =
                'bg-[#966311] border border-[#966311] text-white hover:bg-[#7a500c] cursor-pointer shadow-xs active:scale-[0.98]'
            }
          } else if (action.id === 'reevaluate') {
            iconBox = '&#8635;'
            if (isEnabled) {
              iconStyle = 'bg-[#E7F5EE] text-[#1F7A54] border-[#BFE3D1]'
              btnStyle =
                'bg-[#1F7A54] border border-[#1F7A54] text-white hover:bg-[#165a3e] cursor-pointer shadow-xs active:scale-[0.98]'
            }
          } else if (action.id === 'recheck') {
            iconBox = '&#128065;'
            if (isEnabled) {
              iconStyle = 'bg-blue-50 text-blue-700 border-blue-200'
              btnStyle = isViewerOpen
                ? 'btn btn-neu btn-sm cursor-pointer'
                : 'btn btn-primary btn-sm cursor-pointer active:scale-[0.98]'
            }
          }

          return (
            <div
              key={action.id}
              className={`flex items-center gap-3.5 p-3.5 bg-white border border-[#E1E4EE] rounded-[10px] transition-all ${
                isEnabled
                  ? 'shadow-[0_1px_2px_rgba(26,31,48,0.04),0_6px_20px_-8px_rgba(26,31,48,0.10)] border-slate-300'
                  : 'opacity-50'
              }`}
            >
              {/* Action Icon */}
              <div
                className={`w-[34px] h-[34px] rounded-[8px] flex items-center justify-center shrink-0 text-[16px] border ${iconStyle}`}
                dangerouslySetInnerHTML={{ __html: iconBox }}
              />

              {/* Action Body */}
              <div className="flex-[1_1_auto] min-w-0">
                <div className="font-bold text-[13.5px] text-[#1A1F30] flex items-center gap-2">
                  {action.title}
                </div>
                <div
                  className={`text-[12.5px] mt-0.5 ${isEnabled ? 'text-[#767E99]' : 'text-[#767E99] italic'}`}
                >
                  {action.desc}
                </div>
              </div>

              {/* Action CTA Button */}
              <div className="shrink-0">
                <button
                  type="button"
                  disabled={!isEnabled || isMutating}
                  onClick={() => handleExecuteAction(action.id)}
                  className={`font-semibold text-[13px] px-3.5 py-1.5 rounded-[7px] whitespace-nowrap transition-colors ${btnStyle}`}
                >
                  {action.ctaLabel}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Q&A Viewer (Recheck / Walkthrough) ────────────────────────────── */}
      {isViewerOpen && Boolean(summary?.canRecheck) && (
        <div className="mt-3 border border-[#E1E4EE] rounded-[10px] bg-white shadow-[0_1px_2px_rgba(26,31,48,0.04),0_6px_20px_-8px_rgba(26,31,48,0.10)] overflow-hidden transition-all">
          {/* Viewer Head */}
          <div className="flex items-center justify-between p-3.5 border-b border-[#E1E4EE] bg-[#FAFBFE]">
            <div className="font-bold text-[13px] text-[#1A1F30] flex items-center gap-2">
              <span>Question {questionsList.length > 0 ? viewerIndex + 1 : 0} of {questionsList.length}</span>
              {isRecheckLoading && (
                <span className="text-xs text-blue-600 font-normal flex items-center gap-1">
                  <i className="lni lni-reload animate-spin text-[10px]"></i> Loading answers...
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5 text-[12.5px] text-[#767E99]">
              <span className="font-medium text-slate-700">
                Total:{' '}
                <strong className="text-emerald-700 font-bold font-mono">
                  {recheckData?.totalMark ?? summary?.mark ?? '—'} / {recheckData?.totalMaxMark ?? summary?.maxMark ?? '—'}
                </strong>
              </span>
              <button
                type="button"
                disabled={viewerIndex === 0 || isRecheckLoading}
                onClick={() => setViewerIndex(prev => Math.max(0, prev - 1))}
                className="border border-[#CBD0E0] bg-white text-[#4A5170] rounded-[6px] px-2.5 py-1 text-xs cursor-pointer hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                &lsaquo; Prev
              </button>
              <button
                type="button"
                disabled={viewerIndex >= questionsList.length - 1 || isRecheckLoading}
                onClick={() => setViewerIndex(prev => Math.min(questionsList.length - 1, prev + 1))}
                className="border border-[#CBD0E0] bg-white text-[#4A5170] rounded-[6px] px-2.5 py-1 text-xs cursor-pointer hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next &rsaquo;
              </button>
            </div>
          </div>

          {/* Viewer Body */}
          {currentQ ? (
            <div className="p-4">
              <div className="text-[13.5px] text-[#1A1F30] mb-2.5 leading-relaxed">
                <strong className="font-bold">Q{currentQ.questionNumber}.</strong>{' '}
                <span
                  dangerouslySetInnerHTML={{
                    __html: currentQ.questionText || '<em>No question statement</em>',
                  }}
                />
              </div>
              <div className="bg-[#FAFBFE] border border-[#E1E4EE] rounded-[8px] p-3 text-[13px] text-[#4A5170] min-h-[64px] leading-relaxed whitespace-pre-wrap">
                {currentQ.answerText || <span className="italic text-slate-400">No written answer submitted for this question.</span>}
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-500 italic">
              {isRecheckLoading ? 'Loading questions...' : 'No question records found for this student coursework.'}
            </div>
          )}

          {/* Viewer Foot */}
          {currentQ && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#E1E4EE] text-[12.5px] bg-slate-50/50">
              <span className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Attachment:</span>
                {currentQ.cwFileId ? (
                  <button
                    type="button"
                    onClick={() => showToast(`Opening attachment S3 ID: ${currentQ.cwFileId}...`, 'info')}
                    className="text-[#28357D] font-semibold hover:underline bg-transparent border-none p-0 cursor-pointer flex items-center gap-1"
                  >
                    <i className="lni lni-paperclip"></i> cw_file_{currentQ.cwFileId}.pdf
                  </button>
                ) : (
                  <span className="text-slate-400 italic">None</span>
                )}
              </span>
              <span className="font-semibold text-[#1F7A54] font-mono">
                {currentQ.mark !== null
                  ? `Marked ${currentQ.mark}${currentQ.maxMark != null ? ` / ${currentQ.maxMark}` : ''}`
                  : `Pending Evaluation${currentQ.maxMark != null ? ` (Max: ${currentQ.maxMark})` : ''}`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Confirmation Modals ──────────────────────────────────────────── */}
      {confirmAction && (
        <div
          className="modal-overlay open"
          style={{ zIndex: 650 }}
        >
          <div
            className="modal modal-md flex flex-col"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 520 }}
          >
            <div className="modal-hdr modal-hdr-blue shrink-0">
              <div className="modal-title flex items-center gap-2">
                <i className="lni lni-shield text-base"></i>
                <span>
                  {confirmAction === 'delete' && 'Delete Coursework Submission'}
                  {confirmAction === 'reopen' && 'Reopen Coursework for Resubmission'}
                  {confirmAction === 'reevaluate' && 'Send Back for Re-evaluation'}
                </span>
              </div>
              <button
                type="button"
                className="modal-close"
                disabled={isMutating}
                onClick={() => setConfirmAction(null)}
              >
                <i className="lni lni-close"></i>
              </button>
            </div>

            <div className="modal-body p-5 flex flex-col gap-4 bg-slate-50 text-xs">
              <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2 text-slate-700 shadow-xs">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-semibold">Student:</span>
                  <strong className="text-slate-900">
                    {summary?.studentName || activeStudent?.studentName} (
                    {summary?.studentRegNo || activeStudent?.studentRegNo})
                  </strong>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-semibold">Course Unit:</span>
                  <span>{activeCourseUnit ? `${activeCourseUnit.courseUnitName} (${activeCourseUnit.courseUnitCode})` : '—'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-semibold">Attempt:</span>
                  <strong className="text-blue-700">{activeCoursework?.label || `CW ${courseworkNumber}`}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Current State:</span>
                  <strong className="font-semibold text-slate-800">
                    {STATUS_CONFIG[currentStatus].label}
                    {currentStatus === 'Evaluated' && summary?.mark != null && ` (${summary?.mark}${summary?.maxMark != null ? ` / ${summary.maxMark}` : ''})`}
                  </strong>
                </div>
              </div>

              {confirmAction === 'delete' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-900 text-xs leading-relaxed">
                  <strong>Warning:</strong> Soft-deletes unsubmitted answers (`T_IA_CW_QA`). This resets the student to <em>Not submitted</em> so they can restart with a fresh paper.
                </div>
              )}

              {confirmAction === 'reopen' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 text-xs leading-relaxed">
                  <strong>Resubmission Notice:</strong> Flips the submission state back to &ldquo;Saved&rdquo; (`IsSubmitted=false`). The student regains access to edit or replace their submitted files on the portal.
                </div>
              )}

              {confirmAction === 'reevaluate' && (
                <div className="space-y-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-900 text-xs leading-relaxed">
                    <strong>Re-evaluation Notice:</strong> Cancels the existing evaluation (`T_IA_EVALUATE.IsDeleted=true`). The submission reverts to <em>Submitted</em> and returns to the lecturer for re-marking.
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Reason for Re-evaluation (Optional note for audit)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Student score dispute or re-check request"
                      value={reEvalReason}
                      onChange={e => setReEvalReason(e.target.value)}
                      className="ctrl w-full text-xs"
                      disabled={isMutating}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-foot flex justify-end gap-2 p-3.5 bg-white border-t border-slate-200">
              <button
                type="button"
                className="btn btn-neu text-xs"
                disabled={isMutating}
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isMutating}
                onClick={handleConfirmAction}
                className={`text-xs px-4 py-2 rounded-lg font-semibold text-white shadow-sm transition-colors flex items-center gap-1.5 ${
                  confirmAction === 'delete'
                    ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
                    : confirmAction === 'reopen'
                    ? 'bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300'
                    : 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300'
                }`}
              >
                {isMutating && <i className="lni lni-reload animate-spin text-xs"></i>}
                <span>
                  {confirmAction === 'delete' && 'Confirm & Delete'}
                  {confirmAction === 'reopen' && 'Confirm & Reopen'}
                  {confirmAction === 'reevaluate' && 'Send to Evaluator'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  )
}
