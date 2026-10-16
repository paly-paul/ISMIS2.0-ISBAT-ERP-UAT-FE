'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { ProgramSearchPicker, ProgramPickOption } from '@/components/ProgramSearchPicker'
import { SearchSelect } from '@/components/SearchSelect'
import { SuccessPopup } from '@/components/modals/shared/SuccessPopup'
import { Toast } from '@/components/Toast'
import { useSemestersForProgram } from '@/hooks/academic/useSemesters'
import { useIntakes, useCurrentAcademicIntake } from '@/hooks/academic/useIntakes'
import {
  useUeMarkImportUnits,
  useUeMarkImportExam,
  useDownloadUeMarkImportTemplate,
  useUeMarkImportSheets,
  useUeMarkImportPreview,
  useUeMarkImportImport
} from '@/hooks/assessment/useUeMarkImport'
import { UeMarkImportPreviewItem } from '@/lib/api/assessment/ueMarkImport'

export default function UeMarkImportPage() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null)
  const showToast = (msg: string, type = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }
    setToast({ msg, type })
    const isErrorOrWarn = ['error', 'err', 'danger', 'warn', 'warning'].includes((type || '').toLowerCase().trim())
    const duration = isErrorOrWarn ? 8000 : 4000
    toastTimerRef.current = setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, duration)
  }

  const [program, setProgram] = useState<ProgramPickOption | null>(null)
  const [semesterGuid, setSemesterGuid] = useState('')
  const [courseUnitGuid, setCourseUnitGuid] = useState('')
  const [intakeGuid, setIntakeGuid] = useState('')
  const [ueType, setUeType] = useState('0') // 0 = First Sit

  const [file, setFile] = useState<File | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState('')

  const [previewRows, setPreviewRows] = useState<UeMarkImportPreviewItem[] | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [successModal, setSuccessModal] = useState<{ title: string; subtitle: string } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewSectionRef = useRef<HTMLDivElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  // -- Queries --
  const { data: semesters, isLoading: isLoadingSemesters } = useSemestersForProgram(program?.programGuid || null, !!program)
  const { data: intakes, isLoading: isLoadingIntakes } = useIntakes()
  const { data: currentIntake } = useCurrentAcademicIntake()

  // Auto-select current intake
  useEffect(() => {
    if (!intakeGuid && currentIntake?.intakeGuid) {
      setIntakeGuid(currentIntake.intakeGuid)
    } else if (!intakeGuid && intakes && intakes.length > 0) {
      setIntakeGuid(intakes[0].intakeGuid)
    }
  }, [currentIntake, intakes, intakeGuid])

  const {
    data: courseUnits,
    isLoading: isLoadingCourseUnits,
    isFetching: isFetchingCourseUnits
  } = useUeMarkImportUnits(program?.programGuid || '', semesterGuid, !!program && !!semesterGuid)

  const {
    data: examInfo,
    isLoading: isLoadingExamInfo
  } = useUeMarkImportExam(
    program?.programGuid || '',
    semesterGuid,
    courseUnitGuid,
    intakeGuid,
    Number(ueType),
    !!program && !!semesterGuid && !!courseUnitGuid && !!intakeGuid && !!ueType
  )

  const downloadMut = useDownloadUeMarkImportTemplate()
  const sheetsMut = useUeMarkImportSheets()
  const previewMut = useUeMarkImportPreview()
  const importMut = useUeMarkImportImport()

  const handleClearFile = () => {
    setFile(null)
    setSheetNames([])
    setSelectedSheet('')
    setPreviewRows(null)
    setValidationError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleProgramSelect = (p: ProgramPickOption) => {
    setProgram(p)
    setSemesterGuid('')
    setCourseUnitGuid('')
    handleClearFile()
  }

  const handleProgramClear = () => {
    setProgram(null)
    setSemesterGuid('')
    setCourseUnitGuid('')
    handleClearFile()
  }

  const handleSemesterChange = (val: string) => {
    setSemesterGuid(val)
    setCourseUnitGuid('')
    handleClearFile()
  }

  const handleCourseUnitChange = (val: string) => {
    setCourseUnitGuid(val)
    handleClearFile()
  }

  const handleFilePicked = (pickedFile: File) => {
    if (!pickedFile.name.toLowerCase().endsWith('.xlsx')) {
      showToast('Please upload an Excel workbook (.xlsx format)', 'danger')
      return
    }

    setFile(pickedFile)
    setPreviewRows(null)
    setValidationError(null)
    setSheetNames([])
    setSelectedSheet('')

    sheetsMut.mutate(pickedFile, {
      onSuccess: (sheets) => {
        if (sheets && sheets.length > 0) {
          setSheetNames(sheets)
          setSelectedSheet(sheets[0])
          showToast(`Workbook loaded (${sheets.length} sheet(s) detected)`, 'info')
        } else {
          setSheetNames([])
          setSelectedSheet('')
        }
      },
      onError: (err: any) => {
        showToast(err.message || 'Failed to inspect workbook sheets', 'danger')
      }
    })
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFilePicked(files[0])
    }
  }

  const handlePreview = () => {
    if (!file || !examInfo?.universityExamGuid) {
      showToast('Please select a file and ensure exam info is loaded.', 'warn')
      return
    }

    setValidationError(null)
    previewMut.mutate({
      file,
      sheetName: selectedSheet || undefined,
      universityExamGuid: examInfo.universityExamGuid
    }, {
      onSuccess: (data) => {
        setPreviewRows(data)
        showToast(`Preview loaded successfully (${data.length} records)`, 'success')
        setTimeout(() => {
          previewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
      },
      onError: (err: any) => {
        setPreviewRows(null)
        setValidationError(err.message || 'Validation failed.')
        setTimeout(() => {
          errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      }
    })
  }

  const handleImport = () => {
    if (!file || !examInfo?.universityExamGuid) {
      showToast('Missing required fields', 'warn')
      return
    }

    setValidationError(null)
    importMut.mutate({
      file,
      sheetName: selectedSheet || undefined,
      universityExamGuid: examInfo.universityExamGuid
    }, {
      onSuccess: (res) => {
        setSuccessModal({
          title: 'Import Successful',
          subtitle: res.message || 'Marks have been saved successfully.',
        })
        handleClearFile()
      },
      onError: (err: any) => {
        setValidationError(err.message || 'Import failed.')
        showToast(err.message || 'Import failed', 'danger')
      }
    })
  }

  const handleDownloadTemplate = () => {
    if (!examInfo?.universityExamGuid) {
      showToast('Please select Course Unit and UE Type to resolve exam first.', 'warn')
      return
    }

    setValidationError(null)
    downloadMut.mutate(examInfo.universityExamGuid, {
      onSuccess: () => {
        showToast('Template downloaded successfully.', 'success')
      },
      onError: (err: any) => {
        const errorMsg = err?.message || 'Failed to download template.'
        showToast(errorMsg, 'danger')
        setValidationError(errorMsg)
        setTimeout(() => {
          errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      }
    })
  }

  return (
    <div className="page active">
      <div className="pg-hdr flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div className="flex-1 min-w-0">
          <div className="pg-title flex items-center gap-2 flex-wrap">
            <span>University Exam Mark Import</span>
          </div>
          <div className="pg-sub text-xs text-slate-500">
            Upload and process legacy Excel templates for student marks.
          </div>
        </div>
      </div>

      <div className="card mb-5 p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="fg mb-0">
            <label className="lbl">Academic Intake <span className="text-red-500">*</span></label>
            <SearchSelect
              options={intakes?.map(i => ({ value: i.intakeGuid, label: `${i.intakeCode} — ${i.description}` })) || []}
              value={intakeGuid}
              onChange={setIntakeGuid}
              placeholder={isLoadingIntakes ? 'Loading...' : 'Select Intake'}
            />
          </div>

          <div className="fg mb-0">
            <label className="lbl">Programme <span className="text-red-500">*</span></label>
            <ProgramSearchPicker
              selectedLabel={program ? `${program.programCode} — ${program.programName}` : null}
              onSelect={handleProgramSelect}
              onClear={handleProgramClear}
            />
          </div>

          <div className="fg mb-0">
            <label className="lbl">Semester <span className="text-red-500">*</span></label>
            <SearchSelect
              options={semesters?.map(s => ({ value: s.semesterGuid, label: s.semName })) || []}
              value={semesterGuid}
              onChange={handleSemesterChange}
              disabled={!program || isLoadingSemesters}
              placeholder={!program ? 'Select Programme first' : isLoadingSemesters ? 'Loading...' : 'Select Semester'}
            />
          </div>

          <div className="fg mb-0">
            <label className="lbl">Course Unit <span className="text-red-500">*</span></label>
            <SearchSelect
              options={courseUnits?.map(u => ({ value: u.courseUnitGuid, label: `${u.courseUnitCode} — ${u.courseUnitName}` })) || []}
              value={courseUnitGuid}
              onChange={handleCourseUnitChange}
              disabled={!semesterGuid || isLoadingCourseUnits}
              placeholder={!semesterGuid ? 'Select Semester first' : isLoadingCourseUnits ? 'Loading...' : 'Select Course Unit'}
            />
          </div>

          <div className="fg mb-0">
            <label className="lbl">UE Type <span className="text-red-500">*</span></label>
            <SearchSelect
              options={[
                { value: '0', label: 'First Sit' },
                { value: '1', label: 'Re-Sit' }
              ]}
              value={ueType}
              onChange={setUeType}
            />
          </div>

          <div className="fg mb-0 flex flex-col justify-center">
            <label className="lbl text-slate-400">Maximum Marks</label>
            {isLoadingExamInfo ? (
              <div className="text-sm text-slate-500 animate-pulse">Resolving exam...</div>
            ) : examInfo ? (
              <div className="text-sm font-bold text-slate-800">
                {/* Simplified total logic for display purpose */}
                Theory/Practical/Project Max
                {examInfo.isVerified && (
                  <span className="ml-2 badge badge-green">Verified</span>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-400">---</div>
            )}
          </div>
        </div>
      </div>

      <div className="card mb-5 p-5">
        <div className="card-title mb-4">File Upload</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div className="fg mb-0">
            <label className="lbl">Select File <span className="text-red-500">*</span></label>
            <div className="flex gap-2 items-center">
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx"
                onChange={handleFileInputChange}
                className="ctrl flex-1 min-w-0"
                disabled={!examInfo || examInfo.isVerified}
              />
              {/* Same reset as Cancel: clears the file, sheet list and preview. */}
              {file && (
                <button
                  type="button"
                  className="btn btn-neu btn-sm"
                  onClick={handleClearFile}
                  disabled={previewMut.isPending || importMut.isPending}
                  aria-label={`Remove ${file.name}`}
                  title="Remove file"
                >
                  <i className="lni lni-close"></i> Remove
                </button>
              )}
            </div>
          </div>
          <div className="fg mb-0">
            <label className="lbl">Select Sheet <span className="text-red-500">*</span></label>
            <SearchSelect
              options={sheetNames.map(s => ({ value: s, label: s }))}
              value={selectedSheet}
              onChange={setSelectedSheet}
              disabled={!file || sheetNames.length === 0}
              placeholder={!file ? 'Upload file first' : 'Select Sheet'}
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            className="btn btn-primary bg-indigo-600 text-white"
            onClick={handlePreview}
            disabled={!file || !selectedSheet || previewMut.isPending}
          >
            {previewMut.isPending ? 'Previewing...' : 'Preview'}
          </button>

          <button
            type="button"
            className="btn btn-success"
            onClick={handleImport}
            disabled={!previewRows || previewMut.isPending || importMut.isPending}
          >
            {importMut.isPending ? 'Saving...' : 'Save & Import'}
          </button>

          <button
            type="button"
            className="btn btn-neu"
            onClick={handleClearFile}
            disabled={!file}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-neu ml-auto text-blue-600 flex items-center gap-1.5"
            onClick={handleDownloadTemplate}
            disabled={!examInfo || downloadMut.isPending}
          >
            <i className={`lni ${downloadMut.isPending ? 'lni-spinner animate-spin' : 'lni-download'}`} />
            {downloadMut.isPending ? 'Downloading...' : 'Template Download'}
          </button>
        </div>
      </div>

      {validationError && (
        <div ref={errorRef} className="card p-4 mb-5 border-red-200 bg-red-50 flex gap-3 items-start">
          <i className="lni lni-warning text-red-500 text-xl mt-0.5"></i>
          <div>
            <h4 className="font-bold text-red-800 text-sm mb-1">Validation Error</h4>
            <p className="text-sm text-red-700 whitespace-pre-line">{validationError}</p>
          </div>
        </div>
      )}

      {previewRows && previewRows.length > 0 && (
        <div ref={previewSectionRef} className="card p-0 overflow-hidden mb-5">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <div className="font-bold text-slate-800">
              Preview Marks ({previewRows.length} records)
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl w-full text-xs">
              <thead>
                <tr>
                  <th>Sl No</th>
                  <th>Matching Code</th>
                  {/* Depending on layout, we might show different columns, for now dumping common ones */}
                  {previewRows.some(r => r.sectionAMark !== null) && <th>Section A</th>}
                  {previewRows.some(r => r.sectionBMark !== null) && <th>Section B</th>}
                  {previewRows.some(r => r.sectionCMark !== null) && <th>Section C</th>}
                  {previewRows.some(r => r.recordMark !== null) && <th>Record</th>}
                  {previewRows.some(r => r.codingMark !== null) && <th>Coding</th>}
                  {previewRows.some(r => r.outputMark !== null) && <th>Output</th>}
                  {previewRows.some(r => r.vivaMark !== null) && <th>Viva</th>}
                  {previewRows.some(r => r.synopsisMark !== null) && <th>Synopsis</th>}
                  {previewRows.some(r => r.reviewMark !== null) && <th>Review</th>}
                  {previewRows.some(r => r.methodologyMark !== null) && <th>Methodology</th>}
                  {previewRows.some(r => r.analysisMark !== null) && <th>Analysis</th>}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i}>
                    <td>{row.slNo}</td>
                    <td className="font-mono font-medium text-slate-800">{row.matchingCode || '—'}</td>
                    {row.sectionAMark !== null && <td className="font-mono">{row.sectionAMark}</td>}
                    {row.sectionBMark !== null && <td className="font-mono">{row.sectionBMark}</td>}
                    {row.sectionCMark !== null && <td className="font-mono">{row.sectionCMark}</td>}
                    {row.recordMark !== null && <td className="font-mono">{row.recordMark}</td>}
                    {row.codingMark !== null && <td className="font-mono">{row.codingMark}</td>}
                    {row.outputMark !== null && <td className="font-mono">{row.outputMark}</td>}
                    {row.vivaMark !== null && <td className="font-mono">{row.vivaMark}</td>}
                    {row.synopsisMark !== null && <td className="font-mono">{row.synopsisMark}</td>}
                    {row.reviewMark !== null && <td className="font-mono">{row.reviewMark}</td>}
                    {row.methodologyMark !== null && <td className="font-mono">{row.methodologyMark}</td>}
                    {row.analysisMark !== null && <td className="font-mono">{row.analysisMark}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {successModal && (
        <SuccessPopup
          title={successModal.title}
          subtitle={successModal.subtitle}
          onClose={() => setSuccessModal(null)}
        />
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
