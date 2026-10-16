'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { notFound } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { SearchSelect } from '@/components/SearchSelect'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Toast } from '@/components/Toast'
import { SuccessPopup } from '@/components/modals/shared/SuccessPopup'
import { AuthError } from '@/lib/api/client'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import {
  useUeDetailedMarks, useSaveUeMark, useVerifyUeMarks,
  useUeMarkFormInit, useUeMarkFormSemesters, useUeMarkFormUnits,
} from '@/hooks/assessment/useUeMarks'
import { getUeMarkImportExam, UeMarkImportExam } from '@/lib/api/assessment/ueMarkImport'
import {
  ALL_UE_MARK_FIELDS, ueColumnsFor,
  UeDetailedMarkRowDto, UeMarkField, UeMarkValues,
} from '@/lib/api/assessment/ueMarks'

// One screen, two modes — university-exam-mark-entry-page.md and
// university-exam-mark-verify-page.md. They differ only in:
//   - the unit list: entry is lecturer-scoped (ue-detailed-marks/units),
//     verify lists every unit (ue-attendance/units);
//   - verify has the Verify button.
// In both, Edit is hidden for absent students and for every row once the exam
// is verified — the server locks it too (409 exam_verified on save).
//
// Marking is blind: rows show only the matching code, never a name or reg.
// no., and studentGuid is never resolved — it's only the save key.

export type UeMarkSheetMode = 'entry' | 'verify'

const EXAM_NOT_FOUND = 'University Exam of this Course Unit is not scheduled for this Semester / Exam not yet commenced.'

type Editing = { studentGuid: string; values: Partial<Record<UeMarkField, string>> }

function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

export function UeMarkSheet({ mode }: { mode: UeMarkSheetMode }) {
  const permissions = usePagePermissions()
  const canSave = permissions.edit

  const [intakeGuid, setIntakeGuid] = useState('')
  const [programGuid, setProgramGuid] = useState('')
  const [semesterGuid, setSemesterGuid] = useState('')
  const [unitGuid, setUnitGuid] = useState('')
  const [ueType, setUeType] = useState('0')

  // The exam behind the current selection (ue-mark-import/exam), and the
  // exam whose sheet is shown. The sheet loads only on "Show Mark Sheet".
  const [exam, setExam] = useState<UeMarkImportExam | null>(null)
  const [examLoading, setExamLoading] = useState(false)
  const [sheetGuid, setSheetGuid] = useState<string | null>(null)

  const [editing, setEditing] = useState<Editing | null>(null)
  const [invalid, setInvalid] = useState<Set<UeMarkField>>(new Set())
  const [confirmVerify, setConfirmVerify] = useState(false)
  const [verifiedPopup, setVerifiedPopup] = useState(false)
  // Stable, so SuccessPopup's auto-close timer isn't restarted on re-render.
  const closeVerifiedPopup = useCallback(() => setVerifiedPopup(false), [])
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const { data: init, isLoading: initLoading } = useUeMarkFormInit()
  const { data: semesters = [], isLoading: semLoading } = useUeMarkFormSemesters(programGuid, intakeGuid)
  const { data: units = [], isLoading: unitsLoading } = useUeMarkFormUnits(programGuid, semesterGuid, mode)
  const selectedUnit = units.find(u => u.courseUnitGuid === unitGuid)
  const isCombined = selectedUnit?.unitType === 3

  const grid = useUeDetailedMarks(sheetGuid)
  const sheet = grid.data
  const saveMark = useSaveUeMark(sheetGuid)
  const verify = useVerifyUeMarks(exam?.universityExamGuid ?? null)

  // Default the intake to the current one once the list loads.
  const currentIntakeGuid = init?.intakes.find(i => i.currentIntake)?.intakeGuid ?? ''
  useEffect(() => {
    if (!intakeGuid && currentIntakeGuid) setIntakeGuid(currentIntakeGuid)
  }, [currentIntakeGuid, intakeGuid])

  function clearExam() { setExam(null); setSheetGuid(null); setEditing(null); setInvalid(new Set()) }

  // Exam lookup on every unit or report-type change. Imperative rather than a
  // query so a 404 can reset the unit and still re-run if the same unit is
  // picked again. lookupSeq drops a response that a newer pick has replaced.
  const lookupSeq = useRef(0)
  function lookupExam(nextUnitGuid: string, nextUeType: string) {
    clearExam()
    if (!nextUnitGuid || !programGuid || !semesterGuid || !intakeGuid) return
    const seq = ++lookupSeq.current
    setExamLoading(true)
    getUeMarkImportExam(programGuid, semesterGuid, nextUnitGuid, intakeGuid, Number(nextUeType))
      .then(found => { if (seq === lookupSeq.current) setExam(found) })
      .catch(err => {
        if (seq !== lookupSeq.current) return
        if (err instanceof AuthError && err.code === 'not_found') {
          // The server's own message; the fixed text only when it sends none.
          showToast(errMessage(err, EXAM_NOT_FOUND), 'error')
          setUnitGuid('')
        } else {
          showToast(errMessage(err, 'Could not find the exam for this course unit.'), 'error')
        }
      })
      .finally(() => { if (seq === lookupSeq.current) setExamLoading(false) })
  }

  function handleIntake(v: string) { setIntakeGuid(v); setSemesterGuid(''); setUnitGuid(''); clearExam() }
  function handleProgram(v: string) { setProgramGuid(v); setSemesterGuid(''); setUnitGuid(''); clearExam() }
  function handleSemester(v: string) { setSemesterGuid(v); setUnitGuid(''); clearExam() }
  function handleUnit(v: string) {
    setUnitGuid(v)
    // Only Combined units choose Theory/Practical; everything else is Theory.
    const nextType = units.find(u => u.courseUnitGuid === v)?.unitType === 3 ? ueType : '0'
    setUeType(nextType)
    lookupExam(v, nextType)
  }
  function handleUeType(v: string) { setUeType(v); lookupExam(unitGuid, v) }

  function handleShowSheet() {
    if (!exam) return
    setEditing(null); setInvalid(new Set())
    if (sheetGuid === exam.universityExamGuid) grid.refetch()
    else setSheetGuid(exam.universityExamGuid)
  }

  function handleRefresh() {
    lookupSeq.current++
    setIntakeGuid(currentIntakeGuid); setProgramGuid(''); setSemesterGuid(''); setUnitGuid(''); setUeType('0')
    setExamLoading(false)
    clearExam()
  }

  // ── Row editing ──
  const columns = sheet ? ueColumnsFor(sheet.layout, sheet.maxMarks) : []
  const isVerified = sheet?.isVerified ?? exam?.isVerified ?? false

  function canEdit(row: UeDetailedMarkRowDto) {
    return canSave && !row.isAbsent && !isVerified
  }

  function startEdit(row: UeDetailedMarkRowDto) {
    setInvalid(new Set())
    setEditing({
      studentGuid: row.studentGuid,
      values: Object.fromEntries(columns.map(c => [c.field, row[c.field] == null ? '' : String(row[c.field])])),
    })
  }

  function setValue(field: UeMarkField, raw: string) {
    // Whole numbers only — strip anything that isn't a digit as it's typed.
    const digits = raw.replace(/\D/g, '')
    setEditing(e => e && { ...e, values: { ...e.values, [field]: digits } })
    setInvalid(prev => { if (!prev.has(field)) return prev; const s = new Set(prev); s.delete(field); return s })
  }

  function handleUpdate() {
    if (!editing || !sheet) return
    const marks = Object.fromEntries(ALL_UE_MARK_FIELDS.map(f => [f, null])) as UeMarkValues
    const bad = new Set<UeMarkField>()
    let firstProblem = ''
    for (const c of columns) {
      const raw = editing.values[c.field] ?? ''
      const max = sheet.maxMarks[c.max]
      const n = Number(raw)
      if (raw === '') {
        bad.add(c.field); firstProblem ||= `${c.label} is required.`
      } else if (max != null && n > max) {
        bad.add(c.field); firstProblem ||= `${c.label} should not exceed ${max}.`
      } else {
        marks[c.field] = n
      }
    }
    if (bad.size) { setInvalid(bad); showToast(firstProblem, 'error'); return }

    saveMark.mutate({ studentGuid: editing.studentGuid, marks }, {
      onSuccess: () => { setEditing(null); showToast('Marks saved.', 'success') },
      onError: err => {
        // Verified elsewhere while this sheet was open: close the edit and
        // reload, so the grid comes back locked (Edit hidden).
        if (err instanceof AuthError && err.code === 'exam_verified') {
          setEditing(null); setInvalid(new Set())
          showToast(errMessage(err, 'This exam has been verified; its marks can no longer be edited.'), 'error')
          grid.refetch()
          return
        }
        // validation_error carries the server's own message, e.g. "SectionAMark
        // should not exceed 20." or "Student was not marked present for this exam."
        showToast(errMessage(err, 'Could not save the marks.'), 'error')
      },
    })
  }

  // ── Verify ──
  function handleVerify() {
    setConfirmVerify(false)
    verify.mutate(undefined, {
      onSuccess: () => { setVerifiedPopup(true); handleRefresh() },
      onError: err => {
        const code = err instanceof AuthError ? err.code : undefined
        if (code === 'no_marks_entered') showToast('Please enter marks before proceeding.', 'error')
        else if (code === 'already_verified') showToast(errMessage(err, 'This exam is already verified.'), 'info')
        else showToast(errMessage(err, 'Could not verify the exam.'), 'error')
      },
    })
  }

  const gridError = grid.error
  const gridErrorText = gridError instanceof AuthError && gridError.code === 'attendance_not_taken'
    ? errMessage(gridError, 'Attendance has not been entered for this exam yet.')
    : gridError instanceof AuthError && gridError.code === 'not_found'
      ? 'This exam no longer exists.'
      : errMessage(gridError, 'Could not load the mark sheet.')

  const unitLabel = selectedUnit ? `${selectedUnit.courseUnitCode} — ${selectedUnit.courseUnitName}` : ''
  const showEditColumn = canSave && !isVerified
  const colCount = 3 + columns.length + (showEditColumn ? 1 : 0)

  // No view permission: show the app-wide 404 rather than revealing the page exists.
  if (!permissions.get) notFound()

  return (
    <div className="page active">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">{mode === 'entry' ? 'Mark Entry — University Examination' : 'Mark Verify — University Examination'}</div>
          <div className="pg-sub">
            {mode === 'entry'
              ? 'Enter UE marks one student at a time · blind marking by matching code'
              : 'Review the entered UE marks and verify the exam · verifying locks it for mark entry'}
          </div>
        </div>
        {mode === 'verify' && (
          <div className="pg-actions">
            <button
              className="btn btn-primary"
              onClick={() => setConfirmVerify(true)}
              disabled={!exam || verify.isPending || !!editing}
              title={editing ? 'Update or cancel the open row first' : undefined}
            >
              <i className="lni lni-shield"></i> {verify.isPending ? 'Verifying…' : 'Verify'}
            </button>
          </div>
        )}
      </div>

      {/* ── Selection ── */}
      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 p-5">
          <div className="fg mb-0">
            <label className="lbl">Programme <span className="req">*</span></label>
            <SearchSelect
              placeholder="— Select Programme —"
              value={programGuid}
              onChange={handleProgram}
              disabled={initLoading}
              options={(init?.programs ?? []).map(p => ({ value: p.programGuid, label: `${p.programCode} — ${p.programName}` }))}
            />
          </div>
          <div className="fg mb-0">
            <label className="lbl">Intake <span className="req">*</span></label>
            <SearchSelect
              placeholder="— Select Intake —"
              value={intakeGuid}
              onChange={handleIntake}
              disabled={initLoading}
              options={(init?.intakes ?? []).map(i => ({ value: i.intakeGuid, label: `${i.description || `Intake ${i.intakeCode}`}${i.currentIntake ? ' (Current)' : ''}` }))}
            />
          </div>
          <div className="fg mb-0">
            <label className="lbl">Semester <span className="req">*</span></label>
            <SearchSelect
              placeholder="— Select Semester —"
              value={semesterGuid}
              onChange={handleSemester}
              disabled={!programGuid}
              isLoading={semLoading && !!programGuid}
              options={semesters.map(s => ({ value: s.semesterGuid, label: s.semName }))}
            />
          </div>
          <div className="fg mb-0">
            <label className="lbl">Course Unit <span className="req">*</span></label>
            <SearchSelect
              placeholder={semesterGuid && !unitsLoading && units.length === 0 ? 'No course units' : '— Select Course Unit —'}
              value={unitGuid}
              onChange={handleUnit}
              disabled={!semesterGuid || !intakeGuid}
              isLoading={unitsLoading && !!semesterGuid}
              options={units.map(u => ({ value: u.courseUnitGuid, label: `${u.courseUnitCode} — ${u.courseUnitName}` }))}
            />
          </div>
          {/* Theory / Practical toggle — Combined units (unitType 3) only. */}
          {isCombined && (
            <div className="fg mb-0">
              <label className="lbl" id="ue-report-type">Report Type</label>
              <div className="pc-tabs" role="radiogroup" aria-labelledby="ue-report-type" style={{ marginBottom: 0, padding: 4 }}>
                {[{ value: '0', label: 'Theory', icon: 'lni-book' }, { value: '1', label: 'Practical', icon: 'lni-code' }].map(o => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={ueType === o.value}
                    className={`pc-tab-btn${ueType === o.value ? ' active' : ''}`}
                    style={{ padding: '6px 14px' }}
                    disabled={examLoading}
                    onClick={() => { if (ueType !== o.value) handleUeType(o.value) }}
                  >
                    <i className={`lni ${o.icon}`}></i> {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Exam summary: Maximum Marks + status, once the exam is found. */}
        {(exam || examLoading) && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 pb-4 text-sm">
            {examLoading ? (
              <span className="text-g400">Finding the exam…</span>
            ) : exam && (
              <>
                <span className="text-g500">Maximum Marks <strong className="text-g900" style={{ fontVariantNumeric: 'tabular-nums' }}>{exam.examRuleTotalMark}</strong></span>
                {isVerified
                  ? <span className="badge badge-green"><i className="lni lni-checkmark-circle"></i> Verified</span>
                  : <span className="badge badge-amber">Not Verified</span>}
              </>
            )}
          </div>
        )}

        <div className="px-5 pb-5 flex gap-2">
          <button className="btn btn-primary" disabled={!exam || grid.isFetching} onClick={handleShowSheet}>
            <i className="lni lni-eye"></i> Show Mark Sheet
          </button>
          <button className="btn btn-neu" onClick={handleRefresh}>
            <i className="lni lni-reload"></i> Refresh
          </button>
        </div>
      </div>

      {/* ── Mark sheet ── */}
      {sheetGuid && (
        <div className="card mb-5">
          <div className="card-hdr">
            <div className="card-title">
              <span className="ctitle-icon"><i className="lni lni-list"></i></span>
              {sheet?.courseUnitName ?? 'Mark Sheet'}
            </div>
            {sheet && (
              <span className="text-sm text-g500">
                {sheet.rows.length} student{sheet.rows.length !== 1 ? 's' : ''}
                {sheet.isVerified && ' · verified, marks are locked'}
              </span>
            )}
          </div>

          {gridError ? (
            <div className="p-8 text-center text-sm" style={{ color: 'var(--red)' }}>
              <i className="lni lni-warning text-2xl block mb-2"></i>{gridErrorText}
            </div>
          ) : (
            <ScrollTable>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 64 }}>SL No</th>
                    <th>Matching Code</th>
                    {columns.map(c => {
                      const max = sheet?.maxMarks[c.max]
                      return <th key={c.field} style={{ textAlign: 'center' }}>{c.label}{max != null && <><br /><span style={{ fontWeight: 500 }}>({max})</span></>}</th>
                    })}
                    <th style={{ textAlign: 'center' }}>Total</th>
                    {showEditColumn && <th style={{ width: 150 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {grid.isLoading || !sheet ? (
                    <TableLoadingState colSpan={colCount} />
                  ) : sheet.rows.length === 0 ? (
                    <tr><td colSpan={colCount} className="text-center py-8 text-g400">No students on this mark sheet.</td></tr>
                  ) : sheet.rows.map((row, idx) => {
                    const isEditing = editing?.studentGuid === row.studentGuid
                    return (
                      <tr key={row.studentGuid}>
                        <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--g500)' }}>{idx + 1}</td>
                        <td className="font-mono">{row.matchingCode ?? ''}</td>
                        {columns.map(c => (
                          <td key={c.field} style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                            {row.isAbsent ? (
                              <span className="badge badge-red">ABS</span>
                            ) : isEditing ? (
                              <input
                                type="text"
                                inputMode="numeric"
                                aria-label={`${c.label} for ${row.matchingCode ?? `row ${idx + 1}`}`}
                                aria-invalid={invalid.has(c.field)}
                                className="ctrl"
                                style={{ width: 64, textAlign: 'center', padding: '4px 6px', ...(invalid.has(c.field) ? { borderColor: 'var(--red)' } : {}) }}
                                value={editing.values[c.field] ?? ''}
                                maxLength={String(sheet.maxMarks[c.max] ?? 999).length}
                                onChange={e => setValue(c.field, e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleUpdate(); if (e.key === 'Escape') setEditing(null) }}
                                autoFocus={c === columns[0]}
                              />
                            ) : (
                              row[c.field] ?? <span className="text-g300">—</span>
                            )}
                          </td>
                        ))}
                        <td style={{ textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                          {row.isAbsent ? <span className="badge badge-red">ABS</span> : row.totalMark ?? <span className="text-g300">—</span>}
                        </td>
                        {showEditColumn && (
                          <td>
                            {isEditing ? (
                              <div className="flex gap-1.5">
                                <button className="btn btn-primary btn-sm" onClick={handleUpdate} disabled={saveMark.isPending}>
                                  {saveMark.isPending ? 'Saving…' : 'Update'}
                                </button>
                                <button className="btn btn-neu btn-sm" onClick={() => { setEditing(null); setInvalid(new Set()) }} disabled={saveMark.isPending}>Cancel</button>
                              </div>
                            ) : canEdit(row) && (
                              <button className="btn btn-neu btn-sm" onClick={() => startEdit(row)} disabled={saveMark.isPending}>
                                <i className="lni lni-pencil"></i> Edit
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ScrollTable>
          )}
        </div>
      )}

      {/* ── Verify confirmation ── */}
      {confirmVerify && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 600 }}>
          <div className="perm-delete-card tab-panel-in" role="dialog" aria-modal="true" aria-labelledby="ue-verify-title" style={{ position: 'relative' }}>
            <button className="modal-close" onClick={() => setConfirmVerify(false)} aria-label="Close" style={{ position: 'absolute', top: 10, right: 10 }}>
              <i className="lni lni-close"></i>
            </button>
            <div className="perm-delete-icon" style={{ background: 'var(--b50)', color: 'var(--b700)' }}>
              <i className="lni lni-shield"></i>
            </div>
            <div className="perm-delete-title" id="ue-verify-title">Verify exam</div>
            <div className="perm-delete-sub">Do you want to verify the exam <strong>{unitLabel}</strong>? This can&apos;t be undone.</div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setConfirmVerify(false)}>No</button>
              <button className="btn btn-primary" onClick={handleVerify}>OK</button>
            </div>
          </div>
        </div>
      )}

      {verifiedPopup && (
        <div className="modal-overlay open">
          <div className="modal" style={{ maxWidth: 420 }}>
            <SuccessPopup title="Record verified successfully" onClose={closeVerifiedPopup} />
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  )
}
