'use client'
import { useState, useEffect, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TtImportModal } from '@/components/modals/academic/TtImportModal'
import { AddSlotModal } from '@/components/modals/academic/AddSlotModal'
import { RoomMgmtModal } from '@/components/modals/academic/RoomMgmtModal'
import { Toast } from '@/components/Toast'
import { TableSearch } from '@/components/TableSearch'
import { FilterTh } from '@/components/FilterTh'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { SearchSelect } from '@/components/SearchSelect'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import { useIntakes } from '@/hooks/academic/useIntakes'
import { useWeekdays } from '@/hooks/config/useWeekdays'
import {
  useTimetableIntakes,
  useTimetableLecturers,
  useTimetableSlots,
  useDeleteTimetable,
  TimetableSlot,
} from '@/hooks/academic/useTimetable'
import { AuthError } from '@/lib/api/client'

const PAGE_SIZE = 10
const TERM_OPTIONS = [
  { value: '1', label: 'Term 1' },
  { value: '2', label: 'Term 2' },
  { value: '3', label: 'Term 3' },
]

export default function Page() {
  const permissions = usePagePermissions()
  const router = useRouter()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'week' | 'list'>('week')
  const [slotMode, setSlotMode] = useState<'add' | 'edit'>('add')
  const [editingTimetableGuid, setEditingTimetableGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TimetableSlot | null>(null)

  function openModal(id: string) { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  useEffect(() => {
    function closeFilter(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('th')) setOpenFilter(null)
    }
    document.addEventListener('click', closeFilter)
    return () => document.removeEventListener('click', closeFilter)
  }, [])

  // Call first per get-timetable-intakes.md — tells the page which intake
  // to default to, and which ones Add/Edit/Delete are actually allowed on
  // (current intake + next one, when it exists; past intakes are view-only
  // in this UI, even though the write endpoints themselves don't enforce
  // that restriction server-side).
  const { data: ttIntakes } = useTimetableIntakes()
  const { data: intakes = [] } = useIntakes()
  const intakeOptions = intakes.map(i => ({ value: i.intakeGuid, label: `${i.description} (${i.intakeCode})` }))

  const [intakeGuid, setIntakeGuid] = useState('')
  const [term, setTerm] = useState('1')
  const [lecturerFilterGuid, setLecturerFilterGuid] = useState('')

  // Default to the current intake once it resolves — only once, so picking
  // a different intake afterward isn't silently overridden on a background
  // refetch of the same intakes response.
  useEffect(() => {
    if (!intakeGuid && ttIntakes?.currentIntakeGuid) setIntakeGuid(ttIntakes.currentIntakeGuid)
  }, [intakeGuid, ttIntakes])

  const isEditableIntake = !!intakeGuid && !!ttIntakes?.editableIntakeGuids.includes(intakeGuid)

  // Only lecturers already timetabled for this intake/term — backs the
  // "filter by lecturer" picker, not a general employee list (see the note
  // on useTimetableLecturers).
  const { data: lecturers = [] } = useTimetableLecturers(intakeGuid || null, +term, !!intakeGuid)
  const lecturerOptions = lecturers.map(l => ({ value: l.employeeGuid, label: l.empName ?? l.employeeGuid }))

  const { data: slots = [], isLoading } = useTimetableSlots(intakeGuid || null, +term, lecturerFilterGuid || null, !!intakeGuid)
  const deleteTimetable = useDeleteTimetable()

  const { data: weekdays = [] } = useWeekdays()
  // Real weekday master, Monday-first — Sunday (last in most masters) is
  // dropped from the grid columns the same way the old mock's own TT_DAYS
  // did (a 6-day teaching week), not because the data doesn't have it.
  const gridDays = weekdays.filter(w => w.dayCode !== 'SUN').sort((a, b) => a.dayCode.localeCompare(b.dayCode))
  // Distinct time-slot spans actually in use this intake/term, sorted by
  // start time — the grid's row set is derived from real scheduled slots
  // rather than a fixed guess, since there's no "list every possible time
  // slot regardless of batch time" endpoint wired here (see AddSlotModal's
  // own Time Slot picker, which IS batch-time-scoped).
  const gridTimes = Array.from(new Set(slots.map(s => `${s.startTime}|${s.endTime}`)))
    .sort()
    .map(key => { const [startTime, endTime] = key.split('|'); return { startTime, endTime } })

  const totalLoad = slots.reduce((sum, s) => sum + (s.load || 0), 0)

  const searchTrimmed = search.trim().toLowerCase()
  const matchesSearch = (s: TimetableSlot) => `${s.roomCode} ${s.lecturerName ?? ''}`.toLowerCase().includes(searchTrimmed)
  const searchMatches = searchTrimmed ? slots.filter(matchesSearch).slice(0, 8) : []

  const filteredRows = slots.filter(s => {
    if (searchTrimmed && !matchesSearch(s)) return false
    return Object.entries(filters).every(([k, v]) => !v.length || v.includes(String((s as unknown as Record<string, unknown>)[k])))
  })
  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function fth(label: string, col: string, opts: string[]) {
    return (
      <FilterTh
        label={label}
        opts={opts}
        isOpen={openFilter === col}
        activeFilter={filters[col] ?? []}
        onToggle={(e) => { e.stopPropagation(); setOpenFilter(p => p === col ? null : col) }}
        onSelect={(vals) => { setFilters(f => ({ ...f, [col]: vals })); setOpenFilter(null) }}
        onClear={() => { setFilters(f => ({ ...f, [col]: [] })); setOpenFilter(null) }}
        onClose={() => setOpenFilter(null)}
      />
    )
  }

  function openAddSlot() {
    setSlotMode('add')
    setEditingTimetableGuid(null)
    openModal('add-slot-modal')
  }

  function openEditSlot(slot: TimetableSlot) {
    setSlotMode('edit')
    setEditingTimetableGuid(slot.timetableGuid)
    openModal('add-slot-modal')
  }

  function confirmDelete() {
    if (!deleteTarget) return
    deleteTimetable.mutate(deleteTarget.timetableGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Timetable entry removed', 'success') },
      onError: (error: Error) => {
        const code = error instanceof AuthError ? error.code : undefined
        showToast(error.message || `Failed to remove timetable entry${code ? ` (${code})` : ''}. Please try again.`, 'error')
      },
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Timetable Management</div>
            <div className="pg-sub">Faculty + Room clash prevention on every entry (checked server-side on save)</div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-neu btn-sm" onClick={() => openModal('room-mgmt-modal')}><i className="lni lni-apartment"></i> Manage Rooms</button>
            <button className="btn btn-neu btn-sm" onClick={() => openModal('tt-import-modal')}><i className="lni lni-download"></i> Import Excel</button>
          </div>
        </div>

        <div className="card mb-[14px] p-4">
          <div className="g4">
            <div className="fg"><div className="lbl">Academic Session <span className="req">*</span></div>
              <SearchSelect placeholder="— Select Session —" options={intakeOptions} value={intakeGuid} onChange={setIntakeGuid} />
            </div>
            <div className="fg"><div className="lbl">Term <span className="req">*</span></div>
              <SearchSelect options={TERM_OPTIONS} value={term} onChange={setTerm} />
            </div>
            <div className="fg"><div className="lbl">Lecturer</div>
              <SearchSelect
                placeholder="All Lecturers"
                options={lecturerOptions}
                value={lecturerFilterGuid}
                onChange={setLecturerFilterGuid}
              />
            </div>
            <div className="fg"><div className="lbl">Total Load</div>
              <input className="ctrl" value={`${totalLoad} Hrs / week`} disabled />
            </div>
          </div>
          {intakeGuid && !isEditableIntake && (
            <div className="info-box mt-3">
              <i className="lni lni-information"></i> This session is outside the current/next intake — viewable, but Add/Edit/Delete are disabled here.
            </div>
          )}
        </div>

        <div className="card" id="tt-week-view" style={{ display: view === 'week' ? undefined : 'none' }}>
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-calendar"></i></span> Weekly Schedule</div>
            <div className="flex gap-2 items-center">
              <div className="tgl-group">
                <button className={`tgl-btn${view === 'week' ? ' tgl-active' : ''}`} onClick={() => setView('week')}><i className="lni lni-calendar"></i> Week</button>
                <button className={`tgl-btn${view === 'list' ? ' tgl-active' : ''}`} onClick={() => setView('list')}><i className="lni lni-clipboard"></i> List</button>
              </div>
              {permissions.add && (
                <button className="btn btn-neu btn-sm" disabled={!intakeGuid || !isEditableIntake} onClick={openAddSlot}>
                  <i className="lni lni-plus"></i> Add Slot
                </button>
              )}
            </div>
          </div>
          {/* Room/lecturer/day render straight off get-timetable-slots — that
              endpoint deliberately does NOT include the batches attached to
              each slot (course unit/batch code), per its own doc: "fetch
              them via GET /timetables/{guid}". Showing that per-cell here
              would mean one extra request per slot just to render the grid,
              so cells show Room/Lecturer/Load instead; the full course-
              unit/batch breakdown is one click away via Edit. */}
          <div className="overflow-x-auto">
            {!intakeGuid ? (
              <div className="text-g400 text-center" style={{ padding: 24 }}>Select an Academic Session to view its timetable.</div>
            ) : isLoading ? (
              <div className="text-g400 text-center" style={{ padding: 24 }}>Loading timetable…</div>
            ) : gridTimes.length === 0 ? (
              <div className="text-g400 text-center" style={{ padding: 24 }}>No timetable entries for this session/term yet.</div>
            ) : (
              <div className="tt-grid" id="tt-grid-container" style={{ gridTemplateColumns: `100px repeat(${gridDays.length}, 1fr)` }}>
                <div></div>
                {gridDays.map(d => <div key={d.weekDayGuid} className="tt-hdr">{d.dayName}</div>)}
                {gridTimes.map(({ startTime, endTime }) => (
                  <Fragment key={`${startTime}-${endTime}`}>
                    <div className="tt-time">{startTime.slice(0, 5)}–{endTime.slice(0, 5)}</div>
                    {gridDays.map(d => {
                      const slot = slots.find(s => s.dayCode === d.dayCode && s.startTime === startTime && s.endTime === endTime)
                      if (!slot) {
                        return (
                          <div
                            key={d.weekDayGuid}
                            className="tt-slot"
                            title={isEditableIntake ? `Add slot — ${d.dayName} ${startTime.slice(0, 5)}` : undefined}
                            onClick={() => { if (isEditableIntake) openAddSlot() }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--g300)', cursor: isEditableIntake ? 'pointer' : 'default' }}
                          >
                            {isEditableIntake && <i className="lni lni-plus"></i>}
                          </div>
                        )
                      }
                      return (
                        <div
                          key={d.weekDayGuid}
                          className="tt-slot filled c1"
                          title="Click to edit slot"
                          style={{ cursor: 'pointer' }}
                          onClick={() => openEditSlot(slot)}
                        >
                          <div className="tt-entry">{slot.roomCode}</div>
                          <div className="tt-entry-sub">{slot.lecturerName ?? '—'} · {slot.load} Hrs</div>
                          {slot.url && (
                            <div className="tt-entry-sub"><i className="lni lni-world"></i> Online</div>
                          )}
                        </div>
                      )
                    })}
                  </Fragment>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card" id="tt-list-view" style={{ display: view === 'list' ? undefined : 'none' }}>
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-clipboard"></i></span> List View — Schedule</div>
            <TableSearch
              className="w-56"
              placeholder="Search by room or lecturer…"
              value={search}
              onChange={setSearch}
              results={searchMatches.map(s => ({ id: s.timetableGuid, primary: s.roomCode, secondary: s.lecturerName ?? '—' }))}
            />
          </div>
          <ScrollTable filters={filters} onResetFilters={() => setFilters({})}>
            <table id="tt-list-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  {fth('Day', 'dayName', Array.from(new Set(slots.map(s => s.dayName))))}
                  <th>Time</th>
                  <th>Batch Time</th>
                  {fth('Room', 'roomCode', Array.from(new Set(slots.map(s => s.roomCode))))}
                  {fth('Lecturer', 'lecturerName', Array.from(new Set(slots.map(s => s.lecturerName).filter((n): n is string => !!n))))}
                  <th>Load</th>
                  <th>Online?</th>
                </tr>
              </thead>
              <tbody>
                {!intakeGuid
                  ? <EmptyState colSpan={999} hasFilters={false} onClearFilters={() => {}} />
                  : isLoading
                    ? <TableLoadingState colSpan={999} />
                    : pageItems.length === 0
                      ? <EmptyState colSpan={999} hasFilters={Object.values(filters).some(v => v.length > 0) || !!search.trim()} onClearFilters={() => { setFilters({}); setSearch('') }} />
                      : null}
                {pageItems.map(s => (
                  <tr key={s.timetableGuid}>
                    <td>
                      <ActionMenu>
                        {permissions.edit && (
                          <button className="btn btn-neu btn-sm" disabled={!isEditableIntake} onClick={() => openEditSlot(s)}>
                            <i className="lni lni-pencil"></i> Edit
                          </button>
                        )}
                        {permissions.delete && (
                          <button className="btn btn-neu btn-sm text-clr-red" disabled={!isEditableIntake} onClick={() => setDeleteTarget(s)}>
                            <i className="lni lni-trash-can"></i> Delete
                          </button>
                        )}
                      </ActionMenu>
                    </td>
                    <td>{s.dayName}</td>
                    <td>{s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}</td>
                    <td>{s.batchTimeName}</td>
                    <td>{s.roomCode}</td>
                    <td>{s.lecturerName ?? '—'}</td>
                    <td>{s.load}</td>
                    <td>{s.url ? <span className="badge badge-cyan"><i className="lni lni-world"></i> Online</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="timetable slots" onPageChange={setPage} />
        </div>
      </div>
      <TtImportModal isOpen={openModals.has('tt-import-modal')} onClose={() => closeModal('tt-import-modal')} showToast={showToast} />
      <AddSlotModal
        isOpen={openModals.has('add-slot-modal')}
        onClose={() => closeModal('add-slot-modal')}
        showToast={showToast}
        mode={slotMode}
        intakeGuid={intakeGuid || null}
        term={+term}
        timetableGuid={editingTimetableGuid}
      />
      <RoomMgmtModal isOpen={openModals.has('room-mgmt-modal')} onClose={() => closeModal('room-mgmt-modal')} showToast={showToast} />
      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Remove this timetable entry?</div>
            <div className="perm-delete-sub">
              {deleteTarget.dayName} {deleteTarget.startTime.slice(0, 5)}–{deleteTarget.endTime.slice(0, 5)} · {deleteTarget.roomCode} · {deleteTarget.lecturerName ?? '—'}. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteTimetable.isPending} onClick={confirmDelete}>
                <i className="lni lni-trash-can"></i> {deleteTimetable.isPending ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
      <Toast toast={toast} />
    </>
  )
}
