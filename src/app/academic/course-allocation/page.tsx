'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Toast } from '@/components/Toast'
import { SuccessPopup } from '@/components/modals/shared/SuccessPopup'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { SearchSelect } from '@/components/SearchSelect'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { CourseUnitSearchPicker, CourseUnitPickOption } from '@/components/CourseUnitSearchPicker'
import { useSearchIntakesInfinite } from '@/hooks/academic/useIntakes'
import { useSearchEmployeesInfinite } from '@/hooks/employee/useEmployees'
import { useSearchFacultiesInfinite } from '@/hooks/config/useFaculties'
import { useProgramPlannings, useCreateProgramPlanning, useUpdateProgramPlanning, useDeleteProgramPlanning } from '@/hooks/academic/useProgramPlannings'
import type { ProgramPlanningDto } from '@/lib/api/academic/programPlanning'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import { AuthError } from '@/lib/api/client'
import { flattenUniquePages } from '@/lib/pagination'
import { scrollToFirstError } from '@/lib/scrollToFirstError'

// Confirmed via allocation/*.md — real endpoints now (was UI-only mock
// against the legacy ISMS "Course Allottee" screen this page was first
// built from). Term has no real master list of its own on the backend
// (ProgramPlanningDto.term is just a plain int|null), so the same static
// 1/2/3 options the Timetable page's own Term dropdown already uses are
// reused here rather than inventing a second convention for it.
// value 3 relabeled "Both" per request, 2026-09-08 — represents Term 1 AND
// Term 2 together, not a literal third term.
const TERM_OPTIONS = [
  { value: '1', label: 'Term 1' },
  { value: '2', label: 'Term 2' },
  { value: '3', label: 'Both' },
]

const PAGE_SIZE = 10

export default function CourseAllocationPage() {
  const permissions = usePagePermissions()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const [intakeGuid, setIntakeGuid] = useState('')
  const [term, setTerm] = useState('')
  const [lecturerGuid, setLecturerGuid] = useState('')
  const [schoolGuid, setSchoolGuid] = useState('')
  const [courseUnit, setCourseUnit] = useState<CourseUnitPickOption | null>(null)
  const [load, setLoad] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [intakePickerOpen, setIntakePickerOpen] = useState(false)
  const [lecturerPickerOpen, setLecturerPickerOpen] = useState(false)
  const [facultyPickerOpen, setFacultyPickerOpen] = useState(false)
  const [intakeSearch, setIntakeSearch] = useState('')
  const [lecturerSearch, setLecturerSearch] = useState('')
  const [facultySearch, setFacultySearch] = useState('')
  const [committedIntakeSearch, setCommittedIntakeSearch] = useState('')
  const [committedLecturerSearch, setCommittedLecturerSearch] = useState('')
  const [committedFacultySearch, setCommittedFacultySearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setCommittedIntakeSearch(intakeSearch.trim()), 300)
    return () => clearTimeout(timer)
  }, [intakeSearch])

  useEffect(() => {
    const timer = setTimeout(() => setCommittedLecturerSearch(lecturerSearch.trim()), 300)
    return () => clearTimeout(timer)
  }, [lecturerSearch])

  useEffect(() => {
    const timer = setTimeout(() => setCommittedFacultySearch(facultySearch.trim()), 300)
    return () => clearTimeout(timer)
  }, [facultySearch])

  const intakeQuery = useSearchIntakesInfinite(committedIntakeSearch, 20, intakePickerOpen)
  const lecturerQuery = useSearchEmployeesInfinite(committedLecturerSearch, 20, lecturerPickerOpen)
  const facultyQuery = useSearchFacultiesInfinite(committedFacultySearch, 20, facultyPickerOpen)
  const intakes = useMemo(() => flattenUniquePages(intakeQuery.data?.pages ?? [], intake => intake.intakeGuid), [intakeQuery.data])
  const employees = useMemo(() => flattenUniquePages(lecturerQuery.data?.pages ?? [], employee => employee.employeeGuid), [lecturerQuery.data])
  const faculties = useMemo(() => flattenUniquePages(facultyQuery.data?.pages ?? [], faculty => faculty.facultyGuid), [facultyQuery.data])
  // While editing, the row's own session / school are kept in their lists
  // (labelled from the row) — the pickers only load options once opened.
  const [editingRow, setEditingRow] = useState<ProgramPlanningDto | null>(null)
  const intakeOptions = intakes.map(i => ({ value: i.intakeGuid, label: `${i.description} (${i.intakeCode})` }))
  if (editingRow && intakeGuid === editingRow.intakeGuid && !intakeOptions.some(o => o.value === intakeGuid)) {
    intakeOptions.unshift({ value: editingRow.intakeGuid, label: `${editingRow.description ?? 'Session'}${editingRow.intakeCode != null ? ` (${editingRow.intakeCode})` : ''}` })
  }
  // The options are only the current search's results, and closing the
  // picker resets the search — so a lecturer picked from a search would drop
  // out of the list and the field would fall back to the placeholder. Keep
  // the picked option and pin it into the list.
  const [pickedLecturer, setPickedLecturer] = useState<{ value: string; label: string } | null>(null)
  const lecturerOptions = employees.map(e => ({ value: e.employeeGuid, label: `${e.empName} (${e.shortCode})` }))
  if (pickedLecturer && pickedLecturer.value === lecturerGuid && !lecturerOptions.some(o => o.value === lecturerGuid)) lecturerOptions.unshift(pickedLecturer)
  const facultyOptions = faculties.map(f => ({ value: f.facultyGuid, label: `${f.facultyCode} — ${f.facultyName}` }))
  if (editingRow && schoolGuid === editingRow.schoolGuid && !facultyOptions.some(o => o.value === schoolGuid)) {
    facultyOptions.unshift({ value: editingRow.schoolGuid, label: [editingRow.facultyCode, editingRow.facultyName].filter(Boolean).join(' — ') || 'School' })
  }

  const [search, setSearch] = useState('')
  const searchTrimmed = search.trim().toLowerCase()
  const [page, setPage] = useState(1)
  // Full list (the endpoint has no paging/search — see useProgramPlannings);
  // search, sort and page all happen here.
  const { data, isLoading } = useProgramPlannings()
  const allRows = useMemo(() => data?.items ?? [], [data])
  const createPlanning = useCreateProgramPlanning()
  const updatePlanning = useUpdateProgramPlanning()
  const deletePlanning = useDeleteProgramPlanning()
  const [viewRow, setViewRow] = useState<ProgramPlanningDto | null>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const [deleteTarget, setDeleteTarget] = useState<(typeof allRows)[number] | null>(null)

  // Same "swap to SuccessPopup on save" pattern used across the rest of the
  // academic module (CourseUnitFormModal, EditIntakeModal, bulk-intake-edit,
  // etc.) rather than a toast-only confirmation for the main Allocate
  // action. Delete stays toast-only, matching how the other pages in this
  // module treat deletes vs. saves differently too.
  const [saved, setSaved] = useState<{ title: string; subtitle: string } | null>(null)

  // ProgramPlanningDto has no createdDate/timestamp of its own (see
  // get-program-plannings.md's field table) — the closest real notion of
  // "newest" this data has is intake recency, which is exactly what the
  // endpoint's own documented default order already uses ("Ordered by
  // IntIntake descending — newest intake first"). Re-affirmed client-side
  // here (by intakeCode, which the doc confirms is that same surrogate
  // key's business-facing counterpart) rather than trusted blindly, so the
  // table stays newest-to-oldest even across a client-side filter/refetch
  // that might not preserve the server's original row order.
  // Search (lecturer, course unit code/name, school, session) then sort the
  // WHOLE list newest session first, then page — sorting only the visible
  // page (as before) couldn't put the newest rows on page 1.
  const filteredRows = useMemo(() => {
    const matches = searchTrimmed
      ? allRows.filter(r => [r.employeeName, r.courseUnitCode, r.courseUnitName, r.facultyCode, r.facultyName, r.description, r.intakeCode != null ? String(r.intakeCode) : null]
          .some(v => v?.toLowerCase().includes(searchTrimmed)))
      : allRows
    return [...matches].sort((a, b) => (b.intakeCode ?? 0) - (a.intakeCode ?? 0))
  }, [allRows, searchTrimmed])
  const totalCount = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const sortedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Clamp only against loaded data, so a pending fetch can't snap the
  // page back to 1 (same fix as Room Management / Batch Summary).
  useEffect(() => {
    if (data && page !== safePage) setPage(safePage)
  }, [data, page, safePage])

  useEffect(() => {
    setPage(1)
  }, [searchTrimmed])

  // post-program-planning.md: lecturer / unit / school / intake required;
  // (lecturer, unit, intake) must be unique. load and term are optional ints
  // with no API rule — a 0 teaching load is meaningless, so the form
  // requires at least 1 when one is entered.
  const DUPLICATE_MESSAGE = 'This lecturer is already allocated to this course unit for this academic session.'
  function validate() {
    const e: Record<string, string> = {}
    if (!intakeGuid) e.intakeGuid = 'Academic Session is required'
    if (!lecturerGuid) e.lecturerGuid = 'Lecturer Name is required'
    if (!schoolGuid) e.schoolGuid = 'School / Faculty is required'
    if (!courseUnit) e.courseUnit = 'Course Unit is required'
    if (load.trim() && !(Number.isInteger(+load) && +load >= 1)) e.load = 'Teaching Load must be at least 1'
    // Catch the duplicate before the round trip — the full list is loaded.
    if (!e.courseUnit && intakeGuid && lecturerGuid && courseUnit
      && allRows.some(r => r.programPlanGuid !== editingRow?.programPlanGuid && r.lecturerGuid === lecturerGuid && r.unitGuid === courseUnit.value && r.intakeGuid === intakeGuid)) {
      e.courseUnit = DUPLICATE_MESSAGE
    }
    setErrors(e)
    scrollToFirstError(e)
    return Object.keys(e).length === 0
  }

  // Server-side failures that belong to a field go under it (all are HTTP
  // 400 — the errorCode / message says which).
  function serverFieldError(error: Error): Record<string, string> | null {
    const code = error instanceof AuthError ? error.code : undefined
    const msg = error.message || ''
    if (code === 'conflict' || /already exists for this lecturer/i.test(msg)) return { courseUnit: DUPLICATE_MESSAGE }
    if (/unit not found/i.test(msg)) return { courseUnit: 'This course unit no longer exists. Pick another one.' }
    if (/school not found/i.test(msg)) return { schoolGuid: 'This school / faculty no longer exists. Pick another one.' }
    if (/intake not found/i.test(msg)) return { intakeGuid: 'This academic session no longer exists. Pick another one.' }
    if (code === 'validation_error') {
      if (/lecturer/i.test(msg)) return { lecturerGuid: msg }
      if (/unit/i.test(msg)) return { courseUnit: msg }
      if (/school/i.test(msg)) return { schoolGuid: msg }
      if (/intake/i.test(msg)) return { intakeGuid: msg }
    }
    return null
  }

  // Edit loads the row into the form above (same pickers as Allocate) and
  // the primary button becomes Update; Cancel edit puts it back.
  function startEdit(r: ProgramPlanningDto) {
    setEditingRow(r)
    setIntakeGuid(r.intakeGuid)
    setTerm(r.term != null ? String(r.term) : '')
    setSchoolGuid(r.schoolGuid)
    setLecturerGuid(r.lecturerGuid)
    setPickedLecturer({ value: r.lecturerGuid, label: r.employeeName ?? 'Lecturer' })
    setCourseUnit({ value: r.unitGuid, code: r.courseUnitCode ?? '', name: r.courseUnitName ?? '', credits: 0 })
    setLoad(r.load != null ? String(r.load) : '')
    setErrors({})
    formRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }

  function handleUpdate() {
    if (!editingRow || !validate() || !courseUnit) return
    const lecturerLabel = lecturerOptions.find(o => o.value === lecturerGuid)?.label ?? 'The lecturer'
    updatePlanning.mutate(
      {
        guid: editingRow.programPlanGuid,
        input: { lecturerGuid, unitGuid: courseUnit.value, load: load.trim() ? +load : null, schoolGuid, intakeGuid, term: term ? +term : null },
      },
      {
        onSuccess: () => {
          setSaved({ title: 'Allocation Updated!', subtitle: `${lecturerLabel}'s allocation to ${courseUnit.code} — ${courseUnit.name} has been saved.` })
          handleCancel()
        },
        onError: (error: Error) => {
          const fieldErr = serverFieldError(error)
          if (fieldErr) { setErrors(p => ({ ...p, ...fieldErr })); scrollToFirstError(fieldErr); return }
          showToast(error.message || 'Failed to update the allocation. Please try again.', 'error')
        },
      },
    )
  }

  function handleAllocate() {
    if (!validate() || !courseUnit) return
    // Captured before the onSuccess reset below clears the picks — the
    // popup needs to name who/what was just allocated.
    const lecturerLabel = lecturerOptions.find(o => o.value === lecturerGuid)?.label ?? 'Lecturer'
    const courseUnitLabel = `${courseUnit.code} — ${courseUnit.name}`
    createPlanning.mutate(
      {
        lecturerGuid,
        unitGuid: courseUnit.value,
        load: load.trim() ? +load : null,
        schoolGuid,
        intakeGuid,
        term: term ? +term : null,
      },
      {
        onSuccess: () => {
          setSaved({ title: 'Course Unit Allocated!', subtitle: `${lecturerLabel} has been allocated to ${courseUnitLabel}.` })
          // Academic Session/Term/School stay picked — a support staff
          // member typically allocates several lecturers/course units in a
          // row for the same session/term/school, so only the
          // per-allocation fields reset. Cancel below clears everything.
          setLecturerGuid('')
          setCourseUnit(null)
          setLoad('')
          setErrors({})
        },
        onError: (error: Error) => {
          const fieldErr = serverFieldError(error)
          if (fieldErr) {
            setErrors(p => ({ ...p, ...fieldErr }))
            scrollToFirstError(fieldErr)
            return
          }
          showToast(error.message || 'Failed to allocate course unit. Please try again.', 'error')
        },
      },
    )
  }

  function handleCancel() {
    setEditingRow(null)
    setIntakeGuid('')
    setTerm('')
    setLecturerGuid('')
    setSchoolGuid('')
    setCourseUnit(null)
    setLoad('')
    setErrors({})
  }

  function confirmDelete() {
    if (!deleteTarget) return
    deletePlanning.mutate(deleteTarget.programPlanGuid, {
      onSuccess: () => {
        if (editingRow?.programPlanGuid === deleteTarget.programPlanGuid) handleCancel()
        setDeleteTarget(null); showToast('Allocation removed', 'success')
      },
      onError: (error: Error) => showToast(error.message || 'Failed to remove allocation. Please try again.', 'error'),
    })
  }

  const isAllocating = createPlanning.isPending || updatePlanning.isPending

  return (
    <div id="page-course-allocation">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Course Allocation</div>
          <div className="pg-sub">Assign a lecturer to a course unit for a session, school &amp; term</div>
        </div>
      </div>

      <div className="card" ref={formRef} style={editingRow ? { borderColor: 'var(--b300, var(--b200))', boxShadow: '0 0 0 3px var(--b50)' } : undefined}>
        <div className="card-hdr">
          <div className="card-title">
            <span className="ctitle-icon"><i className={`lni ${editingRow ? 'lni-pencil' : 'lni-agenda'}`}></i></span>
            {editingRow ? 'Edit Allocation' : 'Allocate Lecturer'}
          </div>
          {editingRow && (
            <span className="badge badge-blue">
              Editing: {editingRow.employeeName ?? 'Lecturer'} · <span className="font-mono">{editingRow.courseUnitCode ?? ''}</span>
            </span>
          )}
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Academic Session <span className="req">*</span></div>
            <SearchSelect
              placeholder="— Select Academic Session —"
              options={intakeOptions}
              value={intakeGuid}
              onSearch={setIntakeSearch}
              onOpenChange={setIntakePickerOpen}
              isLoading={intakeQuery.isLoading}
              hasNextPage={intakeQuery.hasNextPage}
              isFetchingNextPage={intakeQuery.isFetchingNextPage}
              onLoadMore={() => intakeQuery.fetchNextPage()}
              onChange={val => { setIntakeGuid(val); setErrors(p => ({ ...p, intakeGuid: '', courseUnit: p.courseUnit === DUPLICATE_MESSAGE ? '' : p.courseUnit })) }}
            />
            {errors.intakeGuid && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.intakeGuid}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Term</div>
            <SearchSelect
              placeholder="— Select Term —"
              options={TERM_OPTIONS}
              value={term}
              onChange={setTerm}
            />
          </div>
          <div className="fg">
            <div className="lbl">School / Faculty <span className="req">*</span></div>
            <SearchSelect
              placeholder="— Select School / Faculty —"
              options={facultyOptions}
              value={schoolGuid}
              onSearch={setFacultySearch}
              onOpenChange={setFacultyPickerOpen}
              isLoading={facultyQuery.isLoading}
              hasNextPage={facultyQuery.hasNextPage}
              isFetchingNextPage={facultyQuery.isFetchingNextPage}
              onLoadMore={() => facultyQuery.fetchNextPage()}
              onChange={val => { setSchoolGuid(val); if (errors.schoolGuid) setErrors(p => ({ ...p, schoolGuid: '' })) }}
            />
            {errors.schoolGuid && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.schoolGuid}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Lecturer Name <span className="req">*</span></div>
            <SearchSelect
              placeholder="— Select Lecturer —"
              options={lecturerOptions}
              value={lecturerGuid}
              onSearch={setLecturerSearch}
              onOpenChange={setLecturerPickerOpen}
              // Also loading while the 300ms debounce is pending — otherwise
              // the old results are filtered by the new text and flash "No matches".
              isLoading={(lecturerQuery.isFetching && !lecturerQuery.isFetchingNextPage) || lecturerSearch.trim() !== committedLecturerSearch}
              hasNextPage={lecturerQuery.hasNextPage}
              isFetchingNextPage={lecturerQuery.isFetchingNextPage}
              onLoadMore={() => lecturerQuery.fetchNextPage()}
              onChange={val => { setPickedLecturer(lecturerOptions.find(o => o.value === val) ?? null); setLecturerGuid(val); setErrors(p => ({ ...p, lecturerGuid: '', courseUnit: p.courseUnit === DUPLICATE_MESSAGE ? '' : p.courseUnit })) }}
            />
            {errors.lecturerGuid && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.lecturerGuid}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Course Unit <span className="req">*</span></div>
            {/* CourseUnitSearchPicker is a fire-and-forget search box (built
                for ProgrammeModal's "pick, add immediately" flow) — it
                clears its own text back to empty right after onSelect, so
                there's nothing in the field itself to show what's currently
                held for this form. A small chip underneath (clearable) is
                the selection state instead; the picker itself is always
                available to change the pick before hitting Allocate. */}
            <CourseUnitSearchPicker
              placeholder="Search course units…"
              onSelect={opt => { setCourseUnit(opt); if (errors.courseUnit) setErrors(p => ({ ...p, courseUnit: '' })) }}
            />
            {courseUnit && (
              <div className="mt-2">
                {/* Close icon sits inside the pill itself (a small circular
                    button, not a separate square .btn-neu beside it) so it
                    reads as one removable chip instead of two mismatched
                    shapes glued together. */}
                <span className="badge badge-blue" style={{ paddingRight: 6 }}>
                  <span className="font-mono">{courseUnit.code}</span> — {courseUnit.name}
                  <button
                    type="button"
                    onClick={() => { setCourseUnit(null); setErrors(p => ({ ...p, courseUnit: '' })) }}
                    title="Clear selection"
                    aria-label="Clear selection"
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 16, height: 16, borderRadius: '50%', border: 'none',
                      background: 'var(--b200)', color: 'inherit', cursor: 'pointer', padding: 0,
                    }}
                  >
                    <i className="lni lni-close" style={{ fontSize: 8 }}></i>
                  </button>
                </span>
              </div>
            )}
            {errors.courseUnit && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.courseUnit}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Teaching Load <span className="text-g400" style={{ fontWeight: 500 }}>(optional)</span></div>
            {/* Digits only — type="number" let "-", "e" and decimals through. */}
            <input
              className="ctrl"
              inputMode="numeric"
              maxLength={3}
              placeholder="e.g. 5"
              value={load}
              onChange={e => { setLoad(e.target.value.replace(/\D/g, '')); if (errors.load) setErrors(p => ({ ...p, load: '' })) }}
              style={errors.load ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.load && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.load}</p>}
          </div>
        </div>
        <div className="flex gap-[10px] justify-end mt-2">
          <button className="btn btn-neu" onClick={handleCancel}><i className="lni lni-close"></i> {editingRow ? 'Cancel Edit' : 'Cancel'}</button>
          {editingRow ? (
            permissions.edit && (
              <button className="btn btn-primary" disabled={isAllocating} onClick={handleUpdate}>
                <i className="lni lni-checkmark"></i> {updatePlanning.isPending ? 'Updating…' : 'Update Allocation'}
              </button>
            )
          ) : (
            permissions.add && (
              <button className="btn btn-primary" disabled={isAllocating} onClick={handleAllocate}>
                <i className="lni lni-checkmark"></i> {createPlanning.isPending ? 'Allocating…' : 'Allocate'}
              </button>
            )
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-hdr">
          <div className="card-title"><span className="ctitle-icon"><i className="lni lni-graduation"></i></span> Allocated List</div>
          <div className="inp-wrap" style={{ maxWidth: 260, width: '100%' }}>
            <span className="inp-icon"><i className="lni lni-search-alt"></i></span>
            <input className="ctrl" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <ScrollTable>
          <table>
            <thead>
              <tr>
                <th style={{ width: 48 }}></th>
                <th>Lecturer</th>
                <th>Course Unit</th>
                <th>School</th>
                <th>Session</th>
                <th>Term</th>
                <th>Load</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? <TableLoadingState colSpan={999} />
                : sortedRows.length === 0
                  ? <EmptyState colSpan={999} hasFilters={!!search.trim()} onClearFilters={() => setSearch('')} />
                  : null}
              {!isLoading && sortedRows.map(r => (
                <tr key={r.programPlanGuid} style={editingRow?.programPlanGuid === r.programPlanGuid ? { background: 'var(--b50)' } : undefined}>
                  <td>
                    <ActionMenu>
                      <button className="btn btn-neu btn-sm" onClick={() => setViewRow(r)}><i className="lni lni-eye"></i> View</button>
                      {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => startEdit(r)}><i className="lni lni-pencil"></i> Edit</button>}
                      {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}><i className="lni lni-trash-can"></i> Delete</button>}
                    </ActionMenu>
                  </td>
                  <td className="font-medium text-g800">{r.employeeName ?? '—'}</td>
                  <td>
                    <span className="font-mono text-xs text-b700">{r.courseUnitCode ?? '—'}</span> {r.courseUnitName ? `— ${r.courseUnitName}` : ''}
                  </td>
                  <td className="text-g600">{r.facultyCode ?? '—'}</td>
                  <td className="text-g600">{r.description ? `${r.description} (${r.intakeCode})` : '—'}</td>
                  <td>{r.term != null ? <span className="badge badge-blue">{r.term === 3 ? 'Both' : `Term ${r.term}`}</span> : '—'}</td>
                  <td className="text-g600">{r.load ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
        <Pagination page={safePage} totalPages={totalPages} totalCount={totalCount} itemLabel="allocations" onPageChange={setPage} />
      </div>

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Remove this allocation?</div>
            <div className="perm-delete-sub">
              {deleteTarget.employeeName ?? 'This lecturer'} will no longer be allocated to {deleteTarget.courseUnitCode ?? 'this course unit'}. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deletePlanning.isPending} onClick={confirmDelete}>
                <i className="lni lni-trash-can"></i> {deletePlanning.isPending ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewRow && (
        <div className="modal-overlay open">
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr modal-hdr-blue">
              <div className="modal-title"><i className="lni lni-eye"></i> View Allocation</div>
              <button className="modal-close" onClick={() => setViewRow(null)} aria-label="Close"><i className="lni lni-close"></i></button>
            </div>
            <div style={{ padding: '20px clamp(14px, 4vw, 22px)' }}>
              {/* Lead with what's allocated to whom; the rest is detail. */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', border: '1.5px solid var(--g200)', borderRadius: 'var(--rsm)', background: 'var(--surface)', marginBottom: 20 }}>
                <span className="badge badge-blue font-mono" style={{ flexShrink: 0, marginTop: 2 }}>{viewRow.courseUnitCode ?? '—'}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--g900)', lineHeight: 1.35 }}>{viewRow.courseUnitName ?? 'Course unit'}</div>
                  <div style={{ fontSize: 13, color: 'var(--g500)', marginTop: 3 }}>
                    <i className="lni lni-user" aria-hidden="true" /> Allocated to <strong style={{ color: 'var(--g800)', fontWeight: 600 }}>{viewRow.employeeName ?? '—'}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', rowGap: 18, columnGap: 24 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--g500)', marginBottom: 4 }}>School / Faculty</div>
                  <div style={{ fontSize: 14, color: 'var(--g900)', fontWeight: 500 }}>
                    {viewRow.facultyName ?? '—'}
                    {viewRow.facultyCode && <span className="font-mono" style={{ color: 'var(--g500)', fontSize: 12.5, marginLeft: 6 }}>{viewRow.facultyCode}</span>}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--g500)', marginBottom: 4 }}>Academic Session</div>
                  <div style={{ fontSize: 14, color: 'var(--g900)', fontWeight: 500 }}>
                    {viewRow.description ?? '—'}
                    {viewRow.intakeCode != null && <span className="font-mono" style={{ color: 'var(--g500)', fontSize: 12.5, marginLeft: 6 }}>{viewRow.intakeCode}</span>}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--g500)', marginBottom: 4 }}>Term</div>
                  {viewRow.term != null
                    ? <span className="badge badge-blue">{viewRow.term === 3 ? 'Both' : `Term ${viewRow.term}`}</span>
                    : <div style={{ fontSize: 14, color: 'var(--g900)', fontWeight: 500 }}>—</div>}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--g500)', marginBottom: 4 }}>Teaching Load</div>
                  <div style={{ fontSize: 14, color: 'var(--g900)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{viewRow.load ?? '—'}</div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <span className="flex-1"></span>
              {permissions.edit && (
                <button className="btn btn-neu" onClick={() => { const r = viewRow; setViewRow(null); startEdit(r) }}>
                  <i className="lni lni-pencil"></i> Edit
                </button>
              )}
              <button className="btn btn-primary" onClick={() => setViewRow(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {saved && (
        <div className="modal-overlay open">
          <div className="modal" style={{ maxWidth: 400 }}>
            <SuccessPopup title={saved.title} subtitle={saved.subtitle} onClose={() => setSaved(null)} />
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  )
}
