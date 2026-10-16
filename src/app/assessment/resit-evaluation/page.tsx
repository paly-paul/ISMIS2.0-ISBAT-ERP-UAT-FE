'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { SearchSelect } from '@/components/SearchSelect'
import { Toast } from '@/components/Toast'
import { useIntakesDropdown } from '@/hooks/academic/useIntakes'
import { useResitConfigs } from '@/hooks/assessment/useResitConfigs'
import {
  RESIT_EVALUATION_KEYS,
  useResitEvaluationQuestions,
  useResitEvaluationStudents,
  useResitEvaluationUnits,
  useSaveResitEvaluationMark,
  useSubmitResitEvaluation,
} from '@/hooks/assessment/useResitEvaluation'
import type {
  ResitEvaluationQuestions,
  ResitEvaluationStudent,
  ResitEvaluationStudents,
  ResitEvaluationUnit,
} from '@/lib/api/assessment/resitEvaluation'

// Resit IA Evaluation (resit-ia-evaluation/resit-ia-evaluation-page.md).
// Two screens: a dashboard of the lecturer's units (Pending / Evaluated
// tabs), and an evaluate screen with the unit's students on the left and the
// selected student's questions on the right. Marks are saved one answer at a
// time as the lecturer leaves the Mark box; Submit locks the student.

type Screen = 'dashboard' | 'evaluate'
type SaveState = { status: 'saving' | 'saved' | 'error'; msg?: string }

const SECTION_LABELS: Record<number, string> = { 1: 'Section A', 2: 'Section B', 3: 'Section C' }
const QUESTION_TYPE_LABELS: Record<number, string> = { 1: 'MCQ', 2: 'Descriptive' }

function errCode(err: unknown): string | undefined {
  return (err as { code?: string } | null)?.code
}

function errMsg(err: unknown, fallback: string): string {
  return (err as { message?: string } | null)?.message || fallback
}

function fmtMark(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, '')
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Client-side check before the PUT (put-resit-evaluation-mark.md#validation).
// Returns the parsed mark, or an error message.
function parseMark(raw: string, maxMark: number): { value: number | null } | { error: string } {
  const t = raw.trim()
  if (t === '') return { value: null }
  if (!/^-?\d+(\.\d+)?$/.test(t)) return { error: 'Enter a valid number.' }
  const n = Number(t)
  if (n < 0) return { error: 'Mark cannot be negative.' }
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { error: 'Mark can have at most 2 decimal places.' }
  if (n > maxMark) return { error: `Invalid mark. The maximum mark for this question is ${fmtMark(maxMark)}.` }
  return { value: n }
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const complete = total > 0 && done >= total
  return (
    <div className="prog-bar-track" style={{ height: 8 }}>
      <div className="prog-bar-fill" style={{ width: `${pct}%`, background: complete ? 'var(--green)' : 'var(--amber)' }} />
    </div>
  )
}

export default function ResitEvaluationPage() {
  const queryClient = useQueryClient()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // ── Filters ──────────────────────────────────────────────────────────────
  const [intakeGuid, setIntakeGuid] = useState('')
  const [resitConfigGuid, setResitConfigGuid] = useState('')

  const { data: intakes, isLoading: intakesLoading } = useIntakesDropdown()
  useEffect(() => {
    if (intakes && intakes.length > 0 && !intakeGuid) {
      const current = intakes.find(i => i.currentIntake) || intakes[0]
      if (current) setIntakeGuid(current.intakeGuid)
    }
  }, [intakes, intakeGuid])

  const { data: resitConfigsData, isLoading: configsLoading } = useResitConfigs(1, 50, intakeGuid || undefined)
  const resitConfigs = useMemo(() => resitConfigsData?.items ?? [], [resitConfigsData])
  // Academic Session change → select that intake's active resit (or the first).
  useEffect(() => {
    if (!intakeGuid || !resitConfigsData) return
    const active = resitConfigs.find(r => r.isActive) || resitConfigs[0]
    setResitConfigGuid(active?.resitConfigGuid ?? '')
  }, [resitConfigsData, resitConfigs, intakeGuid])
  const noResit = !!intakeGuid && !configsLoading && !!resitConfigsData && resitConfigs.length === 0

  // ── Screen 1: dashboard ──────────────────────────────────────────────────
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [tab, setTab] = useState<'pending' | 'evaluated'>('pending')
  const [unitSearch, setUnitSearch] = useState('')

  const unitsQuery = useResitEvaluationUnits(intakeGuid, resitConfigGuid)
  const pendingUnits = unitsQuery.data?.pending ?? []
  const evaluatedUnits = unitsQuery.data?.evaluated ?? []
  const tabUnits = tab === 'pending' ? pendingUnits : evaluatedUnits
  const visibleUnits = useMemo(() => {
    const q = unitSearch.trim().toLowerCase()
    if (!q) return tabUnits
    return tabUnits.filter(u => (u.unitCode ?? '').toLowerCase().includes(q) || (u.unitName ?? '').toLowerCase().includes(q))
  }, [tabUnits, unitSearch])

  // ── Screen 2: evaluate ───────────────────────────────────────────────────
  const [selectedUnit, setSelectedUnit] = useState<ResitEvaluationUnit | null>(null)
  const [openedFromView, setOpenedFromView] = useState(false)
  const [selectedAppGuid, setSelectedAppGuid] = useState<string | null>(null)
  const [unitComplete, setUnitComplete] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const [qIndex, setQIndex] = useState(0)
  const [markInputs, setMarkInputs] = useState<Record<string, string>>({})
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  const studentsQuery = useResitEvaluationStudents(screen === 'evaluate' ? selectedUnit?.courseUnitGuid ?? null : null, intakeGuid, resitConfigGuid)
  const students = useMemo(() => studentsQuery.data?.students ?? [], [studentsQuery.data])
  const minQuestion = studentsQuery.data?.minQuestion ?? 0
  const evaluatedTotal = students.filter(s => s.evaluationStatus === 1).length

  const visibleStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase()
    if (!q) return students
    return students.filter(s => (s.studentName ?? '').toLowerCase().includes(q) || (s.studentRegNo ?? '').toLowerCase().includes(q))
  }, [students, studentSearch])

  const selectedStudent = students.find(s => s.resitApplicationGuid === selectedAppGuid) ?? null

  // Flow step 3: open the first student that is not evaluated (from View:
  // the first student).
  useEffect(() => {
    if (screen !== 'evaluate' || unitComplete || selectedAppGuid || !studentsQuery.data) return
    const first = openedFromView ? students[0] : students.find(s => s.evaluationStatus === 0) ?? students[0]
    if (first) setSelectedAppGuid(first.resitApplicationGuid)
  }, [screen, unitComplete, selectedAppGuid, studentsQuery.data, students, openedFromView])

  const questionsQuery = useResitEvaluationQuestions(screen === 'evaluate' && !unitComplete ? selectedAppGuid : null)
  const questionsData = questionsQuery.data
  const questions = useMemo(() => questionsData?.questions ?? [], [questionsData])
  const isEvaluated = selectedStudent?.evaluationStatus === 1 || questionsData?.evaluationStatus === 1
  const currentQuestion = questions[qIndex] ?? null
  const markedCount = questions.filter(q => q.mark !== null).length
  const marksSum = questions.reduce((sum, q) => sum + (q.mark ?? 0), 0)
  const isSaving = Object.values(saveStates).some(s => s.status === 'saving')

  // Flow step 4: on opening a student, seed the Mark boxes from the saved
  // marks and show the first question without a mark (or question 1). Keyed
  // on the application guid so later cache patches don't reset the inputs.
  const seededForRef = useRef<string | null>(null)
  useEffect(() => {
    if (!questionsData || seededForRef.current === questionsData.resitApplicationGuid) return
    seededForRef.current = questionsData.resitApplicationGuid
    const inputs: Record<string, string> = {}
    questionsData.questions.forEach(q => { inputs[q.answerGuid] = q.mark === null ? '' : String(q.mark) })
    setMarkInputs(inputs)
    setSaveStates({})
    setSubmitError(null)
    const firstUnmarked = questionsData.questions.findIndex(q => q.mark === null)
    setQIndex(firstUnmarked === -1 ? 0 : firstUnmarked)
  }, [questionsData])

  // ── Cache patches (the spec asks for no reload after a save) ─────────────
  const studentsKey = RESIT_EVALUATION_KEYS.students(selectedUnit?.courseUnitGuid ?? '', intakeGuid, resitConfigGuid)

  function patchStudent(appGuid: string, patch: Partial<ResitEvaluationStudent>) {
    queryClient.setQueryData<ResitEvaluationStudents>(studentsKey, old => old && {
      ...old,
      students: old.students.map(s => (s.resitApplicationGuid === appGuid ? { ...s, ...patch } : s)),
    })
  }

  function patchQuestionMark(appGuid: string, answerGuid: string, mark: number | null) {
    let newMarkedCount = 0
    queryClient.setQueryData<ResitEvaluationQuestions>(RESIT_EVALUATION_KEYS.questions(appGuid), old => {
      if (!old) return old
      const qs = old.questions.map(q => (q.answerGuid === answerGuid ? { ...q, mark } : q))
      newMarkedCount = qs.filter(q => q.mark !== null).length
      return { ...old, questions: qs, markedCount: newMarkedCount }
    })
    patchStudent(appGuid, { markedCount: newMarkedCount })
  }

  // ── Saving a mark ────────────────────────────────────────────────────────
  // Refs so commitCurrent() always reads the latest values, even when it's
  // called from a stale closure (blur racing a click on Next / a student).
  const saveMark = useSaveResitEvaluationMark()
  const latest = useRef({ selectedAppGuid, qIndex, markInputs, isEvaluated })
  latest.current = { selectedAppGuid, qIndex, markInputs, isEvaluated }
  const inflightRef = useRef<Promise<boolean> | null>(null)

  // Saves the current question's mark if it changed. Resolves false when the
  // mark is invalid or the save failed — callers then stay on the question
  // ("don't move away until it is fixed or cleared").
  async function commitCurrent(): Promise<boolean> {
    if (inflightRef.current) await inflightRef.current
    const { selectedAppGuid: appGuid, qIndex: idx, markInputs: inputs, isEvaluated: locked } = latest.current
    if (!appGuid || locked) return true
    const cached = queryClient.getQueryData<ResitEvaluationQuestions>(RESIT_EVALUATION_KEYS.questions(appGuid))
    const q = cached?.questions[idx]
    if (!q || q.isMcq) return true

    const parsed = parseMark(inputs[q.answerGuid] ?? '', q.maxMark)
    if ('error' in parsed) {
      setSaveStates(prev => ({ ...prev, [q.answerGuid]: { status: 'error', msg: parsed.error } }))
      return false
    }
    if (parsed.value === q.mark) {
      setSaveStates(prev => (prev[q.answerGuid]?.status === 'error' ? { ...prev, [q.answerGuid]: { status: 'saved' } } : prev))
      return true
    }

    setSaveStates(prev => ({ ...prev, [q.answerGuid]: { status: 'saving' } }))
    const run = saveMark
      .mutateAsync({ resitApplicationGuid: appGuid, answerGuid: q.answerGuid, mark: parsed.value })
      .then(res => {
        patchQuestionMark(appGuid, q.answerGuid, res?.mark ?? parsed.value)
        setSaveStates(prev => ({ ...prev, [q.answerGuid]: { status: 'saved' } }))
        return true
      })
      .catch(err => {
        const code = errCode(err)
        setSaveStates(prev => ({ ...prev, [q.answerGuid]: { status: 'error', msg: errMsg(err, 'Could not save the mark.') } }))
        if (code === 'conflict') {
          showToast(errMsg(err, 'This student is already evaluated.'), 'error')
          queryClient.invalidateQueries({ queryKey: studentsKey })
          queryClient.invalidateQueries({ queryKey: RESIT_EVALUATION_KEYS.questions(appGuid) })
        } else if (code === 'not_found') {
          showToast(errMsg(err, 'Not found.'), 'error')
          backToDashboard()
        }
        return false
      })
      .finally(() => { inflightRef.current = null })
    inflightRef.current = run
    return run
  }

  // ── Navigation ───────────────────────────────────────────────────────────
  function resetStudentState() {
    seededForRef.current = null
    setMarkInputs({})
    setSaveStates({})
    setSubmitError(null)
    setQIndex(0)
  }

  function openUnit(unit: ResitEvaluationUnit, fromView: boolean) {
    resetStudentState()
    setSelectedUnit(unit)
    setOpenedFromView(fromView)
    setSelectedAppGuid(null)
    setUnitComplete(false)
    setStudentSearch('')
    setScreen('evaluate')
  }

  function backToDashboard() {
    setScreen('dashboard')
    setSelectedUnit(null)
    setSelectedAppGuid(null)
    setUnitComplete(false)
    resetStudentState()
    queryClient.invalidateQueries({ queryKey: RESIT_EVALUATION_KEYS.units(intakeGuid, resitConfigGuid) })
  }

  async function handleBack() {
    if (await commitCurrent()) backToDashboard()
  }

  async function selectStudent(appGuid: string) {
    if (appGuid === selectedAppGuid && !unitComplete) return
    if (!(await commitCurrent())) return
    resetStudentState()
    setUnitComplete(false)
    setSelectedAppGuid(appGuid)
  }

  async function goToQuestion(i: number) {
    if (i === qIndex || i < 0 || i >= questions.length) return
    if (await commitCurrent()) setQIndex(i)
  }

  // Next student that isn't evaluated, after the current one in list order.
  function nextPendingStudent(list: ResitEvaluationStudent[], afterGuid: string | null): ResitEvaluationStudent | undefined {
    const start = list.findIndex(s => s.resitApplicationGuid === afterGuid)
    const ordered = start === -1 ? list : [...list.slice(start + 1), ...list.slice(0, start + 1)]
    return ordered.find(s => s.evaluationStatus === 0)
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  const submit = useSubmitResitEvaluation()
  const canSubmit = !!selectedStudent && !isEvaluated && markedCount >= minQuestion && !isSaving && !submit.isPending

  async function handleSubmit() {
    if (!selectedAppGuid || !canSubmit) return
    if (!(await commitCurrent())) return
    // Re-check against the cache: the commit above may have just cleared a mark.
    const cached = queryClient.getQueryData<ResitEvaluationQuestions>(RESIT_EVALUATION_KEYS.questions(selectedAppGuid))
    if ((cached?.questions.filter(q => q.mark !== null).length ?? 0) < minQuestion) return
    setSubmitError(null)
    const appGuid = selectedAppGuid
    try {
      const res = await submit.mutateAsync(appGuid)
      showToast(`Evaluation submitted — ${fmtMark(res.totalMark)} / ${fmtMark(res.totalMaxMark)}.`, 'success')
      patchStudent(appGuid, { evaluationStatus: 1, mark: res.totalMark, maxMark: res.totalMaxMark, evaluatedDate: res.evaluatedDate })
      queryClient.setQueryData<ResitEvaluationQuestions>(RESIT_EVALUATION_KEYS.questions(appGuid), old => old && { ...old, evaluationStatus: 1 })
      const updated = queryClient.getQueryData<ResitEvaluationStudents>(studentsKey)?.students ?? []
      const next = res.remainingPendingCount > 0 ? nextPendingStudent(updated, appGuid) : undefined
      resetStudentState()
      if (next) {
        setSelectedAppGuid(next.resitApplicationGuid)
      } else {
        setSelectedAppGuid(null)
        setUnitComplete(true)
      }
    } catch (err) {
      const code = errCode(err)
      if (code === 'bad_request' || code === 'validation_error') {
        setSubmitError(errMsg(err, 'Minimum questions are not evaluated.'))
      } else if (code === 'conflict') {
        showToast(errMsg(err, 'This student is already evaluated.'), 'error')
        const refreshed = await studentsQuery.refetch()
        const next = nextPendingStudent(refreshed.data?.students ?? [], appGuid)
        resetStudentState()
        if (next) setSelectedAppGuid(next.resitApplicationGuid)
        else { setSelectedAppGuid(null); setUnitComplete(true) }
      } else if (code === 'not_found') {
        showToast(errMsg(err, 'Not found.'), 'error')
        backToDashboard()
      } else {
        showToast(errMsg(err, 'Could not submit the evaluation.'), 'error')
      }
    }
  }

  // Errors from opening a unit or a student (flow error table): 404 → back
  // to the dashboard; anything else is shown inline with a Retry.
  useEffect(() => {
    const err = studentsQuery.error ?? questionsQuery.error
    if (err && errCode(err) === 'not_found' && screen === 'evaluate') {
      showToast(errMsg(err, 'Not found.'), 'error')
      backToDashboard()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentsQuery.error, questionsQuery.error])

  // ── Render ───────────────────────────────────────────────────────────────
  const filters = (
    <div className="flex gap-3 items-end flex-wrap">
      <div className="w-64">
        <label className="block text-xs font-medium text-g500 mb-1">Academic Session</label>
        <SearchSelect
          placeholder="Select academic session…"
          value={intakeGuid}
          onChange={v => { setIntakeGuid(v); setResitConfigGuid('') }}
          disabled={intakesLoading || screen === 'evaluate'}
          options={(intakes ?? []).map(i => ({ value: i.intakeGuid, label: `${i.description || 'Intake'} (${i.intakeCode})` }))}
        />
      </div>
      <div className="w-64">
        <label className="block text-xs font-medium text-g500 mb-1">Resit</label>
        <SearchSelect
          placeholder={configsLoading ? 'Loading…' : noResit ? 'No resit found' : 'Select resit…'}
          value={resitConfigGuid}
          onChange={setResitConfigGuid}
          disabled={configsLoading || noResit || screen === 'evaluate'}
          options={resitConfigs.map(r => ({ value: r.resitConfigGuid, label: r.refCode || 'Unnamed resit' }))}
        />
      </div>
    </div>
  )

  function renderDashboard() {
    const loading = unitsQuery.isLoading && !!resitConfigGuid
    let empty: string | null = null
    if (noResit) empty = 'No resit found for this academic session.'
    else if (!loading && unitsQuery.data) {
      if (pendingUnits.length === 0 && evaluatedUnits.length === 0) empty = 'You have no resit units to evaluate in this session.'
      else if (tab === 'pending' && pendingUnits.length === 0) empty = 'All caught up — nothing pending for evaluation.'
      else if (tabUnits.length > 0 && visibleUnits.length === 0) empty = 'No units match your search.'
      else if (tabUnits.length === 0) empty = 'No evaluated units yet.'
    }

    return (
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-2" style={{ paddingRight: 16 }}>
          <div className="tab-bar" style={{ borderBottom: 'none' }}>
            <button className={`tab-btn${tab === 'pending' ? ' active' : ''}`} onClick={() => setTab('pending')}>
              Pending <span className="badge badge-amber">{noResit ? 0 : pendingUnits.length}</span>
            </button>
            <button className={`tab-btn${tab === 'evaluated' ? ' active' : ''}`} onClick={() => setTab('evaluated')}>
              Evaluated <span className="badge badge-green">{noResit ? 0 : evaluatedUnits.length}</span>
            </button>
          </div>
          <div className="inp-wrap w-64">
            <i className="lni lni-search-alt inp-icon"></i>
            <input className="ctrl" placeholder="Search unit…" value={unitSearch} onChange={e => setUnitSearch(e.target.value)} />
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--g200)', padding: 16 }}>
          {unitsQuery.isError && !noResit ? (
            <div className="empty">
              <div className="empty-icon"><i className="lni lni-warning"></i></div>
              <div className="empty-title">Couldn&apos;t load units</div>
              <div className="empty-sub">{errMsg(unitsQuery.error, 'Please try again.')}</div>
              <button className="btn btn-neu btn-sm mt-3" onClick={() => unitsQuery.refetch()}><i className="lni lni-reload"></i> Retry</button>
            </div>
          ) : loading ? (
            <div className="empty"><div className="empty-sub">Loading units…</div></div>
          ) : empty ? (
            <div className="empty">
              <div className="empty-icon"><i className={`lni ${tab === 'pending' && pendingUnits.length === 0 && evaluatedUnits.length > 0 ? 'lni-checkmark-circle' : 'lni-folder'}`}></i></div>
              <div className="empty-sub">{empty}</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleUnits.map(u => {
                const programmes = u.programmeNames.join(', ')
                const complete = u.submittedCount > 0 && u.evaluatedCount >= u.submittedCount
                return (
                  <div key={u.courseUnitGuid} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 0 }}>
                    <div className="flex items-start justify-between gap-2">
                      <strong className="font-mono">{u.unitCode ?? '—'}</strong>
                      <span className="badge badge-grey">{u.categoryLabel}</span>
                    </div>
                    <div className="text-g800" style={{ fontWeight: 600 }}>{u.unitName ?? 'Unit name unavailable'}</div>
                    <div className="text-xs text-g500 truncate" title={programmes}>{programmes || '—'}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div style={{ flex: 1 }}><ProgressBar done={u.evaluatedCount} total={u.submittedCount} /></div>
                      <span className="text-xs text-g600" style={{ whiteSpace: 'nowrap' }}>
                        {u.evaluatedCount} of {u.submittedCount} done {complete && <i className="lni lni-checkmark" style={{ color: 'var(--green)' }}></i>}
                      </span>
                    </div>
                    <div className="text-xs text-g500">{u.headCount} applied · {u.submittedCount} submitted · {u.pendingCount} pending</div>
                    <div className="flex justify-end mt-2">
                      {tab === 'pending' ? (
                        <button className="btn btn-primary btn-sm" onClick={() => openUnit(u, false)}>
                          {u.evaluatedCount > 0 ? 'Continue' : 'Start evaluating'} <i className="lni lni-arrow-right"></i>
                        </button>
                      ) : (
                        <button className="btn btn-neu btn-sm" onClick={() => openUnit(u, true)}><i className="lni lni-eye"></i> View</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  function studentIcon(s: ResitEvaluationStudent) {
    if (s.evaluationStatus === 1) return <i className="lni lni-checkmark-circle" style={{ color: 'var(--green)' }} title="Evaluated"></i>
    if (s.markedCount > 0) return <span style={{ color: 'var(--amber)' }} title="In progress">●</span>
    return <span style={{ color: 'var(--g400)' }} title="Not started">○</span>
  }

  function renderStudentPanel() {
    if (unitComplete) {
      return (
        <div className="card empty">
          <div className="empty-icon"><i className="lni lni-checkmark-circle" style={{ color: 'var(--green)' }}></i></div>
          <div className="empty-title">All {students.length} student{students.length === 1 ? '' : 's'} {students.length === 1 ? 'is' : 'are'} evaluated</div>
          <button className="btn btn-primary btn-sm mt-3" onClick={backToDashboard}>Back to dashboard</button>
        </div>
      )
    }
    if (!selectedStudent) return null
    if (questionsQuery.isError && errCode(questionsQuery.error) !== 'not_found') {
      return (
        <div className="card empty">
          <div className="empty-icon"><i className="lni lni-warning"></i></div>
          <div className="empty-sub">{errMsg(questionsQuery.error, 'Could not load the questions.')}</div>
          <button className="btn btn-neu btn-sm mt-3" onClick={() => questionsQuery.refetch()}><i className="lni lni-reload"></i> Retry</button>
        </div>
      )
    }
    if (questionsQuery.isLoading || !questionsData) {
      return <div className="card empty"><div className="empty-sub">Loading questions…</div></div>
    }

    const minReached = markedCount >= minQuestion
    const q = currentQuestion
    const state = q ? saveStates[q.answerGuid] : undefined
    const readOnly = isEvaluated || !!q?.isMcq

    return (
      <div className="card" style={{ padding: 0, marginBottom: 0 }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--g200)' }}>
          <div className="text-g900" style={{ fontWeight: 700 }}>
            {selectedStudent.studentName ?? 'Student details unavailable'} · <span className="font-mono">{selectedStudent.studentRegNo ?? '—'}</span>
          </div>
          <div className="text-xs text-g500 mt-0.5">{selectedStudent.programmeName ?? '—'}</div>
          <div className="flex items-center justify-between flex-wrap gap-2 mt-2 text-sm">
            <span style={{ color: minReached ? 'var(--green)' : 'var(--g600)' }}>
              Marked {markedCount} of {questions.length} · at least {minQuestion} needed
            </span>
            {isEvaluated ? (
              <strong>Total {fmtMark(selectedStudent.mark)} / {fmtMark(selectedStudent.maxMark)}</strong>
            ) : (
              <span className="text-g600" title="The final total counts the best N marks in each section (N = the section's attempt count) and is calculated when you submit.">
                Marks entered: <strong>{fmtMark(marksSum)}</strong> <i className="lni lni-information"></i>
              </span>
            )}
          </div>
          {submitError && <div className="field-hint" style={{ color: 'var(--red)' }}>{submitError}</div>}
        </div>

        {isEvaluated && (
          <div className="success-box" style={{ margin: 16, marginBottom: 0 }}>
            <i className="lni lni-checkmark-circle"></i>
            Evaluated on {fmtDate(selectedStudent.evaluatedDate)} — {fmtMark(selectedStudent.mark)} / {fmtMark(selectedStudent.maxMark)}
          </div>
        )}

        <div style={{ padding: 16 }}>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="text-xs text-g500">Questions</span>
            {questions.map((x, i) => (
              <button
                key={x.answerGuid}
                className={`btn btn-sm ${i === qIndex ? 'btn-primary' : 'btn-neu'}`}
                style={{ minWidth: 40 }}
                onClick={() => goToQuestion(i)}
              >
                {x.questionNumber}{x.mark !== null && ' ✓'}
              </button>
            ))}
          </div>

          {!q ? (
            <div className="empty"><div className="empty-sub">This submission has no questions.</div></div>
          ) : (
            <div style={{ border: '1px solid var(--g200)', borderRadius: 'var(--rsm)' }}>
              <div style={{ padding: 14, borderBottom: '1px solid var(--g200)' }}>
                <div className="flex items-center justify-between text-xs text-g500 mb-2">
                  <span>
                    Q{q.questionNumber} · {SECTION_LABELS[q.section ?? 1] ?? 'Section A'}
                    {q.questionType !== null && ` · ${QUESTION_TYPE_LABELS[q.questionType] ?? 'Question'}`}
                  </span>
                  <span>Max {fmtMark(q.maxMark)}</span>
                </div>
                {q.questionText === null ? (
                  <div className="text-g400" style={{ fontStyle: 'italic' }}>Question not available.</div>
                ) : (
                  <div className="text-g800" dangerouslySetInnerHTML={{ __html: q.questionText }} />
                )}
              </div>

              <div style={{ padding: 14, borderBottom: '1px solid var(--g200)', background: 'var(--g50, var(--g100))' }}>
                <div className="text-xs text-g500 mb-1">Student&apos;s answer</div>
                {q.answerText?.trim() ? (
                  <div className="text-g800" style={{ whiteSpace: 'pre-wrap' }}>{q.answerText}</div>
                ) : (
                  <div className="text-g400" style={{ fontStyle: 'italic' }}>No typed answer.</div>
                )}
                {q.answerFileUrl && (
                  <div className="flex items-center gap-2 mt-2 text-sm">
                    <i className="lni lni-files"></i>
                    <span>{q.answerFileName ?? 'Attachment'}</span>
                    <a className="btn btn-neu btn-sm" href={q.answerFileUrl} target="_blank" rel="noopener noreferrer">Open</a>
                  </div>
                )}
              </div>

              <div style={{ padding: 14 }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-sm text-g600" htmlFor="resit-mark">Mark</label>
                  <input
                    id="resit-mark"
                    className="ctrl"
                    style={{ width: 100 }}
                    type="number"
                    step="0.01"
                    min={0}
                    max={q.maxMark}
                    inputMode="decimal"
                    value={markInputs[q.answerGuid] ?? ''}
                    readOnly={readOnly}
                    disabled={readOnly}
                    onChange={e => {
                      const v = e.target.value
                      setMarkInputs(prev => ({ ...prev, [q.answerGuid]: v }))
                      if (state?.status === 'error') setSaveStates(prev => { const s = { ...prev }; delete s[q.answerGuid]; return s })
                    }}
                    onBlur={() => { void commitCurrent() }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  />
                  <span className="text-sm text-g600">/ {fmtMark(q.maxMark)}</span>
                  {q.isMcq && !isEvaluated && <span className="text-xs text-g400">Marked automatically</span>}
                  <span className="text-xs" style={{ marginLeft: 'auto' }}>
                    {state?.status === 'saving' && <span className="text-g500">Saving…</span>}
                    {state?.status === 'saved' && <span style={{ color: 'var(--green)' }}>✓ Saved</span>}
                  </span>
                </div>
                {state?.status === 'error' && <div className="field-hint" style={{ color: 'var(--red)' }}>{state.msg}</div>}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-3">
            <button className="btn btn-neu btn-sm" disabled={qIndex === 0} onClick={() => goToQuestion(qIndex - 1)}>
              <i className="lni lni-chevron-left"></i> Previous
            </button>
            <button className="btn btn-neu btn-sm" disabled={qIndex >= questions.length - 1} onClick={() => goToQuestion(qIndex + 1)}>
              Next <i className="lni lni-chevron-right"></i>
            </button>
          </div>
          {!isEvaluated && (
            <div className="flex justify-end mt-3">
              <span title={markedCount < minQuestion ? `Mark at least ${minQuestion} question(s) first.` : undefined}>
                <button className="btn btn-primary" disabled={!canSubmit} onClick={handleSubmit}>
                  {submit.isPending ? 'Submitting…' : 'Submit evaluation'} <i className="lni lni-checkmark"></i>
                </button>
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderEvaluate() {
    const unitCode = studentsQuery.data?.unitCode ?? selectedUnit?.unitCode ?? '—'
    const unitName = studentsQuery.data?.unitName ?? selectedUnit?.unitName ?? ''

    return (
      <>
        <div className="card" style={{ padding: 16 }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <button className="btn btn-neu btn-sm" onClick={handleBack}><i className="lni lni-arrow-left"></i> Back</button>
              <strong>{unitCode}{unitName && ` · ${unitName}`}</strong>
            </div>
            <span className="text-sm text-g600">{evaluatedTotal} of {students.length} evaluated</span>
          </div>
          <div className="mt-2"><ProgressBar done={evaluatedTotal} total={students.length} /></div>
        </div>

        {studentsQuery.isLoading ? (
          <div className="card empty"><div className="empty-sub">Loading students…</div></div>
        ) : studentsQuery.isError && errCode(studentsQuery.error) !== 'not_found' ? (
          <div className="card empty">
            <div className="empty-icon"><i className="lni lni-warning"></i></div>
            <div className="empty-sub">{errMsg(studentsQuery.error, 'Could not load the students.')}</div>
            <button className="btn btn-neu btn-sm mt-3" onClick={() => studentsQuery.refetch()}><i className="lni lni-reload"></i> Retry</button>
          </div>
        ) : students.length === 0 ? (
          <div className="card empty">
            <div className="empty-icon"><i className="lni lni-users"></i></div>
            <div className="empty-sub">No submissions for this unit.</div>
            <button className="btn btn-neu btn-sm mt-3" onClick={backToDashboard}><i className="lni lni-arrow-left"></i> Back</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 items-start">
            <div className="card" style={{ padding: 0, marginBottom: 0 }}>
              <div style={{ padding: 12, borderBottom: '1px solid var(--g200)' }}>
                <div className="text-sm text-g700 mb-2" style={{ fontWeight: 600 }}>Students</div>
                <div className="inp-wrap">
                  <i className="lni lni-search-alt inp-icon"></i>
                  <input className="ctrl" placeholder="Search…" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                </div>
              </div>
              <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                {visibleStudents.length === 0 && <div className="text-sm text-g400" style={{ padding: 12 }}>No students match your search.</div>}
                {visibleStudents.map(s => {
                  const active = s.resitApplicationGuid === selectedAppGuid && !unitComplete
                  return (
                    <button
                      key={s.resitApplicationGuid}
                      onClick={() => selectStudent(s.resitApplicationGuid)}
                      className="w-full text-left"
                      style={{ display: 'flex', gap: 10, padding: '10px 12px', background: active ? 'var(--b50)' : 'transparent', borderWidth: '0 0 1px', borderStyle: 'solid', borderColor: 'var(--g100)', cursor: 'pointer' }}
                    >
                      <span style={{ width: 16, textAlign: 'center' }}>{studentIcon(s)}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="block truncate" style={{ fontWeight: active ? 700 : 500 }}>{s.studentName ?? '—'}</span>
                        <span className="block text-xs text-g400">
                          <span className="font-mono">{s.studentRegNo ?? '—'}</span>{'  '}
                          {s.evaluationStatus === 1
                            ? <span style={{ color: 'var(--green)' }}>{fmtMark(s.mark)} / {fmtMark(s.maxMark)}</span>
                            : <span>{s.markedCount}/{s.questionCount} marked</span>}
                        </span>
                      </span>
                      {active && <i className="lni lni-play" style={{ fontSize: 10, alignSelf: 'center' }}></i>}
                    </button>
                  )
                })}
              </div>
              <div className="text-xs text-g500" style={{ padding: 12, borderTop: '1px solid var(--g200)', display: 'grid', gap: 4 }}>
                <span><span style={{ color: 'var(--g400)' }}>○</span> Not started</span>
                <span><span style={{ color: 'var(--amber)' }}>●</span> In progress</span>
                <span><i className="lni lni-checkmark-circle" style={{ color: 'var(--green)' }}></i> Evaluated (read-only)</span>
              </div>
            </div>
            <div>{renderStudentPanel()}</div>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr flex justify-between items-end flex-wrap gap-3">
          <div>
            <div className="pg-title">Resit IA Evaluation</div>
            <div className="pg-sub">Mark submitted resit coursework (Course Work 1) for your units</div>
          </div>
          {filters}
        </div>
        {screen === 'dashboard' ? renderDashboard() : renderEvaluate()}
      </div>
      <Toast toast={toast} />
    </>
  )
}
