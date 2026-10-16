'use client'

import { useEffect, useMemo, useState } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import { Toast } from '@/components/Toast'
import { useCurrentAcademicIntake, useIntakes } from '@/hooks/academic/useIntakes'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import {
  useDownloadUeBookletPdf, useDownloadUeQuestionTheoryWord, usePrintUeBooklet,
  usePrintUeQuestionTheory, useUeMaterialPrintPrograms, useUeMaterialPrintProgramUnits,
  useUeMaterialPrintSemesters, useUeQuestionPrintCourseUnits,
} from '@/hooks/assessment/useUeMaterialPrint'
import { useDownloadUeQuestionPracticalWord, usePrintUeQuestionPractical } from '@/hooks/assessment/useUePracticalPrint'

type EffectiveType = 'Theory' | 'Practical' | 'Project'

function unitType(value?: string | null): EffectiveType | 'Combined' {
  switch ((value ?? '').trim().toLowerCase()) {
    case 'practical': return 'Practical'
    case 'project': return 'Project'
    case 'combined': return 'Combined'
    default: return 'Theory'
  }
}

export default function UniversityExamMaterialPrintPage() {
  const permissions = usePagePermissions()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [selectedIntakeGuid, setSelectedIntakeGuid] = useState('')
  const [programGuid, setProgramGuid] = useState('')
  const [semesterGuid, setSemesterGuid] = useState('')
  const [courseUnitGuid, setCourseUnitGuid] = useState('')
  const [combinedType, setCombinedType] = useState<'Theory' | 'Practical'>('Theory')
  const [confirmation, setConfirmation] = useState<{ message: string; action: () => void } | null>(null)

  const showToast = (msg: string, type = '') => {
    setToast({ msg, type })
    window.setTimeout(() => setToast(null), 3500)
  }

  const { data: currentIntake, isLoading: currentIntakeLoading } = useCurrentAcademicIntake()
  const { data: allIntakes, isLoading: allIntakesLoading } = useIntakes()
  const intakeLoading = currentIntakeLoading || allIntakesLoading

  const intakeOptions = useMemo(() => {
    if (currentIntake) {
      return [{
        value: currentIntake.intakeGuid,
        label: `${currentIntake.description || currentIntake.intakeCode} (Current)`,
      }]
    }
    const currentFromAll = (allIntakes ?? []).filter(i => i.currentIntake)
    if (currentFromAll.length > 0) {
      return currentFromAll.map(i => ({
        value: i.intakeGuid,
        label: `${i.description || i.intakeCode} (Current)`,
      }))
    }
    if ((allIntakes ?? []).length > 0) {
      const fallback = allIntakes![0]
      return [{
        value: fallback.intakeGuid,
        label: `${fallback.description || fallback.intakeCode} (Current)`,
      }]
    }
    return []
  }, [currentIntake, allIntakes])

  useEffect(() => {
    if (!selectedIntakeGuid && intakeOptions.length > 0) {
      setSelectedIntakeGuid(intakeOptions[0].value)
    }
  }, [intakeOptions, selectedIntakeGuid])

  const { data: programs, isLoading: programsLoading } = useUeMaterialPrintPrograms()
  const { data: semesters, isLoading: semestersLoading } = useUeMaterialPrintSemesters(programGuid || null)
  const { data: courseUnits, isLoading: unitsLoading } = useUeQuestionPrintCourseUnits(
    programGuid, semesterGuid, Boolean(programGuid && semesterGuid),
  )
  const { data: programUnits } = useUeMaterialPrintProgramUnits(programGuid || null)

  const selectedUnitType = useMemo(() => {
    const selected = (programUnits ?? []).find(unit =>
      unit.courseUnitGuid === courseUnitGuid && unit.semesterGuid === semesterGuid,
    )
    return unitType(selected?.unitTypeName)
  }, [courseUnitGuid, programUnits, semesterGuid])
  const effectiveType: EffectiveType = selectedUnitType === 'Combined' ? combinedType : selectedUnitType
  const intakeGuid = selectedIntakeGuid || currentIntake?.intakeGuid || ''
  const formComplete = Boolean(intakeGuid && programGuid && semesterGuid && courseUnitGuid)
  const canPrintBooklet = formComplete && effectiveType === 'Theory' && permissions.add
  const canPrintQuestionPaper = formComplete && effectiveType !== 'Project' && permissions.add

  const printBooklet = usePrintUeBooklet()
  const downloadBooklet = useDownloadUeBookletPdf()
  const printTheory = usePrintUeQuestionTheory()
  const downloadTheoryWord = useDownloadUeQuestionTheoryWord()
  const printPractical = usePrintUeQuestionPractical()
  const downloadPracticalWord = useDownloadUeQuestionPracticalWord()
  const isWorking = printBooklet.isPending || downloadBooklet.isPending || printTheory.isPending ||
    downloadTheoryWord.isPending || printPractical.isPending || downloadPracticalWord.isPending

  const request = (confirm = false) => ({ programGuid, semesterGuid, courseUnitGuid, intakeGuid, confirm })
  const reset = () => {
    setProgramGuid('')
    setSemesterGuid('')
    setCourseUnitGuid('')
    setCombinedType('Theory')
    if (intakeOptions.length > 0) {
      setSelectedIntakeGuid(intakeOptions[0].value)
    }
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

  const handleQuestionPaperPrint = async (confirm = false) => {
    if (!canPrintQuestionPaper || isWorking) return
    try {
      const result = effectiveType === 'Practical'
        ? await printPractical.mutateAsync(request(confirm))
        : await printTheory.mutateAsync(request(confirm))
      if (result.outcome === 'ConfirmationRequired' || result.outcome === 4) {
        setConfirmation({
          message: result.message || 'Questions are already printed. Do you want to reprint the same?',
          action: () => handleQuestionPaperPrint(true),
        })
        return
      }
      if (result.outcome === 'ExamRuleNotSet' || result.outcome === 2) {
        showToast(result.message || 'University Exam not yet Scheduled!!', 'error')
        return
      }
      if (result.outcome === 'QuestionsNotAvailable' || result.outcome === 3) {
        showToast(result.message || 'Questions are not yet uploaded!!', 'error')
        return
      }
      if (result.outcome === 'Printed' || result.outcome === 'Reprinted' || result.outcome === 0 || result.outcome === 1) {
        const file = effectiveType === 'Practical'
          ? await downloadPracticalWord.mutateAsync(request())
          : await downloadTheoryWord.mutateAsync(request())
        download(file.blob, file.filename, 'QuestionPaper.doc')
        showToast('Question paper downloaded successfully.', 'success')
      }
    } catch (error: any) {
      showToast(error?.message || 'Failed to print question paper.', 'error')
    }
  }

  const bookletHint = !formComplete ? 'Select Programme, Semester and Course Unit first.'
    : effectiveType !== 'Theory' ? 'Booklet printing is currently available for Theory only.'
      : !permissions.add ? 'You do not have permission to print booklets.' : ''

  return (
    <div className="page active">
      <div className="pg-hdr">
        <h1 className="pg-title">University Exam Material Print</h1>
        <p className="pg-sub">Print the exam booklet or question paper for the current intake.</p>
      </div>

      <div className="card mb-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5">
          <div className="fg mb-0">
            <label className="lbl">Academic Intake <span className="text-red-500">*</span></label>
            <SearchSelect
              placeholder="— Select Intake —"
              value={selectedIntakeGuid}
              onChange={setSelectedIntakeGuid}
              disabled={intakeLoading}
              options={intakeOptions}
            />
          </div>
          <div className="fg mb-0">
            <label className="lbl">Programme <span className="text-red-500">*</span></label>
            <SearchSelect placeholder="— Select Programme —" value={programGuid}
              onChange={guid => { setProgramGuid(guid); setSemesterGuid(''); setCourseUnitGuid(''); setCombinedType('Theory') }}
              disabled={programsLoading || intakeLoading}
              options={(programs ?? []).map(program => ({ value: program.programGuid, label: program.programName }))} />
          </div>
          <div className="fg mb-0">
            <label className="lbl">Semester <span className="text-red-500">*</span></label>
            <SearchSelect placeholder="— Select Semester —" value={semesterGuid}
              onChange={guid => { setSemesterGuid(guid); setCourseUnitGuid(''); setCombinedType('Theory') }}
              disabled={!programGuid || semestersLoading}
              options={(semesters ?? []).map(semester => ({ value: semester.semesterGuid, label: semester.semName }))} />
          </div>
          <div className="fg mb-0">
            <label className="lbl">Course Unit <span className="text-red-500">*</span></label>
            <SearchSelect placeholder="— Select Course Unit —" value={courseUnitGuid}
              onChange={guid => { setCourseUnitGuid(guid); setCombinedType('Theory') }}
              disabled={!semesterGuid || unitsLoading}
              options={(courseUnits ?? []).map(unit => ({ value: unit.courseUnitGuid, label: `${unit.courseUnitCode} - ${unit.courseUnitName}` }))} />
          </div>
        </div>

        {selectedUnitType === 'Combined' && (
          <div className="px-5 py-4 border-t border-gray-100 bg-slate-50 flex items-center gap-6">
            <span className="lbl mb-0">Print component</span>
            {(['Theory', 'Practical'] as const).map(type => (
              <label key={type} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="radio" name="combined-unit-type" checked={combinedType === type}
                  onChange={() => setCombinedType(type)} className="w-4 h-4 text-primary" />
                {type}
              </label>
            ))}
          </div>
        )}

        <div className="p-5 pt-0 flex flex-wrap gap-3">
          <button className="btn btn-primary" onClick={() => handleBookletPrint()} disabled={!canPrintBooklet || isWorking} title={bookletHint}>
            <i className="lni lni-printer" /> Print
          </button>
          {effectiveType !== 'Project' && (
            <button className="btn btn-neu" onClick={() => handleQuestionPaperPrint()} disabled={!canPrintQuestionPaper || isWorking}
              title={!permissions.add ? 'You do not have permission to print question papers.' : ''}>
              <i className="lni lni-download" /> QP Print in MS Word
            </button>
          )}
          <button className="btn btn-neu" onClick={reset} disabled={isWorking}><i className="lni lni-reload" /> Refresh</button>
        </div>
      </div>

      {confirmation && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setConfirmation(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={event => event.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-warning" /></div>
            <div className="perm-delete-title">Confirmation Required</div>
            <div className="perm-delete-sub">{confirmation.message}</div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setConfirmation(null)}>No</button>
              <button className="btn btn-primary" onClick={() => { const action = confirmation.action; setConfirmation(null); action() }}>Yes</button>
            </div>
          </div>
        </div>
      )}
      <Toast toast={toast} />
    </div>
  )
}
