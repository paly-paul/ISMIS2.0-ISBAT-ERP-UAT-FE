'use client'

import { useState } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import { ScrollTable } from '@/components/ScrollTable'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { useIntakesDropdown } from '@/hooks/academic/useIntakes'
import { useProgramDropdown } from '@/hooks/academic/useProgramMaster'
import { useSemestersForProgram } from '@/hooks/academic/useSemesters'
import { 
  useTranscriptPrintEligibility, 
  useDownloadTranscriptPrintPdf, 
  useDownloadTranscriptPrintBulkPdf 
} from '@/hooks/assessment/useTranscriptPrint'
import { Toast } from '@/components/Toast'

export default function TranscriptPrintPage() {
  const [academicIntakeGuid, setAcademicIntakeGuid] = useState<string>('')
  const [programGuid, setProgramGuid] = useState<string>('')
  const [semesterGuid, setSemesterGuid] = useState<string>('')
  const [toastMessage, setToastMessage] = useState<{ msg: string, type: 'success' | 'error' | 'warn' | 'info' | 'danger' } | null>(null)

  const { data: intakes, isLoading: isLoadingIntakes } = useIntakesDropdown()
  const { data: programs, isLoading: isLoadingPrograms } = useProgramDropdown()
  const { data: semesters, isLoading: isLoadingSemesters } = useSemestersForProgram(programGuid, !!programGuid)

  const { data: eligibilityList, isLoading: isLoadingEligibility } = useTranscriptPrintEligibility(
    academicIntakeGuid || null, 
    programGuid || null, 
    semesterGuid || null
  )

  const singlePrintMut = useDownloadTranscriptPrintPdf()
  const bulkPrintMut = useDownloadTranscriptPrintBulkPdf()

  const showToast = (msg: string, type: 'success' | 'error' | 'warn' | 'info' | 'danger' = 'success') => {
    setToastMessage({ msg, type })
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handlePrintSingle = (studentGuid: string, studentName: string) => {
    singlePrintMut.mutate(studentGuid, {
      onSuccess: (data: any) => {
        const url = window.URL.createObjectURL(data.blob)
        const a = document.createElement('a')
        a.href = url
        a.download = data.filename || `Transcript_${studentName}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
        showToast(`Downloaded transcript for ${studentName}`)
      },
      onError: (err: any) => {
        showToast(err?.code === 'forbidden' ? 'You do not have permission to print transcripts.' : err?.message || 'Failed to download transcript. Please try again.', 'error')
      }
    })
  }

  const handlePrintBulk = () => {
    if (!academicIntakeGuid || !programGuid || !semesterGuid) return
    bulkPrintMut.mutate({ academicIntakeGuid, programGuid, semesterGuid }, {
      onSuccess: (data: any) => {
        const url = window.URL.createObjectURL(data.blob)
        const a = document.createElement('a')
        a.href = url
        a.download = data.filename || `Bulk_Transcripts.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
        showToast(`Downloaded bulk transcripts successfully`)
      },
      onError: (err: any) => {
        showToast(err?.code === 'forbidden' ? 'You do not have permission to print transcripts.' : err?.message || 'Failed to download bulk transcripts. Please try again.', 'error')
      }
    })
  }

  const isFilterComplete = !!(academicIntakeGuid && programGuid && semesterGuid)
  const isBulkPrintDisabled = !isFilterComplete || bulkPrintMut.isPending || (eligibilityList && eligibilityList.length === 0)

  return (
    <div className="page active">
      <Toast toast={toastMessage} />

      <div className="pg-hdr flex justify-between items-end">
        <div>
          <h1 className="pg-title">Transcript Print</h1>
          <p className="pg-sub">Print student academic transcripts (Statement of Marks) with QR verification.</p>
        </div>
        <div>
          <button 
            className="btn btn-primary" 
            onClick={handlePrintBulk} 
            disabled={isBulkPrintDisabled}
          >
            {bulkPrintMut.isPending ? <i className="lni lni-spinner-solid animate-spin"></i> : <i className="lni lni-printer"></i>} 
            Print All Eligible
          </button>
        </div>
      </div>

      <div className="card mb-5">
        <div className="p-4 border-b border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="form-group mb-0">
            <label className="text-sm font-semibold text-slate-700 mb-1 block">Academic Intake</label>
            <SearchSelect
              placeholder="Select Intake"
              value={academicIntakeGuid}
              onChange={setAcademicIntakeGuid}
              disabled={isLoadingIntakes}
              options={[
                { value: '', label: 'Select Intake' },
                ...(intakes || []).map((i: any) => ({
                  value: i.intakeGuid,
                  label: i.description
                }))
              ]}
            />
          </div>
          <div className="form-group mb-0">
            <label className="text-sm font-semibold text-slate-700 mb-1 block">Programme</label>
            <SearchSelect
              placeholder="Select Programme"
              value={programGuid}
              onChange={(val) => {
                setProgramGuid(val)
                setSemesterGuid('')
              }}
              disabled={isLoadingPrograms}
              options={[
                { value: '', label: 'Select Programme' },
                ...(programs || []).map((p: any) => ({
                  value: p.programGuid,
                  label: p.programName
                }))
              ]}
            />
          </div>
          <div className="form-group mb-0">
            <label className="text-sm font-semibold text-slate-700 mb-1 block">Semester</label>
            <SearchSelect
              placeholder={programGuid ? "Select Semester" : "Select Programme first"}
              value={semesterGuid}
              onChange={setSemesterGuid}
              disabled={!programGuid || isLoadingSemesters}
              options={[
                { value: '', label: 'Select Semester' },
                ...(semesters || []).map((s: any) => ({
                  value: s.semesterGuid,
                  label: s.semName
                }))
              ]}
            />
          </div>
        </div>

        <ScrollTable>
          <table className="table w-full">
            <thead>
              <tr>
                <th className="w-16">#</th>
                <th>Student No</th>
                <th>Student Name</th>
                <th>Status</th>
                <th className="w-32">Action</th>
              </tr>
            </thead>
            <tbody>
              {!isFilterComplete ? (
                <EmptyState colSpan={5} title="Select Academic Intake, Programme, and Semester to view eligibility." />
              ) : isLoadingEligibility ? (
                <TableLoadingState colSpan={5} title="Loading eligible students..." />
              ) : !eligibilityList || eligibilityList.length === 0 ? (
                <EmptyState colSpan={5} title="No eligible students found for printing transcripts in this batch." />
              ) : (
                eligibilityList.map((student, index) => (
                  <tr key={student.studentGuid}>
                    <td className="text-slate-500">{index + 1}</td>
                    <td className="font-mono text-slate-700">{student.studentRegNo}</td>
                    <td className="font-medium text-slate-800">{student.studentName}</td>
                    <td>
                      {student.alreadyPrinted ? (
                        <span className="badge badge-amber">Already Printed</span>
                      ) : (
                        <span className="badge badge-green">Not Printed</span>
                      )}
                    </td>
                    <td>
                      <button 
                        className="btn btn-neu btn-sm w-full"
                        onClick={() => handlePrintSingle(student.studentGuid, student.studentName)}
                        disabled={singlePrintMut.isPending}
                      >
                        <i className="lni lni-printer"></i> Print
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollTable>
      </div>
    </div>
  )
}
