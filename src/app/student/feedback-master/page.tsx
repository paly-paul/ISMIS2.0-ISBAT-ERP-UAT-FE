'use client'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ScrollTable } from '@/components/ScrollTable'
import { SearchSelect } from '@/components/SearchSelect'
import { Toast } from '@/components/Toast'
import { AuthError } from '@/lib/api/client'
import { useIntakesDropdown } from '@/hooks/academic/useIntakes'
import {
  useFeedbackTypes,
  useFeedbacks,
  useFeedback,
  useFeedbackQuestions,
  useCreateFeedback,
  useUpdateFeedback,
  useDeleteFeedback,
  useAddFeedbackQuestion,
  useUpdateFeedbackQuestion,
  useDeleteFeedbackQuestion,
  FEEDBACK_QUESTION_TYPES,
  FeedbackListItem,
  FeedbackQuestion,
  FeedbackQuestionType,
} from '@/hooks/student/useFeedbackMaster'
import { getFeedbackQuestions } from '@/lib/api/student/feedbackMaster'
// import { usePagePermissions } from '@/hooks/users/usePagePermissions'

// Feedback Master (pages/students/feedback-master-admin-page.md) — replaces
// the legacy feedback master screen. Feedback forms per academic intake
// (code, description, assessment type), each holding the questions the
// student portal shows for course feedback. Two panels: the intake's
// feedback list on the left; the selected form's details and its questions
// on the right. Questions can only be added once a form is saved.
//
// No endpoint says whether students have responded to a FORM, so its type
// is locked when any of its questions has answers (hasAnswers) — the server
// enforces the real rule either way.

// Field errors from the envelope's errors[] (or its message), shown inline.
function errorLines(e: unknown, fallback: string): string[] {
  if (e instanceof AuthError && e.errors?.length) return e.errors
  return [e instanceof Error && e.message ? e.message : fallback]
}

function ErrorList({ lines }: { lines: string[] }) {
  if (!lines.length) return null
  return (
    <div className="text-clr-red" style={{ fontSize: 12, marginBottom: 10 }}>
      {lines.map((l, i) => <div key={i}><i className="lni lni-warning"></i> {l}</div>)}
    </div>
  )
}

type Confirm =
  | { kind: 'feedback'; row: FeedbackListItem }
  | { kind: 'question'; q: FeedbackQuestion }

export default function FeedbackMasterPage() {
  // Permission checks disabled for now — every action is allowed. Restore the
  // line below (and the import above) to gate actions by the menu permissions again.
  // const permissions = usePagePermissions()
  const permissions = { add: true, edit: true, delete: true }
  const queryClient = useQueryClient()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // ---- Intake (page-level context) ----------------------------------------
  const { data: intakes = [] } = useIntakesDropdown()
  const [intakeGuid, setIntakeGuid] = useState('')
  useEffect(() => {
    if (intakeGuid || intakes.length === 0) return
    setIntakeGuid((intakes.find(i => i.currentIntake) ?? intakes[0]).intakeGuid)
  }, [intakes, intakeGuid])
  const intakeLabel = (guid: string | null | undefined) => {
    const i = intakes.find(x => x.intakeGuid === guid)
    return i ? (i.description ? `${i.description} (${i.intakeCode})` : String(i.intakeCode)) : '—'
  }

  // ---- Feedback list ------------------------------------------------------
  const { data: types = [] } = useFeedbackTypes()
  const typeOptions = types.map(t => ({ value: t.assessmentTypeGuid, label: t.assessmentName ?? '—' }))
  const { data: feedbacks = [], isLoading: listLoading, isError: listError } = useFeedbacks(intakeGuid || null)
  const [search, setSearch] = useState('')
  const needle = search.trim().toLowerCase()
  const visible = needle
    ? feedbacks.filter(f => f.code.toLowerCase().includes(needle) || (f.description ?? '').toLowerCase().includes(needle) || (f.assessmentTypeName ?? '').toLowerCase().includes(needle))
    : feedbacks

  // ---- Selected feedback --------------------------------------------------
  const [selectedGuid, setSelectedGuid] = useState<string | null>(null)
  useEffect(() => { setSelectedGuid(null) }, [intakeGuid])
  const { data: detail, isLoading: detailLoading, isError: detailError } = useFeedback(selectedGuid)
  const { data: questionsRaw = [], isLoading: questionsLoading } = useFeedbackQuestions(selectedGuid)
  const questions = [...questionsRaw].sort((a, b) => a.sortOrder - b.sortOrder)
  const typeLocked = questions.some(q => q.hasAnswers)

  const [description, setDescription] = useState('')
  const [typeGuid, setTypeGuid] = useState('')
  const [detailErrors, setDetailErrors] = useState<string[]>([])
  useEffect(() => {
    setDescription(detail?.description ?? '')
    setTypeGuid(detail?.assessmentTypeGuid ?? '')
    setDetailErrors([])
  }, [detail])
  const updateFeedback = useUpdateFeedback()
  const detailDirty = !!detail && (description !== (detail.description ?? '') || typeGuid !== (detail.assessmentTypeGuid ?? ''))

  function saveDetail() {
    if (!detail) return
    const desc = description.trim()
    const errs: string[] = []
    if (!desc) errs.push('Description is required.')
    else if (desc.length > 200) errs.push('Description must be 200 characters or fewer.')
    if (!typeGuid) errs.push('Feedback Type is required.')
    setDetailErrors(errs)
    if (errs.length) return
    updateFeedback.mutate({ feedbackGuid: detail.feedbackGuid, input: { description: desc, assessmentTypeGuid: typeGuid } }, {
      onSuccess: () => showToast('Feedback updated successfully.', 'ok'),
      onError: e => setDetailErrors(errorLines(e, 'Could not update the feedback.')),
    })
  }

  // ---- Create feedback ----------------------------------------------------
  const [createOpen, setCreateOpen] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newType, setNewType] = useState('')
  const [createErrors, setCreateErrors] = useState<string[]>([])
  const createFeedback = useCreateFeedback()
  // One feedback per assessment type per intake — hide types already used.
  const usedTypes = new Set(feedbacks.map(f => f.assessmentTypeGuid))
  const freeTypeOptions = typeOptions.filter(o => !usedTypes.has(o.value))

  function openCreate() { setNewCode(''); setNewDesc(''); setNewType(''); setCreateErrors([]); setCreateOpen(true) }
  function submitCreate() {
    const code = newCode.trim()
    const desc = newDesc.trim()
    const errs: string[] = []
    if (!code) errs.push('Code is required.')
    else if (code.length > 50) errs.push('Code must be 50 characters or fewer.')
    if (!desc) errs.push('Description is required.')
    else if (desc.length > 200) errs.push('Description must be 200 characters or fewer.')
    if (!newType) errs.push('Feedback Type is required.')
    setCreateErrors(errs)
    if (errs.length) return
    createFeedback.mutate({ code, description: desc, assessmentTypeGuid: newType, intakeGuid }, {
      onSuccess: created => {
        setCreateOpen(false)
        showToast('Feedback created successfully.', 'ok')
        // Open the new form so questions can be added straight away.
        setSelectedGuid(created.feedbackGuid)
      },
      onError: e => setCreateErrors(errorLines(e, 'Could not create the feedback.')),
    })
  }

  // ---- Delete (feedback or question) --------------------------------------
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const deleteFeedback = useDeleteFeedback()
  const deleteQuestion = useDeleteFeedbackQuestion()

  // Questions must be deleted first. Checked client-side before confirming;
  // a row other than the open one has its questions fetched on demand.
  async function requestDeleteFeedback(row: FeedbackListItem) {
    try {
      const qs = row.feedbackGuid === selectedGuid
        ? questions
        : await queryClient.fetchQuery({ queryKey: ['feedback-master', 'questions', row.feedbackGuid], queryFn: () => getFeedbackQuestions(row.feedbackGuid), staleTime: 0 })
      if (qs.length > 0) { showToast('Delete all questions before deleting this feedback form.', 'warn'); setSelectedGuid(row.feedbackGuid); return }
      setConfirm({ kind: 'feedback', row })
    } catch (e) {
      showToast(errorLines(e, 'Could not check this feedback’s questions.')[0], 'error')
    }
  }

  function runConfirm() {
    if (!confirm) return
    if (confirm.kind === 'feedback') {
      const guid = confirm.row.feedbackGuid
      deleteFeedback.mutate(guid, {
        onSuccess: () => {
          setConfirm(null)
          if (selectedGuid === guid) setSelectedGuid(null)
          showToast('Feedback deleted successfully.', 'ok')
        },
        onError: e => { setConfirm(null); showToast(errorLines(e, 'Could not delete the feedback.')[0], 'error') },
      })
    } else if (selectedGuid) {
      const q = confirm.q
      deleteQuestion.mutate({ feedbackGuid: selectedGuid, questionGuid: q.questionGuid }, {
        onSuccess: () => {
          setConfirm(null)
          if (editingQ?.questionGuid === q.questionGuid) resetQuestionForm()
          showToast('Question deleted.', 'ok')
        },
        onError: e => {
          setConfirm(null)
          const msg = errorLines(e, '')[0]
          showToast(/answer/i.test(msg) || !msg ? 'Cannot delete: students have already answered this question.' : msg, 'error')
        },
      })
    }
  }

  // ---- Question form ------------------------------------------------------
  const [editingQ, setEditingQ] = useState<FeedbackQuestion | null>(null)
  const [qText, setQText] = useState('')
  const [qType, setQType] = useState<FeedbackQuestionType | ''>('')
  const [qSort, setQSort] = useState('')
  const [qErrors, setQErrors] = useState<string[]>([])
  const addQuestion = useAddFeedbackQuestion()
  const updateQuestion = useUpdateFeedbackQuestion()
  const qLocked = !!editingQ?.hasAnswers
  // Suggest the next multiple of 10 after the highest, per the doc's
  // "leave room for reordering" note.
  const nextSort = String(Math.floor(Math.max(0, ...questions.map(q => q.sortOrder)) / 10) * 10 + 10)

  function resetQuestionForm() { setEditingQ(null); setQText(''); setQType(''); setQSort(''); setQErrors([]) }
  useEffect(() => { resetQuestionForm() }, [selectedGuid])

  function startEditQuestion(q: FeedbackQuestion) {
    setEditingQ(q); setQText(q.questionText ?? ''); setQType(q.questionType); setQSort(String(q.sortOrder)); setQErrors([])
  }

  function submitQuestion() {
    if (!selectedGuid) return
    const text = qText.trim()
    // Blank = keep the current order when editing, or take the suggested
    // next multiple of 10 for a new question.
    const sortRaw = qSort.trim() === '' ? (editingQ ? String(editingQ.sortOrder) : nextSort) : qSort.trim()
    const sort = Number(sortRaw)
    const errs: string[] = []
    if (!qLocked) {
      if (!text) errs.push('Question text is required.')
      else if (text.length > 400) errs.push('Question text must be 400 characters or fewer.')
      if (!qType) errs.push('Question type is required.')
    }
    if (!Number.isInteger(sort) || sort < 0) errs.push('Sort order must be a whole number, 0 or more.')
    setQErrors(errs)
    if (errs.length) return

    if (editingQ) {
      updateQuestion.mutate({
        feedbackGuid: selectedGuid,
        questionGuid: editingQ.questionGuid,
        // Answered questions: text and type must be sent as null.
        input: qLocked
          ? { questionText: null, questionType: null, sortOrder: sort }
          : { questionText: text, questionType: qType as FeedbackQuestionType, sortOrder: sort },
      }, {
        onSuccess: () => { showToast('Question updated.', 'ok'); resetQuestionForm() },
        onError: e => setQErrors(errorLines(e, 'Could not update the question.')),
      })
    } else {
      addQuestion.mutate({ feedbackGuid: selectedGuid, input: { questionText: text, questionType: qType as FeedbackQuestionType, sortOrder: sort } }, {
        onSuccess: () => { showToast('Question added.', 'ok'); resetQuestionForm() },
        onError: e => setQErrors(errorLines(e, 'Could not add the question.')),
      })
    }
  }

  const qSaving = addQuestion.isPending || updateQuestion.isPending
  const confirmBusy = deleteFeedback.isPending || deleteQuestion.isPending

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div><div className="pg-title">Feedback Master</div><div className="pg-sub">Feedback forms and questions shown to students for course feedback</div></div>
          <div className="flex gap-2" style={{ alignItems: 'center' }}>
            <SearchSelect
              className="w-64"
              placeholder="— Select Intake —"
              options={intakes.map(i => ({ value: i.intakeGuid, label: i.description ? `${i.description} (${i.intakeCode})` : String(i.intakeCode) }))}
              value={intakeGuid}
              onChange={setIntakeGuid}
            />
            {permissions.add && (
              <button className="btn btn-primary" onClick={openCreate} disabled={!intakeGuid}><i className="lni lni-plus"></i> New Feedback</button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4" style={{ alignItems: 'start' }}>
          {/* ---- Left: feedback list ---- */}
          <div className="card xl:col-span-2" style={{ marginBottom: 0 }}>
            <div className="card-hdr">
              <div className="card-title"><span className="ctitle-icon"><i className="lni lni-comments"></i></span> Feedback Forms</div>
              <div className="inp-wrap" style={{ width: 180 }}>
                <span className="inp-icon"><i className="lni lni-search-alt"></i></span>
                <input className="ctrl" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <ScrollTable>
              <table>
                <thead><tr><th>Code</th><th>Description</th><th>Feedback Type</th><th style={{ width: 80 }}></th></tr></thead>
                <tbody>
                  {!intakeGuid || listLoading ? (
                    <tr><td colSpan={4} className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading…</td></tr>
                  ) : listError ? (
                    <tr><td colSpan={4} className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load feedback forms. Please try again.</td></tr>
                  ) : feedbacks.length === 0 ? (
                    <tr><td colSpan={4} className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No feedback forms have been created for this intake.</td></tr>
                  ) : visible.length === 0 ? (
                    <tr><td colSpan={4} className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No feedback forms match your search.</td></tr>
                  ) : visible.map(f => (
                    <tr key={f.feedbackGuid} style={{ background: selectedGuid === f.feedbackGuid ? 'var(--b50)' : undefined }}>
                      <td>
                        <button className="font-mono font-bold" style={{ color: 'var(--b700)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => setSelectedGuid(f.feedbackGuid)}>{f.code}</button>
                      </td>
                      <td>{f.description ?? '—'}</td>
                      <td>{f.assessmentTypeName ?? '—'}</td>
                      <td>
                        <div className="flex gap-1">
                          {permissions.edit && <button className="btn btn-neu btn-sm" title="Edit" onClick={() => setSelectedGuid(f.feedbackGuid)}><i className="lni lni-pencil"></i></button>}
                          {permissions.delete && <button className="btn btn-neu btn-sm" title="Delete" onClick={() => requestDeleteFeedback(f)}><i className="lni lni-trash-can"></i></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollTable>
          </div>

          {/* ---- Right: details + questions ---- */}
          <div className="xl:col-span-3">
            {!selectedGuid ? (
              <div className="card">
                <div className="empty">
                  <div className="empty-icon"><i className="lni lni-comments"></i></div>
                  <div className="empty-title">No Feedback Form Selected</div>
                  <div className="empty-sub">Pick a form from the list to edit it and manage its questions, or create a new one.</div>
                </div>
              </div>
            ) : detailLoading ? (
              <div className="card"><div className="text-g400 text-center" style={{ padding: 24, fontSize: 12.5 }}>Loading feedback…</div></div>
            ) : detailError || !detail ? (
              <div className="card"><div className="text-clr-red text-center" style={{ padding: 24, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load this feedback form. It may have been deleted.</div></div>
            ) : (
              <>
                <div className="card">
                  <div className="card-hdr">
                    <div className="card-title"><i className="lni lni-pencil-alt"></i> Feedback Details</div>
                    <button className="btn btn-neu btn-sm" onClick={() => setSelectedGuid(null)}><i className="lni lni-close"></i> Close</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="fg"><label className="lbl">Code</label><input className="ctrl font-mono" readOnly value={detail.code} style={{ background: 'var(--g100)' }} /></div>
                    <div className="fg"><label className="lbl">Intake</label><input className="ctrl" readOnly value={intakeLabel(detail.intakeGuid)} style={{ background: 'var(--g100)' }} /></div>
                    <div className="fg">
                      <label className="lbl">Description <span className="req">*</span></label>
                      <input className="ctrl" maxLength={200} value={description} onChange={e => setDescription(e.target.value)} disabled={!permissions.edit} />
                    </div>
                    <div className="fg" title={typeLocked ? 'Type cannot be changed once students have submitted responses.' : undefined}>
                      <label className="lbl">Feedback Type <span className="req">*</span> {typeLocked && <i className="lni lni-lock" style={{ fontSize: 11 }}></i>}</label>
                      <SearchSelect
                        placeholder="— Select Type —"
                        // Current type stays selectable; other types already
                        // used in this intake are hidden (one per intake).
                        options={typeOptions.filter(o => o.value === detail.assessmentTypeGuid || !usedTypes.has(o.value))}
                        value={typeGuid}
                        onChange={setTypeGuid}
                        disabled={typeLocked || !permissions.edit}
                      />
                      {typeLocked && <div className="text-g500" style={{ fontSize: 11, marginTop: 4 }}>Type cannot be changed once students have submitted responses.</div>}
                    </div>
                  </div>
                  <ErrorList lines={detailErrors} />
                  <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                    {permissions.delete && (
                      <button className="btn btn-neu" onClick={() => requestDeleteFeedback(detail)} disabled={updateFeedback.isPending}><i className="lni lni-trash-can"></i> Delete</button>
                    )}
                    {permissions.edit && (
                      <button className="btn btn-primary" onClick={saveDetail} disabled={!detailDirty || updateFeedback.isPending}>
                        <i className="lni lni-save"></i> {updateFeedback.isPending ? 'Saving…' : 'Save Changes'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="card-hdr">
                    <div className="card-title"><i className="lni lni-list"></i> Questions</div>
                    {questions.length > 0 && <span className="badge badge-blue">{questions.length}</span>}
                  </div>

                  {permissions.add && (
                    <div style={{ padding: 12, borderRadius: 'var(--rsm)', background: 'var(--g100)', marginBottom: 12 }}>
                      {qLocked && (
                        <div className="info-box mb-3">
                          <i className="lni lni-lock" style={{ color: 'var(--amber)', fontSize: 15, flexShrink: 0 }}></i>
                          <div style={{ fontSize: 12.5 }}>This question has student responses — text and type are locked. Only the sort order can change.</div>
                        </div>
                      )}
                      <div className="fg">
                        <label className="lbl">{editingQ ? 'Edit Question' : 'New Question'} <span className="req">*</span></label>
                        <textarea className="ctrl" rows={2} maxLength={400} value={qText} onChange={e => setQText(e.target.value)} disabled={qLocked} placeholder="e.g. How would you rate the lecturer's delivery?" style={{ height: 'auto' }} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3" style={{ alignItems: 'end' }}>
                        <div className="fg">
                          <label className="lbl">Question Type <span className="req">*</span></label>
                          <SearchSelect
                            placeholder="— Select —"
                            options={FEEDBACK_QUESTION_TYPES.map(t => ({ value: String(t.value), label: t.label }))}
                            value={qType ? String(qType) : ''}
                            onChange={v => setQType(Number(v) as FeedbackQuestionType)}
                            disabled={qLocked}
                          />
                        </div>
                        <div className="fg">
                          <label className="lbl">Sort Order</label>
                          <input className="ctrl" type="number" min={0} step={10} value={qSort} onChange={e => setQSort(e.target.value)} placeholder={editingQ ? '' : nextSort} />
                        </div>
                        <div className="fg flex gap-2" style={{ justifyContent: 'flex-end' }}>
                          {editingQ && <button className="btn btn-neu" onClick={resetQuestionForm} disabled={qSaving}>Cancel</button>}
                          <button className="btn btn-primary" onClick={submitQuestion} disabled={qSaving}>
                            <i className={`lni ${editingQ ? 'lni-save' : 'lni-plus'}`}></i> {qSaving ? 'Saving…' : editingQ ? 'Update' : 'Add'}
                          </button>
                        </div>
                      </div>
                      <ErrorList lines={qErrors} />
                    </div>
                  )}

                  <ScrollTable>
                    <table>
                      <thead><tr><th style={{ width: 40 }}>#</th><th>Question</th><th>Type</th><th>Sort Order</th><th style={{ width: 60 }}>Locked</th><th style={{ width: 90 }}></th></tr></thead>
                      <tbody>
                        {questionsLoading ? (
                          <tr><td colSpan={6} className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading questions…</td></tr>
                        ) : questions.length === 0 ? (
                          <tr><td colSpan={6} className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No questions yet — add the first one above.</td></tr>
                        ) : questions.map((q, i) => (
                          <tr key={q.questionGuid} style={{ background: editingQ?.questionGuid === q.questionGuid ? 'var(--b50)' : undefined }}>
                            <td>{i + 1}</td>
                            <td style={{ whiteSpace: 'normal' }}>{q.questionText ?? '—'}</td>
                            <td><span className="badge badge-blue">{q.questionTypeLabel}</span></td>
                            <td>{q.sortOrder}</td>
                            <td>{q.hasAnswers && <i className="lni lni-lock" title="Has student responses" style={{ color: 'var(--amber)' }}></i>}</td>
                            <td>
                              <div className="flex gap-1">
                                {permissions.edit && <button className="btn btn-neu btn-sm" title="Edit" onClick={() => startEditQuestion(q)}><i className="lni lni-pencil"></i></button>}
                                {permissions.delete && (
                                  <button className="btn btn-neu btn-sm" title={q.hasAnswers ? 'Cannot delete: students have already answered this question.' : 'Delete'} disabled={q.hasAnswers} onClick={() => setConfirm({ kind: 'question', q })}>
                                    <i className="lni lni-trash-can"></i>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollTable>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {createOpen && (
        <div className="modal-overlay open">
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title"><i className="lni lni-plus"></i> New Feedback Form</div>
              <button className="modal-close" onClick={() => setCreateOpen(false)}><i className="lni lni-close"></i></button>
            </div>
            <div style={{ padding: 20 }}>
              <div className="fg"><label className="lbl">Intake</label><input className="ctrl" readOnly value={intakeLabel(intakeGuid)} style={{ background: 'var(--g100)' }} /></div>
              <div className="fg">
                <label className="lbl">Code <span className="req">*</span></label>
                <input className="ctrl font-mono" maxLength={50} value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} placeholder="e.g. CW2026" autoFocus />
                <div className="text-g500" style={{ fontSize: 11, marginTop: 4 }}>Can&apos;t be changed later.</div>
              </div>
              <div className="fg"><label className="lbl">Description <span className="req">*</span></label><input className="ctrl" maxLength={200} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="e.g. Course Work 2026 Feedback" /></div>
              <div className="fg">
                <label className="lbl">Feedback Type <span className="req">*</span></label>
                <SearchSelect placeholder="— Select Type —" options={freeTypeOptions} value={newType} onChange={setNewType} />
                {freeTypeOptions.length === 0 && typeOptions.length > 0 && (
                  <div className="text-g500" style={{ fontSize: 11, marginTop: 4 }}>Every feedback type already has a form in this intake.</div>
                )}
              </div>
              <ErrorList lines={createErrors} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-neu" onClick={() => setCreateOpen(false)} disabled={createFeedback.isPending}>Cancel</button>
              <button className="btn btn-primary" onClick={submitCreate} disabled={createFeedback.isPending}>
                <i className="lni lni-save"></i> {createFeedback.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => !confirmBusy && setConfirm(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">
              {confirm.kind === 'feedback' ? <>Delete feedback &apos;{confirm.row.code}&apos;?</> : 'Delete this question?'}
            </div>
            <div className="perm-delete-sub">
              {confirm.kind === 'feedback' ? 'This cannot be undone.' : (confirm.q.questionText ?? '')}
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setConfirm(null)} disabled={confirmBusy}>Cancel</button>
              <button className="btn btn-danger" onClick={runConfirm} disabled={confirmBusy}>
                <i className="lni lni-trash-can"></i> {confirmBusy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </>
  )
}
