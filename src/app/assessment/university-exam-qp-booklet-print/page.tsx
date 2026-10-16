'use client'

import { useMemo, useState } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import { Toast } from '@/components/Toast'
import { useCurrentAcademicIntake, useIntakes } from '@/hooks/academic/useIntakes'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import {
  useDownloadUeBookletPdf,
  useDownloadUeQuestionTheoryWord,
  usePrintUeBooklet,
  usePrintUeQuestionTheory,
  useUeMaterialPrintPrograms,
  useUeMaterialPrintProgramUnits,
  useUeMaterialPrintSemesters,
} from '@/hooks/assessment/useUeMaterialPrint'
import {
  useDeleteUeQuestionPractical,
  useDownloadUeQuestionPracticalWord,
  usePrintUeQuestionPractical,
} from '@/hooks/assessment/useUePracticalPrint'
import { AuthError } from '@/lib/api/client'
import { UePrintParams } from '@/lib/api/assessment/ueMaterialPrint'
import { UePracticalPrintParams } from '@/lib/api/assessment/uePracticalPrint'

type EffectiveType = 'Theory' | 'Practical' | 'Project'

const OUTCOME_NAMES = ['Printed', 'Reprinted', 'ExamRuleNotSet', 'QuestionsNotAvailable', 'ConfirmationRequired'] as const
type QpOutcome = typeof OUTCOME_NAMES[number]

function getUnitType(value?: string | null): EffectiveType | 'Combined' {
  switch ((value ?? '').trim().toLowerCase()) {
    case 'practical': return 'Practical'
    case 'project': return 'Project'
    case 'combined': return 'Combined'
    default: return 'Theory'
  }
}

function parseOutcome(result: any): { outcome: QpOutcome | null; message: string } {
  if (result === null || result === undefined) return { outcome: null, message: '' }

  const raw = result?.outcome ?? result?.Outcome ?? (typeof result === 'object' && 'data' in result ? (result.data?.outcome ?? result.data?.Outcome ?? result.data) : result)

  let outcome: QpOutcome | null = null
  if (typeof raw === 'number') {
    outcome = OUTCOME_NAMES[raw] ?? null
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (/^\d+$/.test(trimmed)) {
      outcome = OUTCOME_NAMES[Number(trimmed)] ?? null
    } else {
      outcome = OUTCOME_NAMES.find(n => n.toLowerCase() === trimmed.toLowerCase()) ?? null
    }
  }

  const message = (typeof result?.message === 'string' && result.message)
    || (typeof result?.data?.message === 'string' && result.data.message)
    || ''

  return { outcome, message }
}

export default function UniversityExamQpBookletPrintPage() {
  const permissions = usePagePermissions()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [programGuid, setProgramGuid] = useState('')
  const [semesterGuid, setSemesterGuid] = useState('')
  const [courseUnitGuid, setCourseUnitGuid] = useState('')
  const [combinedType, setCombinedType] = useState<'Theory' | 'Practical'>('Theory')
  const [confirmation, setConfirmation] = useState<{ message: string; action: () => void } | null>(null)

  const showToast = (msg: string, type = '') => {
    setToast({ msg, type })
    window.setTimeout(() => setToast(null), 3500)
  }

  // Silent Intake Resolution per specification: no intake dropdown rendered
  const { data: currentIntake } = useCurrentAcademicIntake()
  const { data: allIntakes } = useIntakes()
  const intakeGuid = currentIntake?.intakeGuid
    || (allIntakes ?? []).find(i => i.currentIntake)?.intakeGuid
    || (allIntakes && allIntakes.length > 0 ? allIntakes[0].intakeGuid : '')

  // Dropdown Queries
  const { data: programs, isLoading: programsLoading } = useUeMaterialPrintPrograms()
  const { data: semesters, isLoading: semestersLoading } = useUeMaterialPrintSemesters(programGuid || null)
  const { data: programUnits, isLoading: unitsLoading } = useUeMaterialPrintProgramUnits(programGuid || null)

  // Filter Course Units client-side by semesterGuid from program-course-units
  const courseUnits = useMemo(() => {
    if (!programUnits || !semesterGuid) return []
    return programUnits.filter(u => u.semesterGuid === semesterGuid)
  }, [programUnits, semesterGuid])

  const selectedUnitRow = useMemo(() => {
    if (!courseUnitGuid || !courseUnits) return null
    return courseUnits.find(u => u.courseUnitGuid === courseUnitGuid)
  }, [courseUnits, courseUnitGuid])

  const selectedUnitType = useMemo(() => {
    return getUnitType(selectedUnitRow?.unitTypeName)
  }, [selectedUnitRow])

  const effectiveType: EffectiveType = selectedUnitType === 'Combined' ? combinedType : selectedUnitType

  const formComplete = Boolean(intakeGuid && programGuid && semesterGuid && courseUnitGuid)
  const canPrintBooklet = formComplete && effectiveType === 'Theory' && permissions.add
  const canPrintQuestionPaper = formComplete && effectiveType !== 'Project' && permissions.add
  const canDeletePracticalQp = formComplete && effectiveType === 'Practical' && permissions.delete

  // Mutations
  const printBooklet = usePrintUeBooklet()
  const downloadBooklet = useDownloadUeBookletPdf()
  const printTheory = usePrintUeQuestionTheory()
  const downloadTheoryWord = useDownloadUeQuestionTheoryWord()
  const printPractical = usePrintUeQuestionPractical()
  const downloadPracticalWord = useDownloadUeQuestionPracticalWord()
  const deletePractical = useDeleteUeQuestionPractical()

  const isWorking = printBooklet.isPending || downloadBooklet.isPending ||
    printTheory.isPending || downloadTheoryWord.isPending ||
    printPractical.isPending || downloadPracticalWord.isPending ||
    deletePractical.isPending

  const request = (confirm = false): UePrintParams => ({
    programGuid,
    semesterGuid,
    courseUnitGuid,
    intakeGuid,
    confirm,
  })

  const practicalRequest = (confirm = false): UePracticalPrintParams => ({
    programGuid,
    semesterGuid,
    courseUnitGuid,
    intakeGuid,
    streamGuid: (selectedUnitRow as any)?.streamGuid ?? null,
    confirm,
  })

  const reset = () => {
    setProgramGuid('')
    setSemesterGuid('')
    setCourseUnitGuid('')
    setCombinedType('Theory')
  }

  const download = (blob: Blob, filename: string | null, fallback: string) => {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || fallback
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  // Booklet Print (Theory only)
  const handleBookletPrint = async (confirm = false) => {
    if (!canPrintBooklet || isWorking) return
    try {
      const result = await printBooklet.mutateAsync(request(confirm))
      if (result.confirmationRequired && !confirm) {
        setConfirmation({
          message: result.message || 'Booklets are already printed. Do you want to reprint the same?',
          action: () => handleBookletPrint(true),
        })
        return
      }
      const file = await downloadBooklet.mutateAsync(request())
      download(file.blob, file.filename, 'Booklet.pdf')
      showToast(result.wasReprint ? 'Booklet reprinted successfully.' : 'Booklet downloaded successfully.', 'success')
    } catch (error: any) {
      showToast(error?.message || 'Failed to print booklet.', 'error')
    }
  }

  // QP Print in MS Word (Theory & Practical)
  const handleQuestionPaperPrint = async (confirm = false) => {
    if (!canPrintQuestionPaper || isWorking) return
    try {
      const result = effectiveType === 'Practical'
        ? await printPractical.mutateAsync(practicalRequest(confirm))
        : await printTheory.mutateAsync(request(confirm))

      const { outcome, message } = parseOutcome(result)

      if (outcome === 'ConfirmationRequired') {
        setConfirmation({
          message: message || 'Questions are already printed. Do you want to reprint the same?',
          action: () => handleQuestionPaperPrint(true),
        })
        return
      }
      if (outcome === 'ExamRuleNotSet') {
        showToast(message || 'University Exam not yet Scheduled!!', 'error')
        return
      }
      if (outcome === 'QuestionsNotAvailable') {
        showToast(message || 'Questions are not yet uploaded!!', 'error')
        return
      }
      if (outcome === 'Printed' || outcome === 'Reprinted') {
        const file = effectiveType === 'Practical'
          ? await downloadPracticalWord.mutateAsync(practicalRequest())
          : await downloadTheoryWord.mutateAsync(request())
        download(file.blob, file.filename, 'QuestionPaper.doc')
        showToast(message || (outcome === 'Reprinted' ? 'Question paper reprinted successfully.' : 'Question paper downloaded successfully.'), 'success')
        return
      }

      if (message) {
        showToast(message, 'info')
      } else {
        showToast('Unexpected response from the server — the question paper may not have been printed.', 'error')
      }
    } catch (error: any) {
      showToast(error?.message || 'Failed to print question paper.', 'error')
    }
  }

  // Delete Practical QP (Practical only)
  const handleDeletePracticalQP = async (confirm = false) => {
    if (!canDeletePracticalQp || isWorking) return
    try {
      const res = await deletePractical.mutateAsync(practicalRequest(confirm))
      if (res.data === false && !confirm) {
        setConfirmation({
          message: res.message || 'You are about to delete the QP set. Do you want to continue?',
          action: () => handleDeletePracticalQP(true),
        })
        return
      }
      if (res.data === true) {
        showToast(res.message || 'Practical QP deleted successfully!', 'success')
      }
    } catch (error: any) {
      if (error instanceof AuthError && error.code === 'not_found') {
        showToast('There is no printed practical QP to delete for this unit.', 'warn')
      } else {
        showToast(error?.message || 'Could not delete practical QP.', 'error')
      }
    }
  }

  const bookletHint = !formComplete
    ? 'Select Programme, Semester and Course Unit first.'
    : effectiveType !== 'Theory'
      ? 'Booklet printing is currently available for Theory only.'
      : !permissions.add
        ? 'You do not have permission to print booklets.'
        : ''

  const qpHint = !formComplete
    ? 'Select Programme, Semester and Course Unit first.'
    : !permissions.add
      ? 'You do not have permission to print question papers.'
      : ''

  return (
    <div className="page active">
      <div className="pg-hdr flex justify-between items-end">
        <div>
          <h1 className="pg-title">University Exam QP/Booklet Print</h1>
          <p className="pg-sub">A leaner, unit-type-agnostic print console for Theory, Practical, Combined, and Project units.</p>
        </div>
        <button className="btn btn-neu" onClick={reset} disabled={isWorking}>
          <i className="lni lni-reload" /> Refresh
        </button>
      </div>

      <div className="card mb-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
          <div className="fg mb-0">
            <label className="lbl">Programme <span className="text-red-500">*</span></label>
            <SearchSelect
              placeholder="— Select Programme —"
              value={programGuid}
              onChange={guid => {
                setProgramGuid(guid)
                setSemesterGuid('')
                setCourseUnitGuid('')
                setCombinedType('Theory')
              }}
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
              value={semesterGuid}
              onChange={guid => {
                setSemesterGuid(guid)
                setCourseUnitGuid('')
                setCombinedType('Theory')
              }}
              disabled={!programGuid || semestersLoading}
              options={(semesters ?? []).map((s: any) => ({
                value: s.semesterGuid,
                label: s.semName,
              }))}
            />
          </div>
          <div className="fg mb-0">
            <label className="lbl">Course Unit <span className="text-red-500">*</span></label>
            <SearchSelect
              placeholder="— Select Course Unit —"
              value={courseUnitGuid}
              onChange={guid => {
                setCourseUnitGuid(guid)
                setCombinedType('Theory')
              }}
              disabled={!semesterGuid || unitsLoading}
              options={courseUnits.map(unit => ({
                value: unit.courseUnitGuid,
                label: `${unit.courseUnitCode} - ${unit.courseUnitName}${unit.unitTypeName ? ` (${unit.unitTypeName})` : ''}`,
              }))}
            />
          </div>
        </div>

        {selectedUnitType === 'Combined' && (
          <div className="px-5 py-4 border-t border-gray-100 bg-slate-50 flex items-center gap-6">
            <span className="lbl mb-0">Select Exam Component:</span>
            {(['Theory', 'Practical'] as const).map(type => (
              <label key={type} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input
                  type="radio"
                  name="combined-unit-type"
                  value={type}
                  checked={combinedType === type}
                  onChange={() => setCombinedType(type)}
                  className="w-4 h-4 text-primary"
                />
                <span className="font-medium">{type}</span>
              </label>
            ))}
          </div>
        )}

        <div className="p-5 pt-0 flex flex-wrap gap-3">
          <button
            className="btn btn-primary"
            onClick={() => handleBookletPrint()}
            disabled={!canPrintBooklet || isWorking}
            title={bookletHint}
          >
            <i className="lni lni-printer" /> Print (Booklet)
          </button>

          {effectiveType !== 'Project' && (
            <button
              className="btn btn-neu"
              onClick={() => handleQuestionPaperPrint()}
              disabled={!canPrintQuestionPaper || isWorking}
              title={qpHint}
            >
              <i className="lni lni-download" /> QP Print in MS Word
            </button>
          )}

          {effectiveType === 'Practical' && (
            <button
              className="btn btn-danger"
              onClick={() => handleDeletePracticalQP()}
              disabled={!canDeletePracticalQp || isWorking}
              title={!permissions.delete ? 'You do not have permission to delete question papers.' : ''}
            >
              <i className="lni lni-trash-can" /> Delete Practical QP
            </button>
          )}

          <button className="btn btn-neu" onClick={reset} disabled={isWorking}>
            <i className="lni lni-reload" /> Refresh
          </button>
        </div>
      </div>

      {confirmation && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setConfirmation(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-warning" /></div>
            <div className="perm-delete-title">Confirmation Required</div>
            <div className="perm-delete-sub">{confirmation.message}</div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setConfirmation(null)}>No</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const action = confirmation.action
                  setConfirmation(null)
                  action()
                }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  )
}
