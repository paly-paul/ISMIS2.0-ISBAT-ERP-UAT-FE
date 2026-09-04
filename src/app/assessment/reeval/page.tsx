'use client'
import { ScrollTable } from '@/components/ScrollTable'
import { TableSearch } from '@/components/TableSearch'
import { ActionMenu } from '@/components/ActionMenu'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { FilterTh } from '@/components/FilterTh'
import { Toast } from '@/components/Toast'
import { useState, useEffect } from 'react'

export default function ReevaluationPage() {
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
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

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="page active">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">CW Reevaluation Console — Tier 1</div>
          <div className="pg-sub">Routes submission back to original faculty for review · Pending badge added to their dashboard</div>
        </div>
      </div>

      <div className="bg-[#eff6ff] border border-[#dbeafe] rounded-md p-4 mb-5 flex gap-3 text-[13px] text-[#2563eb] items-start shadow-sm">
        <div className="bg-[#2563eb] text-white w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5"><i className="lni lni-information"></i></div>
        <div className="leading-relaxed">
          <span className="font-semibold">Tier 1 Reevaluation:</span> Used when a student contests their marks (occurs in ~1-2% of cases). The original evaluating faculty member is notified and the work is returned to their dashboard as a pending item. Historical files are locked — student cannot resubmit.
        </div>
      </div>

      <div className="card">
        <div className="p-5 pb-4 border-b border-slate-100 flex items-center gap-3">
          <div className="text-[13.5px] font-bold text-slate-900">Active Reevaluation Requests</div>
          <span className="bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-amber-200">4 pending</span>
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
                <th style={{ width: 48 }}></th>
                <th>STUDENT</th>
                <th>SUBJECT</th>
                <th>ORIGINAL MARK</th>
                <th>ORIGINAL FACULTY</th>
                <th>REQUESTED ON</th>
                <th>TAT</th>
                <FilterTh 
                  label="STATUS" 
                  opts={['Pending Faculty', 'Overdue']} 
                  isOpen={openFilter === 'status'} 
                  activeFilter={filters['status'] || []} 
                  onToggle={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'status' ? null : 'status') }} 
                  onSelect={(vals) => handleFilterSelect('status', vals)} 
                  onClear={() => handleFilterSelect('status', [])} 
                  onClose={() => setOpenFilter(null)} 
                />
                <th className="text-right">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoadingState colSpan={9} />
              ) : (
                <>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View Log</button>
                  </ActionMenu>
                </td>
                <td className="text-slate-800">
                  Kevin<br/>Mugumya
                </td>
                <td className="font-medium text-slate-700">MGT 2101</td>
                <td className="text-slate-600 text-[12.5px]">12 / 25 → 7.2 /<br/>15</td>
                <td className="text-slate-600">James<br/>Ochieng</td>
                <td className="text-slate-600">05 Nov</td>
                <td>
                  <div className="flex flex-col gap-1 w-[80px]">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: '60%' }}></div>
                    </div>
                    <div className="text-[11px] font-medium text-amber-600">Day 3 / 5</div>
                  </div>
                </td>
                <td><span className="badge badge-amber">Pending Faculty</span></td>
                <td className="text-right">
                  <button className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium text-[12px] px-3 py-1.5 rounded-md transition-colors shadow-sm whitespace-nowrap" onClick={() => showToast('Reminder sent to faculty')}>
                    Remind Faculty
                  </button>
                </td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View Log</button>
                  </ActionMenu>
                </td>
                <td className="text-slate-800">
                  Miriam Ouma
                </td>
                <td className="font-medium text-slate-700">CSE 1301</td>
                <td className="text-slate-600 text-[12.5px]">14 / 25 → 8.4 /<br/>15</td>
                <td className="text-slate-600">Sarah Mugisha</td>
                <td className="text-slate-600">06 Nov</td>
                <td>
                  <div className="flex flex-col gap-1 w-[80px]">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: '40%' }}></div>
                    </div>
                    <div className="text-[11px] font-medium text-green-600">Day 2 / 5</div>
                  </div>
                </td>
                <td><span className="badge badge-amber">Pending Faculty</span></td>
                <td className="text-right">
                  <button className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium text-[12px] px-3 py-1.5 rounded-md transition-colors shadow-sm whitespace-nowrap">
                    Remind Faculty
                  </button>
                </td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View Log</button>
                  </ActionMenu>
                </td>
                <td className="text-slate-800">
                  Joy Akello
                </td>
                <td className="font-medium text-slate-700">MGT 2101</td>
                <td className="text-slate-600 text-[12.5px]">10 / 25 → 6 / 15</td>
                <td className="text-slate-600">James<br/>Ochieng</td>
                <td className="text-slate-600">04 Nov</td>
                <td>
                  <div className="flex flex-col gap-1 w-[80px]">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                    <div className="text-[11px] font-bold text-red-500">Overdue</div>
                  </div>
                </td>
                <td><span className="badge badge-red">Overdue</span></td>
                <td className="text-right">
                  <button className="btn btn-danger" onClick={() => showToast('Escalated to Dean')}>
                    Escalate to Dean
                  </button>
                </td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View Log</button>
                  </ActionMenu>
                </td>
                <td className="text-slate-800">
                  Sam Lutwama
                </td>
                <td className="font-medium text-slate-700">ENG 1101</td>
                <td className="text-slate-600 text-[12.5px]">16 / 25 → 12.8 /<br/>20</td>
                <td className="text-slate-600">Fatuma<br/>Wanjiku</td>
                <td className="text-slate-600">07 Nov</td>
                <td>
                  <div className="flex flex-col gap-1 w-[80px]">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: '20%' }}></div>
                    </div>
                    <div className="text-[11px] font-medium text-green-600">Day 1 / 5</div>
                  </div>
                </td>
                <td><span className="badge badge-amber">Pending Faculty</span></td>
                <td className="text-right">
                  <button className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium text-[12px] px-3 py-1.5 rounded-md transition-colors shadow-sm whitespace-nowrap">
                    Remind Faculty
                  </button>
                </td>
              </tr>
                </>
              )}
            </tbody>
          </table>
        </ScrollTable>
        <div className="p-4 border-t border-slate-100">
          <Pagination page={page} totalPages={1} totalCount={4} onPageChange={setPage} />
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
