'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import { Pagination } from '@/components/Pagination'
import { useCurrentAcademicIntake } from '@/hooks/academic/useIntakes'
import {
  getPracticalCourseUnits,
  previewPracticalQuestionBank,
  importPracticalQuestionBank,
  deletePracticalQuestionBank,
  PreviewQuestion
} from '@/lib/api/assessment/questionBankPractical'
import { postQuestionBankSheets, getQuestionBankTemplate } from '@/lib/api/assessment/questionBank'

// UE Practical Question Bank Import — combined course units. Flow: pick a
// course unit → pick an Excel file → pick a sheet → Import (server preview,
// nothing saved) → Upload (saves). Delete clears every practical question of
// the course unit in the current intake. Layout follows Exam Mark Import.

const PREVIEW_PAGE_SIZE = 25

type Busy = null | 'sheets' | 'preview' | 'upload' | 'delete' | 'template'

function errMsg(err: unknown, fallback: string) {
  return (err as { message?: string } | null)?.message || fallback
}
function fmtSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export default function QuestionBankPracticalPage() {
  const [courseUnitGuid, setCourseUnitGuid] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [sheetName, setSheetName] = useState<string>('')
  const [availableSheets, setAvailableSheets] = useState<string[]>([])
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [courseUnits, setCourseUnits] = useState<{ value: string, label: string }[]>([])
  const [courseUnitsLoading, setCourseUnitsLoading] = useState(true)
  const [previewData, setPreviewData] = useState<PreviewQuestion[] | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: currentIntake, isLoading: intakeLoading } = useCurrentAcademicIntake()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getPracticalCourseUnits().then(units => {
      setCourseUnits(units.map(u => ({
        value: u.courseUnitGuid,
        label: `${u.courseUnitCode ? u.courseUnitCode + ' - ' : ''}${u.courseUnitName || 'Unnamed Unit'}`
      })))
    }).catch(() => {
      showToast('Failed to load course units', 'error')
    }).finally(() => setCourseUnitsLoading(false))
  }, [])

  function showToast(msg: string, type = '') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const sheetOptions = availableSheets.map(s => ({ value: s, label: s }))
  const courseUnitLabel = courseUnits.find(c => c.value === courseUnitGuid)?.label ?? ''
  const intakeLabel = currentIntake ? currentIntake.description || String(currentIntake.intakeCode) : null

  // The preview belongs to one course unit + file + sheet. Changing any of
  // them drops it, so Upload can never save something other than what was
  // previewed.
  function changeCourseUnit(v: string) { setCourseUnitGuid(v); setPreviewData(null) }
  function changeSheet(v: string) { setSheetName(v); setPreviewData(null); setFileError(null) }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setSheetName('')
    setAvailableSheets([])
    setPreviewData(null)
    setFileError(null)
    if (!/\.xlsx?$/i.test(selected.name)) { setFileError('Choose an Excel file (.xls or .xlsx).'); return }

    setBusy('sheets')
    try {
      const sheets = await postQuestionBankSheets(selected)
      setAvailableSheets(sheets)
      if (sheets.length > 0) setSheetName(sheets[0])
      else setFileError('The workbook has no sheets.')
    } catch (err) {
      setFileError(errMsg(err, 'The sheets could not be read from this file.'))
    } finally {
      setBusy(null)
    }
  }

  // "Import" = server preview, nothing saved yet.
  const handlePreview = async () => {
    if (!currentIntake?.intakeGuid) return showToast('No active intake found.', 'error')
    if (!courseUnitGuid) return showToast('Please select a course unit.', 'error')
    if (!file) return showToast('Please select a file.', 'error')
    if (!sheetName) return showToast('Please select a sheet.', 'error')

    setBusy('preview')
    setPreviewData(null)
    setFileError(null)
    try {
      const data = await previewPracticalQuestionBank(courseUnitGuid, file, sheetName, currentIntake.intakeGuid)
      if (data) {
        setPreviewData(data)
        setPage(1)
        setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
      }
    } catch (err) {
      // Validation problems come back as the error message — show it next to
      // the file, where the fix happens, rather than in a passing toast.
      setFileError(errMsg(err, 'Failed to preview question bank.'))
    } finally {
      setBusy(null)
    }
  }

  // "Upload" = final save of the previewed sheet.
  const handleUpload = async () => {
    if (!currentIntake?.intakeGuid) return showToast('No active intake found.', 'error')
    if (!courseUnitGuid || !file || !sheetName) return
    if (!previewData) return showToast('Please preview (Import) the data first.', 'error')

    setBusy('upload')
    try {
      await importPracticalQuestionBank(courseUnitGuid, file, sheetName, currentIntake.intakeGuid)
      showToast(`${previewData.length.toLocaleString()} questions uploaded.`, 'success')
      handleCancel()
    } catch (err) {
      showToast(errMsg(err, 'Failed to save question bank.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleDelete = async () => {
    setConfirmDelete(false)
    if (!currentIntake?.intakeGuid) return showToast('No active intake found.', 'error')
    if (!courseUnitGuid) return showToast('Please select a course unit.', 'error')

    setBusy('delete')
    try {
      await deletePracticalQuestionBank(courseUnitGuid, currentIntake.intakeGuid)
      showToast('Questions deleted successfully.', 'success')
      handleCancel()
    } catch (err) {
      showToast(errMsg(err, 'Failed to delete question bank.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleCancel = () => {
    setFile(null)
    setCourseUnitGuid('')
    setSheetName('')
    setAvailableSheets([])
    setPreviewData(null)
    setFileError(null)
    setPage(1)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDownloadTemplate = async () => {
    setBusy('template')
    try {
      const res = await getQuestionBankTemplate()
      if (res && res.url) {
        window.location.href = res.url
      } else {
        throw new Error('Template URL not received')
      }
    } catch {
      showToast('Failed to download template.', 'error')
    } finally {
      setBusy(null)
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────
  const typeCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const q of previewData ?? []) m.set(q.questionType || '—', (m.get(q.questionType || '—') ?? 0) + 1)
    return [...m.entries()]
  }, [previewData])
  const totalPages = Math.max(1, Math.ceil((previewData?.length ?? 0) / PREVIEW_PAGE_SIZE))
  const pageRows = previewData?.slice((page - 1) * PREVIEW_PAGE_SIZE, page * PREVIEW_PAGE_SIZE) ?? []
  const canPreview = !!courseUnitGuid && !!file && !!sheetName && !busy && !!currentIntake
  const step = !courseUnitGuid ? 1 : !file || !sheetName ? 2 : 3

  return (
    <div className="page active" id="page-question-bank-practical">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">UE Practical Question Bank Import</div>
          <div className="pg-sub">Import practical questions for combined course units from Excel. Nothing is saved until you upload.</div>
        </div>
        <div className="pg-actions">
          <button className="btn btn-neu" onClick={handleDownloadTemplate} disabled={busy === 'template'}>
            <i className="lni lni-download"></i> {busy === 'template' ? 'Preparing…' : 'Template download'}
          </button>
        </div>
      </div>

      {/* Import details */}
      <div className="card" style={{ padding: 0 }}>
        <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--g200)' }}>
          <div className="card-title" style={{ margin: 0 }}>
            <span className="ctitle-icon"><i className="lni lni-upload"></i></span> Import details
          </div>
          {intakeLoading ? (
            <span className="text-xs text-g500"><i className="lni lni-spinner-solid animate-spin mr-1"></i>Loading intake…</span>
          ) : intakeLabel ? (
            <span className="badge badge-blue"><i className="lni lni-calendar mr-1"></i>Intake: {intakeLabel}</span>
          ) : (
            <span className="badge badge-red"><i className="lni lni-warning mr-1"></i>No active intake</span>
          )}
        </div>

        <div className="p-5 flex flex-col gap-5">
          <StepRow n={1} active={step === 1} done={step > 1} label="Course unit" required>
            <div className="w-full sm:max-w-[420px]">
              <SearchSelect
                options={courseUnits}
                value={courseUnitGuid}
                onChange={changeCourseUnit}
                placeholder={courseUnitsLoading ? 'Loading course units…' : 'Select a course unit…'}
                disabled={!!busy}
              />
            </div>
          </StepRow>

          <StepRow n={2} active={step === 2} done={step > 2} label="Excel file" required>
            <div className="flex items-center gap-3 flex-wrap">
              <button className="btn btn-neu" onClick={() => fileInputRef.current?.click()} disabled={!!busy}>
                <i className="lni lni-upload"></i> {file ? 'Replace file' : 'Choose file'}
              </button>
              <input ref={fileInputRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={handleFileChange} />
              {file ? (
                <span className="text-sm text-g800">
                  <i className="lni lni-files mr-1 text-g500"></i><strong>{file.name}</strong> <span className="text-g500">· {fmtSize(file.size)}</span>
                </span>
              ) : (
                <span className="text-sm text-g500">.xls or .xlsx — use the template for the right columns</span>
              )}
              {busy === 'sheets' && <span className="text-sm text-g500"><i className="lni lni-spinner-solid animate-spin mr-1"></i>Reading sheets…</span>}
            </div>
          </StepRow>

          <StepRow n={3} active={step === 3} done={!!previewData} label="Sheet" required>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-full sm:w-[280px]">
                <SearchSelect
                  options={sheetOptions}
                  value={sheetName}
                  onChange={changeSheet}
                  placeholder={availableSheets.length ? 'Select a sheet…' : 'Choose a file first'}
                  disabled={!availableSheets.length || !!busy}
                />
              </div>
              <button className="btn btn-primary" onClick={handlePreview} disabled={!canPreview}>
                {busy === 'preview'
                  ? <><i className="lni lni-spinner-solid animate-spin"></i> Checking…</>
                  : <><i className="lni lni-eye"></i> Import &amp; preview</>}
              </button>
            </div>
          </StepRow>

          {fileError && <div className="danger-box text-sm"><i className="lni lni-warning"></i> {fileError}</div>}
        </div>

        {/* Danger zone — kept apart from the import actions so it can't be hit by mistake. */}
        <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-4" style={{ borderTop: '1px solid var(--g200)', background: 'var(--g100)' }}>
          <span className="text-sm text-g500">
            {courseUnitGuid
              ? <>Remove every practical question already saved for <strong className="text-g800">{courseUnitLabel}</strong>{intakeLabel ? <> in {intakeLabel}</> : null}.</>
              : 'Select a course unit to remove its saved practical questions.'}
          </span>
          <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)} disabled={!courseUnitGuid || !currentIntake || !!busy}>
            {busy === 'delete' ? <><i className="lni lni-spinner-solid animate-spin"></i> Deleting…</> : <><i className="lni lni-trash-can"></i> Delete questions</>}
          </button>
        </div>
      </div>

      {/* Preview */}
      {previewData && (
        <div ref={previewRef} className="card" style={{ padding: 0 }}>
          <div className="p-4 flex flex-wrap gap-3">
            <Tile label="Questions" value={previewData.length.toLocaleString()} color="var(--b600)" />
            {typeCounts.map(([type, count]) => <Tile key={type} label={type} value={count.toLocaleString()} />)}
          </div>

          {previewData.length === 0 ? (
            <div className="warn-box mx-4 mb-4 text-sm"><i className="lni lni-warning"></i> The sheet has no questions to upload.</div>
          ) : (
            <>
              <ScrollTable className="no-sticky-col">
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', width: 56 }}>SL</th>
                      <th>Type</th>
                      <th style={{ minWidth: 300 }}>Question</th>
                      <th>Option 1</th>
                      <th>Option 2</th>
                      <th>Option 3</th>
                      <th>Option 4</th>
                      <th>Answer</th>
                      <th className="text-center">Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row, idx) => (
                      <tr key={`${row.slNo}-${idx}`}>
                        <td className="font-mono" style={{ textAlign: 'left', verticalAlign: 'top' }}>{row.slNo}</td>
                        <td style={{ verticalAlign: 'top' }}>
                          <span className={`badge ${row.questionType === 'MCQ' ? 'badge-blue' : 'badge-purple'}`}>{row.questionType || '—'}</span>
                        </td>
                        <td style={{ verticalAlign: 'top', whiteSpace: 'normal', minWidth: 300 }}>
                          <div className="text-g900 line-clamp-2" title={row.question}>{row.question}</div>
                        </td>
                        {[row.option1, row.option2, row.option3, row.option4].map((opt, i) => (
                          <td key={i} style={{ verticalAlign: 'top' }}>
                            <div className="truncate max-w-[160px]" title={opt}>{opt || <span className="text-g400">—</span>}</div>
                          </td>
                        ))}
                        <td style={{ verticalAlign: 'top' }}>
                          <span className="font-semibold" style={{ color: 'var(--green)' }}>{row.answer || '—'}</span>
                        </td>
                        <td className="text-center" style={{ verticalAlign: 'top' }}>
                          <span className="badge badge-grey">{row.level || '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollTable>
              {previewData.length > PREVIEW_PAGE_SIZE && (
                <Pagination page={page} totalPages={totalPages} totalCount={previewData.length} itemLabel="questions" onPageChange={setPage} />
              )}
            </>
          )}

          <div className="flex items-center justify-between flex-wrap gap-3 p-4" style={{ borderTop: '1px solid var(--g200)' }}>
            <span className="text-sm text-g500">
              <i className="lni lni-checkmark-circle mr-1" style={{ color: 'var(--green)' }}></i>
              Preview of <strong className="text-g800">{sheetName}</strong> for <strong className="text-g800">{courseUnitLabel}</strong>. Not saved yet.
            </span>
            <div className="flex gap-2">
              <button className="btn btn-neu" onClick={handleCancel} disabled={busy === 'upload'}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUpload} disabled={!!busy || previewData.length === 0}>
                {busy === 'upload'
                  ? <><i className="lni lni-spinner-solid animate-spin"></i> Uploading…</>
                  : <><i className="lni lni-save"></i> Upload {previewData.length.toLocaleString()} questions</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setConfirmDelete(false)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete practical questions?</div>
            <div className="perm-delete-sub">
              Every practical question saved for {courseUnitLabel}{intakeLabel ? ` in ${intakeLabel}` : ''} will be removed. This cannot be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  )
}

function StepRow({ n, label, required, active, done, children }: { n: number; label: string; required?: boolean; active: boolean; done: boolean; children: React.ReactNode }) {
  const bg = done ? 'var(--green)' : active ? 'var(--b500)' : 'var(--g200)'
  const fg = done || active ? '#fff' : 'var(--g500)'
  return (
    <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-x-4 gap-y-2 items-center">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex items-center justify-center rounded-full text-xs font-bold shrink-0" style={{ width: 24, height: 24, background: bg, color: fg }}>
          {done ? <i className="lni lni-checkmark"></i> : n}
        </span>
        <span className="lbl mb-0">{label} {required && <span className="text-red-500">*</span>}</span>
      </div>
      <div>{children}</div>
    </div>
  )
}

function Tile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="card" style={{ padding: '12px 16px', marginBottom: 0, minWidth: 130 }}>
      <div className="text-xs font-semibold" style={{ color: color ?? 'var(--g500)' }}>{label}</div>
      <div className="text-lg font-bold mt-0.5" style={{ color: color ?? 'var(--g900)' }}>{value}</div>
    </div>
  )
}
