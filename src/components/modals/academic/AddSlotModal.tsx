'use client'
import { ModalProps } from '../types'
import { SearchSelect } from '@/components/SearchSelect'

export function AddSlotModal({ isOpen, onClose, showToast }: ModalProps) {
  if (!isOpen) return null
  return (
    <div className="modal-overlay open" id="add-slot-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-calendar"></i> Add Timetable Slot</div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Course Unit <span className="req">*</span></div>
            <SearchSelect options={['IT101 – Intro to Programming', 'IT102 – Computer Org.', 'IT103 – Engineering Maths', 'MBA101 – Managerial Econ.']} />
          </div>
          <div className="fg"><div className="lbl">Session Type <span className="req">*</span></div><SearchSelect options={['Theory', 'Practical', 'Tutorial', 'CBT/Lab']} /></div>
          <div className="fg"><div className="lbl">Day <span className="req">*</span></div><SearchSelect options={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']} /></div>
          <div className="fg"><div className="lbl">Start Time <span className="req">*</span></div><input className="ctrl" type="time" defaultValue="08:00" id="slot-start" /></div>
          <div className="fg"><div className="lbl">End Time <span className="req">*</span></div><input className="ctrl" type="time" defaultValue="10:00" id="slot-end" /></div>
          <div className="fg">
            <div className="lbl">Room / Venue <span className="req">*</span></div>
            <SearchSelect
              placeholder="-- Select Room --"
              options={[
                { value: 'LR-01', label: 'LR-01 (Lecture, cap. 60)' },
                { value: 'LR-02', label: 'LR-02 (Lecture, cap. 60)' },
                { value: 'Lab-A', label: 'Lab-A Linux (Specialist, cap. 40)' },
                { value: 'Lab-B', label: 'Lab-B General (Computer Lab, cap. 40)' },
                { value: 'Lab-C', label: 'Lab-C MBA (Case Room, cap. 30)' },
              ]}
            />
          </div>
          <div className="fg">
            <div className="lbl">Faculty <span className="req">*</span></div>
            <SearchSelect
              placeholder="-- Select Faculty --"
              options={['Dr. Ssekibuule Ronald', 'Ms. Namutebi Joyce', 'Prof. Mukasa Charles', 'Dr. Tendo Patrick', 'Dr. Kato Andrew']}
            />
          </div>
        </div>
        <div id="slot-clash-result" className="hidden my-[10px]"></div>
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
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary"><i className="lni lni-checkmark"></i> Add &amp; Check Clashes</button>
        </div>
      </div>
    </div>
  )
}
