'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { SearchSelect } from '@/components/SearchSelect'
import { ActionMenu } from '@/components/ActionMenu'
import { IaStructureViewModal } from './_components/IaStructureViewModal'
import { CwScheduleModal } from './_components/CwScheduleModal'
import { CbtScheduleModal } from './_components/CbtScheduleModal'
import { UeScheduleModal } from './_components/UeScheduleModal'
import { type IaStructureRowDto } from '@/lib/api/assessment/iaCreation'
import {
  useIaCreationInit,
  useIaCreationSemesters,
  useIaCreationStructure,
  useCreateIaStructure,
} from '@/hooks/assessment/useIaCreation'

function formatDateRange(start: string | null, end: string | null) {
  if (!start) return null
  const s = new Date(start)
  const formatPart = (d: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    let h = d.getHours()
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12; h = h ? h : 12;
    const m = d.getMinutes().toString().padStart(2, '0')
    return `${months[d.getMonth()]} ${d.getDate()} ${d.getFullYear()} ${h}:${m}${ampm}`
  }
  
  const startStr = formatPart(s)
  if (!end) return startStr
  const e = new Date(end)
  return `${startStr} - ${formatPart(e)}`
}

function formatDate(dateString: string | null) {
  if (!dateString) return <span className="text-g300">—</span>
  return <span>{new Date(dateString).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: '2-digit' })}</span>
}

export default function IaCreationPage() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)

  // ── Selections ──────────────────────────────────
  const [selectedIntakeGuid, setSelectedIntakeGuid] = useState<string>('')
  const [selectedProgramGuid, setSelectedProgramGuid] = useState<string>('')
  const [selectedSemesterGuid, setSelectedSemesterGuid] = useState<string>('')

  // ── Modal State ─────────────────────────────────
  const [viewingRow, setViewingRow] = useState<IaStructureRowDto | null>(null)
  const [selectedCwGuid, setSelectedCwGuid] = useState<string | null>(null)
  const [selectedCbtData, setSelectedCbtData] = useState<{ testGuid: string, unitCode: string, unitName: string } | null>(null)
  const [selectedUeData, setSelectedUeData] = useState<{ examGuid: string, unitCode: string, unitName: string } | null>(null)

  // ── Data fetching ─────────────────────────────────
  const { data: initData, isLoading: initLoading } = useIaCreationInit()
  const { data: semesters, isLoading: semLoading } = useIaCreationSemesters(selectedProgramGuid || null)
  const {
    data: structureRows,
    isLoading: structureLoading,
    error: structureError,
    refetch: refetchStructure,
  } = useIaCreationStructure(
    selectedProgramGuid || null,
    selectedSemesterGuid || null,
    selectedIntakeGuid || null
  )
  const createMut = useCreateIaStructure()



  function showToast(msg: string, type = '') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function handleProgramChange(guid: string) {
    setSelectedProgramGuid(guid)
    setSelectedSemesterGuid('')
  }

  function handleRefresh() {
    if (!selectedProgramGuid || !selectedSemesterGuid || !selectedIntakeGuid) {
      showToast('Please select Programme, Semester, and Academic Session first.', 'error')
      return
    }
    refetchStructure()
  }

  async function handleCreate() {
    if (!selectedProgramGuid || !selectedSemesterGuid || !selectedIntakeGuid) {
      showToast('Please select Programme, Semester, and Academic Session first.', 'error')
      return
    }
    try {
      await createMut.mutateAsync({
        programGuid: selectedProgramGuid,
        semesterGuid: selectedSemesterGuid,
        intakeGuid: selectedIntakeGuid,
      })
      refetchStructure()
      showToast('IA Structure created successfully.', 'success')
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status
      if (status === 409) {
        showToast('IA Structure already exists for this combination.', '')
      } else {
        showToast(err.message || 'Failed to create IA Structure.', 'error')
      }
    }
  }

  const canRefresh = !!selectedProgramGuid && !!selectedSemesterGuid && !!selectedIntakeGuid
  const is404 = (structureError as any)?.status === 404

  return (
    <div id="page-ia-creation">
      {/* ── Page Header ── */}
      <div className="pg-hdr">
        <div>
          <h1 className="text-xl font-semibold text-g900">Assessment Structure</h1>
          <p className="text-sm text-g500 mt-0.5">
            Create Internal Assessment skeleton for Course Work, Class Test and University Exam
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            className="btn btn-neu flex-1 sm:flex-none justify-center"
            onClick={handleRefresh}
            disabled={!canRefresh || structureLoading}
          >
            <i className="lni lni-reload" />
            {structureLoading ? 'Loading…' : 'Refresh'}
          </button>
          <button
            className="btn btn-primary flex-1 sm:flex-none justify-center whitespace-nowrap"
            onClick={handleCreate}
            disabled={!canRefresh || createMut.isPending}
          >
            <i className="lni lni-plus" />
            {createMut.isPending ? 'Creating…' : 'Create Structure'}
          </button>
        </div>
      </div>

      {/* ── Filters Card ── */}
      <div className="card mb-4">
        <h2 className="text-base font-semibold text-g800 mb-4">Select Combination</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Academic Session */}
          <div className="fg mb-0">
            <label className="lbl">Academic Session</label>
            <SearchSelect
              placeholder="— Select Session —"
              value={selectedIntakeGuid}
              onChange={val => setSelectedIntakeGuid(val)}
              disabled={initLoading}
              options={(initData?.intakes ?? [])
                .filter(i => i.currentIntake)
                .map(i => ({
                  value: i.intakeGuid,
                  label: `${i.description ?? `Intake ${i.intakeCode}`} (Current)`,
              }))}
            />
          </div>

          {/* Programme */}
          <div className="fg mb-0">
            <label className="lbl">Programme</label>
            <SearchSelect
              placeholder="— Select Programme —"
              value={selectedProgramGuid}
              onChange={val => handleProgramChange(val)}
              disabled={initLoading}
              options={(initData?.programs ?? []).map(p => ({
                value: p.programGuid,
                label: `${p.programCode} — ${p.programName}`,
              }))}
            />
          </div>

          {/* Semester */}
          <div className="fg mb-0">
            <label className="lbl">Semester</label>
            <SearchSelect
              placeholder={!selectedProgramGuid ? '— Select Programme first —' : '— Select Semester —'}
              value={selectedSemesterGuid}
              onChange={val => setSelectedSemesterGuid(val)}
              disabled={!selectedProgramGuid || semLoading}
              options={(semesters ?? []).map(s => ({
                value: s.semesterGuid,
                label: s.semName,
              }))}
            />
          </div>
        </div>
      </div>

      {/* ── Structure Grid ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-base font-semibold text-g800">IA Structure</h2>
            <p className="text-xs text-g400 mt-0.5">
              {structureRows ? `${structureRows.length} unit(s) in this combination` : 'Select all filters and click Refresh'}
            </p>
          </div>
        </div>

        {/* 404 — no session mapping */}
        {is404 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <i className="lni lni-warning text-3xl text-amber-400" />
            <div className="text-sm font-semibold text-g700 mt-2">No Session Mapping Found</div>
            <div className="text-xs text-g500 max-w-sm">
              No session mapping is configured for this Programme / Semester / Intake combination. Please contact Academic Affairs.
            </div>
          </div>
        )}

        {/* Table */}
        {!is404 && (
          <ScrollTable>
            <table>
              {canRefresh && structureRows && structureRows.length > 0 && (
                <thead>
                  <tr className="bg-[#001f5c] text-white text-center text-sm">
                    <th className="w-12 text-center py-3 px-2 border-r border-white/20"></th>
                    <th className="py-3 px-4 font-semibold border-r border-white/20 text-left">Unit Code</th>
                    <th className="py-3 px-4 font-semibold border-r border-white/20 text-left">Unit Name</th>
                    <th className="py-3 px-4 font-semibold border-r border-white/20 text-left">Class Test</th>
                    <th className="py-3 px-4 font-semibold border-r border-white/20 text-left">Course Work</th>
                    <th className="py-3 px-4 font-semibold text-left">University Exam</th>
                  </tr>
                </thead>
              )}
              <tbody>
                {structureLoading ? (
                  <TableLoadingState colSpan={12} />
                ) : !canRefresh ? (
                  <tr>
                    <td colSpan={12}>
                      <div className="flex flex-col items-center justify-center py-10 gap-2 text-center text-g400">
                        <i className="lni lni-pointer text-2xl" />
                        <span className="text-sm">Select Programme, Semester &amp; Session to view structure</span>
                      </div>
                    </td>
                  </tr>
                ) : structureRows?.length === 0 ? (
                  <EmptyState
                    colSpan={6}
                    hasFilters={false}
                    onClearFilters={() => { }}
                    subtitle="No structure created yet. Click Create Structure to generate it."
                  />
                ) : (
                  structureRows?.map((row, idx) => (
                    <tr key={row.internalAssessmentGuid} className={`text-[13px] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#e7f1f9]'}`}>
                      <td className="text-center">
                        <ActionMenu>
                          <button
                            className="btn btn-neu btn-sm flex items-center justify-start gap-1.5 w-full"
                            onClick={() => setViewingRow(row)}
                          >
                            <i className="lni lni-eye" /> View
                          </button>
                        </ActionMenu>
                      </td>
                      <td className="font-mono text-sm border-r border-slate-200 px-4 py-3">{row.unitCode ?? '—'}</td>
                      <td className="font-medium border-r border-slate-200 px-4 py-3">{row.unitName ?? '—'}</td>

                      {/* Class Test */}
                      <td className="border-r border-slate-200 px-4 py-3 text-left">
                        {row.classTestGuid ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Max mark removed as requested */}
                            {row.classTestStartDateTime ? (
                              <span className="text-g900 font-medium text-[11px] leading-tight">
                                {formatDateRange(row.classTestStartDateTime, row.classTestEndDateTime)}
                              </span>
                            ) : (
                              <button
                                onClick={() => setSelectedCbtData({ testGuid: row.classTestGuid!, unitCode: row.unitCode ?? '', unitName: row.unitName ?? '' })}
                                className="text-[#3a6bc9] hover:underline"
                              >
                                Add Class Test
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-g400 text-xs">—</span>
                        )}
                      </td>

                      {/* Course Work */}
                      <td className="border-r border-slate-200 px-4 py-3 text-left">
                        {row.courseworkGuid ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Max mark removed as requested */}
                            {row.courseworkStartDateTime ? (
                              <span className="text-g900 font-medium text-[11px] leading-tight">
                                {formatDateRange(row.courseworkStartDateTime, row.courseworkEndDateTime)}
                              </span>
                            ) : (
                              <button
                                onClick={() => setSelectedCwGuid(row.courseworkGuid)}
                                className="text-[#3a6bc9] hover:underline"
                              >
                                Add Course work
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-g400 text-xs">—</span>
                        )}
                      </td>

                      {/* Uni. Exam */}
                      <td className="px-4 py-3 text-left">
                        {row.universityExamGuid ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Max mark removed as requested */}
                            {row.examDate && row.examStartTime ? (
                              <span className="text-g900 font-medium text-[11px] leading-tight" style={{ cursor: 'pointer', borderBottom: '1px dashed #9ca3af' }} onClick={() => setSelectedUeData({ examGuid: row.universityExamGuid!, unitCode: row.unitCode ?? '', unitName: row.unitName ?? '' })}>
                                {formatDateRange(`${row.examDate.split('T')[0]}T${row.examStartTime}`, row.examEndTime ? `${row.examDate.split('T')[0]}T${row.examEndTime}` : null)}
                              </span>
                            ) : (
                              <button onClick={() => setSelectedUeData({ examGuid: row.universityExamGuid!, unitCode: row.unitCode ?? '', unitName: row.unitName ?? '' })} className="text-[#3a6bc9] hover:underline">Add University Exam</button>
                            )}
                          </div>
                        ) : (
                          <span className="text-g400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollTable>
        )}
      </div>

      <Toast toast={toast} />

      {viewingRow && (
        <IaStructureViewModal
          row={viewingRow}
          progName={initData?.programs.find(p => p.programGuid === selectedProgramGuid)?.programName || ''}
          semName={semesters?.find(s => s.semesterGuid === selectedSemesterGuid)?.semName || ''}
          onClose={() => setViewingRow(null)}
          onEditCw={(guid) => setSelectedCwGuid(guid)}
          onEditCt={(guid) => setSelectedCbtData({
            testGuid: guid,
            unitCode: viewingRow.unitCode ?? '',
            unitName: viewingRow.unitName ?? ''
          })}
          onEditUe={(guid) => setSelectedUeData({
            examGuid: guid,
            unitCode: viewingRow.unitCode ?? '',
            unitName: viewingRow.unitName ?? ''
          })}
        />
      )}

      <CwScheduleModal
        isOpen={!!selectedCwGuid}
        onClose={() => setSelectedCwGuid(null)}
        courseworkGuid={selectedCwGuid}
      />

      <CbtScheduleModal
        isOpen={!!selectedCbtData}
        onClose={() => setSelectedCbtData(null)}
        testGuid={selectedCbtData?.testGuid || null}
        unitCode={selectedCbtData?.unitCode || ''}
        unitName={selectedCbtData?.unitName || ''}
      />

      <UeScheduleModal
        isOpen={!!selectedUeData}
        onClose={() => setSelectedUeData(null)}
        examGuid={selectedUeData?.examGuid || null}
        unitCode={selectedUeData?.unitCode || ''}
        unitName={selectedUeData?.unitName || ''}
      />
    </div>
  )
}
