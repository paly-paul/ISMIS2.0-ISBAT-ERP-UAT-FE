'use client'

import { useState, useMemo, useEffect } from 'react'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import { useIntakes } from '@/hooks/academic/useIntakes'
import {
  useUePracticalPrintPrograms as useUeProjectPrintPrograms,
  useUePracticalPrintSemesters as useUeProjectPrintSemesters,
  useUePracticalProgramUnits as useUeProjectProgramUnits,
} from '@/hooks/assessment/useUePracticalPrint'

export default function UniversityExamProjectBookletPrintPage() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)

  const showToast = (msg: string, type = '') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Dropdown States
  const [selectedIntakeGuid, setSelectedIntakeGuid] = useState<string>('')
  const [selectedProgramGuid, setSelectedProgramGuid] = useState<string>('')
  const [selectedSemesterGuid, setSelectedSemesterGuid] = useState<string>('')
  const [selectedCourseUnitGuid, setSelectedCourseUnitGuid] = useState<string>('')

  // Data Hooks
  const { data: intakes, isLoading: intakesLoading } = useIntakes()
  const { data: programs, isLoading: programsLoading } = useUeProjectPrintPrograms()
  const { data: semesters, isLoading: semLoading } = useUeProjectPrintSemesters(selectedProgramGuid || null)
  const { data: allProgramUnits, isLoading: unitsLoading } = useUeProjectProgramUnits(selectedProgramGuid || null)

  // Pre-select current intake
  useEffect(() => {
    if (intakes && !selectedIntakeGuid) {
      const current = intakes.find(i => i.currentIntake)
      if (current) setSelectedIntakeGuid(current.intakeGuid)
    }
  }, [intakes, selectedIntakeGuid])

  // Filter Project units for the selected semester
  const courseUnits = useMemo(() => {
    if (!allProgramUnits || !selectedSemesterGuid) return []
    return allProgramUnits.filter((u: any) => u.semesterGuid === selectedSemesterGuid && u.unitTypeName === 'Project')
  }, [allProgramUnits, selectedSemesterGuid])

  const handleProgramChange = (guid: string) => {
    setSelectedProgramGuid(guid)
    setSelectedSemesterGuid('')
    setSelectedCourseUnitGuid('')
  }
  const handleSemesterChange = (guid: string) => {
    setSelectedSemesterGuid(guid)
    setSelectedCourseUnitGuid('')
  }
  const handleRefresh = () => {
    setSelectedProgramGuid('')
    setSelectedSemesterGuid('')
    setSelectedCourseUnitGuid('')
  }

  return (
    <div className="page active">
      <div className="pg-hdr flex justify-between items-end">
        <div>
          <h1 className="pg-title">University Exam Project Booklet Print</h1>
          <p className="pg-sub">Generate and print exam booklets for Project course units</p>
        </div>
        <button className="btn btn-neu" onClick={handleRefresh}>
          <i className="lni lni-reload"></i> Refresh
        </button>
      </div>

      <div className="card mb-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5">
          <div className="fg mb-0">
            <label className="lbl">Academic Intake <span className="text-red-500">*</span></label>
            <SearchSelect
              placeholder="— Select Intake —"
              value={selectedIntakeGuid}
              onChange={setSelectedIntakeGuid}
              disabled={intakesLoading}
              options={(() => {
                const current = (intakes ?? []).filter(i => i.currentIntake)
                const list = current.length > 0 ? current : (intakes && intakes.length > 0 ? [intakes[0]] : [])
                return list.map(i => ({
                  value: i.intakeGuid,
                  label: `${i.description || i.intakeCode} (Current)`,
                }))
              })()}
            />
          </div>
          <div className="fg mb-0">
            <label className="lbl">Programme <span className="text-red-500">*</span></label>
            <SearchSelect
              placeholder="— Select Programme —"
              value={selectedProgramGuid}
              onChange={handleProgramChange}
              disabled={programsLoading}
              options={(programs ?? []).map((p: any) => ({
                value: p.programGuid,
                label: p.programName,
              }))}
            />
          </div>
          <div className="fg mb-0">
            <label className="lbl">Semester <span className="text-red-500">*</span></label>
            <SearchSelect
              placeholder="— Select Semester —"
              value={selectedSemesterGuid}
              onChange={handleSemesterChange}
              disabled={!selectedProgramGuid || semLoading}
              options={(semesters ?? []).map((s: any) => ({
                value: s.semesterGuid,
                label: s.semName,
              }))}
            />
          </div>
          <div className="fg mb-0">
            <label className="lbl">Course Unit (Project) <span className="text-red-500">*</span></label>
            <SearchSelect
              placeholder="— Select Project Unit —"
              value={selectedCourseUnitGuid}
              onChange={setSelectedCourseUnitGuid}
              disabled={!selectedSemesterGuid || unitsLoading}
              options={courseUnits.map((u: any) => ({
                value: u.courseUnitGuid,
                label: `${u.courseUnitCode} - ${u.courseUnitName}`,
              }))}
            />
          </div>
        </div>

        <div className="p-5 pt-0 mt-4 grid grid-cols-1 gap-6">
          {/* Booklet Card */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-sm opacity-70 max-w-4xl mx-auto w-full">
            <div className="bg-gray-100 px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center">
                  <i className="lni lni-book"></i>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-700 text-sm m-0">Project Booklet & Registers</h3>
                  <p className="text-xs text-gray-500 m-0">Not supported for project units yet (Backend pending)</p>
                </div>
              </div>
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded font-semibold uppercase">Coming Soon</span>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-3">
              <button className="flex flex-col items-center justify-center p-4 border rounded-xl gap-2 text-sm font-medium opacity-50 cursor-not-allowed bg-gray-50 border-gray-100" disabled title="Not yet supported for project exams">
                <i className="lni lni-printer text-3xl text-gray-400"></i>
                Print Booklet
              </button>
              <button className="flex flex-col items-center justify-center p-4 border rounded-xl gap-2 text-sm font-medium opacity-50 cursor-not-allowed bg-gray-50 border-gray-100" disabled title="Not yet supported for project exams">
                <i className="lni lni-empty-file text-3xl text-gray-400"></i>
                Booklet PDF
              </button>
              <button className="flex flex-col items-center justify-center p-4 border rounded-xl gap-2 text-sm font-medium opacity-50 cursor-not-allowed bg-gray-50 border-gray-100" disabled title="Not yet supported for project exams">
                <i className="lni lni-users text-3xl text-gray-400"></i>
                Attendance
              </button>
              <button className="flex flex-col items-center justify-center p-4 border rounded-xl gap-2 text-sm font-medium opacity-50 cursor-not-allowed bg-gray-50 border-gray-100" disabled title="Not yet supported for project exams">
                <i className="lni lni-envelope text-3xl text-gray-400"></i>
                Cover Letter
              </button>
              <button className="flex flex-col items-center justify-center p-4 border rounded-xl gap-2 text-sm font-medium opacity-50 cursor-not-allowed bg-gray-50 border-gray-100" disabled title="Not yet supported for project exams">
                <i className="lni lni-list text-3xl text-gray-400"></i>
                Mark Sheet
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <Toast toast={toast} />
    </div>
  )
}
