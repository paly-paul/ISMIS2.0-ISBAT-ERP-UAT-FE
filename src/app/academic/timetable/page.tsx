'use client'
import { useState, useEffect } from 'react'
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
import { SearchSelect } from '@/components/SearchSelect'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'

const PAGE_SIZE = 10

export default function Page() {
  const router = useRouter()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  function nav(id: string) { router.push('/academic/' + id) }
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

  const rows = [
    { day: 'Monday',    time: '08:00–10:00', courseUnit: 'IT101 – Intro to Programming',  type: 'Theory',    room: 'LR-01',  capacity: 60, faculty: 'Dr. Ssekibuule Ronald', combined: '—' },
    { day: 'Monday',    time: '10:00–12:00', courseUnit: 'IT102 – Computer Org.',          type: 'Theory',    room: 'LR-02',  capacity: 60, faculty: 'Ms. Namutebi Joyce',    combined: '—' },
    { day: 'Tuesday',   time: '08:00–10:00', courseUnit: 'IT104 – Programming Lab',        type: 'Practical', room: 'Lab-A',  capacity: 40, faculty: 'Dr. Ssekibuule Ronald', combined: '—' },
    { day: 'Wednesday', time: '10:00–12:00', courseUnit: 'IT103 – Engineering Maths I',    type: 'Theory',    room: 'LR-01',  capacity: 60, faculty: 'Ms. Namutebi Joyce',    combined: '—' },
    { day: 'Thursday',  time: '14:00–16:00', courseUnit: 'IT105 – Systems & Lab',          type: 'Practical', room: 'Lab-B',  capacity: 40, faculty: 'Dr. Ssekibuule Ronald', combined: 'BSC-IT-S26-DB' },
    { day: 'Friday',    time: '08:00–10:00', courseUnit: 'MBA101 – Managerial Economics',  type: 'Theory',    room: 'LR-02',  capacity: 60, faculty: 'Prof. Mukasa Charles',  combined: '—' },
  ]
  const searchMatches = search.trim()
    ? rows.filter(r => `${r.courseUnit} ${r.faculty}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8)
    : []

  const filteredRows = rows.filter(r => {
    if (search.trim() && !`${r.courseUnit} ${r.faculty}`.toLowerCase().includes(search.trim().toLowerCase())) return false
    return Object.entries(filters).every(([k, v]) => !v.length || v.includes(String((r as Record<string, unknown>)[k])))
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

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Timetable Management</div>
            <div className="pg-sub">Module 4 · Drag-and-drop scheduling · Dual clash prevention (Faculty + Room) · Immediate publish to Student Portal and Faculty view</div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-neu btn-sm" onClick={() => openModal('room-mgmt-modal')}><i className="lni lni-apartment"></i> Manage Rooms</button>
            <button className="btn btn-neu btn-sm" onClick={() => openModal('tt-import-modal')}><i className="lni lni-download"></i> Import Excel</button>
            <button className="btn btn-primary" onClick={() => showToast('Publishing timetable...', 'success')}><i className="lni lni-volume-high"></i> Publish — Students &amp; Faculty</button>
          </div>
        </div>

        {/* <div className="g2 mb-[14px]">
          <div className="danger-box flex-col items-start gap-1">
            <span className="font-bold text-[var(--fs-sm)]"><i className="lni lni-volume-high"></i> Dual Clash Prevention (Hard Block)</span>
            <span className="text-[var(--fs-sm)]">The system checks <strong>both</strong> conditions simultaneously on every slot entry:</span>
            <div className="flex gap-2 flex-wrap mt-[2px]">
              <span className="bg-[var(--red-bg)] border border-[var(--red-bd)] rounded p-[3px_8px] text-[var(--fs-xs)] font-semibold"><i className="lni lni-user"></i> Faculty Clash — teacher already allocated elsewhere at same time</span>
              <span className="bg-[var(--red-bg)] border border-[var(--red-bd)] rounded p-[3px_8px] text-[var(--fs-xs)] font-semibold"><i className="lni lni-apartment"></i> Room Clash — room already occupied by any class at exact same slot</span>
            </div>
            <span className="text-[var(--fs-xs)] mt-[2px]">If either clash is detected → <strong>entry is blocked with an error message</strong>. No override permitted.</span>
          </div>
          <div className="info-box flex-col items-start gap-1">
            <span className="font-bold text-[var(--fs-sm)]"><i className="lni lni-volume-high"></i> Publish Rules</span>
            <span className="text-[var(--fs-sm)]">Once published, the schedule is <strong>immediately visible</strong> on both the Student Portal and the Lecturer&apos;s view — no delay.</span>
            <span className="text-[var(--fs-sm)] mt-[2px]">Subjects with a <strong>Repetition Tag</strong> (set in Course Master) allow multiple batches to be combined into a single slot — system provides a combine option when a tag match is detected.</span>
          </div>
        </div> */}

        <div className="card mb-[14px] p-4">
          <div className="g4">
            <div className="fg"><div className="lbl">Batch <span className="req">*</span></div>
              <SearchSelect
                options={[
                  { value: 'BSC-IT-S1-D', label: 'BSC-IT-S26-DA · BSc. IT Sem 1 Day A' },
                  { value: 'BBA-S3-D', label: 'BBA-S26-DA · BBA Sem 3 Day A' },
                  { value: 'MBA-S1-E', label: 'MBA-S26-EA · MBA Sem 1 Evening A' },
                  { value: 'BENG-CIV-S2-D', label: 'BEng-CIV-S26-DA · Civil Sem 2 Day A' },
                ]}
                onChange={() => showToast('Rendering timetable...', 'info')}
              />
            </div>
            <div className="fg"><div className="lbl">Intake</div>
              <SearchSelect options={['Spring 2026 (20261)']} />
            </div>
            <div className="fg"><div className="lbl">Room Filter</div>
              <SearchSelect
                placeholder="All Rooms"
                options={[
                  { value: 'LR-01', label: 'LR-01 (cap. 60)' },
                  { value: 'LR-02', label: 'LR-02 (cap. 60)' },
                  { value: 'Lab-A', label: 'Lab-A Linux (cap. 40)' },
                  { value: 'Lab-B', label: 'Lab-B General (cap. 40)' },
                ]}
                onChange={() => showToast('Filtering rooms...', 'info')}
              />
            </div>
            <div className="fg"><div className="lbl">View</div>
              <div className="tgl-group">
                <button className="tgl-btn tgl-active" onClick={() => showToast('Week view', 'info')}><i className="lni lni-calendar"></i> Week</button>
                <button className="tgl-btn" onClick={() => showToast('List view', 'info')}><i className="lni lni-clipboard"></i> List</button>
              </div>
            </div>
          </div>
        </div>

        {/* <div id="tt-conflict-banner" className="danger-box hidden mb-[14px]">
          <i className="lni lni-volume-high"></i> <span id="tt-conflict-msg">Conflict detected — entry blocked.</span>
        </div> */}

        <div className="card" id="tt-week-view">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-calendar"></i></span> Weekly Schedule — <span id="tt-batch-label">BSC-IT-S26-DA</span></div>
            <div className="flex gap-2">
              <span className="badge badge-green" id="tt-status-badge"><i className="lni lni-checkmark"></i> No Conflicts</span>
              <button className="btn btn-neu btn-sm" onClick={() => openModal('add-slot-modal')}><i className="lni lni-plus"></i> Add Slot</button>
            </div>
          </div>
          <div className="info-box mb-[10px] p-[8px_12px]">
            <i className="lni lni-pointer"></i> <span className="text-[var(--fs-sm)]"><strong>Drag-and-drop:</strong> Drag any slot to a new day/time cell. The system will immediately check for faculty and room clashes before confirming the move. Click any empty cell to add a new slot.</span>
          </div>
          <div className="overflow-x-auto">
            <div className="tt-grid" id="tt-grid-container"></div>
          </div>
          <div className="mt-[14px] flex gap-2 flex-wrap items-center">
            <span className="text-[var(--fs-xs)] text-g500 font-semibold">Legend:</span>
            <span className="bg-b50 border border-[var(--b200)] rounded p-[3px_8px] text-[var(--fs-xs)]">Theory</span>
            <span className="bg-[var(--green-bg)] border border-[var(--green-bd)] rounded p-[3px_8px] text-[var(--fs-xs)]">Practical</span>
            <span className="bg-[var(--amber-bg)] border border-[var(--amber-bd)] rounded p-[3px_8px] text-[var(--fs-xs)]">Tutorial</span>
            <span className="bg-[var(--purple-bg)] border border-[var(--purple-bd)] rounded p-[3px_8px] text-[var(--fs-xs)]">CBT/Lab</span>
            <span className="bg-[var(--cyan-bg)] border border-[#bae6fd] rounded p-[3px_8px] text-[var(--fs-xs)]"><i className="lni lni-reload"></i> Combined Batch</span>
            <span className="bg-[var(--red-bg)] border border-[var(--red-bd)] rounded p-[3px_8px] text-[var(--fs-xs)]"><i className="lni lni-checkmark-circle"></i> Conflict (blocked)</span>
          </div>
        </div>

        <div className="card hidden" id="tt-list-view">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-clipboard"></i></span> List View — Schedule</div>
            <TableSearch
              className="w-56"
              placeholder="Search by course unit or faculty…"
              value={search}
              onChange={setSearch}
              results={searchMatches.map((r, i) => ({ id: `${r.day}-${r.time}-${i}`, primary: r.courseUnit, secondary: r.faculty }))}
            />
          </div>
          <ScrollTable filters={filters} onResetFilters={() => setFilters({})}>
            <table id="tt-list-table">
              <thead><tr><th style={{ width: 48 }}></th>{fth('Day', 'day', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])}<th>Time</th><th>Course Unit</th>{fth('Type', 'type', ['Theory', 'Practical'])}{fth('Room', 'room', ['LR-01', 'LR-02', 'Lab-A', 'Lab-B'])}<th>Capacity</th>{fth('Faculty', 'faculty', ['Dr. Ssekibuule Ronald', 'Ms. Namutebi Joyce', 'Prof. Mukasa Charles'])}<th>Combined Batch?</th></tr></thead>
              <tbody>
                {filteredRows.length === 0
                  ? <EmptyState colSpan={999} hasFilters={Object.values(filters).some(v => v.length > 0)} onClearFilters={() => setFilters({})} />
                  : null}
                {pageItems.map((r, i) => (
                  <tr key={i}>
                    <td><ActionMenu><button className="btn btn-neu btn-sm" onClick={() => openModal('add-slot-modal')}><i className="lni lni-pencil"></i> Edit</button></ActionMenu></td>
                    <td>{r.day}</td>
                    <td>{r.time}</td>
                    <td>{r.courseUnit}</td>
                    <td>
                      {r.type === 'Theory'
                        ? <span className="badge badge-blue">Theory</span>
                        : <span className="badge badge-green">Practical</span>
                      }
                    </td>
                    <td>{r.room}</td>
                    <td>{r.capacity}</td>
                    <td>{r.faculty}</td>
                    <td>{r.combined === '—' ? '—' : <span className="badge badge-cyan"><i className="lni lni-reload"></i> {r.combined}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="timetable slots" onPageChange={setPage} />
        </div>
      </div>
      <TtImportModal isOpen={openModals.has('tt-import-modal')} onClose={() => closeModal('tt-import-modal')} showToast={showToast} />
      <AddSlotModal isOpen={openModals.has('add-slot-modal')} onClose={() => closeModal('add-slot-modal')} showToast={showToast} />
      <RoomMgmtModal isOpen={openModals.has('room-mgmt-modal')} onClose={() => closeModal('room-mgmt-modal')} showToast={showToast} />
      <Toast toast={toast} />
    </>
  )
}
