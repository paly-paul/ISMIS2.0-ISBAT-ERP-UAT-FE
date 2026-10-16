'use client'

import { useEffect, useState } from 'react'
import {
  getBulkCwSchedulePreview,
  updateBulkCwSchedule,
  getBulkTestSchedulePreview,
  updateBulkTestSchedule,
  getBulkUeSchedulePreview,
  updateBulkUeSchedule,
  getBulkMockSchedulePreview,
  updateBulkMockSchedule,
} from '@/lib/api/assessment/iaBulkSchedule'
import { getExamRules, ExamRuleDto } from '@/lib/api/assessment/examRule'
import TimeRangePicker from '@/components/TimeRangePicker'

export type BulkAssessmentType = 'CW' | 'CLASS_TEST' | 'CA' | 'UE' | 'MOCK'

export interface BulkScheduleScope {
  intakeGuid: string
  intakeLabel: string
  term: number // 1 = Term 1, 2 = Term 2, 3 = Both
  campusGuid?: string | null
  campusName?: string | null
  programGuid?: string | null
  programName?: string | null
  programCode?: string | null
  semesterGuid?: string | null
  semesterCode?: string | null
  isBulkAll?: boolean
  isAlreadyScheduled?: boolean
}

interface BulkScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (updatedCount: number, message: string) => void
  scheduleType: BulkAssessmentType
  scope: BulkScheduleScope | null
}

const TYPE_CONFIG: Record<
  BulkAssessmentType,
  { title: string; badge: string; icon: string; defaultMaxMark: number }
> = {
  CW: {
    title: 'Coursework 1 (CW)',
    badge: 'CW',
    icon: 'lni-book',
    defaultMaxMark: 15,
  },
  CLASS_TEST: {
    title: 'Class Test (Mid-Semester)',
    badge: 'Class Test',
    icon: 'lni-timer',
    defaultMaxMark: 15,
  },
  CA: {
    title: 'Continuous Assessment (CA)',
    badge: 'CA',
    icon: 'lni-pencil-alt',
    defaultMaxMark: 15,
  },
  UE: {
    title: 'University Examination (UE)',
    badge: 'UE',
    icon: 'lni-graduation',
    defaultMaxMark: 70,
  },
  MOCK: {
    title: 'Mock (CBT)',
    badge: 'Mock',
    icon: 'lni-display-alt',
    defaultMaxMark: 0,
  },
}

function toLocalDatetimeInputString(isoOrDateStr: string | null | undefined): string {
  if (!isoOrDateStr) return ''
  try {
    const d = new Date(isoOrDateStr)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    const y = d.getFullYear()
    const m = pad(d.getMonth() + 1)
    const day = pad(d.getDate())
    const h = pad(d.getHours())
    const min = pad(d.getMinutes())
    return `${y}-${m}-${day}T${h}:${min}`
  } catch {
    return ''
  }
}

function toDateInputString(isoOrDateStr: string | null | undefined): string {
  if (!isoOrDateStr) return ''
  try {
    const d = new Date(isoOrDateStr)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  } catch {
    return ''
  }
}

export function BulkScheduleModal({
  isOpen,
  onClose,
  onSuccess,
  scheduleType,
  scope,
}: BulkScheduleModalProps) {
  const config = TYPE_CONFIG[scheduleType]

  // Pre-flight preview stats
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewStats, setPreviewStats] = useState<{
    matchCount: number
    scheduledCount: number
    unscheduledCount: number
  } | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Exam Rules
  const [examRules, setExamRules] = useState<ExamRuleDto[]>([])

  // Common Form States
  const [startDateTime, setStartDateTime] = useState('')
  const [endDateTime, setEndDateTime] = useState('')
  const [maxMark, setMaxMark] = useState<number>(config.defaultMaxMark)
  const [publishStatus, setPublishStatus] = useState<number>(0) // 0 = Unpublished, 1 = Published
  const [selectedExamRuleGuid, setSelectedExamRuleGuid] = useState<string>('')

  // Specific Form States
  const [assessmentTypeMode, setAssessmentTypeMode] = useState<number>(0) // 0 = Online, 1 = Offline
  const [durationMinutes, setDurationMinutes] = useState<number>(60)
  const [examDate, setExamDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('12:00')
  const [ueType, setUeType] = useState<number>(0) // 0 = Theory, 1 = Practical

  // Execution
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // 1. Fetch Exam Rules once
  useEffect(() => {
    if (!isOpen) return
    let active = true
    getExamRules(1, 50)
      .then(res => {
        if (active && res?.items) {
          setExamRules(res.items.filter(r => r.status === 2))
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [isOpen])

  // 2. Fetch Pre-flight Preview Stats whenever modal opens or scope changes
  useEffect(() => {
    if (!isOpen || !scope) return
    setIsPreviewLoading(true)
    setPreviewError(null)
    setSubmitError(null)

    // Set fallback default dates (e.g. tomorrow)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    const tomorrowEnd = new Date(tomorrow)
    tomorrowEnd.setHours(11, 0, 0, 0)

    setStartDateTime(toLocalDatetimeInputString(tomorrow.toISOString()))
    setEndDateTime(toLocalDatetimeInputString(tomorrowEnd.toISOString()))
    setExamDate(toDateInputString(tomorrow.toISOString()))
    setStartTime('09:00')
    setEndTime('12:00')
    setMaxMark(config.defaultMaxMark)
    setPublishStatus(0)
    setSelectedExamRuleGuid('')

    const baseParams = {
      academicIntakeGuid: scope.intakeGuid,
      campusGuid: scope.campusGuid || undefined,
      programGuid: scope.programGuid || undefined,
      semesterGuid: scope.semesterGuid || undefined,
    }

    if (scheduleType === 'CW') {
      getBulkCwSchedulePreview({ ...baseParams, cwNo: 1, term: scope.term })
        .then(res => {
          setPreviewStats({
            matchCount: res.matchCount,
            scheduledCount: res.scheduledCount,
            unscheduledCount: res.unscheduledCount,
          })
          if (res.scheduledStartDateTime) setStartDateTime(toLocalDatetimeInputString(res.scheduledStartDateTime))
          if (res.scheduledEndDateTime) setEndDateTime(toLocalDatetimeInputString(res.scheduledEndDateTime))
          if (res.maxMark != null) setMaxMark(Number(res.maxMark))
          if (res.courseworkType != null) setAssessmentTypeMode(res.courseworkType)
          if (res.publishStatus != null) setPublishStatus(res.publishStatus)
          if (res.examRuleGuid) setSelectedExamRuleGuid(res.examRuleGuid)
        })
        .catch(err => {
          setPreviewError(err?.message || 'Could not load CW preview. You may still set new schedule dates.')
        })
        .finally(() => setIsPreviewLoading(false))
    } else if (scheduleType === 'CA') {
      // CA forbids term param per spec
      getBulkCwSchedulePreview({ ...baseParams, cwNo: 2 })
        .then(res => {
          setPreviewStats({
            matchCount: res.matchCount,
            scheduledCount: res.scheduledCount,
            unscheduledCount: res.unscheduledCount,
          })
          if (res.scheduledStartDateTime) setStartDateTime(toLocalDatetimeInputString(res.scheduledStartDateTime))
          if (res.scheduledEndDateTime) setEndDateTime(toLocalDatetimeInputString(res.scheduledEndDateTime))
          if (res.maxMark != null) setMaxMark(Number(res.maxMark))
          if (res.courseworkType != null) setAssessmentTypeMode(res.courseworkType)
          if (res.publishStatus != null) setPublishStatus(res.publishStatus)
          if (res.examRuleGuid) setSelectedExamRuleGuid(res.examRuleGuid)
        })
        .catch(err => {
          setPreviewError(err?.message || 'Could not load CA preview. You may still set new schedule dates.')
        })
        .finally(() => setIsPreviewLoading(false))
    } else if (scheduleType === 'CLASS_TEST') {
      getBulkTestSchedulePreview({ ...baseParams, term: scope.term })
        .then(res => {
          setPreviewStats({
            matchCount: res.matchCount,
            scheduledCount: res.scheduledCount,
            unscheduledCount: res.unscheduledCount,
          })
          if (res.scheduledStartDateTime) setStartDateTime(toLocalDatetimeInputString(res.scheduledStartDateTime))
          if (res.scheduledEndDateTime) setEndDateTime(toLocalDatetimeInputString(res.scheduledEndDateTime))
          if (res.durationMinutes != null) setDurationMinutes(res.durationMinutes)
          if (res.maxMark != null) setMaxMark(Number(res.maxMark))
          if (res.testType != null) setAssessmentTypeMode(res.testType)
          if (res.publishStatus != null) setPublishStatus(res.publishStatus)
          if (res.examRuleGuid) setSelectedExamRuleGuid(res.examRuleGuid)
        })
        .catch(err => {
          setPreviewError(err?.message || 'Could not load Class Test preview. You may still set new schedule dates.')
        })
        .finally(() => setIsPreviewLoading(false))
    } else if (scheduleType === 'UE') {
      getBulkUeSchedulePreview({ ...baseParams, term: scope.term })
        .then(res => {
          setPreviewStats({
            matchCount: res.matchCount,
            scheduledCount: res.scheduledCount,
            unscheduledCount: res.unscheduledCount,
          })
          if (res.examDate) setExamDate(toDateInputString(res.examDate))
          if (res.startTime) setStartTime(res.startTime.slice(0, 5))
          if (res.endTime) setEndTime(res.endTime.slice(0, 5))
          if (res.maxMark != null) setMaxMark(Number(res.maxMark))
          if (res.examType != null) setAssessmentTypeMode(res.examType)
          if (res.universityExamType != null) setUeType(res.universityExamType)
          if (res.publishStatus != null) setPublishStatus(res.publishStatus)
          if (res.examRuleGuid) setSelectedExamRuleGuid(res.examRuleGuid)
        })
        .catch(err => {
          setPreviewError(err?.message || 'Could not load UE preview. You may still set new schedule dates.')
        })
        .finally(() => setIsPreviewLoading(false))
    } else if (scheduleType === 'MOCK') {
      getBulkMockSchedulePreview(baseParams)
        .then(res => {
          setPreviewStats({
            matchCount: res.matchCount,
            scheduledCount: res.scheduledCount,
            unscheduledCount: res.unscheduledCount,
          })
          if (res.scheduledStartDateTime) setStartDateTime(toLocalDatetimeInputString(res.scheduledStartDateTime))
          if (res.scheduledEndDateTime) setEndDateTime(toLocalDatetimeInputString(res.scheduledEndDateTime))
          if (res.durationMinutes != null) setDurationMinutes(res.durationMinutes)
          if (res.examRuleGuid) setSelectedExamRuleGuid(res.examRuleGuid)
        })
        .catch(err => {
          setPreviewError(err?.message || 'Could not load Mock preview. You may still set new schedule dates.')
        })
        .finally(() => setIsPreviewLoading(false))
    }
  }, [isOpen, scheduleType, scope, config.defaultMaxMark])

  const isEditMode = Boolean(
    scope?.isAlreadyScheduled || (previewStats && previewStats.scheduledCount > 0)
  )

  if (!isOpen || !scope) return null

  // 3. Handle Form Submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!scope) return

    setSubmitError(null)
    setPreviewError(null)

    // Validation
    if (scheduleType === 'UE') {
      if (!examDate) {
        setSubmitError('Exam date is required.')
        return
      }
      if (!startTime || !endTime) {
        setSubmitError('Start and end times are required.')
        return
      }
      if (startTime >= endTime) {
        setSubmitError('End time must be after start time.')
        return
      }
    } else {
      if (!startDateTime || !endDateTime) {
        setSubmitError('Scheduled start and end dates/times are required.')
        return
      }
      if (new Date(startDateTime) >= new Date(endDateTime)) {
        setSubmitError('Scheduled end date/time must be after start date/time.')
        return
      }
    }

      if (scheduleType !== 'MOCK' && maxMark < 0) {
      setSubmitError('Maximum mark cannot be negative.')
      return
    }

    setIsSubmitting(true)

    try {
      const baseParams = {
        academicIntakeGuid: scope.intakeGuid,
        campusGuid: scope.campusGuid || undefined,
        programGuid: scope.programGuid || undefined,
        semesterGuid: scope.semesterGuid || undefined,
      }

      let resMessage = 'Scheduled successfully.'
      let updatedCount = 1

      if (scheduleType === 'CW') {
        const res = await updateBulkCwSchedule(
          { ...baseParams, cwNo: 1, term: scope.term },
          {
            scheduledStartDateTime: new Date(startDateTime).toISOString(),
            scheduledEndDateTime: new Date(endDateTime).toISOString(),
            maxMark: Number(maxMark),
            courseworkType: assessmentTypeMode,
            publishStatus,
            examRuleGuid: selectedExamRuleGuid || null,
          }
        )
        updatedCount = res.data ?? 1
        resMessage = res.message || `${updatedCount} Coursework record(s) scheduled successfully.`
      } else if (scheduleType === 'CA') {
        const res = await updateBulkCwSchedule(
          { ...baseParams, cwNo: 2 },
          {
            scheduledStartDateTime: new Date(startDateTime).toISOString(),
            scheduledEndDateTime: new Date(endDateTime).toISOString(),
            maxMark: Number(maxMark),
            courseworkType: assessmentTypeMode,
            publishStatus,
            examRuleGuid: selectedExamRuleGuid || null,
          }
        )
        updatedCount = res.data ?? 1
        resMessage = res.message || `${updatedCount} Continuous Assessment record(s) scheduled successfully.`
      } else if (scheduleType === 'CLASS_TEST') {
        const res = await updateBulkTestSchedule(
          { ...baseParams, term: scope.term },
          {
            scheduledStartDateTime: new Date(startDateTime).toISOString(),
            scheduledEndDateTime: new Date(endDateTime).toISOString(),
            durationMinutes: Number(durationMinutes) || 60,
            maxMark: Number(maxMark),
            testType: assessmentTypeMode,
            publishStatus,
            examRuleGuid: selectedExamRuleGuid || null,
          }
        )
        updatedCount = res.data ?? 1
        resMessage = res.message || `${updatedCount} Class Test record(s) scheduled successfully.`
      } else if (scheduleType === 'UE') {
        const res = await updateBulkUeSchedule(
          { ...baseParams, term: scope.term },
          {
            examDate,
            startTime: startTime.length === 5 ? `${startTime}:00` : startTime,
            endTime: endTime.length === 5 ? `${endTime}:00` : endTime,
            maxMark: Number(maxMark),
            examType: assessmentTypeMode,
            universityExamType: ueType,
            publishStatus,
            examRuleGuid: selectedExamRuleGuid || null,
          }
        )
        updatedCount = res.data ?? 1
        resMessage = res.message || `${updatedCount} University Exam record(s) scheduled successfully.`
      } else if (scheduleType === 'MOCK') {
        const res = await updateBulkMockSchedule(
          baseParams,
          {
            scheduledStartDateTime: new Date(startDateTime).toISOString(),
            scheduledEndDateTime: new Date(endDateTime).toISOString(),
            durationMinutes: Number(durationMinutes) || 60,
            examRuleGuid: selectedExamRuleGuid || null,
          }
        )
        updatedCount = res.data ?? 1
        resMessage = res.message || `${updatedCount} Mock Exam record(s) scheduled successfully.`
      }

      onSuccess(updatedCount, resMessage)
      onClose()
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to update schedule. Please check inputs and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const termLabel = scope.term === 1 ? 'Term 1' : scope.term === 2 ? 'Term 2' : 'Both (Term 1 & 2)'

  return (
    <div className="modal-overlay open" style={{ zIndex: 650 }}>
      <div
        className="modal modal-md flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 580, maxHeight: '92vh' }}
      >
        {/* ── Modal Header ── */}
        <div className="modal-hdr modal-hdr-blue shrink-0 flex items-center justify-between">
          <div className="modal-title flex items-center gap-2">
            <i className={`lni ${config.icon} text-lg`}></i>
            <span>
              {scope.isBulkAll
                ? isEditMode
                  ? `Bulk Update: ${config.title}`
                  : `Bulk Schedule All: ${config.title}`
                : isEditMode
                ? `Update Schedule: ${config.title}`
                : `Schedule: ${config.title}`}
            </span>
            {isEditMode && (
              <span className="badge badge-amber text-[10px] font-semibold flex items-center gap-1">
                <i className="lni lni-pencil"></i> Editing
              </span>
            )}
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={isSubmitting}>
            <i className="lni lni-close"></i>
          </button>
        </div>

        {/* ── Modal Body ── */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="modal-body p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
            {/* Scope Information Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-slate-700">
              <div className="flex justify-between items-baseline border-b border-slate-200/60 pb-1">
                <span className="text-slate-500 font-medium">Academic Session:</span>
                <strong className="text-slate-900 font-semibold">{scope.intakeLabel}</strong>
              </div>
              <div className="flex justify-between items-baseline border-b border-slate-200/60 pb-1">
                <span className="text-slate-500 font-medium">Campus:</span>
                <span className="text-slate-800">{scope.campusName || 'All Registered Campuses'}</span>
              </div>
              {scheduleType !== 'CA' && scheduleType !== 'MOCK' && (
                <div className="flex justify-between items-baseline border-b border-slate-200/60 pb-1">
                  <span className="text-slate-500 font-medium">Academic Term:</span>
                  <span className="badge badge-purple text-[10.5px] font-semibold">{termLabel}</span>
                </div>
              )}
              {scope.isBulkAll ? (
                <div className="flex justify-between items-baseline pt-0.5">
                  <span className="text-slate-500 font-medium">Target Scope:</span>
                  <strong className="text-blue-700 font-semibold">
                    All Programmes &amp; Semesters in Session
                  </strong>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-baseline border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-medium">Programme:</span>
                    <strong className="text-blue-700 font-semibold">
                      {scope.programName} ({scope.programCode})
                    </strong>
                  </div>
                  <div className="flex justify-between items-baseline pt-0.5">
                    <span className="text-slate-500 font-medium">Semester:</span>
                    <strong className="text-slate-900 font-semibold">
                      Semester {scope.semesterCode}
                    </strong>
                  </div>
                </>
              )}
            </div>

            {/* Dry-Run Preview Statistics (Removed per user request) */}

            {previewError && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-800 text-[11px] flex items-center gap-1.5">
                <i className="lni lni-warning text-sm shrink-0"></i>
                <span>{previewError}</span>
              </div>
            )}

            {submitError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800 text-[11.5px] flex items-center gap-1.5">
                <i className="lni lni-cross-circle text-sm shrink-0"></i>
                <span>{submitError}</span>
              </div>
            )}

            {/* Form Fields: Non-UE (CW, CA, Class Test) */}
            {scheduleType !== 'UE' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Start Date &amp; Time <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                      value={startDateTime}
                      onChange={e => setStartDateTime(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      End Date &amp; Time <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                      value={endDateTime}
                      onChange={e => setEndDateTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(scheduleType === 'CLASS_TEST' || scheduleType === 'MOCK') ? (
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Duration (Minutes) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                        value={durationMinutes}
                        onChange={e => setDurationMinutes(Number(e.target.value))}
                        required
                      />
                    </div>
                  ) : null}

                  {scheduleType !== 'MOCK' && (
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Max Mark <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                        value={maxMark}
                        onChange={e => setMaxMark(Number(e.target.value))}
                        required
                      />
                    </div>
                  )}

                  {scheduleType !== 'MOCK' && (
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Mode</label>
                      <select
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                        value={assessmentTypeMode}
                        onChange={e => setAssessmentTypeMode(Number(e.target.value))}
                      >
                        <option value={0}>Online</option>
                        <option value={1}>Offline</option>
                      </select>
                    </div>
                  )}

                  {scheduleType !== 'MOCK' && (
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Publish Status</label>
                      <select
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                        value={publishStatus}
                        onChange={e => setPublishStatus(Number(e.target.value))}
                      >
                        <option value={0}>Unpublished (Draft)</option>
                        <option value={1}>Published</option>
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Exam Rule (Grading / Structure)
                  </label>
                  <select
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                    value={selectedExamRuleGuid}
                    onChange={e => setSelectedExamRuleGuid(e.target.value)}
                  >
                    <option value="">-- No Specific Exam Rule / Standard --</option>
                    {examRules.map(r => (
                      <option key={r.examRuleGuid} value={r.examRuleGuid}>
                        {r.ruleName || 'Unnamed'} {r.ruleCode ? `(${r.ruleCode})` : ''} — Total:{' '}
                        {r.totalMark}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Form Fields: UE (University Exam) */}
            {scheduleType === 'UE' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Exam Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                      value={examDate}
                      onChange={e => setExamDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <TimeRangePicker
                      start={startTime}
                      end={endTime}
                      onStartChange={setStartTime}
                      onEndChange={setEndTime}
                      required
                      labelClassName="block text-slate-700 font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Max Mark <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                      value={maxMark}
                      onChange={e => setMaxMark(Number(e.target.value))}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Exam Mode</label>
                    <select
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                      value={assessmentTypeMode}
                      onChange={e => setAssessmentTypeMode(Number(e.target.value))}
                    >
                      <option value={0}>Online</option>
                      <option value={1}>Offline</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Paper Type</label>
                    <select
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                      value={ueType}
                      onChange={e => setUeType(Number(e.target.value))}
                    >
                      <option value={0}>Theory</option>
                      <option value={1}>Practical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Publish Status</label>
                    <select
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                      value={publishStatus}
                      onChange={e => setPublishStatus(Number(e.target.value))}
                    >
                      <option value={0}>Unpublished</option>
                      <option value={1}>Published</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Exam Rule (Grading / Question Structure)
                  </label>
                  <select
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                    value={selectedExamRuleGuid}
                    onChange={e => setSelectedExamRuleGuid(e.target.value)}
                  >
                    <option value="">-- No Specific Exam Rule / Standard --</option>
                    {examRules.map(r => (
                      <option key={r.examRuleGuid} value={r.examRuleGuid}>
                        {r.ruleName || 'Unnamed'} {r.ruleCode ? `(${r.ruleCode})` : ''} — Total:{' '}
                        {r.totalMark}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* ── Modal Footer ── */}
          <div className="modal-foot flex justify-end gap-2 p-3.5 bg-slate-50 border-t border-slate-200">
            <button
              type="button"
              className="btn btn-neu text-xs"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary text-xs flex items-center gap-1.5"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <i className="lni lni-reload animate-spin"></i>
              ) : isEditMode ? (
                <i className="lni lni-reload"></i>
              ) : (
                <i className="lni lni-checkmark"></i>
              )}
              <span>
                {isSubmitting
                  ? isEditMode
                    ? 'Updating Schedule…'
                    : 'Saving Schedule…'
                  : isEditMode
                  ? 'Update Schedule'
                  : 'Execute & Save Schedule'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
