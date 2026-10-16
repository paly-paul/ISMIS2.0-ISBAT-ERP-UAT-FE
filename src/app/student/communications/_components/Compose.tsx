'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Pagination } from '@/components/Pagination'
import { RichTextEditor, isHtmlEmpty } from '@/components/RichTextEditor'
import { SearchSelect } from '@/components/SearchSelect'
import { InfiniteSearchSelect } from '@/components/InfiniteSearchSelect'
import { AuthError } from '@/lib/api/client'
import { getCampusesPaged } from '@/lib/api/academic/campus'
import { getCountriesPaged } from '@/lib/api/academic/country'
import { getIntakesPaged } from '@/lib/api/academic/intake'
import { getProgramMastersByCampusPaged, getProgramMastersPage } from '@/lib/api/academic/programMaster'
import { getSponsorCategories } from '@/lib/api/student/sponsor'
import { useFacultyDropdown } from '@/hooks/config/useFaculties'
import { useProgramDropdown } from '@/hooks/academic/useProgramMaster'
import { useSemestersForProgram } from '@/hooks/academic/useSemesters'
import { useBatchDropdown } from '@/hooks/academic/useBatches'
import { useCurrentAcademicIntake } from '@/hooks/academic/useIntakes'
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_RECIPIENTS,
  MAX_SUBJECT_LENGTH,
  StudentSearchResultDto,
  searchBulkEmailStudents,
  useBulkEmailStudentSearch,
  useSendBulkEmail,
} from '@/hooks/student/useBulkEmail'
import { StudentSearchFilters } from '@/lib/api/student/studentSearch'

const STUDENT_PAGE_SIZE = 25
// The search API's maximum page size — used for "Select all matching".
const SELECT_ALL_PAGE_SIZE = 200

interface FilterForm {
  campusGuid: string
  schoolGuid: string
  programGuid: string
  semesterGuid: string
  batchGuid: string
  intakeCode: string
  sponsorCategoryGuid: string
  countryGuid: string
  gender: string
  refugee: string
  studentRegNo: string
  studentName: string
}

const EMPTY_FORM: FilterForm = {
  campusGuid: '', schoolGuid: '', programGuid: '', semesterGuid: '', batchGuid: '',
  intakeCode: '', sponsorCategoryGuid: '', countryGuid: '', gender: '', refugee: '',
  studentRegNo: '', studentName: '',
}

// Unset filters are sent as null. intakeCode is an int, not a GUID; gender
// is 0 Male / 1 Female; refugee is 1 refugee only / 0 non-refugee only.
function toSearchFilters(f: FilterForm): StudentSearchFilters {
  return {
    campusGuid: f.campusGuid || null,
    schoolGuid: f.schoolGuid || null,
    programGuid: f.programGuid || null,
    semesterGuid: f.semesterGuid || null,
    batchGuid: f.batchGuid || null,
    intakeCode: f.intakeCode ? Number(f.intakeCode) : null,
    sponsorCategoryGuid: f.sponsorCategoryGuid || null,
    countryGuid: f.countryGuid || null,
    gender: f.gender === '' ? null : Number(f.gender),
    refugee: f.refugee === '' ? null : f.refugee === '1',
    studentRegNo: f.studentRegNo.trim() || null,
    studentName: f.studentName.trim() || null,
  }
}

// At least one filter must be set before students are loaded — an
// unfiltered search returns every student and is slow.
function hasAnyFilter(f: StudentSearchFilters) {
  return Object.values(f).some(v => v !== null && v !== undefined && v !== '')
}

interface SelectedStudent { regNo: string; name: string; email: string }

interface Props {
  onCancel: () => void
  onSent: (selectedRecipients: number) => void
  showToast: (msg: string, type?: string) => void
}

export function Compose({ onCancel, onSent, showToast }: Props) {
  // ── Filters (left) ──
  const [form, setForm] = useState<FilterForm>(EMPTY_FORM)
  const [applied, setApplied] = useState<StudentSearchFilters>({})
  const [page, setPage] = useState(1)

  // Intake defaults to the current academic intake. Set once when it loads;
  // the user can still change or clear it.
  const { data: currentIntake } = useCurrentAcademicIntake()
  const defaultForm = useMemo<FilterForm>(() => ({ ...EMPTY_FORM, intakeCode: currentIntake ? String(currentIntake.intakeCode) : '' }), [currentIntake])
  const intakeDefaulted = useRef(false)
  useEffect(() => {
    if (intakeDefaulted.current || !currentIntake) return
    intakeDefaulted.current = true
    setForm(f => (f.intakeCode ? f : { ...f, intakeCode: String(currentIntake.intakeCode) }))
  }, [currentIntake])
  const currentIntakeOption = currentIntake ? { value: String(currentIntake.intakeCode), label: currentIntake.description || String(currentIntake.intakeCode) } : null

  // Campus, Programme, Intake, Sponsor Category and Nationality come from
  // paginated list endpoints — loaded page by page as the dropdown scrolls,
  // searched on the server as the user types (InfiniteSearchSelect). School,
  // Semester and Batch are scoped lookup endpoints that return their whole
  // (short) list in one response, so they stay plain dropdowns.
  const { data: schools = [], isFetching: schoolsLoading } = useFacultyDropdown(form.campusGuid || null)
  // A school narrows programmes through the faculty-scoped dropdown endpoint,
  // which isn't paginated.
  const { data: schoolPrograms = [], isFetching: programsLoading } = useProgramDropdown(form.schoolGuid || undefined, !!form.schoolGuid)
  const { data: semesters = [], isFetching: semestersLoading } = useSemestersForProgram(form.programGuid || null, !!form.programGuid)
  const { data: batches = [], isFetching: batchesLoading } = useBatchDropdown(form.programGuid || null, form.semesterGuid || null)

  // Cascade: changing a parent clears every child below it.
  function setCampus(v: string) { setForm(f => ({ ...f, campusGuid: v, schoolGuid: '', programGuid: '', semesterGuid: '', batchGuid: '' })) }
  function setSchool(v: string) { setForm(f => ({ ...f, schoolGuid: v, programGuid: '', semesterGuid: '', batchGuid: '' })) }
  function setProgram(v: string) { setForm(f => ({ ...f, programGuid: v, semesterGuid: '', batchGuid: '' })) }
  function setSemester(v: string) { setForm(f => ({ ...f, semesterGuid: v, batchGuid: '' })) }
  function setField<K extends keyof FilterForm>(key: K, v: FilterForm[K]) { setForm(f => ({ ...f, [key]: v })) }

  const formHasFilter = hasAnyFilter(toSearchFilters(form))
  const filtersApplied = hasAnyFilter(applied)

  function applyFilters() {
    if (!formHasFilter) { showToast('Select at least one filter.', 'warn'); return }
    setApplied(toSearchFilters(form)); setPage(1); cancelSelectAll()
  }
  // Back to the defaults (current intake). Students are hidden again until
  // Apply is clicked.
  function resetFilters() { setForm(defaultForm); setApplied({}); setPage(1); cancelSelectAll() }

  // ── Students (middle) ──
  const query = useMemo(() => ({ ...applied, pageNumber: page, pageSize: STUDENT_PAGE_SIZE }), [applied, page])
  const students = useBulkEmailStudentSearch(query, filtersApplied)
  const rows = students.data?.items ?? []
  const matchCount = students.data?.totalCount ?? 0

  // Selection persists across filter changes and pages, so one audience can
  // be built from several filters. Keyed by studentGuid (no duplicates).
  const [selected, setSelected] = useState<Map<string, SelectedStudent>>(new Map())
  const selectable = rows.filter(s => !!s.emailId)
  const pageAllSelected = selectable.length > 0 && selectable.every(s => selected.has(s.studentGuid))

  function toSelected(s: StudentSearchResultDto): SelectedStudent { return { regNo: s.studentRegNo, name: s.studentName, email: s.emailId ?? '' } }

  function toggleStudent(s: StudentSearchResultDto) {
    if (!s.emailId) return
    setSelected(prev => {
      const next = new Map(prev)
      if (next.has(s.studentGuid)) next.delete(s.studentGuid)
      else next.set(s.studentGuid, toSelected(s))
      return next
    })
  }

  function togglePage() {
    setSelected(prev => {
      const next = new Map(prev)
      if (pageAllSelected) selectable.forEach(s => next.delete(s.studentGuid))
      else selectable.forEach(s => next.set(s.studentGuid, toSelected(s)))
      return next
    })
  }

  // "Select all N matching": walks every page of the current filters at the
  // API maximum page size, adding each student that has an email. Stops if
  // the selection would go past the 10,000-per-job backend limit.
  const [selectAll, setSelectAll] = useState<{ done: number; total: number } | null>(null)
  const selectAllRun = useRef(0)
  function cancelSelectAll() { selectAllRun.current += 1; setSelectAll(null) }

  async function selectAllMatching() {
    const run = ++selectAllRun.current
    const merged = new Map(selected)
    let fetched = 0
    let pageNumber = 1
    setSelectAll({ done: 0, total: matchCount })
    try {
      while (true) {
        const res = await searchBulkEmailStudents({ ...applied, pageNumber, pageSize: SELECT_ALL_PAGE_SIZE })
        if (run !== selectAllRun.current) return
        res.items.forEach(s => { if (s.emailId) merged.set(s.studentGuid, toSelected(s)) })
        if (merged.size > MAX_RECIPIENTS) {
          setSelectAll(null)
          showToast(`A single email can go to at most ${MAX_RECIPIENTS.toLocaleString()} students. Narrow the filters and try again.`, 'err')
          return
        }
        fetched += res.items.length
        setSelectAll({ done: fetched, total: res.totalCount })
        if (res.items.length < SELECT_ALL_PAGE_SIZE || fetched >= res.totalCount) break
        pageNumber += 1
      }
      setSelected(merged)
      showToast(`${merged.size.toLocaleString()} students selected`, 'ok')
    } catch (err) {
      if (run === selectAllRun.current) showToast((err as Error).message || 'Could not select all matching students', 'err')
    } finally {
      if (run === selectAllRun.current) setSelectAll(null)
    }
  }

  // ── Message (right) ──
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const send = useSendBulkEmail()

  function pickFile(f: File | null) {
    setFileError(null)
    if (!f) { setFile(null); return }
    if (!ATTACHMENT_MIME_TYPES.includes(f.type)) { setFileError('Only PDF, JPEG, PNG or DOCX files can be attached.'); return }
    if (f.size > MAX_ATTACHMENT_BYTES) { setFileError('The attachment must be 8 MB or smaller.'); return }
    setFile(f)
  }

  const recipientCount = selected.size
  const overLimit = recipientCount > MAX_RECIPIENTS
  const subjectMissing = !subject.trim()
  const bodyMissing = isHtmlEmpty(body)
  const canSend = recipientCount >= 1 && !overLimit && !subjectMissing && !bodyMissing && subject.length <= MAX_SUBJECT_LENGTH && !send.isPending
  const dirty = recipientCount > 0 || !subjectMissing || !bodyMissing

  // Warn before closing the tab with unsent input.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  function requestCancel() { if (dirty) setDiscardOpen(true); else onCancel() }

  function doSend() {
    setSendError(null)
    send.mutate(
      { subject: subject.trim(), body, studentGuids: [...selected.keys()], file },
      {
        onSuccess: res => { setConfirmOpen(false); onSent(res?.selectedRecipients ?? recipientCount) },
        onError: (err: Error) => {
          setConfirmOpen(false)
          const code = err instanceof AuthError ? err.code : ''
          if (code === 'bad_request' || code === 'unauthorized') setSendError('Your session has expired. Please log in again.')
          else setSendError(err.message || 'Could not queue the email.')
        },
      },
    )
  }

  const opt = (label: string) => [{ value: '', label }]
  const showRight = filtersApplied || recipientCount > 0

  return (
    <section className="cm-main cm-compose-page">
      <div className="cm-toolbar">
        <button className="cm-icon-btn" title="Back to list" onClick={requestCancel}><i className="lni lni-arrow-left"></i></button>
        <div className="cm-compose-title">New Bulk Email</div>
      </div>

      <div className="cm-compose-grid cm-compose-grid-3">
        {/* ── Filters ── */}
        <div className="cm-compose-side">
          <div className="cm-compose-sect">
            <i className="lni lni-funnel"></i> Filters
            <div className="cm-filter-actions">
              <button className="cm-link" onClick={resetFilters}>Reset</button>
              <button className="btn btn-primary btn-sm" disabled={!formHasFilter} title={formHasFilter ? undefined : 'Select at least one filter'} onClick={applyFilters}>Apply</button>
            </div>
          </div>
          <div className="fg"><label className="lbl">Campus</label>
            <InfiniteSearchSelect
              queryKey={['campuses', 'bulk-email']}
              fetchPage={getCampusesPaged}
              toOption={c => ({ value: c.campusGuid, label: c.campusName })}
              allLabel="All campuses"
              value={form.campusGuid}
              onChange={setCampus}
            />
          </div>
          <div className="fg"><label className="lbl">School</label>
            <SearchSelect options={[...opt('All schools'), ...schools.map(s => ({ value: s.facultyGuid, label: s.facultyName }))]} value={form.schoolGuid} onChange={setSchool} isLoading={schoolsLoading} />
          </div>
          <div className="fg"><label className="lbl">Programme</label>
            {form.schoolGuid ? (
              <SearchSelect options={[...opt('All programmes'), ...schoolPrograms.map(p => ({ value: p.programGuid, label: p.programName || p.programCode }))]} value={form.programGuid} onChange={setProgram} isLoading={programsLoading} />
            ) : (
              // Scoped to the campus when one is picked, otherwise all programmes.
              <InfiniteSearchSelect
                key={form.campusGuid || 'all'}
                queryKey={['program-masters', 'bulk-email', form.campusGuid]}
                fetchPage={(page, size, search) => form.campusGuid ? getProgramMastersByCampusPaged(form.campusGuid, page, size, search) : getProgramMastersPage(page, size, search)}
                toOption={p => ({ value: p.programGuid, label: p.programName || p.programCode })}
                allLabel="All programmes"
                value={form.programGuid}
                onChange={setProgram}
              />
            )}
          </div>
          <div className="fg"><label className="lbl">Semester</label>
            <SearchSelect options={[...opt(form.programGuid ? 'All semesters' : 'Pick a programme first'), ...semesters.map(s => ({ value: s.semesterGuid, label: s.semName }))]} value={form.semesterGuid} onChange={setSemester} disabled={!form.programGuid} isLoading={semestersLoading} />
          </div>
          <div className="fg"><label className="lbl">Batch</label>
            <SearchSelect options={[...opt(form.programGuid ? 'All batches' : 'Pick a programme first'), ...batches.map(b => ({ value: b.batchGuid, label: b.batchCode }))]} value={form.batchGuid} onChange={v => setField('batchGuid', v)} disabled={!form.programGuid || !form.semesterGuid} isLoading={batchesLoading} />
          </div>
          <div className="fg"><label className="lbl">Intake</label>
            <InfiniteSearchSelect
              queryKey={['intakes', 'bulk-email']}
              fetchPage={getIntakesPaged}
              toOption={i => ({ value: String(i.intakeCode), label: i.description || String(i.intakeCode) })}
              allLabel="All intakes"
              selectedOption={currentIntakeOption}
              value={form.intakeCode}
              onChange={v => setField('intakeCode', v)}
            />
          </div>
          <div className="fg"><label className="lbl">Sponsor Category</label>
            {/* The sponsor-categories list takes page/pageSize only — typed
                text filters the pages already loaded. */}
            <InfiniteSearchSelect
              queryKey={['sponsor-categories', 'bulk-email']}
              fetchPage={page => getSponsorCategories(page, 20)}
              toOption={s => ({ value: s.sponsorCategoryGuid, label: s.category })}
              allLabel="All sponsor categories"
              value={form.sponsorCategoryGuid}
              onChange={v => setField('sponsorCategoryGuid', v)}
            />
          </div>
          <div className="fg"><label className="lbl">Nationality</label>
            <InfiniteSearchSelect
              queryKey={['countries', 'bulk-email']}
              fetchPage={getCountriesPaged}
              toOption={c => ({ value: c.countryGuid, label: c.nationality || c.countryName })}
              allLabel="All nationalities"
              value={form.countryGuid}
              onChange={v => setField('countryGuid', v)}
            />
          </div>
          <div className="g2">
            <div className="fg"><label className="lbl">Gender</label>
              <SearchSelect options={[...opt('All'), { value: '0', label: 'Male' }, { value: '1', label: 'Female' }]} value={form.gender} onChange={v => setField('gender', v)} />
            </div>
            <div className="fg"><label className="lbl">Refugee</label>
              <SearchSelect options={[...opt('All'), { value: '1', label: 'Refugees only' }, { value: '0', label: 'Non-refugees' }]} value={form.refugee} onChange={v => setField('refugee', v)} />
            </div>
          </div>
          <div className="fg"><label className="lbl">Reg. No</label>
            <input className="ctrl" maxLength={50} placeholder="Partial match" value={form.studentRegNo} onChange={e => setField('studentRegNo', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') applyFilters() }} />
          </div>
          <div className="fg"><label className="lbl">Name</label>
            <input className="ctrl" maxLength={50} placeholder="Partial match" value={form.studentName} onChange={e => setField('studentName', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') applyFilters() }} />
          </div>
        </div>

        {/* Students and Message stay hidden until filters are applied (or
            students were already picked under earlier filters). */}
        {!showRight ? (
          <div className="cm-compose-empty">
            <div className="empty">
              <div className="empty-icon"><i className="lni lni-funnel"></i></div>
              <div className="empty-title">Select at least one filter</div>
              <div className="empty-sub">Choose filters on the left and click <strong>Apply</strong> to load the matching students.</div>
            </div>
          </div>
        ) : (<>
        {/* ── Students ── */}
        <div className="cm-compose-students">
          <div className="cm-stu-head">
            <label className="cm-check">
              <input type="checkbox" checked={pageAllSelected} disabled={selectable.length === 0 || !!selectAll} onChange={togglePage} />
              Select page
            </label>
            <span className="cm-stu-count">{students.isLoading ? 'Loading…' : `${matchCount.toLocaleString()} students match`}</span>
            {selectAll ? (
              <span className="cm-select-all">
                <i className="lni lni-spinner-arrow cm-spin"></i> Selecting… {selectAll.done.toLocaleString()} / {selectAll.total.toLocaleString()}
                <button className="cm-link" onClick={cancelSelectAll}>Cancel</button>
              </span>
            ) : pageAllSelected && matchCount > selectable.length && (
              <button className="cm-link" onClick={selectAllMatching}>Select all {matchCount.toLocaleString()} matching</button>
            )}
          </div>

          <div className="cm-stu-list">
            {students.isLoading ? (
              <div className="empty" style={{ padding: 40 }}><div className="empty-icon"><i className="lni lni-spinner-arrow cm-spin"></i></div><div className="empty-title">Loading students…</div></div>
            ) : students.isError && !students.data ? (
              <div className="empty" style={{ padding: 40 }}>
                <div className="empty-icon"><i className="lni lni-warning"></i></div>
                <div className="empty-title">Could not load students</div>
                <button className="btn btn-neu btn-sm" style={{ marginTop: 10 }} onClick={() => students.refetch()}><i className="lni lni-reload"></i> Retry</button>
              </div>
            ) : rows.length === 0 ? (
              <div className="empty" style={{ padding: 40 }}><div className="empty-icon"><i className="lni lni-users"></i></div><div className="empty-title">No students match these filters.</div></div>
            ) : rows.map(s => (
              // Students without an email can't be picked — the backend drops
              // them anyway, and the recipient count would be wrong.
              <label key={s.studentGuid} className={`cm-stu-row${s.emailId ? '' : ' disabled'}${selected.has(s.studentGuid) ? ' checked' : ''}`}>
                <input type="checkbox" checked={selected.has(s.studentGuid)} disabled={!s.emailId} onChange={() => toggleStudent(s)} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="cm-stu-name"><span className="cm-stu-reg">{s.studentRegNo}</span>{s.studentName}</div>
                  <div className="cm-stu-meta">
                    {[s.programCode, s.batchCode, s.semName].filter(Boolean).join(' · ') || '—'}
                    {' · '}
                    {s.emailId ? <span>{s.emailId}</span> : <span className="badge badge-amber">⚠ No email</span>}
                  </div>
                </div>
              </label>
            ))}
          </div>
          <div style={{ padding: '0 16px 10px' }}>
            <Pagination page={page} totalPages={Math.max(1, Math.ceil(matchCount / STUDENT_PAGE_SIZE))} totalCount={matchCount} itemLabel="students" onPageChange={setPage} />
          </div>
        </div>

        {/* ── Message ── */}
        <div className="cm-compose-main">
          <div className="cm-compose-sect"><i className="lni lni-envelope"></i> Message</div>

          <div className="cm-reach">
            <span><i className="lni lni-users"></i> To: <strong>{recipientCount.toLocaleString()}</strong> student{recipientCount === 1 ? '' : 's'}</span>
            <button className="cm-link" disabled={recipientCount === 0} onClick={() => setDrawerOpen(true)}>View</button>
          </div>
          {overLimit && <div className="field-hint err" style={{ marginTop: 6 }}>A single email can go to at most {MAX_RECIPIENTS.toLocaleString()} students.</div>}

          <div className="fg" style={{ marginTop: 14 }}><label className="lbl">Subject <span className="req">*</span></label>
            <input className="ctrl" maxLength={MAX_SUBJECT_LENGTH} placeholder="e.g. Reminder: Outstanding Fee Balance — Spring 2026" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>

          <div className="fg"><label className="lbl">Body <span className="req">*</span></label>
            <RichTextEditor value={body} onChange={setBody} placeholder="Write the email…" minHeight={280} />
          </div>

          <div className="fg"><label className="lbl">Attachment (optional)</label>
            {file ? (
              <div className="cm-attach-row" style={{ margin: 0 }}>
                <span className="cm-file-chip"><i className="lni lni-paperclip"></i> {file.name}</span>
                <button className="cm-icon-btn cm-icon-btn-sm" title="Remove attachment" onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = '' }}><i className="lni lni-close"></i></button>
              </div>
            ) : (
              <button className="btn btn-neu btn-sm" onClick={() => fileInput.current?.click()}><i className="lni lni-paperclip"></i> Choose file</button>
            )}
            <input ref={fileInput} type="file" accept={ATTACHMENT_ACCEPT} style={{ display: 'none' }} onChange={e => pickFile(e.target.files?.[0] ?? null)} />
            <div className={fileError ? 'field-hint err' : 'cm-hint'} style={{ marginTop: 6 }}>
              {fileError ?? 'PDF, JPEG, PNG or DOCX, up to 8 MB. Attachments are stored but not yet included in the email.'}
            </div>
          </div>

          {sendError && (
            <div className="danger-box">
              <i className="lni lni-warning" style={{ color: 'var(--red)', fontSize: 15, flexShrink: 0 }}></i>
              <div style={{ fontSize: 12.5 }}>{sendError}</div>
            </div>
          )}
        </div>
        </>)}
      </div>

      <div className="cm-compose-ftr">
        <button className="btn btn-neu" onClick={requestCancel}>Cancel</button>
        {showRight && (
          <button className="btn btn-primary" disabled={!canSend} onClick={() => setConfirmOpen(true)}>
            <i className="lni lni-telegram-original"></i> Send to {recipientCount.toLocaleString()} Student{recipientCount === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {/* Confirm send — a job can't be cancelled once started. */}
      {confirmOpen && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => !send.isPending && setConfirmOpen(false)}>
          <div className="perm-delete-card cm-confirm-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-warning"></i></div>
            <div className="perm-delete-title">Send &quot;{subject.trim()}&quot; to {recipientCount.toLocaleString()} student{recipientCount === 1 ? '' : 's'}?</div>
            <div className="perm-delete-sub">
              This cannot be cancelled once started.{file && <> The attachment <strong>{file.name}</strong> is stored but not yet included in the email.</>}
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setConfirmOpen(false)} disabled={send.isPending}>Cancel</button>
              <button className="btn btn-primary" onClick={doSend} disabled={send.isPending}>
                <i className="lni lni-telegram-original"></i> {send.isPending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {discardOpen && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDiscardOpen(false)}>
          <div className="perm-delete-card cm-confirm-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Discard this email?</div>
            <div className="perm-delete-sub">Your selected students, subject and message will be lost.</div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDiscardOpen(false)}>Keep Editing</button>
              <button className="btn btn-danger" onClick={onCancel}><i className="lni lni-trash-can"></i> Discard</button>
            </div>
          </div>
        </div>
      )}

      {/* Selected students */}
      {drawerOpen && (
        <div className="modal-overlay open">
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr"><div className="modal-title">Selected students ({recipientCount.toLocaleString()})</div><button className="modal-close" onClick={() => setDrawerOpen(false)}>✕</button></div>
            <div className="cm-selected-list">
              {recipientCount === 0 ? (
                <div className="empty" style={{ padding: 24 }}><div className="empty-title">No students selected</div></div>
              ) : [...selected.entries()].map(([guid, s]) => (
                <div key={guid} className="cm-selected-row">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="cm-stu-name"><span className="cm-stu-reg">{s.regNo}</span>{s.name}</div>
                    <div className="cm-stu-meta">{s.email}</div>
                  </div>
                  <button className="cm-icon-btn cm-icon-btn-sm" title="Remove" onClick={() => setSelected(prev => { const next = new Map(prev); next.delete(guid); return next })}><i className="lni lni-close"></i></button>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-neu" disabled={recipientCount === 0} onClick={() => setSelected(new Map())}>Clear all</button>
              <button className="btn btn-primary" onClick={() => setDrawerOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
