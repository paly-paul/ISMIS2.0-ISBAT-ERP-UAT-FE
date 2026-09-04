'use client'
import { useState, useEffect } from 'react'
import { ModalProps } from '../types'
import { ScrollTable } from '@/components/ScrollTable'
import { FilterTh } from '@/components/FilterTh'
import { SearchSelect } from '@/components/SearchSelect'

export function RoomMgmtModal({ isOpen, onClose, showToast }: ModalProps) {
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [openFilter, setOpenFilter] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    function closeFilter() { setOpenFilter(null) }
    document.addEventListener('click', closeFilter)
    return () => document.removeEventListener('click', closeFilter)
  }, [isOpen])

  const rows = [
    { code: 'LR-01', name: 'Lecture Room 1',       capacity: 60, type: 'Lecture',      specialised: '—',                      status: 'Free',      statusBadge: 'badge-green', statusIcon: 'lni-checkmark' },
    { code: 'LR-02', name: 'Lecture Room 2',       capacity: 60, type: 'Lecture',      specialised: '—',                      status: 'Mon 8–10',  statusBadge: 'badge-amber', statusIcon: 'lni-warning' },
    { code: 'Lab-A', name: 'Linux Lab A',           capacity: 40, type: 'Specialist',   specialised: 'Linux / OS subjects only', status: 'Free',     statusBadge: 'badge-green', statusIcon: 'lni-checkmark' },
    { code: 'Lab-B', name: 'General Computer Lab B', capacity: 40, type: 'Computer Lab', specialised: '—',                     status: 'Free',      statusBadge: 'badge-green', statusIcon: 'lni-checkmark' },
  ]
  const filteredRows = rows.filter(r =>
    Object.entries(filters).every(([k, v]) => !v.length || v.includes((r as unknown as Record<string, string>)[k]))
  )

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

  if (!isOpen) return null
  return (
    <div className="modal-overlay open" id="room-mgmt-modal">
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-apartment"></i> Room Management</div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>
        <ScrollTable className="mb-[14px]">
          <table>
            <thead><tr><th style={{ width: 48 }}></th><th>Room Code</th><th>Room Name</th><th>Capacity</th>{fth('Type', 'type', ['Lecture', 'Specialist', 'Computer Lab'])}<th>Specialised For</th>{fth('Status', 'status', ['Free', 'Mon 8–10'])}</tr></thead>
            <tbody>
              {filteredRows.map((r, i) => (
                <tr key={i}>
                  <td><button className="btn btn-neu btn-sm"><i className="lni lni-pencil"></i> Edit</button></td>
                  <td className="font-mono">{r.code}</td>
                  <td>{r.name}</td>
                  <td>{r.capacity}</td>
                  <td>
                    {r.type === 'Lecture' && <span className="badge badge-blue">Lecture</span>}
                    {r.type === 'Specialist' && <span className="badge badge-purple">Specialist</span>}
                    {r.type === 'Computer Lab' && <span className="badge badge-cyan">Computer Lab</span>}
                  </td>
                  <td>{r.specialised}</td>
                  <td>
                    <span className={`badge ${r.statusBadge}`}>
                      <i className={`lni ${r.statusIcon}`}></i> {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
        <div className="g3">
          <div className="fg"><div className="lbl">Room Code <span className="req">*</span></div><input className="ctrl" placeholder="e.g. LR-03" /></div>
          <div className="fg"><div className="lbl">Room Name</div><input className="ctrl" placeholder="e.g. Seminar Room 3" /></div>
          <div className="fg"><div className="lbl">Capacity <span className="req">*</span></div><input className="ctrl" type="number" placeholder="e.g. 45" /></div>
          <div className="fg"><div className="lbl">Type</div><SearchSelect options={['Lecture', 'Specialist Lab', 'Computer Lab', 'Case Room']} /></div>
          <div className="fg span2"><div className="lbl">Specialised For</div><input className="ctrl" placeholder="e.g. Linux Administration, Nursing Practical" /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => showToast('Room saved.', 'success')}><i className="lni lni-plus"></i> Add Room</button>
        </div>
      </div>
    </div>
  )
}
