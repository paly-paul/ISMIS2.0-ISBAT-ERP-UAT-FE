'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ScrollTable } from '@/components/ScrollTable'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import { useCurrentAcademicIntake, useSearchIntakesInfinite } from '@/hooks/academic/useIntakes'
import { useSearchCampusesInfinite } from '@/hooks/config/useCampuses'
import { useSessions } from '@/hooks/academic/useSessionManagement'
import { SessionListItemDto } from '@/lib/api/academic/sessionManagement'
import { flattenUniquePages } from '@/lib/pagination'
import {
  BulkScheduleModal,
  BulkAssessmentType,
  BulkScheduleScope,
} from '@/components/modals/assessment/BulkScheduleModal'
import { getIaCreationInit, IaProgramDto } from '@/lib/api/assessment/iaCreation'
import {
  getBulkScheduleInit,
  getBulkCwScheduleStatus,
  getBulkTestScheduleStatus,
  getBulkUeScheduleStatus,
  getBulkMockScheduleStatus,
} from '@/lib/api/assessment/iaBulkSchedule'

const PAGE_SIZE = 15

export default function BulkExamSchedulerPage() {
  const queryClient = useQueryClient()

  // ── Toast State ─────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  // ── 1. Filters State ────────────────────────────────────────────────────────
  const [intakeGuid, setIntakeGuid] = useState('')
  const [campusGuid, setCampusGuid] = useState('')
  const [term, setTerm] = useState<number>(1) // 1 = Term 1, 2 = Term 2, 3 = Both
  const [page, setPage] = useState(1)

  // Autocomplete / Search filters
  const [intakeSearch, setIntakeSearch] = useState('')
  const [campusSearch, setCampusSearch] = useState('')
  const [committedIntakeSearch, setCommittedIntakeSearch] = useState('')
  const [committedCampusSearch, setCommittedCampusSearch] = useState('')
  const [intakePickerOpen, setIntakePickerOpen] = useState(false)
  const [campusPickerOpen, setCampusPickerOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setCommittedIntakeSearch(intakeSearch.trim()), 300)
    return () => clearTimeout(timer)
  }, [intakeSearch])

  useEffect(() => {
    const timer = setTimeout(() => setCommittedCampusSearch(campusSearch.trim()), 300)
    return () => clearTimeout(timer)
  }, [campusSearch])

  const intakeQuery = useSearchIntakesInfinite(committedIntakeSearch, 20, intakePickerOpen || !intakeGuid)
  const campusQuery = useSearchCampusesInfinite(committedCampusSearch, 20, campusPickerOpen)
  const { data: currentIntake } = useCurrentAcademicIntake()

  // Intakes list
  const intakes = useMemo(() => {
    const items = flattenUniquePages(intakeQuery.data?.pages ?? [], i => i.intakeGuid)
    if (currentIntake && !items.some(i => i.intakeGuid === currentIntake.intakeGuid)) {
      items.unshift(currentIntake)
    }
    return items
  }, [currentIntake, intakeQuery.data])

  // Campuses list
  const campuses = useMemo(
    () => flattenUniquePages(campusQuery.data?.pages ?? [], c => c.campusGuid),
    [campusQuery.data]
  )

  // Default to current intake on load
  useEffect(() => {
    if (intakeGuid) return
    if (currentIntake) {
      setIntakeGuid(currentIntake.intakeGuid)
    } else if (intakes.length > 0) {
      setIntakeGuid(intakes[0].intakeGuid)
    }
  }, [currentIntake, intakeGuid, intakes])

  // Reset page when intake or campus changes
  useEffect(() => setPage(1), [intakeGuid, campusGuid])

  // Current selected intake label
  const selectedIntake = intakes.find(i => i.intakeGuid === intakeGuid)
  const selectedIntakeLabel = selectedIntake
    ? `${selectedIntake.description} (${selectedIntake.intakeCode})`
    : 'Selected Academic Session'

  const selectedCampus = campuses.find(c => c.campusGuid === campusGuid)
  const selectedCampusLabel = selectedCampus ? selectedCampus.campusName : 'All Campuses'

  // ── 2. Programs Metadata for GUID resolution ────────────────────────────────
  const [allPrograms, setAllPrograms] = useState<IaProgramDto[]>([])
  useEffect(() => {
    getIaCreationInit()
      .then(res => setAllPrograms(res?.programs || []))
      .catch(() => { })
  }, [])

  // ── 3. Table Rows from Session Management API ───────────────────────────────
  const { data: sessionList, isLoading: isTableLoading } = useSessions(
    { intakeGuid, campusGuid: campusGuid || undefined, pageNumber: page, pageSize: PAGE_SIZE },
    !!intakeGuid
  )

  const serverRows = sessionList?.items ?? []
  const totalPages = sessionList?.totalPages ?? 1
  const totalCount = sessionList?.totalCount ?? serverRows.length

  // Local overrides map to instantly reflect scheduled status changes on client
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, Partial<Record<BulkAssessmentType, boolean>>>
  >({})

  // Clear overrides when intake or page changes
  useEffect(() => {
    setStatusOverrides({})
  }, [intakeGuid, campusGuid, page])

  // Call GET /api/v1/assessment/ia-bulk-cw-schedule/init on mount
  useEffect(() => {
    getBulkScheduleInit()
      .then(res => {
        if (res?.intakes?.length > 0 && !intakeGuid) {
          const current = res.intakes.find(i => i.currentIntake) || res.intakes[0]
          if (current) setIntakeGuid(current.intakeGuid)
        }
      })
      .catch(() => { })
  }, [intakeGuid])

  // Pre-fetch live status for visible rows using the dedicated status endpoints (ia-bulk-cw-schedule/status, ia-bulk-test-schedule/status, ia-bulk-ue-schedule/status)
  useEffect(() => {
    if (!intakeGuid || serverRows.length === 0) return
    let active = true

    serverRows.forEach(row => {
      const rawRow = row as any
      const matchedProg = allPrograms.find(
        p =>
          p.programCode?.toLowerCase() === row.programCode?.toLowerCase() ||
          p.programName?.toLowerCase() === row.programName?.toLowerCase()
      )
      const progGuid = rawRow.programGuid || matchedProg?.programGuid
      const semGuid = rawRow.semesterGuid

      if (!progGuid || !semGuid) return

      // CW1 Status (ia-bulk-cw-schedule/status?cwNo=1)
      getBulkCwScheduleStatus({
        academicIntakeGuid: intakeGuid,
        programGuid: progGuid,
        semesterGuid: semGuid,
        cwNo: 1,
      })
        .then(res => {
          if (active && res) {
            setStatusOverrides(prev => ({
              ...prev,
              [row.sessionGuid]: { ...(prev[row.sessionGuid] || {}), CW: res.isFullyScheduled },
            }))
          }
        })
        .catch(() => { })

      // CA Status (ia-bulk-cw-schedule/status?cwNo=2)
      getBulkCwScheduleStatus({
        academicIntakeGuid: intakeGuid,
        programGuid: progGuid,
        semesterGuid: semGuid,
        cwNo: 2,
      })
        .then(res => {
          if (active && res) {
            setStatusOverrides(prev => ({
              ...prev,
              [row.sessionGuid]: { ...(prev[row.sessionGuid] || {}), CA: res.isFullyScheduled },
            }))
          }
        })
        .catch(() => { })

      // Class Test Status (ia-bulk-test-schedule/status)
      getBulkTestScheduleStatus({
        academicIntakeGuid: intakeGuid,
        programGuid: progGuid,
        semesterGuid: semGuid,
      })
        .then(res => {
          if (active && res) {
            setStatusOverrides(prev => ({
              ...prev,
              [row.sessionGuid]: { ...(prev[row.sessionGuid] || {}), CLASS_TEST: res.isFullyScheduled },
            }))
          }
        })
        .catch(() => { })

      // UE Status (ia-bulk-ue-schedule/status)
      getBulkUeScheduleStatus({
        academicIntakeGuid: intakeGuid,
        programGuid: progGuid,
        semesterGuid: semGuid,
      })
        .then(res => {
          if (active && res) {
            setStatusOverrides(prev => ({
              ...prev,
              [row.sessionGuid]: { ...(prev[row.sessionGuid] || {}), UE: res.isFullyScheduled },
            }))
          }
        })
        .catch(() => { })

      // Mock Status (ia-bulk-mock-schedule/status)
      getBulkMockScheduleStatus({
        academicIntakeGuid: intakeGuid,
        programGuid: progGuid,
        semesterGuid: semGuid,
      })
        .then(res => {
          if (active && res) {
            setStatusOverrides(prev => ({
              ...prev,
              [row.sessionGuid]: { ...(prev[row.sessionGuid] || {}), MOCK: res.isFullyScheduled },
            }))
          }
        })
        .catch(() => { })
    })

    return () => {
      active = false
    }
  }, [intakeGuid, serverRows, allPrograms])

  // ── 4. Modal State ──────────────────────────────────────────────────────────
  const [activeModalType, setActiveModalType] = useState<BulkAssessmentType | null>(null)
  const [activeModalScope, setActiveModalScope] = useState<BulkScheduleScope | null>(null)

  // Helper to open bulk modal for a specific column (Header click)
  function handleOpenHeaderBulkSchedule(type: BulkAssessmentType) {
    if (!intakeGuid) {
      showToast('Please select an Academic Session first.', 'warn')
      return
    }
    const anyScheduled = serverRows.some(r => isCellScheduled(r, type))
    setActiveModalType(type)
    setActiveModalScope({
      intakeGuid,
      intakeLabel: selectedIntakeLabel,
      term,
      campusGuid: campusGuid || undefined,
      campusName: selectedCampusLabel,
      isBulkAll: true,
      isAlreadyScheduled: anyScheduled,
    })
  }

  // Helper to open bulk modal for a single row
  function handleOpenRowSchedule(row: SessionListItemDto, type: BulkAssessmentType) {
    if (!intakeGuid) return

    // Resolve programGuid from row or fallback lookup
    const rawRow = row as any
    const matchedProg = allPrograms.find(
      p =>
        p.programCode?.toLowerCase() === row.programCode?.toLowerCase() ||
        p.programName?.toLowerCase() === row.programName?.toLowerCase()
    )
    const resolvedProgramGuid = rawRow.programGuid || matchedProg?.programGuid || ''
    const resolvedSemesterGuid = rawRow.semesterGuid || ''
    const alreadyScheduled = isCellScheduled(row, type)

    setActiveModalType(type)
    setActiveModalScope({
      intakeGuid,
      intakeLabel: selectedIntakeLabel,
      term,
      campusGuid: campusGuid || undefined,
      campusName: selectedCampusLabel,
      programGuid: resolvedProgramGuid,
      programName: row.programName,
      programCode: row.programCode,
      semesterGuid: resolvedSemesterGuid,
      semesterCode: row.semesterCode,
      isBulkAll: false,
      isAlreadyScheduled: alreadyScheduled,
    })
  }

  // Success handler from modal
  function handleScheduleSuccess(updatedCount: number, message: string) {
    showToast(message, 'success')

    if (!activeModalType || !activeModalScope) return

    if (activeModalScope.isBulkAll) {
      // Mark all visible rows as scheduled for this type
      const newOverrides: Record<string, Partial<Record<BulkAssessmentType, boolean>>> = {}
      serverRows.forEach(r => {
        newOverrides[r.sessionGuid] = {
          ...(statusOverrides[r.sessionGuid] || {}),
          [activeModalType]: true,
        }
      })
      setStatusOverrides(prev => ({ ...prev, ...newOverrides }))
    } else if (activeModalScope.programCode && activeModalScope.semesterCode) {
      // Find matching row and mark as scheduled
      const targetRow = serverRows.find(
        r =>
          r.programCode === activeModalScope.programCode &&
          r.semesterCode === activeModalScope.semesterCode
      )
      if (targetRow) {
        setStatusOverrides(prev => ({
          ...prev,
          [targetRow.sessionGuid]: {
            ...(prev[targetRow.sessionGuid] || {}),
            [activeModalType]: true,
          },
        }))
      }
    }

    // Invalidate session management list in background
    queryClient.invalidateQueries({ queryKey: ['session-management'] })
  }

  // Helper to determine if a cell is scheduled
  function isCellScheduled(row: SessionListItemDto, type: BulkAssessmentType): boolean {
    const overridden = statusOverrides[row.sessionGuid]?.[type]
    if (overridden !== undefined) return overridden

    const status = row.schedulingStatus
    if (!status) return false

    switch (type) {
      case 'CW':
        return Boolean(status.cw1Scheduled)
      case 'CLASS_TEST':
        return Boolean(status.midScheduled)
      case 'CA':
        return Boolean(status.cw2Scheduled)
      case 'UE':
        return Boolean(status.ueScheduled)
      case 'MOCK':
        return false // Only populated via live override since session endpoint doesn't track it
      default:
        return false
    }
  }

  return (
    <>
      <div className="page active" id="page-bulk-exam-scheduler">
        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="pg-hdr flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
          <div>
            <div className="pg-title flex items-center gap-2">
              <span>Bulk Exam Scheduler</span>
              <span className="badge badge-purple text-[11px] font-semibold">Assessment Ops</span>
            </div>
            <div className="pg-sub text-xs text-slate-500">
              Schedule examinations in bulk or manage session-wise examination schedules
            </div>
          </div>
        </div>

        {/* ── Legacy Top Filters Bar (Matching Screenshot) ────────────────── */}
        <div className="bg-white border border-slate-200/80 rounded-lg p-4 mb-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* 1. Academic Session */}
            <div className="md:col-span-4 flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-700 shrink-0 w-32">
                Academic Session<span className="text-rose-600 font-bold">*</span>
              </label>
              <div className="flex-1 min-w-0">
                <SearchSelect
                  options={intakes.map(i => ({
                    value: i.intakeGuid,
                    label: `${i.description} (${i.intakeCode})`,
                  }))}
                  value={intakeGuid}
                  onSearch={setIntakeSearch}
                  onOpenChange={setIntakePickerOpen}
                  isLoading={intakeQuery.isLoading}
                  hasNextPage={intakeQuery.hasNextPage}
                  isFetchingNextPage={intakeQuery.isFetchingNextPage}
                  onLoadMore={() => intakeQuery.fetchNextPage()}
                  onChange={setIntakeGuid}
                  placeholder="Select Academic Session..."
                />
              </div>
            </div>

            {/* 2. Academic Term */}
            <div className="md:col-span-4 flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-700 shrink-0 w-14">Term</label>
              <div className="flex-1 min-w-0">
                <SearchSelect
                  options={[
                    { value: '1', label: 'Term 1' },
                    { value: '2', label: 'Term 2' },
                    { value: '3', label: 'Both (Term 1 & 2)' },
                  ]}
                  value={String(term)}
                  onChange={(val) => setTerm(Number(val))}
                  placeholder="Select Term"
                />
              </div>
            </div>

            {/* 3. Campus */}
            <div className="md:col-span-4 flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-700 shrink-0 w-16">Campus</label>
              <div className="flex-1 min-w-0">
                <SearchSelect
                  placeholder="All Campuses"
                  options={[
                    { value: '', label: 'All Campuses' },
                    ...campuses.map(c => ({
                      value: c.campusGuid,
                      label: c.campusName,
                    })),
                  ]}
                  value={campusGuid}
                  onSearch={setCampusSearch}
                  onOpenChange={setCampusPickerOpen}
                  isLoading={campusQuery.isLoading}
                  hasNextPage={campusQuery.hasNextPage}
                  isFetchingNextPage={campusQuery.isFetchingNextPage}
                  onLoadMore={() => campusQuery.fetchNextPage()}
                  onChange={setCampusGuid}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Main Legacy Table View (Matching Screenshot) ──────────────────── */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          {!intakeGuid ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <i className="lni lni-calendar text-2xl mb-2 block text-slate-300"></i>
              Please select an Academic Session above to load examination schedules.
            </div>
          ) : isTableLoading && serverRows.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
              <i className="lni lni-reload animate-spin text-base text-blue-600"></i>
              <span>Loading examination session schedules...</span>
            </div>
          ) : (
            <>
              <ScrollTable>
                <table className="w-full text-xs text-left border-collapse">
                  {/* ── Solid Blue Header (Exact match to screenshot) ── */}
                  <thead>
                    <tr className="bg-[#0066b2] text-white text-xs font-semibold border-b border-[#00528e]">
                      <th className="py-3 px-3 min-w-[120px] text-center border-r border-blue-400/30">
                        Admission Intake
                      </th>
                      <th className="py-3 px-4 min-w-[280px] text-center border-r border-blue-400/30">
                        Programme
                      </th>
                      <th className="py-3 px-3 w-20 text-center border-r border-blue-400/30">
                        Semester
                      </th>

                      {/* 1. Schedule All (CW) Header Trigger */}
                      <th className="py-2.5 px-2.5 min-w-[140px] text-center border-r border-blue-400/30">
                        <button
                          type="button"
                          onClick={() => handleOpenHeaderBulkSchedule('CW')}
                          className="w-full text-xs font-bold hover:underline hover:text-blue-100 flex items-center justify-center gap-1 focus:outline-none"
                          title="Click to schedule Coursework (CW1) for all programmes in this session"
                        >
                          <span>Schedule All (CW)</span>
                        </button>
                      </th>

                      {/* 2. Schedule All (Class Test) Header Trigger */}
                      <th className="py-2.5 px-2.5 min-w-[160px] text-center border-r border-blue-400/30">
                        <button
                          type="button"
                          onClick={() => handleOpenHeaderBulkSchedule('CLASS_TEST')}
                          className="w-full text-xs font-bold hover:underline hover:text-blue-100 flex items-center justify-center gap-1 focus:outline-none"
                          title="Click to schedule Class Test for all programmes in this session"
                        >
                          <span>Schedule All (Class Test)</span>
                        </button>
                      </th>

                      {/* 3. Schedule All (CA) Header Trigger */}
                      <th className="py-2.5 px-2.5 min-w-[140px] text-center border-r border-blue-400/30">
                        <button
                          type="button"
                          onClick={() => handleOpenHeaderBulkSchedule('CA')}
                          className="w-full text-xs font-bold hover:underline hover:text-blue-100 flex items-center justify-center gap-1 focus:outline-none"
                          title="Click to schedule Continuous Assessment (CA) for all programmes in this session"
                        >
                          <span>Schedule All (CA)</span>
                        </button>
                      </th>

                      {/* 4. Schedule All (UE) Header Trigger */}
                      <th className="py-2.5 px-2.5 min-w-[140px] text-center border-r border-blue-400/30">
                        <button
                          type="button"
                          onClick={() => handleOpenHeaderBulkSchedule('UE')}
                          className="w-full text-xs font-bold hover:underline hover:text-blue-100 flex items-center justify-center gap-1 focus:outline-none"
                          title="Click to schedule University Exam (UE) for all programmes in this session"
                        >
                          <span>Schedule All (UE)</span>
                        </button>
                      </th>

                      {/* 5. Schedule All (Mock) Header Trigger */}
                      <th className="py-2.5 px-2.5 min-w-[140px] text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenHeaderBulkSchedule('MOCK')}
                          className="w-full text-xs font-bold hover:underline hover:text-blue-100 flex items-center justify-center gap-1 focus:outline-none"
                          title="Click to schedule Mock Exam (CBT) for all programmes in this session"
                        >
                          <span>Schedule All (Mock)</span>
                        </button>
                      </th>
                    </tr>
                  </thead>

                  {/* ── Table Body ── */}
                  <tbody className="divide-y divide-slate-200/80 bg-white">
                    {isTableLoading ? (
                      <TableLoadingState colSpan={7} title="Loading schedules..." />
                    ) : serverRows.length === 0 ? (
                      <EmptyState
                        colSpan={7}
                        title="No programme sessions found"
                        subtitle="No programmes match the selected academic session and campus."
                      />
                    ) : (
                      serverRows.map((row, idx) => {
                        const cwScheduled = isCellScheduled(row, 'CW')
                        const testScheduled = isCellScheduled(row, 'CLASS_TEST')
                        const caScheduled = isCellScheduled(row, 'CA')
                        const ueScheduled = isCellScheduled(row, 'UE')
                        const mockScheduled = isCellScheduled(row, 'MOCK')

                        return (
                          <tr
                            key={row.sessionGuid || `row-${idx}`}
                            className="hover:bg-slate-50/70 transition-colors"
                          >
                            {/* Admission Intake */}
                            <td className="py-2 px-3 text-slate-700 font-medium text-center border-r border-slate-100">
                              {row.intakeText || selectedIntakeLabel}
                            </td>

                            {/* Programme Name & Code */}
                            <td className="py-2 px-4 text-slate-800 border-r border-slate-100">
                              <span className="font-semibold text-slate-900">{row.programName}</span>{' '}
                              {row.programCode && (
                                <span className="text-slate-500 font-mono text-[11px]">
                                  ({row.programCode})
                                </span>
                              )}
                            </td>

                            {/* Semester */}
                            <td className="py-2 px-3 text-center font-bold text-slate-800 border-r border-slate-100">
                              {row.semesterCode}
                            </td>

                            {/* 1. CW Button */}
                            <td className="py-2 px-2.5 text-center border-r border-slate-100">
                              <button
                                type="button"
                                onClick={() => handleOpenRowSchedule(row, 'CW')}
                                className={`w-full py-1 px-2.5 rounded text-[11px] font-semibold transition-all focus:outline-none shadow-xs ${cwScheduled
                                    ? 'bg-[#0284c7] hover:bg-[#0369a1] text-white'
                                    : 'bg-[#0a2540] hover:bg-[#1e3a8a] text-white'
                                  }`}
                              >
                                {cwScheduled ? 'Scheduled' : 'Schedule'}
                              </button>
                            </td>

                            {/* 2. Class Test Button */}
                            <td className="py-2 px-2.5 text-center border-r border-slate-100">
                              <button
                                type="button"
                                onClick={() => handleOpenRowSchedule(row, 'CLASS_TEST')}
                                className={`w-full py-1 px-2.5 rounded text-[11px] font-semibold transition-all focus:outline-none shadow-xs ${testScheduled
                                    ? 'bg-[#0284c7] hover:bg-[#0369a1] text-white'
                                    : 'bg-[#0a2540] hover:bg-[#1e3a8a] text-white'
                                  }`}
                              >
                                {testScheduled ? 'Scheduled' : 'Schedule'}
                              </button>
                            </td>

                            {/* 3. CA Button */}
                            <td className="py-2 px-2.5 text-center border-r border-slate-100">
                              <button
                                type="button"
                                onClick={() => handleOpenRowSchedule(row, 'CA')}
                                className={`w-full py-1 px-2.5 rounded text-[11px] font-semibold transition-all focus:outline-none shadow-xs ${caScheduled
                                    ? 'bg-[#0284c7] hover:bg-[#0369a1] text-white'
                                    : 'bg-[#0a2540] hover:bg-[#1e3a8a] text-white'
                                  }`}
                              >
                                {caScheduled ? 'Scheduled' : 'Schedule'}
                              </button>
                            </td>

                            {/* 4. UE Button */}
                            <td className="py-2 px-2.5 text-center border-r border-slate-100">
                              <button
                                type="button"
                                onClick={() => handleOpenRowSchedule(row, 'UE')}
                                className={`w-full py-1 px-2.5 rounded text-[11px] font-semibold transition-all focus:outline-none shadow-xs ${ueScheduled
                                    ? 'bg-[#0284c7] hover:bg-[#0369a1] text-white'
                                    : 'bg-[#0a2540] hover:bg-[#1e3a8a] text-white'
                                  }`}
                              >
                                {ueScheduled ? 'Scheduled' : 'Schedule'}
                              </button>
                            </td>

                            {/* 5. Mock Button */}
                            <td className="py-2 px-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleOpenRowSchedule(row, 'MOCK')}
                                className={`w-full py-1 px-2.5 rounded text-[11px] font-semibold transition-all focus:outline-none shadow-xs ${mockScheduled
                                    ? 'bg-[#0284c7] hover:bg-[#0369a1] text-white'
                                    : 'bg-[#0a2540] hover:bg-[#1e3a8a] text-white'
                                  }`}
                              >
                                {mockScheduled ? 'Scheduled' : 'Schedule'}
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </ScrollTable>

              {/* Pagination */}
              {serverRows.length > 0 && (
                <div className="border-t border-slate-200 px-4 py-2 bg-slate-50/50">
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    itemLabel="programme sessions"
                    onPageChange={setPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Unified Bulk Schedule Modal ──────────────────────────────────────── */}
      {activeModalType && activeModalScope && (
        <BulkScheduleModal
          isOpen={Boolean(activeModalType)}
          onClose={() => {
            setActiveModalType(null)
            setActiveModalScope(null)
          }}
          onSuccess={handleScheduleSuccess}
          scheduleType={activeModalType}
          scope={activeModalScope}
        />
      )}

      {/* ── Toast Notification ──────────────────────────────────────────────── */}
      <Toast toast={toast} />
    </>
  )
}
