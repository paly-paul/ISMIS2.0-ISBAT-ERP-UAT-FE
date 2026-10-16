'use client'

import { useMemo, useRef, useState } from 'react'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import { Pagination } from '@/components/Pagination'
import {
  useDownloadExamMarkTemplate,
  useExamMarkPreview,
  useExamMarkSheets,
  useImportExamMarks,
} from '@/hooks/assessment/useExamMarkImport'
import {
  EXAM_MARK_MAX_FILE_BYTES,
  mapSaveErrors,
  type ExamMarkPreviewRow,
  type ExamMarkProblem,
} from '@/lib/api/assessment/examMarkImport'
import { saveBlob } from '@/lib/xlsx'

// Exam Mark Import (exam-mark-import-page.md). The exam office loads final
// exam results (IA + UE per student and course unit) from Excel: pick a file
// → pick a sheet → Import (server preview, nothing saved) → Save. Every saved
// row becomes a published exam result. The File stays in page state and is
// sent again on Import and on Save.

const PREVIEW_PAGE_SIZE = 25

const RESULT_BADGE = { Pass: 'badge-green', Fail: 'badge-red', RL: 'badge-amber' } as const

// Which grid cell shows a problem for each template column.
const CELL_OF: Record<string, 'student' | 'sem' | 'session' | 'unit' | 'ia' | 'ue'> = {
  SLNO: 'student', STUDENTNUM: 'student', STUDENTNAME: 'student',
  SEMCODE: 'sem', ACADEMICINTAKE: 'session',
  UNITCODE: 'unit', UNITNAME: 'unit',
  IATOTAL: 'ia', IAMAX: 'ia', UETOTAL: 'ue', UEMAX: 'ue',
}

function errMsg(err: unknown, fallback: string) {
  return (err as { message?: string } | null)?.message || fallback
}
function fmtMark(n: number | null) {
  if (n === null) return '—'
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)))
}
function fmtSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export default function ExamMarkImportPage() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const templateMut = useDownloadExamMarkTemplate()
  const sheetsMut = useExamMarkSheets()
  const previewMut = useExamMarkPreview()
  const importMut = useImportExamMarks()

  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [sheet, setSheet] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [rows, setRows] = useState<ExamMarkPreviewRow[] | null>(null)
  const [saveMessages, setSaveMessages] = useState<string[]>([])
  const [saveRejected, setSaveRejected] = useState(false)
  const [onlyProblems, setOnlyProblems] = useState(false)
  const [page, setPage] = useState(1)
  const [confirmSave, setConfirmSave] = useState(false)

  const busy = sheetsMut.isPending || previewMut.isPending || importMut.isPending

  function clearAll() {
    setFile(null); setSheetNames([]); setSheet(''); setFileError(null)
    setRows(null); setSaveMessages([]); setSaveRejected(false); setOnlyProblems(false); setPage(1)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleTemplate() {
    templateMut.mutate(undefined, {
      onSuccess: ({ blob, filename }) => saveBlob(blob, filename ?? 'Exam_Mark_Import_Template.xlsx'),
      onError: err => showToast(errMsg(err, 'Could not download the template.'), 'error'),
    })
  }

  // ① Select file → sheet names.
  function pickFile(f: File | undefined) {
    setFileError(null); setSheetNames([]); setSheet(''); setRows(null); setSaveMessages([]); setSaveRejected(false)
    if (!f) { setFile(null); return }
    setFile(f)
    if (!f.name.toLowerCase().endsWith('.xlsx') || f.size > EXAM_MARK_MAX_FILE_BYTES) {
      setFileError('Upload an .xlsx file of at most 5 MB.')
      return
    }
    sheetsMut.mutate(f, {
      onSuccess: names => {
        setSheetNames(names)
        if (names.length === 1) setSheet(names[0])
        if (!names.length) setFileError('The workbook has no sheets.')
      },
      onError: err => { setSheetNames([]); setFileError(errMsg(err, 'The file could not be read.')) },
    })
  }

  // ② Import = server preview (nothing saved).
  function handleImport() {
    if (!file) { setFileError('Upload an .xlsx file of at most 5 MB.'); return }
    if (!sheet) { setFileError('Select a sheet.'); return }
    setFileError(null); setRows(null); setSaveMessages([]); setSaveRejected(false)
    previewMut.mutate({ file, sheetName: sheet }, {
      onSuccess: data => { setRows(data); setOnlyProblems(false); setPage(1) },
      // File-level problem (header count, no rows, too many rows): keep the
      // file so another sheet can be picked.
      onError: err => setFileError(errMsg(err, 'The sheet could not be checked.')),
    })
  }

  // ④ Save — the server checks everything again; all or nothing.
  function doSave() {
    setConfirmSave(false)
    if (!file || !sheet || !rows) return
    importMut.mutate({ file, sheetName: sheet }, {
      onSuccess: res => {
        showToast(res.message || `${(res.savedCount || rows.length).toLocaleString()} exam results saved.`, 'success')
        clearAll()
      },
      onError: err => {
        const e = err as { code?: string; errors?: string[] }
        const list = e.errors?.length ? e.errors : [errMsg(err, 'The exam results could not be saved.')]
        if (e.code === 'validation_error' || e.code === 'bad_request') {
          // Something changed since the preview: show the returned problems
          // on the grid and keep Save disabled.
          const { bySlNo, unmatched } = mapSaveErrors(list)
          setRows(prev => prev && prev.map(r => {
            const extra = bySlNo.get(r.slNo)
            return extra ? { ...r, result: null, problems: [...r.problems, ...extra] } : r
          }))
          setSaveMessages(unmatched)
          setSaveRejected(true)
          setOnlyProblems(bySlNo.size > 0)
          setPage(1)
          return
        }
        showToast(list[0], 'error')
      },
    })
  }

  // ── Derived ─────────────────────────────────────────────────────────────
  const sorted = useMemo(() => rows ? [...rows].sort((a, b) => Number(b.problems.length > 0) - Number(a.problems.length > 0)) : [], [rows])
  const problemRows = sorted.filter(r => r.problems.length)
  const readyRows = sorted.filter(r => !r.problems.length)
  const counts = { Pass: 0, Fail: 0, RL: 0 }
  for (const r of readyRows) if (r.result) counts[r.result]++
  const visible = onlyProblems ? problemRows : sorted
  const totalPages = Math.max(1, Math.ceil(visible.length / PREVIEW_PAGE_SIZE))
  const pageRows = visible.slice((page - 1) * PREVIEW_PAGE_SIZE, page * PREVIEW_PAGE_SIZE)
  const canSave = !!rows && rows.length > 0 && problemRows.length === 0 && !saveRejected && !busy

  return (
    <div className="page active">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Exam Mark Import</div>
          <div className="pg-sub">Load final exam results (IA and UE marks) from Excel. Saved results are published straight away.</div>
        </div>
        <div className="pg-actions">
          <button className="btn btn-neu" onClick={handleTemplate} disabled={templateMut.isPending}>
            <i className="lni lni-download"></i> {templateMut.isPending ? 'Preparing…' : 'Template download'}
          </button>
        </div>
      </div>

      {/* File + sheet */}
      <div className="card" style={{ padding: 20 }}>
        <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-x-4 gap-y-4 items-center">
          <label className="lbl mb-0">Select file <span className="text-red-500">*</span></label>
          <div className="flex items-center gap-3 flex-wrap">
            <button className="btn btn-neu" onClick={() => fileRef.current?.click()} disabled={busy}>
              <i className="lni lni-upload"></i> {file ? 'Replace' : 'Choose file'}
            </button>
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onClick={e => { e.currentTarget.value = '' }} onChange={e => pickFile(e.target.files?.[0])} />
            {file ? (
              <span className="text-sm text-g800"><strong>{file.name}</strong> <span className="text-g500">· {fmtSize(file.size)}</span></span>
            ) : (
              <span className="text-sm text-g500">.xlsx only · max 5 MB</span>
            )}
            {sheetsMut.isPending && <span className="text-sm text-g500"><i className="lni lni-spinner-solid animate-spin mr-1"></i>Reading sheets…</span>}
          </div>

          <label className="lbl mb-0">Select sheet <span className="text-red-500">*</span></label>
          <div className="flex items-center gap-3 flex-wrap">
            <select className="ctrl" style={{ minWidth: 280 }} value={sheet} onChange={e => { setSheet(e.target.value); setFileError(null) }} disabled={!sheetNames.length || busy}>
              <option value="">{sheetNames.length ? 'Select a sheet…' : 'Choose a file first'}</option>
              {sheetNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button className="btn btn-primary" onClick={handleImport} disabled={!file || !sheet || busy}>
              {previewMut.isPending ? <><i className="lni lni-spinner-solid animate-spin"></i> Checking…</> : <><i className="lni lni-eye"></i> Import</>}
            </button>
          </div>
        </div>
        {fileError && <div className="danger-box mt-4 text-sm"><i className="lni lni-warning"></i> {fileError}</div>}
      </div>

      {/* Preview */}
      {rows && (
        <div className="card">
          <div className="p-4 flex flex-wrap gap-3">
            <Tile label="Rows read" value={rows.length.toLocaleString()} />
            <Tile label="Ready" value={readyRows.length.toLocaleString()} color="var(--green)" />
            {problemRows.length > 0 && <Tile label="⚠ Rows with problems" value={problemRows.length.toLocaleString()} color="var(--red)" />}
            <Tile label="Results (ready rows)" value={`Pass ${counts.Pass} · Fail ${counts.Fail} · RL ${counts.RL}`} />
          </div>

          {saveMessages.map(m => <div key={m} className="danger-box mx-4 mb-3 text-sm"><i className="lni lni-warning"></i> {m}</div>)}

          <div className="px-4 pb-3 flex gap-2">
            <button className={`btn btn-sm ${!onlyProblems ? 'btn-primary' : 'btn-neu'}`} onClick={() => { setOnlyProblems(false); setPage(1) }}>All rows</button>
            <button className={`btn btn-sm ${onlyProblems ? 'btn-primary' : 'btn-neu'}`} onClick={() => { setOnlyProblems(true); setPage(1) }} disabled={!problemRows.length}>
              ⚠ Problems only ({problemRows.length})
            </button>
          </div>

          <ScrollTable className="no-sticky-col">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', width: 56 }}>SL</th>
                  <th>Student</th>
                  <th>Sem</th>
                  <th>Session</th>
                  <th>Unit</th>
                  <th style={{ textAlign: 'right' }}>IA</th>
                  <th style={{ textAlign: 'right' }}>UE</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(r => {
                  const bad = r.problems.length > 0
                  const at = (cell: string) => r.problems.filter(p => (p.column ? CELL_OF[p.column] ?? 'student' : 'student') === cell)
                  const outline = (cell: string) => (at(cell).length ? { outline: '1.5px solid var(--red)', borderRadius: 4, padding: '1px 4px' } : undefined)
                  return (
                    <tr key={r.slNo} style={bad ? { background: 'var(--red-bg)', boxShadow: 'inset 3px 0 0 var(--red)' } : undefined}>
                      <td className="font-mono" style={{ textAlign: 'left', verticalAlign: 'top' }}>{r.slNo}</td>
                      <td style={{ minWidth: 200, verticalAlign: 'top' }}>
                        <div style={outline('student')}>
                          <div className="font-semibold text-g900">{r.studentName ?? '—'}</div>
                          <div className="text-xs text-g500 font-mono">{r.studentNum ?? '—'}</div>
                        </div>
                        <Problems list={at('student')} />
                      </td>
                      <td style={{ verticalAlign: 'top' }}><span style={outline('sem')}>{r.semCode ?? '—'}</span><Problems list={at('sem')} /></td>
                      <td className="font-mono" style={{ verticalAlign: 'top' }}><span style={outline('session')}>{r.academicIntake ?? '—'}</span><Problems list={at('session')} /></td>
                      <td style={{ minWidth: 220, verticalAlign: 'top' }}>
                        <div style={outline('unit')}>
                          <div className="font-semibold font-mono text-g900">{r.unitCode ?? '—'}</div>
                          <div className="text-xs text-g500 truncate max-w-[260px]" title={r.unitName ?? undefined}>{r.unitName ?? '—'}</div>
                        </div>
                        <Problems list={at('unit')} />
                      </td>
                      <td className="font-mono whitespace-nowrap" style={{ textAlign: 'right', verticalAlign: 'top' }}>
                        <span style={outline('ia')}>{fmtMark(r.iaTotal)} / {fmtMark(r.iaMax)}</span><Problems list={at('ia')} />
                      </td>
                      <td className="font-mono whitespace-nowrap" style={{ textAlign: 'right', verticalAlign: 'top' }}>
                        <span style={outline('ue')}>{fmtMark(r.ueTotal)} / {fmtMark(r.ueMax)}</span><Problems list={at('ue')} />
                      </td>
                      <td style={{ verticalAlign: 'top' }}>
                        {!bad && r.result ? <span className={`badge ${RESULT_BADGE[r.result]}`}>{r.result}</span> : <span className="text-g400">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ScrollTable>
          {visible.length > PREVIEW_PAGE_SIZE && (
            <Pagination page={page} totalPages={totalPages} totalCount={visible.length} itemLabel="rows" onPageChange={setPage} />
          )}

          <div className="flex items-center justify-between flex-wrap gap-3 p-4" style={{ borderTop: '1px solid var(--g200)' }}>
            <span className="text-sm" style={{ color: problemRows.length || saveRejected ? 'var(--red)' : 'var(--g500)' }}>
              {problemRows.length
                ? <><i className="lni lni-warning"></i> Fix {problemRows.length} row{problemRows.length === 1 ? '' : 's'} in the file and import it again.</>
                : saveRejected ? <><i className="lni lni-warning"></i> The server rejected the save. Fix the file and import it again.</>
                  : 'All rows are ready to save.'}
            </span>
            <div className="flex gap-2">
              <button className="btn btn-neu" onClick={clearAll} disabled={importMut.isPending}>Cancel</button>
              <button className="btn btn-primary" onClick={() => setConfirmSave(true)} disabled={!canSave}>
                {importMut.isPending ? <><i className="lni lni-spinner-solid animate-spin"></i> Saving…</> : `Save ${rows.length.toLocaleString()} marks`}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmSave && rows && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setConfirmSave(false)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-save"></i></div>
            <div className="perm-delete-title">Save and publish?</div>
            <div className="perm-delete-sub">Save and publish the exam results of {rows.length.toLocaleString()} rows? Saved results cannot be changed on this page.</div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setConfirmSave(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={doSave}>Save and publish</button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
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

function Problems({ list }: { list: ExamMarkProblem[] }) {
  if (!list.length) return null
  return <div className="text-[11px] mt-1" style={{ color: 'var(--red)', textAlign: 'left' }}>{list.map((p, i) => <div key={i}>{p.message}</div>)}</div>
}
