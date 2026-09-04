'use client'
import { ModalProps } from '../types'

export function ElectiveSelectModal({ isOpen, onClose, showToast }: ModalProps) {
  if (!isOpen) return null
  return (
    <div className="modal-overlay open" id="elective-select-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-bar-chart"></i> Select Elective Paper — Batch BSC-IT-S26-DA · Sem 5</div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="flex flex-col gap-2 mb-[14px]">
          <label className="flex items-start gap-3 p-3 border-[1.5px] border-g200 rounded-[var(--rsm)] cursor-pointer transition-[var(--tr)]">
            <input type="radio" name="elective" className="mt-[2px] shrink-0" />
            <div><div className="font-bold">Radar Navigation Systems</div><div className="text-[var(--fs-sm)] text-g500">3 Credits · Theory · CW + CBT + UE</div></div>
          </label>
          <label className="flex items-start gap-3 p-3 border-[1.5px] border-g200 rounded-[var(--rsm)] cursor-pointer transition-[var(--tr)]">
            <input type="radio" name="elective" className="mt-[2px] shrink-0" />
            <div><div className="font-bold">Renewable Energy Systems</div><div className="text-[var(--fs-sm)] text-g500">3 Credits · Combined · CW + CBT + UE + Practical</div></div>
          </label>
          <label className="flex items-start gap-3 p-3 border-[1.5px] border-g200 rounded-[var(--rsm)] cursor-pointer transition-[var(--tr)]">
            <input type="radio" name="elective" className="mt-[2px] shrink-0" />
            <div><div className="font-bold">Remote Sensing &amp; GIS</div><div className="text-[var(--fs-sm)] text-g500">3 Credits · Theory · CW + CBT + UE</div></div>
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { onClose(); showToast('Elective paper selected for batch. Curriculum updated.', 'success') }}><i className="lni lni-checkmark"></i> Confirm Elective Selection</button>
        </div>
      </div>
    </div>
  )
}
