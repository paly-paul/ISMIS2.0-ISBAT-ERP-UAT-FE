'use client'

import { useEffect, useState } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import { TableSearch } from '@/components/TableSearch'
import { Toast } from '@/components/Toast'
import {
  SEARCH_MAX_RESULTS,
  SEARCH_MIN_CHARS,
  useCancelAttempt,
  useExamCancelCourseUnits,
  useExamCancelStudent,
  useExamCancelStudentSearch,
  useExamStatus,
  useGrantExtraTime,
  type AttemptCategory,
} from '@/hooks/assessment/useExamCancel'

// Exam Cancel & Extra Time (exam-cancel/*.md) — port of legacy
// frmTrnStudentExamCancel ("Class Test Cancelation & Extra Time Management").
// Pick a student and a course unit, see the Class Test status, then either
// cancel a Class Test / CW1 / CW2 attempt so the student can sit it again,
// or give extra time on the Class Test. The server always works in the
// current academic intake.

const CATEGORIES: { value: AttemptCategory; label: string }[] = [
  { value: 1, label: 'Class Test' },
  { value: 2, label: 'CW1' },
  { value: 3, label: 'CW2' },
]

const STATUS_BADGE: Record<number, { cls: string; label: string; icon: string }> = {
  0: { cls: 'badge-grey', label: 'Not submitted', icon: 'lni-timer' },
  1: { cls: 'badge-blue', label: 'Submitted', icon: 'lni-checkmark' },
  2: { cls: 'badge-green', label: 'Evaluated', icon: 'lni-checkmark-circle' },
}

function errCode(err: unknown) { return (err as { code?: string } | null)?.code }
function errMsg(err: unknown, fallback: string) { return (err as { message?: string } | null)?.message || fallback }

type ConfirmState = { title: string; body: React.ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => void } | null

export default function ExamCancelPage() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 4500) }

  // ── Student picker ───────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const searchQuery = useExamCancelStudentSearch(searchTerm)
  const hits = searchTerm.length >= SEARCH_MIN_CHARS ? searchQuery.data ?? [] : []
  const searching = searchInput.trim().length >= SEARCH_MIN_CHARS && (searchQuery.isFetching || searchInput.trim() !== searchTerm)

  const [studentGuid, setStudentGuid] = useState<string | null>(null)
  const studentQuery = useExamCancelStudent(studentGuid)
  const student = studentQuery.data

  // ── Assessment ───────────────────────────────────────────────────────────
  const [category, setCategory] = useState<AttemptCategory>(1)
  const [courseUnitGuid, setCourseUnitGuid] = useState('')
  const unitsQuery = useExamCancelCourseUnits(studentGuid)
  const units = unitsQuery.data ?? []
  const unit = units.find(u => u.courseUnitGuid === courseUnitGuid)

  const statusQuery = useExamStatus(studentGuid, courseUnitGuid || null)
  const status = statusQuery.data

  const [extraMinutes, setExtraMinutes] = useState('')

  function pickStudent(guid: string) {
    setStudentGuid(guid)
    setCourseUnitGuid('')
    setExtraMinutes('')
    setSearchInput('')
    setSearchTerm('')
  }

  // Legacy "Cancel" — start over.
  function clearAll() {
    setStudentGuid(null)
    setCourseUnitGuid('')
    setCategory(1)
    setExtraMinutes('')
    setSearchInput('')
    setSearchTerm('')
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  const cancelMut = useCancelAttempt()
  const extraMut = useGrantExtraTime()
  const busy = cancelMut.isPending || extraMut.isPending
  const [confirm, setConfirm] = useState<ConfirmState>(null)

  const categoryLabel = CATEGORIES.find(c => c.value === category)!.label
  const studentLabel = `${student?.studentName ?? '—'}(${student?.studentRegNo ?? '—'})`
  const ready = !!student && !!unit

  function doCancel() {
    if (!ready || !studentGuid) return
    setConfirm({
      title: `Cancel the ${categoryLabel} attempt?`,
      // Legacy confirmation text.
      body: <>You are about to delete the <strong>{categoryLabel}</strong> of <strong>{unit!.courseUnitName}</strong>, <strong>{studentLabel}</strong>. The student&apos;s answers and marks for it are removed so they can sit it again. Do you want to continue?</>,
      confirmLabel: 'Delete attempt',
      danger: true,
      onConfirm: () => cancelMut.mutate({ studentGuid, courseUnitGuid, category }, {
        onSuccess: () => showToast(`${categoryLabel} attempt cancelled. ${student!.studentName ?? 'The student'} can sit it again.`, 'success'),
        onError: err => {
          // The legacy "Could not delete.....!" (404) means the delete matched
          // nothing — no attempt of this kind exists in the current intake.
          // Other 404s ("No assessment found…") already say what's wrong.
          if (errCode(err) === 'not_found' && /could not delete/i.test(errMsg(err, ''))) {
            showToast(`Nothing to cancel: ${student?.studentName ?? 'this student'} has no ${categoryLabel} attempt for ${unit?.courseUnitName ?? 'this unit'} in the current intake.`, 'warn')
          } else {
            showToast(errMsg(err, 'Could not cancel the attempt.'), 'error')
          }
        },
      }),
    })
  }

  function doExtraTime() {
    if (!ready || !studentGuid || category !== 1) return
    const n = Number(extraMinutes)
    if (extraMinutes.trim() === '' || !Number.isInteger(n) || n <= 0) { showToast('Enter the extra time as a whole number of minutes greater than zero.', 'error'); return }
    const save = () => extraMut.mutate({ studentGuid, courseUnitGuid, extraMinutes: n }, {
      onSuccess: res => {
        setExtraMinutes('')
        const left = Math.floor((res?.balanceTimeSeconds ?? 0) / 60)
        showToast(`Extra time saved. ${student!.studentName ?? 'The student'} now has ${left} minute${left === 1 ? '' : 's'} on the Class Test, and the test is reopened.`, 'success')
      },
      onError: err => showToast(errMsg(err, 'Could not save the extra time.'), 'error'),
    })
    // Extra time removes the Class Test evaluation — say so when there is one.
    if (status?.status === 2) {
      setConfirm({
        title: `Give ${n} minute${n === 1 ? '' : 's'} extra time?`,
        body: <>The Class Test is reopened and its evaluation is removed: <strong>{status.message}</strong>. The student must submit again to be marked.</>,
        confirmLabel: 'Save extra time',
        onConfirm: save,
      })
    } else save()
  }

  const statusMissing = statusQuery.isError && errCode(statusQuery.error) === 'not_found'
  const meta = status ? STATUS_BADGE[status.status] : null

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Exam Cancel &amp; Extra Time</div>
            <div className="pg-sub">Cancel a student&apos;s Class Test or coursework attempt so they can sit it again, or give extra time on the Class Test</div>
          </div>
          {studentGuid && (
            <button className="btn btn-neu" onClick={clearAll} disabled={busy}><i className="lni lni-reload"></i> Clear</button>
          )}
        </div>

        {/* 1 · Student */}
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title mb-3"><span className="ctitle-icon"><i className="lni lni-user"></i></span> Student</div>
          {!studentGuid ? (
            <>
              <TableSearch
                className="w-full md:w-[520px]"
                placeholder="Student number, registration number or name…"
                value={searchInput}
                onChange={setSearchInput}
                minChars={SEARCH_MIN_CHARS}
                loading={searching}
                emptyLabel="No students found"
                results={hits.map(h => ({
                  id: h.studentGuid,
                  primary: h.studentName ?? '—',
                  secondary: [h.studentRegNo, h.batchCode].filter(Boolean).join(' · '),
                }))}
                onSelect={r => pickStudent(r.id)}
              />
              <div className="text-xs text-g500 mt-2">
                Numbers must be typed in full; names can be partial.
                {/* Restore with SEARCH_MIN_CHARS = 3: */}
                {/* Numbers must be typed in full; names can be partial (at least {SEARCH_MIN_CHARS} characters). */}
                {hits.length >= SEARCH_MAX_RESULTS && <span style={{ color: 'var(--amber)' }}> Showing the first {SEARCH_MAX_RESULTS} matches. Type more of the name to narrow the list.</span>}
              </div>
            </>
          ) : studentQuery.isLoading ? (
            <div className="text-sm text-g500"><i className="lni lni-spinner-solid animate-spin mr-2"></i>Loading student…</div>
          ) : studentQuery.isError ? (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-sm" style={{ color: 'var(--red)' }}><i className="lni lni-warning mr-1"></i>{errMsg(studentQuery.error, 'No Student found!!')}</div>
              <button className="btn btn-neu btn-sm" onClick={clearAll}>Pick another student</button>
            </div>
          ) : student ? (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center rounded-full text-white font-semibold flex-shrink-0" style={{ width: 40, height: 40, background: 'var(--b500)', fontSize: 15 }}>
                    {(student.studentName || '?').trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-slate-900 truncate">{student.studentName ?? '—'}</div>
                    <div className="font-mono text-sm text-slate-500">{student.studentRegNo ?? '—'}</div>
                  </div>
                </div>
                <button className="btn btn-neu btn-sm" onClick={clearAll} disabled={busy}><i className="lni lni-reload"></i> Change student</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-x-6 gap-y-3 mt-4 pt-4 border-t border-slate-200">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-g500 uppercase tracking-wide mb-0.5">Programme</div>
                  <div className="text-sm text-g900">{student.programName ?? '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-g500 uppercase tracking-wide mb-0.5">Semester</div>
                  <div className="text-sm text-g900">{student.semesterName ?? '—'}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* 2 · Assessment */}
        <div className="card" style={{ padding: 20, opacity: student ? 1 : 0.55 }}>
          <div className="card-title mb-3"><span className="ctitle-icon"><i className="lni lni-files"></i></span> Assessment</div>
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-end">
            <div>
              <label className="lbl">Assessment Type <span className="req">*</span></label>
              <div className="flex gap-1 p-1 rounded-lg mt-1" style={{ background: 'var(--g100)' }}>
                {CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    className={`btn btn-sm ${category === c.value ? 'btn-primary' : ''}`}
                    style={category === c.value ? undefined : { background: 'transparent', border: 'none', boxShadow: 'none', color: 'var(--g600)' }}
                    onClick={() => setCategory(c.value)}
                    disabled={!student || busy}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="lbl">Course Unit <span className="req">*</span></label>
              <SearchSelect
                placeholder={unitsQuery.isLoading ? 'Loading…' : 'Select course unit'}
                options={units.map(u => ({ value: u.courseUnitGuid, label: u.label }))}
                value={courseUnitGuid}
                onChange={setCourseUnitGuid}
                className="w-full mt-1"
                disabled={!student || unitsQuery.isLoading || busy}
              />
            </div>
          </div>
          {student && unitsQuery.isError && (
            <div className="text-sm mt-3" style={{ color: 'var(--red)' }}><i className="lni lni-warning mr-1"></i>{errMsg(unitsQuery.error, 'No Student found!!')} The student has no programme or semester on record.</div>
          )}
          {student && unitsQuery.data && units.length === 0 && (
            <div className="text-sm text-g500 mt-3">No course units found for this student&apos;s programme and semester.</div>
          )}

          {/* Class Test status */}
          {unit && (
            <div className="mt-5 pt-5 border-t border-slate-200">
              <div className="text-[11px] font-bold text-g500 uppercase tracking-wide mb-2">Class Test status · current intake</div>
              {statusQuery.isLoading ? (
                <div className="text-sm text-g500"><i className="lni lni-spinner-solid animate-spin mr-2"></i>Checking…</div>
              ) : statusMissing ? (
                <div className="text-sm px-4 py-3 rounded-lg" style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-bd)', color: '#92400e' }}>
                  <i className="lni lni-warning mr-1"></i>{errMsg(statusQuery.error, 'No assessment found for this course unit.')}
                </div>
              ) : statusQuery.isError ? (
                <div className="flex items-center gap-3 text-sm">
                  <span style={{ color: 'var(--red)' }}>{errMsg(statusQuery.error, 'Could not load the status.')}</span>
                  <button className="btn btn-neu btn-sm" onClick={() => statusQuery.refetch()}><i className="lni lni-reload"></i> Retry</button>
                </div>
              ) : status && meta ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`badge ${meta.cls}`}><i className={`lni ${meta.icon}`}></i> {meta.label}</span>
                  <span className="text-sm text-g800">{status.message}</span>
                </div>
              ) : null}
              {category !== 1 && (
                <div className="text-xs text-g500 mt-2">Only the Class Test has a status; there is none for CW1 or CW2.</div>
              )}
            </div>
          )}
        </div>

        {/* 3 · Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card" style={{ padding: 20, marginBottom: 0, opacity: ready ? 1 : 0.55 }}>
            <div className="card-title mb-1"><span className="ctitle-icon"><i className="lni lni-trash-can"></i></span> Cancel Attempt</div>
            <div className="text-xs text-g500 mb-4">
              Deletes the student&apos;s {categoryLabel} answers and marks for this unit so they can sit it again. This also works after the attempt was submitted.
            </div>
            <button className="btn btn-danger" onClick={doCancel} disabled={!ready || busy || statusMissing}>
              <i className="lni lni-trash-can"></i> {cancelMut.isPending ? 'Deleting…' : `Delete ${categoryLabel} Attempt`}
            </button>
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 0, opacity: ready && category === 1 ? 1 : 0.55 }}>
            <div className="card-title mb-1"><span className="ctitle-icon"><i className="lni lni-timer"></i></span> Extra Time</div>
            <div className="text-xs text-g500 mb-4">
              {category === 1
                ? 'Adds minutes to the student’s remaining time and reopens the Class Test. The total can’t go over the test duration.'
                : 'Extra time applies to the Class Test only. Choose Class Test above to give extra time.'}
            </div>
            <div className="flex items-end gap-3 flex-wrap">
              <div style={{ width: 140 }}>
                <label className="lbl">Extra Time <span className="req">*</span></label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    className="ctrl"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="e.g. 15"
                    value={extraMinutes}
                    onChange={e => setExtraMinutes(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') doExtraTime() }}
                    disabled={!ready || category !== 1 || busy}
                  />
                  <span className="text-sm text-g500">min</span>
                </div>
              </div>
              <button className="btn btn-primary" onClick={doExtraTime} disabled={!ready || category !== 1 || busy || statusMissing}>
                <i className="lni lni-checkmark"></i> {extraMut.isPending ? 'Saving…' : 'Save Extra Time'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {confirm && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 600 }} onClick={() => setConfirm(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon" style={confirm.danger ? undefined : { background: 'var(--b50)', color: 'var(--b700)' }}>
              <i className={`lni ${confirm.danger ? 'lni-trash-can' : 'lni-timer'}`}></i>
            </div>
            <div className="perm-delete-title">{confirm.title}</div>
            <div className="perm-delete-sub">{confirm.body}</div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setConfirm(null)}>Cancel</button>
              <button className={`btn ${confirm.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => { const fn = confirm.onConfirm; setConfirm(null); fn() }}>
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </>
  )
}
