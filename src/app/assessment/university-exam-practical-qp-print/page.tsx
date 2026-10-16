'use client'

import { useState, useMemo, useEffect } from 'react'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import { useIntakes } from '@/hooks/academic/useIntakes'
import {
  useUePracticalPrintPrograms,
  useUePracticalPrintSemesters,
  useUePracticalProgramUnits,
  usePrintUeQuestionPractical,
  useDownloadUeQuestionPracticalPdf,
  useDownloadUeQuestionPracticalWord,
  useDeleteUeQuestionPractical
} from '@/hooks/assessment/useUePracticalPrint'

export default function UniversityExamPracticalQpPrintPage() {
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

  // Modals for confirmation
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null)
  const [confirmMessage, setConfirmMessage] = useState('')

  // Data Hooks
  const { data: intakes, isLoading: intakesLoading } = useIntakes()
  const { data: programs, isLoading: programsLoading } = useUePracticalPrintPrograms()
  const { data: semesters, isLoading: semLoading } = useUePracticalPrintSemesters(selectedProgramGuid || null)
  const { data: allProgramUnits, isLoading: unitsLoading } = useUePracticalProgramUnits(selectedProgramGuid || null)

  // Pre-select current intake
  useEffect(() => {
    if (intakes && !selectedIntakeGuid) {
      const current = intakes.find(i => i.currentIntake)
      if (current) setSelectedIntakeGuid(current.intakeGuid)
    }
  }, [intakes, selectedIntakeGuid])

  // Filter Practical units for the selected semester
  const courseUnits = useMemo(() => {
    if (!allProgramUnits || !selectedSemesterGuid) return []
    return allProgramUnits.filter((u: any) => u.semesterGuid === selectedSemesterGuid && u.unitTypeName === 'Practical')
  }, [allProgramUnits, selectedSemesterGuid])

  const isFormValid = !!selectedIntakeGuid && !!selectedProgramGuid && !!selectedSemesterGuid && !!selectedCourseUnitGuid

  // API Hooks
  const printPracticalMut = usePrintUeQuestionPractical()
  const dlPracticalPdfMut = useDownloadUeQuestionPracticalPdf()
  const dlPracticalWordMut = useDownloadUeQuestionPracticalWord()
  const delPracticalMut = useDeleteUeQuestionPractical()

  // Handlers
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

  const downloadFile = (blob: Blob, filename: string | null, fallbackName: string) => {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || fallbackName
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }

  const confirmAndExecute = (msg: string, action: () => void) => {
    setConfirmMessage(msg)
    setConfirmAction(() => action)
    setShowConfirmModal(true)
  }

  const executeConfirm = () => {
    if (confirmAction) confirmAction()
    setShowConfirmModal(false)
  }

  // --- Actions ---

  // 1. QP Print
  const handlePrintQP = async (confirm = false) => {
    if (!isFormValid) return
    const req = {
      programGuid: selectedProgramGuid,
      semesterGuid: selectedSemesterGuid,
      courseUnitGuid: selectedCourseUnitGuid,
      intakeGuid: selectedIntakeGuid,
      confirm
    }

    try {
      const res = await printPracticalMut.mutateAsync(req)

      const outcome = String(res.outcome)

      if (outcome === '2' || outcome === 'ExamRuleNotSet') {
        showToast(res.message || 'University Exam not yet Scheduled!!', 'error')
      } else if (outcome === '3' || outcome === 'QuestionsNotAvailable') {
        showToast(res.message || 'Questions are not yet uploaded!!', 'error')
      } else if (outcome === '4' || outcome === 'ConfirmationRequired') {
        confirmAndExecute(res.message || 'Questions are already printed. Do you want to reprint the same?', () => handlePrintQP(true))
      } else if (outcome === '0' || outcome === '1' || outcome === 'Printed' || outcome === 'Reprinted') {
        showToast(res.message || `Question Paper Generated!`, 'success')
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to print practical QP', 'error')
    }
  }

  // 2. QP Delete
  const handleDeleteQP = async (confirm = false) => {
    if (!isFormValid) return
    const req = {
      programGuid: selectedProgramGuid,
      semesterGuid: selectedSemesterGuid,
      courseUnitGuid: selectedCourseUnitGuid,
      intakeGuid: selectedIntakeGuid,
      confirm
    }

    try {
      const res = await delPracticalMut.mutateAsync(req)
      if (res.data === false && !confirm) {
        confirmAndExecute(res.message || 'You are about to delete the QP set. Do you want to continue?', () => handleDeleteQP(true))
      } else if (res.data === true) {
        showToast(res.message || 'Deleted successfully!', 'success')
      }
    } catch (err: any) {
      showToast(err.message || 'Could not delete QP.', 'error')
    }
  }

  // Download Handlers
  const handleDownload = async (type: 'QPPDF' | 'QPWord') => {
    if (!isFormValid) return
    const req = {
      programGuid: selectedProgramGuid,
      semesterGuid: selectedSemesterGuid,
      courseUnitGuid: selectedCourseUnitGuid,
      intakeGuid: selectedIntakeGuid,
    }

    try {
      if (type === 'QPPDF') {
        const { blob, filename } = await dlPracticalPdfMut.mutateAsync(req)
        downloadFile(blob, filename, 'Practical_QuestionPaper.pdf')
      } else if (type === 'QPWord') {
        const { blob, filename } = await dlPracticalWordMut.mutateAsync(req)
        downloadFile(blob, filename, 'Practical_QuestionPaper.doc')
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to download document', 'error')
    }
  }

  const isWorking = printPracticalMut.isPending || dlPracticalPdfMut.isPending || dlPracticalWordMut.isPending || delPracticalMut.isPending
  
  return (
    <div className="page active">
      <div className="pg-hdr flex justify-between items-end">
        <div>
          <h1 className="pg-title">University Exam Practical QP Print</h1>
          <p className="pg-sub">Generate and print exam materials for Practical course units</p>
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
            <label className="lbl">Course Unit (Practical) <span className="text-red-500">*</span></label>
            <SearchSelect
              placeholder="— Select Practical Unit —"
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

        <div className="p-5 pt-0 mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Question Paper Card */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <i className="lni lni-layout"></i>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 text-sm m-0">Practical QP Materials</h3>
                <p className="text-xs text-gray-500 m-0">Generate & download practical QP</p>
              </div>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-2 gap-3">
              <button 
                className="flex flex-col items-center justify-center p-4 border rounded-xl gap-2 text-sm font-medium transition-all hover:border-primary hover:text-primary hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:shadow-none disabled:hover:text-gray-700 bg-white"
                onClick={() => handlePrintQP()}
                disabled={!isFormValid || isWorking}
              >
                <i className="lni lni-printer text-3xl text-primary"></i>
                Generate QP
              </button>
              
              <button 
                className="flex flex-col items-center justify-center p-4 border rounded-xl gap-2 text-sm font-medium transition-all hover:border-primary hover:text-primary hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:shadow-none disabled:hover:text-gray-700 bg-blue-50 border-blue-100"
                onClick={() => handleDownload('QPPDF')}
                disabled={!isFormValid || isWorking}
              >
                <i className="lni lni-download text-3xl text-red-500"></i>
                PDF Format
              </button>

              <button 
                className="flex flex-col items-center justify-center p-4 border rounded-xl gap-2 text-sm font-medium transition-all hover:border-primary hover:text-primary hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:shadow-none disabled:hover:text-gray-700 bg-slate-50 border-slate-200"
                onClick={() => handleDownload('QPWord')}
                disabled={!isFormValid || isWorking}
              >
                <i className="lni lni-wordpress text-3xl text-blue-500"></i>
                Word Format
              </button>

              <button 
                className="flex flex-col items-center justify-center p-4 border rounded-xl gap-2 text-sm font-medium transition-all hover:border-red-500 hover:text-red-600 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:shadow-none disabled:hover:text-gray-700 bg-red-50 border-red-100"
                onClick={() => handleDeleteQP()}
                disabled={!isFormValid || isWorking}
              >
                <i className="lni lni-trash-can text-3xl text-red-600"></i>
                Delete QP
              </button>
            </div>
          </div>

          {/* Booklet Card */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-sm opacity-70">
            <div className="bg-gray-100 px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center">
                  <i className="lni lni-book"></i>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-700 text-sm m-0">Booklet & Registers</h3>
                  <p className="text-xs text-gray-500 m-0">Not supported for practical units yet</p>
                </div>
              </div>
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded font-semibold uppercase">Coming Soon</span>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button className="flex flex-col items-center justify-center p-4 border rounded-xl gap-2 text-sm font-medium opacity-50 cursor-not-allowed bg-sky-50 border-sky-100" disabled title="Not yet supported for practical exams">
                <i className="lni lni-printer text-3xl text-gray-400"></i>
                Print Booklet
              </button>
              <button className="flex flex-col items-center justify-center p-4 border rounded-xl gap-2 text-sm font-medium opacity-50 cursor-not-allowed bg-gray-50 border-gray-100" disabled title="Not yet supported for practical exams">
                <i className="lni lni-empty-file text-3xl text-gray-400"></i>
                Booklet PDF
              </button>
              <button className="flex flex-col items-center justify-center p-4 border rounded-xl gap-2 text-sm font-medium opacity-50 cursor-not-allowed bg-gray-50 border-gray-100" disabled title="Not yet supported for practical exams">
                <i className="lni lni-users text-3xl text-gray-400"></i>
                Attendance
              </button>
              <button className="flex flex-col items-center justify-center p-4 border rounded-xl gap-2 text-sm font-medium opacity-50 cursor-not-allowed bg-gray-50 border-gray-100" disabled title="Not yet supported for practical exams">
                <i className="lni lni-envelope text-3xl text-gray-400"></i>
                Cover Letter
              </button>
              <button className="flex flex-col items-center justify-center p-4 border rounded-xl gap-2 text-sm font-medium opacity-50 cursor-not-allowed bg-gray-50 border-gray-100" disabled title="Not yet supported for practical exams">
                <i className="lni lni-list text-3xl text-gray-400"></i>
                Mark Sheet
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setShowConfirmModal(false)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-warning"></i></div>
            <div className="perm-delete-title">Confirmation Required</div>
            <div className="perm-delete-sub">{confirmMessage}</div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setShowConfirmModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={executeConfirm}>Continue</button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  )
}
