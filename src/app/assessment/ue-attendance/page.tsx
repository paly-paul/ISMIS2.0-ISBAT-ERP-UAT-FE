'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SearchSelect } from '@/components/SearchSelect'
import { TableSearch } from '@/components/TableSearch'
import { ScrollTable } from '@/components/ScrollTable'
import { TableLoadingState } from '@/components/TableLoadingState'
import { EmptyState } from '@/components/EmptyState'
import { ActionMenu } from '@/components/ActionMenu'
import { Toast } from '@/components/Toast'
import { 
  getUeAttendanceInit, 
  getUeAttendanceSemesters, 
  getUeAttendanceUnits, 
  getUeAttendanceSchedule, 
  getUeAttendanceStudents, 
  saveUeAttendance 
} from '@/lib/api/assessment/ueAttendance'

export default function UeAttendancePage() {
  const queryClient = useQueryClient()
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Form State
  const [programGuid, setProgramGuid] = useState('')
  const [intakeGuid, setIntakeGuid] = useState('')
  const [semesterGuid, setSemesterGuid] = useState('')
  const [unitGuid, setUnitGuid] = useState('')
  const [ueTypeManual, setUeTypeManual] = useState<string>('0')

  // Search State
  const [searchTerm, setSearchTerm] = useState('')

  // Modal State
  const [confirmStudent, setConfirmStudent] = useState<{ studentGuid: string, name: string, isPresent: boolean } | null>(null)

  // Local Attendance State (editable)
  const [attendanceState, setAttendanceState] = useState<Record<string, boolean>>({})

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // 1. Init
  const { data: initData, isLoading: loadingInit } = useQuery({
    queryKey: ['ueAttendanceInit'],
    queryFn: getUeAttendanceInit
  })

  // Auto-select current intake
  useEffect(() => {
    if (initData?.intakes && !intakeGuid) {
      const curr = initData.intakes.find(i => i.currentIntake)
      if (curr) setIntakeGuid(curr.intakeGuid)
    }
  }, [initData, intakeGuid])

  // 2. Semesters
  const { data: semesters, isLoading: loadingSemesters } = useQuery({
    queryKey: ['ueAttendanceSemesters', programGuid, intakeGuid],
    queryFn: () => getUeAttendanceSemesters(programGuid, intakeGuid),
    enabled: !!programGuid
  })

  // 3. Units
  const { data: units, isLoading: loadingUnits } = useQuery({
    queryKey: ['ueAttendanceUnits', programGuid, semesterGuid],
    queryFn: () => getUeAttendanceUnits(programGuid, semesterGuid),
    enabled: !!programGuid && !!semesterGuid
  })

  const selectedUnit = useMemo(() => units?.find(u => u.courseUnitGuid === unitGuid), [units, unitGuid])
  const showUeTypeToggle = selectedUnit?.unitType === 3
  
  const derivedUeType = useMemo(() => {
    if (!selectedUnit) return -1
    if (selectedUnit.unitType === 1) return 0 // Theory
    if (selectedUnit.unitType === 2) return 1 // Practical
    if (selectedUnit.unitType === 3) return parseInt(ueTypeManual)
    return 0 // default fallback
  }, [selectedUnit, ueTypeManual])

  const isReadyForData = !!(programGuid && semesterGuid && unitGuid && intakeGuid && derivedUeType !== -1)

  // 4. Schedule
  const { data: schedule, isLoading: loadingSchedule, error: scheduleError } = useQuery({
    queryKey: ['ueAttendanceSchedule', programGuid, semesterGuid, unitGuid, intakeGuid, derivedUeType],
    queryFn: () => getUeAttendanceSchedule(programGuid, semesterGuid, unitGuid, intakeGuid, derivedUeType),
    enabled: isReadyForData,
  })

  // 5. Students
  const { data: students, isLoading: loadingStudents, isFetching: fetchingStudents } = useQuery({
    queryKey: ['ueAttendanceStudents', programGuid, semesterGuid, unitGuid, intakeGuid, derivedUeType, selectedUnit?.unitCat],
    queryFn: () => getUeAttendanceStudents(programGuid, semesterGuid, unitGuid, intakeGuid, derivedUeType, selectedUnit!.unitCat),
    enabled: isReadyForData && !!schedule, // Only load students if schedule exists
  })

  // Sync local attendance state when students fetch
  useEffect(() => {
    if (students) {
      const newState: Record<string, boolean> = {}
      students.forEach(s => {
        newState[s.studentGuid] = s.isPresent
      })
      setAttendanceState(newState)
    }
  }, [students])

  // Save Mutation
  const { mutate: saveMutate, isPending: saving } = useMutation({
    mutationFn: saveUeAttendance,
    onSuccess: (res) => {
      showToast(`Successfully saved attendance for ${res.savedCount} students.`)
      queryClient.invalidateQueries({ queryKey: ['ueAttendanceStudents'] })
    },
    onError: (err: any) => {
      showToast(err?.message || 'Failed to save attendance', 'error')
    }
  })

  const handleSave = () => {
    if (!students) return
    const payload = {
      programGuid,
      semesterGuid,
      unitGuid,
      intakeGuid,
      ueType: derivedUeType,
      students: students.map(s => ({
        studentGuid: s.studentGuid,
        isPresent: !!attendanceState[s.studentGuid]
      }))
    }
    saveMutate(payload)
  }

  const handleSingleSave = (studentGuid: string, newStatus: boolean) => {
    if (!students) return
    
    // Update local state for immediate UI feedback
    setAttendanceState(prev => ({
      ...prev,
      [studentGuid]: newStatus
    }))

    // Fire API call immediately
    const payload = {
      programGuid,
      semesterGuid,
      unitGuid,
      intakeGuid,
      ueType: derivedUeType,
      students: students.map(s => {
        if (s.studentGuid === studentGuid) {
          return { studentGuid: s.studentGuid, isPresent: newStatus }
        }
        return { studentGuid: s.studentGuid, isPresent: !!attendanceState[s.studentGuid] }
      })
    }
    saveMutate(payload)
  }

  const handleToggleAttendance = (studentGuid: string) => {
    setAttendanceState(prev => ({
      ...prev,
      [studentGuid]: !prev[studentGuid]
    }))
  }

  const handleMarkAll = (status: boolean) => {
    if (!students) return
    const newState = { ...attendanceState }
    students.forEach(s => {
      newState[s.studentGuid] = status
    })
    setAttendanceState(newState)
  }

  const filteredStudents = useMemo(() => {
    if (!students) return []
    if (!searchTerm) return students
    const lower = searchTerm.toLowerCase()
    return students.filter(s => 
      s.studentName.toLowerCase().includes(lower) || 
      s.studentRegNo.toLowerCase().includes(lower)
    )
  }, [students, searchTerm])

  const isLoadingData = loadingSchedule || fetchingStudents

  return (
    <div className="page active">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">UE Attendance</div>
          <div className="pg-sub">Mark or edit student attendance for scheduled exams</div>
        </div>
      </div>

      <div className="card mb-5">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="form-label text-[11px] font-semibold text-slate-500 uppercase">Programme</label>
              <SearchSelect
                options={initData?.programs.map(p => ({ value: p.programGuid, label: p.programName })) || []}
                value={programGuid}
                onChange={setProgramGuid}
                isLoading={loadingInit}
                placeholder="Select Programme"
              />
            </div>
            <div>
              <label className="form-label text-[11px] font-semibold text-slate-500 uppercase">Intake</label>
              <SearchSelect
                options={initData?.intakes.map(i => ({ value: i.intakeGuid, label: i.description })) || []}
                value={intakeGuid}
                onChange={setIntakeGuid}
                isLoading={loadingInit}
                placeholder="Select Intake"
              />
            </div>
            <div>
              <label className="form-label text-[11px] font-semibold text-slate-500 uppercase">Semester</label>
              <SearchSelect
                options={semesters?.map(s => ({ value: s.semesterGuid, label: s.semName })) || []}
                value={semesterGuid}
                onChange={setSemesterGuid}
                isLoading={loadingSemesters}
                disabled={!programGuid}
                placeholder="Select Semester"
              />
            </div>
            <div>
              <label className="form-label text-[11px] font-semibold text-slate-500 uppercase">Course Unit</label>
              <SearchSelect
                options={units?.map(u => ({ value: u.courseUnitGuid, label: `${u.courseUnitCode} - ${u.courseUnitName}` })) || []}
                value={unitGuid}
                onChange={setUnitGuid}
                isLoading={loadingUnits}
                disabled={!semesterGuid}
                placeholder="Select Unit"
              />
            </div>
          </div>

          {showUeTypeToggle && (
            <div className="mt-4 max-w-xs">
              <label className="form-label text-[11px] font-semibold text-slate-500 uppercase">Report Type</label>
              <SearchSelect
                options={[
                  { value: '0', label: 'Theory' },
                  { value: '1', label: 'Practical' }
                ]}
                value={ueTypeManual}
                onChange={setUeTypeManual}
              />
            </div>
          )}
        </div>
      </div>

      {isReadyForData && (
        <div className="card mb-5 border-l-4 border-l-blue-500">
          <div className="p-5 flex flex-col md:flex-row items-center gap-6">
            {loadingSchedule ? (
              <div className="flex items-center gap-3 text-slate-500 font-medium">
                <i className="lni lni-spinner-solid animate-spin text-xl text-blue-500"></i> Fetching schedule details...
              </div>
            ) : scheduleError ? (
              <div className="flex items-center gap-3 text-red-500 font-medium bg-red-50 p-3 rounded-lg border border-red-100 w-full">
                <i className="lni lni-warning text-xl"></i> No scheduled exam found for this combination. Please create the exam schedule first.
              </div>
            ) : schedule ? (
              <>
                <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 border border-blue-100 shadow-sm">
                  <i className="lni lni-calendar text-2xl"></i>
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <i className="lni lni-calendar text-blue-500"></i> Exam Date
                    </div>
                    <div className="font-bold text-slate-800 text-[16px]">{schedule.examDate}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <i className="lni lni-alarm-clock text-blue-500"></i> Start Time
                    </div>
                    <div className="font-bold text-slate-800 text-[16px]">{schedule.startTime}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <i className="lni lni-timer text-blue-500"></i> End Time
                    </div>
                    <div className="font-bold text-slate-800 text-[16px]">{schedule.endTime}</div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-hdr">
          <div className="card-title">
            <span className="ctitle-icon"><i className="lni lni-users"></i></span> Eligible Students
          </div>
          <div className="card-hdr-actions">
            <button className="btn btn-primary" disabled={!isReadyForData || !students || students.length === 0 || saving} onClick={handleSave}>
              {saving ? <i className="lni lni-spinner-solid animate-spin mr-2"></i> : <i className="lni lni-save mr-2"></i>}
              Save Attendance
            </button>
          </div>
        </div>
        
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex gap-2">
            <button className="btn btn-neu btn-sm" onClick={() => handleMarkAll(true)} disabled={isLoadingData || !students}>Mark All Present</button>
            <button className="btn btn-neu btn-sm" onClick={() => handleMarkAll(false)} disabled={isLoadingData || !students}>Mark All Absent</button>
          </div>
          <div className="w-full md:w-64">
            <TableSearch value={searchTerm} onChange={setSearchTerm} placeholder="Search students..." disabled={!isReadyForData} />
          </div>
        </div>

        <ScrollTable>
          <table>
            <thead>
              <tr>
                <th style={{ width: 48 }}></th>
                <th style={{ width: 60 }}>#</th>
                <th>STUDENT NO.</th>
                <th>STUDENT NAME</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {!isReadyForData ? (
                <EmptyState colSpan={5} title="No Exam Selected" subtitle="Select a Programme, Intake, Semester, and Unit to view students." />
              ) : isLoadingData ? (
                <TableLoadingState colSpan={5} title="Loading students..." subtitle="Fetching eligible students for this exam." />
              ) : !students || students.length === 0 ? (
                <EmptyState colSpan={5} title="No students found" subtitle="No eligible students found for this exam combination." />
              ) : filteredStudents.length === 0 ? (
                <EmptyState colSpan={5} hasFilters={true} onClearFilters={() => setSearchTerm('')} />
              ) : (
                filteredStudents.map((student, index) => {
                  const isPresent = attendanceState[student.studentGuid]
                  return (
                    <tr key={student.studentGuid}>
                      <td>
                        <ActionMenu>
                          <button className="btn btn-neu btn-sm" onClick={() => setConfirmStudent({
                                studentGuid: student.studentGuid,
                                name: student.studentName,
                                isPresent: !!isPresent
                              })}>
                            <i className={`lni ${isPresent ? 'lni-close' : 'lni-checkmark'}`}></i> 
                            Mark {isPresent ? 'Absent' : 'Present'}
                          </button>
                        </ActionMenu>
                      </td>
                      <td className="text-slate-500 font-mono text-[12px]">{index + 1}</td>
                      <td className="font-mono text-slate-700">{student.studentRegNo}</td>
                      <td className="font-medium text-slate-900">{student.studentName}</td>
                      <td>
                        <button 
                          onClick={() => handleToggleAttendance(student.studentGuid)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold transition-colors ${
                            isPresent 
                              ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100' 
                              : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                          }`}
                        >
                          <i className={`lni ${isPresent ? 'lni-checkmark-circle' : 'lni-close'}`}></i>
                          {isPresent ? 'Present' : 'Absent'}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </ScrollTable>
      </div>

      {confirmStudent && (
        <div className="modal-overlay open">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-hdr modal-hdr-blue">
              <div className="modal-title">Confirm Change</div>
              <button className="modal-close" onClick={() => setConfirmStudent(null)}><i className="lni lni-close"></i></button>
            </div>
            <div className="modal-body p-6 text-center">
              <div className="text-[48px] text-orange-500 mb-3"><i className="lni lni-warning"></i></div>
              <div className="text-lg font-semibold text-slate-800 mb-2">Are you sure?</div>
              <div className="text-[14px] text-slate-600">
                You are about to mark <strong className="text-slate-900">{confirmStudent.name}</strong> as 
                <strong className={confirmStudent.isPresent ? 'text-red-600' : 'text-green-600'}> {confirmStudent.isPresent ? 'Absent' : 'Present'}</strong>.
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50">
              <button className="btn btn-neu" onClick={() => setConfirmStudent(null)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  handleSingleSave(confirmStudent.studentGuid, !confirmStudent.isPresent)
                  setConfirmStudent(null)
                }}
              >
                Yes, Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast toast={toast} />}
    </div>
  )
}
