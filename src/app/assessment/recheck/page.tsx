'use client'
import { useState } from 'react'
import { ScrollTable } from '@/components/ScrollTable'
import { TableSearch } from '@/components/TableSearch'
import { SearchSelect } from '@/components/SearchSelect'
import { Pagination } from '@/components/Pagination'
import { FilterTh } from '@/components/FilterTh'
import { Toast } from '@/components/Toast'

export default function RecheckHub() {
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [page1, setPage1] = useState(1)
  const [page2, setPage2] = useState(1)
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [toast, setToast] = useState<{msg: string, type: string} | null>(null)

  const showToast = (msg: string, type: string = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleFilterSelect = (col: string, vals: string[]) => {
    setFilters(prev => ({ ...prev, [col]: vals }))
    setOpenFilter(null)
  }

  function openAssignModal() {
    setAssignModalOpen(true)
  }

  function closeAssignModal() {
    setAssignModalOpen(false)
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">CW Recheck Hub — Tier 2</div>
            <div className="pg-sub">Dean/Admin access only · Independent auditor assignment · Original faculty identity hidden</div>
          </div>
          <div className="pg-actions">
            <span className="text-purple-700 bg-purple-50 px-3 py-1.5 rounded-full text-[12px] font-bold">Dean / Admin Access Only</span>
          </div>
        </div>

        <div className="bg-red-50 border border-red-100 rounded-md p-4 mb-5 flex gap-3 text-[13px] text-red-600 items-start shadow-sm">
          <div className="text-[16px] flex-shrink-0 mt-[-2px]">🔒</div>
          <div className="leading-relaxed">
            <span className="font-bold">Tier 2 Recheck</span> is reserved for severe anomalies — suspected grading bias, unjustified batch failures, or misconduct. The original evaluator is completely removed from the case. All actions create a permanent audit trail. This page is restricted to Dean and Admin roles.
          </div>
        </div>

        <div className="card mb-5">
          <div className="p-5 pb-4 border-b border-slate-100">
            <div className="text-[13.5px] font-bold text-slate-900">Flagged Cases</div>
          </div>
          
          
        <div className="card-hdr">
          <div className="card-title">
            <span className="ctitle-icon"><i className="lni lni-list"></i></span> Records
          </div>
          <TableSearch
            className="w-64"
            placeholder="Search records..."
            value={search}
            onChange={setSearch}
            results={[]}
          />
        </div>
        <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th>SUBJECT</th>
                  <th>FACULTY (HIDDEN FROM AUDITOR)</th>
                  <th>BATCH FAILURE RATE</th>
                  <th>FLAG REASON</th>
                  <FilterTh 
                    label="STATUS" 
                    opts={['Awaiting Auditor']} 
                    isOpen={openFilter === 'status1'} 
                    activeFilter={filters['status1'] || []} 
                    onToggle={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'status1' ? null : 'status1') }} 
                    onSelect={(vals) => handleFilterSelect('status1', vals)} 
                    onClear={() => handleFilterSelect('status1', [])} 
                    onClose={() => setOpenFilter(null)} 
                  />
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="text-slate-800">
                    <span className="font-semibold text-slate-700">CSE 1212</span><br/>
                    <span className="text-slate-500 text-[12px]">Data Structures</span>
                  </td>
                  <td><span className="bg-red-50 text-red-500 px-2.5 py-0.5 rounded-full text-[11px] font-bold">Identity Hidden</span></td>
                  <td><span className="text-red-500 font-bold">78% fail</span></td>
                  <td className="text-slate-800 text-[12.5px] max-w-[250px]">
                    All 20 students in batch failed without grade justification
                  </td>
                  <td><span className="bg-amber-50 text-amber-600 px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap">Awaiting Auditor</span></td>
                  <td>
                    <button className="btn btn-danger" onClick={openAssignModal}>
                      Assign Independent Auditor
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </ScrollTable>
          <div className="p-3 border-t border-slate-100">
            <Pagination page={page1} totalPages={1} totalCount={1} onPageChange={setPage1} />
          </div>
        </div>

        <div className="card">
          <div className="p-5 pb-4 border-b border-slate-100">
            <div className="text-[13.5px] font-bold text-slate-900">Recheck Audit Log</div>
          </div>
          
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th>CASE</th>
                  <th>ASSIGNED AUDITOR</th>
                  <th>DISPATCHED BY</th>
                  <th>DATE</th>
                  <FilterTh 
                    label="STATUS" 
                    opts={['Resolved', 'Open']} 
                    isOpen={openFilter === 'status2'} 
                    activeFilter={filters['status2'] || []} 
                    onToggle={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'status2' ? null : 'status2') }} 
                    onSelect={(vals) => handleFilterSelect('status2', vals)} 
                    onClear={() => handleFilterSelect('status2', [])} 
                    onClose={() => setOpenFilter(null)} 
                  />
                  <th>OUTCOME</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-medium text-slate-700">MGT 2101 · 2023</td>
                  <td className="text-slate-800 font-semibold">Dr. Fatuma Wanjiku</td>
                  <td className="text-slate-600">Dean Registrar</td>
                  <td className="text-slate-500">Mar 2024</td>
                  <td><span className="badge badge-green">Resolved</span></td>
                  <td className="text-slate-700">Marks revised upward for 12 students</td>
                </tr>
                <tr>
                  <td className="font-medium text-slate-700">CSE 1212 · 2024</td>
                  <td><span className="bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap">Pending Assignment</span></td>
                  <td className="text-slate-400">—</td>
                  <td className="text-slate-500">Now</td>
                  <td><span className="bg-amber-50 text-amber-600 px-2.5 py-0.5 rounded-full text-[11px] font-bold">Open</span></td>
                  <td className="text-slate-400">—</td>
                </tr>
              </tbody>
            </table>
          </ScrollTable>
          <div className="p-4 border-t border-slate-100">
            <Pagination page={page2} totalPages={1} totalCount={2} onPageChange={setPage2} />
          </div>
        </div>
      </div>

      {assignModalOpen && (
        <div className="modal-backdrop open" style={{ display: 'flex', position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,.4)', zIndex: 500, alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
          <div className="bg-white rounded-[14px] p-6 max-w-[560px] w-[90%] shadow-lg border border-slate-200">
            <div className="text-base font-bold text-slate-900 mb-1">Assign Independent Auditor — Tier 2 Recheck</div>
            <div className="text-[13px] text-slate-500 mb-5">Original faculty identity is hidden from the auditor. Select a neutral expert to review this submission.</div>

            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-[13px] flex items-start gap-2 mb-4">
              <span className="text-base shrink-0">🔒</span>
              <span>This action is logged and irreversible. The original evaluator is removed from this case.</span>
            </div>

            <div className="flex gap-2 mb-2 items-baseline">
              <span className="text-[12px] text-slate-500 min-w-[120px]">Contested Subject:</span>
              <span className="text-[13px] font-medium text-slate-900">CSE 1212 — Data Structures</span>
            </div>
            <div className="flex gap-2 mb-2 items-baseline">
              <span className="text-[12px] text-slate-500 min-w-[120px]">Batch Failure Rate:</span>
              <span className="badge badge-red text-red-600">78% — Anomaly Flagged</span>
            </div>

            <div className="h-px bg-slate-200 my-4"></div>

            <div className="flex flex-col gap-1 mb-4">
              <label className="text-[12px] font-semibold text-slate-700">Select Independent Auditor</label>
              <SearchSelect
                options={[
                  '— Select Auditor —',
                  'Dr. Sarah Mugisha (CS Dept Head)',
                  'Prof. James Ochieng (Senior Faculty)',
                  'Dr. Fatuma Wanjiku (Dean of Studies)'
                ]}
                className="w-full"
              />
            </div>

            <div className="flex flex-col gap-1 mb-4">
              <label className="text-[12px] font-semibold text-slate-700">Justification Note (Mandatory)</label>
              <textarea className="form-control px-3 py-2 border-[1.5px] border-slate-200 rounded-md text-[13px] text-slate-900 bg-white focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 transition-colors" rows={3} placeholder="Describe the anomaly and reason for escalating to Tier 2 recheck..."></textarea>
            </div>

            <div className="flex gap-2 justify-end mt-5 pt-4 border-t border-slate-200">
              <button className="btn btn-neu" onClick={closeAssignModal}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { closeAssignModal(); showToast('Recheck dispatched to auditor') }}>Confirm &amp; Dispatch Recheck</button>
            </div>
          </div>
        </div>
      )}
      <Toast toast={toast} />
    </>
  )
}
