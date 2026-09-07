'use client'
import { useState } from 'react'
import { ModalProps } from '../types'
import { SearchSelect } from '@/components/SearchSelect'
import { ScrollTable } from '@/components/ScrollTable'

const COURSE_UNITS = [
  { code: 'BFX3232', name: 'Dissertation / Portfolio Development', credit: 10, batch: 'BSCVEXF23DA', count: 16 },
  { code: 'BIT2201', name: 'Database Systems',                     credit: 4,  batch: 'BSC-IT-S26-DA', count: 42 },
  { code: 'BIT2202', name: 'Data Structures & Algorithms',         credit: 4,  batch: 'BSC-IT-S26-DA', count: 42 },
  { code: 'BBA3110', name: 'Strategic Management',                 credit: 3,  batch: 'BBA-S26-DA',   count: 55 },
]

const ROOMS = [
  { value: '402',   capacity: 45 },
  { value: 'LR-01', capacity: 60 },
  { value: 'LR-02', capacity: 60 },
  { value: 'Lab-A', capacity: 40 },
  { value: 'Lab-B', capacity: 40 },
  { value: 'Lab-C', capacity: 30 },
]

export function AddSlotModal({ isOpen, onClose, showToast }: ModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(['BFX3232']))
  const [room, setRoom] = useState('')

  function toggle(code: string) {
    setSelected(prev => {
      const s = new Set(prev)
      if (s.has(code)) s.delete(code); else s.add(code)
      return s
    })
  }

  if (!isOpen) return null

  const load = COURSE_UNITS.filter(u => selected.has(u.code)).reduce((sum, u) => sum + u.credit, 0)
  const roomCapacity = ROOMS.find(r => r.value === room)?.capacity ?? ''

  return (
    <div className="modal-overlay open" id="add-slot-modal">
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-calendar"></i> Create New Schedule</div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="g3">
          <div className="fg"><div className="lbl">Academic Session <span className="req">*</span></div><SearchSelect options={['Spring 2026 (20261)', 'Fall 2025 (20253)']} /></div>
          <div className="fg"><div className="lbl">Term <span className="req">*</span></div><SearchSelect options={['Term1', 'Term2', 'Term3']} /></div>
          <div className="fg"><div className="lbl">Total Load</div><input className="ctrl" value="50 Hrs" disabled /></div>
          <div className="fg"><div className="lbl">Batch/Time <span className="req">*</span></div><SearchSelect options={['Day', 'Evening', 'Weekend']} /></div>
          <div className="fg span2">
            <div className="lbl">Lecturer <span className="req">*</span></div>
            <SearchSelect
              placeholder="-- Select Lecturer --"
              options={['Kumar Thilak D.', 'Dr. Ssekibuule Ronald', 'Ms. Namutebi Joyce', 'Prof. Mukasa Charles']}
            />
          </div>
        </div>

        <div className="sec-divider">Course Units — Select to Schedule</div>
        <ScrollTable className="mb-[14px]">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Course Unit Code</th>
                <th>Course Unit Name</th>
                <th>Credit</th>
                <th>Batch</th>
                <th>Student Count</th>
              </tr>
            </thead>
            <tbody>
              {COURSE_UNITS.map(u => (
                <tr key={u.code}>
                  <td><input type="checkbox" checked={selected.has(u.code)} onChange={() => toggle(u.code)} /></td>
                  <td className="font-mono">{u.code}</td>
                  <td>{u.name}</td>
                  <td>{u.credit}</td>
                  <td>{u.batch}</td>
                  <td>{u.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>

        <div className="sec-divider">Combined Batch (Repetition Tag)</div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Has Repetition Tag?</div>
            <div className="tgl-group">
              <button className="tgl-btn tgl-active" id="slot-rep-no">No — Single Batch</button>
              <button className="tgl-btn" id="slot-rep-yes">Yes — Combine Batches</button>
            </div>
          </div>
          <div className="fg hidden" id="slot-rep-batches">
            <div className="lbl">Include Batches</div>
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-[6px] text-[var(--fs-sm)]"><input type="checkbox" /> BSC-IT-S26-DA</label>
              <label className="flex items-center gap-[6px] text-[var(--fs-sm)]"><input type="checkbox" /> BSC-IT-S26-DB</label>
              <label className="flex items-center gap-[6px] text-[var(--fs-sm)]"><input type="checkbox" /> BBA-S26-DA</label>
            </div>
          </div>
        </div>

        <div className="sec-divider">Time Slot &amp; Venue</div>
        <div className="g3">
          <div className="fg"><div className="lbl">Load</div><input className="ctrl" value={`${load} Hrs`} disabled /></div>
          <div className="fg"><div className="lbl">Day <span className="req">*</span></div><SearchSelect options={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']} /></div>
          <div className="fg">
            <div className="lbl">Room / Venue <span className="req">*</span></div>
            <SearchSelect
              placeholder="-- Select Room --"
              options={ROOMS.map(r => ({ value: r.value, label: `${r.value} (cap. ${r.capacity})` }))}
              onChange={setRoom}
            />
          </div>
          <div className="fg"><div className="lbl">Start Time <span className="req">*</span></div><input className="ctrl" type="time" defaultValue="14:00" id="slot-start" /></div>
          <div className="fg"><div className="lbl">End Time <span className="req">*</span></div><input className="ctrl" type="time" defaultValue="15:55" id="slot-end" /></div>
          <div className="fg"><div className="lbl">Capacity</div><input className="ctrl" value={roomCapacity} disabled /></div>
          <div className="fg span3"><div className="lbl">Online URL</div><input className="ctrl" placeholder="https://meet.isbat.ac.ug/… (optional, for online/hybrid sessions)" /></div>
        </div>

        <div id="slot-clash-result" className="hidden my-[10px]"></div>

        <div className="modal-footer">
          <button className="btn btn-neu" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { showToast('Schedule created — checking clashes...', 'success'); onClose() }}><i className="lni lni-checkmark"></i> Schedule</button>
        </div>
      </div>
    </div>
  )
}
