'use client'
import { useState } from 'react'
import { Toast } from '@/components/Toast'
import { SuccessPopup } from '@/components/modals/shared/SuccessPopup'
import { ScrollTable } from '@/components/ScrollTable'
import { SearchSelect } from '@/components/SearchSelect'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { CourseUnitSearchPicker, CourseUnitPickOption } from '@/components/CourseUnitSearchPicker'
import { usePagination } from '@/hooks/usePagination'
import { useIntakes } from '@/hooks/academic/useIntakes'
import { useEmployees } from '@/hooks/employee/useEmployees'
import { useFaculties } from '@/hooks/config/useFaculties'
import { useProgramPlannings, useCreateProgramPlanning, useDeleteProgramPlanning } from '@/hooks/academic/useProgramPlannings'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import { AuthError } from '@/lib/api/client'

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

  const { data: intakes = [] } = useIntakes()
  const intakeOptions = intakes.map(i => ({ value: i.intakeGuid, label: `${i.description} (${i.intakeCode})` }))

  const { data: employees = [] } = useEmployees()
  const lecturerOptions = employees.map(e => ({ value: e.employeeGuid, label: `${e.empName} (${e.shortCode})` }))

  const { data: faculties = [] } = useFaculties()
  const facultyOptions = faculties.map(f => ({ value: f.facultyGuid, label: `${f.facultyCode} — ${f.facultyName}` }))

  const [intakeGuid, setIntakeGuid] = useState('')
  const [term, setTerm] = useState('')
  const [lecturerGuid, setLecturerGuid] = useState('')
  const [schoolGuid, setSchoolGuid] = useState('')
  const [courseUnit, setCourseUnit] = useState<CourseUnitPickOption | null>(null)
  const [load, setLoad] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: rows = [], isLoading } = useProgramPlannings()
  const createPlanning = useCreateProgramPlanning()
  const deletePlanning = useDeleteProgramPlanning()
  const [deleteTarget, setDeleteTarget] = useState<(typeof rows)[number] | null>(null)

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
  const sortedRows = [...rows].sort((a, b) => (b.intakeCode ?? 0) - (a.intakeCode ?? 0))

  const [search, setSearch] = useState('')
  const searchTrimmed = search.trim().toLowerCase()
  const filteredRows = searchTrimmed
    ? sortedRows.filter(r => `${r.employeeName ?? ''} ${r.courseUnitCode ?? ''} ${r.courseUnitName ?? ''}`.toLowerCase().includes(searchTrimmed))
    : sortedRows
  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function validate() {
    const e: Record<string, string> = {}
    if (!intakeGuid) e.intakeGuid = 'Academic Session is required'
    if (!lecturerGuid) e.lecturerGuid = 'Lecturer Name is required'
    if (!schoolGuid) e.schoolGuid = 'School / Faculty is required'
    if (!courseUnit) e.courseUnit = 'Course Unit is required'
    setErrors(e)
    return Object.keys(e).length === 0
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
          // 400 conflict ("already exists for this lecturer, unit and
          // intake") and the various 400 not_found cases (unit/school/
          // intake no longer resolves) both come back with a real message
          // per post-program-planning.md — surface it as-is.
          showToast(error instanceof AuthError ? error.message : (error.message || 'Failed to allocate course unit. Please try again.'), 'error')
        },
      },
    )
  }

  function handleCancel() {
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
      onSuccess: () => { setDeleteTarget(null); showToast('Allocation removed', 'success') },
      onError: (error: Error) => showToast(error.message || 'Failed to remove allocation. Please try again.', 'error'),
    })
  }

  const isAllocating = createPlanning.isPending

  return (
    <div id="page-course-allocation">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Course Allocation</div>
          <div className="pg-sub">Assign a lecturer to a course unit for a session, school &amp; term</div>
        </div>
      </div>

      <div className="card">
        <div className="card-hdr">
          <div className="card-title"><span className="ctitle-icon"><i className="lni lni-agenda"></i></span> Allocate Lecturer</div>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Academic Session <span className="req">*</span></div>
            <SearchSelect
              placeholder="— Select Academic Session —"
              options={intakeOptions}
              value={intakeGuid}
              onChange={val => { setIntakeGuid(val); if (errors.intakeGuid) setErrors(p => ({ ...p, intakeGuid: '' })) }}
            />
            {errors.intakeGuid && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.intakeGuid}</p>}
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
              onChange={val => { setSchoolGuid(val); if (errors.schoolGuid) setErrors(p => ({ ...p, schoolGuid: '' })) }}
            />
            {errors.schoolGuid && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.schoolGuid}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Lecturer Name <span className="req">*</span></div>
            <SearchSelect
              placeholder="— Select Lecturer —"
              options={lecturerOptions}
              value={lecturerGuid}
              onChange={val => { setLecturerGuid(val); if (errors.lecturerGuid) setErrors(p => ({ ...p, lecturerGuid: '' })) }}
            />
            {errors.lecturerGuid && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.lecturerGuid}</p>}
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
                    onClick={() => setCourseUnit(null)}
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
            {errors.courseUnit && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.courseUnit}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Teaching Load <span className="text-g400" style={{ fontWeight: 500 }}>(optional)</span></div>
            <input className="ctrl" type="number" min={0} placeholder="e.g. 5" value={load} onChange={e => setLoad(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-[10px] justify-end mt-2">
          <button className="btn btn-neu" onClick={handleCancel}><i className="lni lni-close"></i> Cancel</button>
          {permissions.add && (
            <button className="btn btn-primary" disabled={isAllocating} onClick={handleAllocate}>
              <i className="lni lni-checkmark"></i> {isAllocating ? 'Allocating…' : 'Allocate'}
            </button>
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
                <th>Lecturer</th>
                <th>Course Unit</th>
                <th>School</th>
                <th>Session</th>
                <th>Term</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? <TableLoadingState colSpan={999} />
                : filteredRows.length === 0
                  ? <EmptyState colSpan={999} hasFilters={!!search.trim()} onClearFilters={() => setSearch('')} />
                  : null}
              {!isLoading && pageItems.map(r => (
                <tr key={r.programPlanGuid}>
                  <td className="font-medium text-g800">{r.employeeName ?? '—'}</td>
                  <td>
                    <span className="font-mono text-xs text-b700">{r.courseUnitCode ?? '—'}</span> {r.courseUnitName ? `— ${r.courseUnitName}` : ''}
                  </td>
                  <td className="text-g600">{r.facultyCode ?? '—'}</td>
                  <td className="text-g600">{r.description ? `${r.description} (${r.intakeCode})` : '—'}</td>
                  <td>{r.term != null ? <span className="badge badge-blue">{r.term === 3 ? 'Both' : `Term ${r.term}`}</span> : '—'}</td>
                  <td>
                    {permissions.delete && (
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(r)} title="Remove allocation">
                        <i className="lni lni-trash-can"></i>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
        <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="allocations" onPageChange={setPage} />
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
