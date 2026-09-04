'use client'
import { ModalProps } from '../types'
import { ScrollTable } from '@/components/ScrollTable'

export function AllocImportModal({ isOpen, onClose, showToast }: ModalProps) {
  if (!isOpen) return null
  return (
    <div className="modal-overlay open" id="alloc-import-modal">
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-download"></i> Import Allocation from Excel</div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="file-zone mb-[14px]" id="alloc-upload-zone">
          <input type="file" accept=".xlsx,.xls,.csv" />
          <div className="file-zone-icon"><i className="lni lni-bar-chart"></i></div>
          <p>Drop Excel file here or click to browse</p>
          <p className="text-[var(--fs-xs)] text-g400">.xlsx, .xls or .csv · Max 5MB</p>
          <div className="fz-uploaded" id="alloc-upload-status"></div>
        </div>
        <div id="alloc-preview-section" className="hidden">
          <div className="sec-divider">Preview (8 rows detected)</div>
          <div className="g3 mb-3">
            <div className="p-[10px] bg-[var(--green-bg)] border border-[var(--green-bd)] rounded-[var(--rsm)] text-center"><div className="text-[var(--fs-xs)] font-bold text-clr-green">VALID ROWS</div><div className="text-[var(--fs-xl)] font-extrabold text-clr-green">6</div></div>
            <div className="p-[10px] bg-[var(--amber-bg)] border border-[var(--amber-bd)] rounded-[var(--rsm)] text-center"><div className="text-[var(--fs-xs)] font-bold text-clr-amber">WARNINGS</div><div className="text-[var(--fs-xl)] font-extrabold text-clr-amber">1</div></div>
            <div className="p-[10px] bg-[var(--red-bg)] border border-[var(--red-bd)] rounded-[var(--rsm)] text-center"><div className="text-[var(--fs-xs)] font-bold text-clr-red">ERRORS</div><div className="text-[var(--fs-xl)] font-extrabold text-clr-red">1</div></div>
          </div>
          <ScrollTable className="import-preview">
            <table>
              <thead><tr><th>#</th><th>Course Code</th><th>Faculty Name</th><th>Batch Code</th><th>Semester</th><th>Status</th><th>Issue</th></tr></thead>
              <tbody>
                <tr className="import-row-ok"><td>1</td><td className="font-mono">IT101</td><td>Dr. Ssekibuule Ronald</td><td>BSC-IT-S1-D</td><td>Sem 1</td><td><span className="badge badge-green"><i className="lni lni-checkmark"></i> Valid</span></td><td>—</td></tr>
                <tr className="import-row-ok"><td>2</td><td className="font-mono">IT102</td><td>Ms. Namutebi Joyce</td><td>BSC-IT-S1-D</td><td>Sem 1</td><td><span className="badge badge-green"><i className="lni lni-checkmark"></i> Valid</span></td><td>—</td></tr>
                <tr className="import-row-warn"><td>3</td><td className="font-mono">BBA301</td><td>Dr. Kato Andrew</td><td>BBA-S3-D</td><td>Sem 3</td><td><span className="badge badge-amber"><i className="lni lni-warning"></i> Warning</span></td><td>Faculty not linked to FBM</td></tr>
                <tr className="import-row-err"><td>4</td><td className="font-mono">BBA999</td><td>Prof. Mukasa Charles</td><td>BBA-S3-D</td><td>Sem 3</td><td><span className="badge badge-red"><i className="lni lni-close"></i> Error</span></td><td>Course code not found</td></tr>
                <tr className="import-row-ok"><td>5</td><td className="font-mono">MBA101</td><td>Prof. Mukasa Charles</td><td>MBA-S1-E</td><td>Sem 1</td><td><span className="badge badge-green"><i className="lni lni-checkmark"></i> Valid</span></td><td>—</td></tr>
              </tbody>
            </table>
          </ScrollTable>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={onClose}>Cancel</button>
          <button className="btn btn-amber btn-sm hidden" id="alloc-download-errors" onClick={() => showToast('Error report downloaded.', 'warn')}><i className="lni lni-download"></i> Download Error Report</button>
          <button className="btn btn-primary hidden" id="alloc-import-btn" onClick={() => { onClose(); showToast('6 valid allocations saved. 1 warning requires manual review.', 'success') }}><i className="lni lni-checkmark"></i> Import Valid Rows (6)</button>
        </div>
      </div>
    </div>
  )
}
