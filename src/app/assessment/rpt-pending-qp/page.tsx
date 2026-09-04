'use client'
import { ScrollTable } from '@/components/ScrollTable'
import { TableSearch } from '@/components/TableSearch'
import { ActionMenu } from '@/components/ActionMenu'
import { SearchSelect } from '@/components/SearchSelect'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { FilterTh } from '@/components/FilterTh'
import { Toast } from '@/components/Toast'
import { useState, useEffect } from 'react'

export default function PendingQPUploadReport() {
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
          <div className="pg-title">Pending QP Upload Report</div>
          <div className="pg-sub">Track which faculty have not uploaded question papers · Send bulk reminders</div>
        </div>
        <div className="pg-actions flex items-center gap-3">
          <button className="btn btn-primary" onClick={() => showToast('Bulk reminders sent')}>
            Send Bulk Reminder
          </button>
          <button className="btn btn-primary" onClick={() => showToast('Exporting report...')}>
            <i className="lni lni-download"></i> Export
          </button>
        </div>
      </div>

      <div className="card">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 bg-slate-50/50 rounded-t-[14px]">
          <div className="flex-1">
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Session</label>
            <SearchSelect
              options={['2024/25 Semester 1', '2023/24 Semester 2']}
              className="w-full"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Term</label>
            <SearchSelect
              options={['Term 1', 'Term 2']}
              className="w-full"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Exam Type</label>
            <SearchSelect
              options={['All', 'CW', 'CBT', 'UE']}
              className="w-full"
            />
          </div>
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
                <th>FACULTY</th>
                <th>SUBJECT</th>
                <th>TYPE</th>
                <th>PROGRAMME</th>
                <th>DEADLINE</th>
                <th>DAYS OVERDUE</th>
                <FilterTh 
                  label="STATUS" 
                  opts={['Overdue', 'Due Soon', 'Pending']} 
                  isOpen={openFilter === 'status'} 
                  activeFilter={filters['status'] || []} 
                  onToggle={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'status' ? null : 'status') }} 
                  onSelect={(vals) => handleFilterSelect('status', vals)} 
                  onClear={() => handleFilterSelect('status', [])} 
                  onClose={() => setOpenFilter(null)} 
                />
                <th>ACTION</th>
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
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View Profile</button>
                  </ActionMenu>
                </td>
                <td className="text-slate-800">Tom Kizito</td>
                <td className="font-mono text-[12.5px] text-slate-500">CSE 1212</td>
                <td><span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[11px] font-bold">CW</span></td>
                <td className="text-slate-600">BCS Sem 1</td>
                <td className="text-red-500 font-medium">05 Nov</td>
                <td><span className="bg-red-50 text-red-600 px-2.5 py-0.5 rounded-full text-[11px] font-bold">6 days</span></td>
                <td><span className="bg-red-50 text-red-600 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-red-200">Overdue</span></td>
                <td>
                  <button className="bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold text-[11.5px] px-3 py-1 rounded-full transition-colors" onClick={() => showToast('Reminder sent to faculty')}>
                    Remind
                  </button>
                </td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View Profile</button>
                  </ActionMenu>
                </td>
                <td className="text-slate-800">Joseph Ayuma</td>
                <td className="font-mono text-[12.5px] text-slate-500">BIO 2201</td>
                <td><span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[11px] font-bold">CW</span></td>
                <td className="text-slate-600">BMLT Sem 2</td>
                <td className="text-red-500 font-medium">06 Nov</td>
                <td><span className="bg-red-50 text-red-600 px-2.5 py-0.5 rounded-full text-[11px] font-bold">5 days</span></td>
                <td><span className="bg-red-50 text-red-600 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-red-200">Overdue</span></td>
                <td>
                  <button className="bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold text-[11.5px] px-3 py-1 rounded-full transition-colors">
                    Remind
                  </button>
                </td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View Profile</button>
                  </ActionMenu>
                </td>
                <td className="text-slate-800">Mary Nakato</td>
                <td className="font-mono text-[12.5px] text-slate-500">ACC 3101</td>
                <td><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[11px] font-bold">CBT</span></td>
                <td className="text-slate-600">BBA Sem 3</td>
                <td className="text-amber-600 font-medium">10 Nov</td>
                <td><span className="bg-amber-50 text-amber-600 px-2.5 py-0.5 rounded-full text-[11px] font-bold">1 day</span></td>
                <td><span className="bg-amber-50 text-amber-600 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-amber-200">Due Soon</span></td>
                <td>
                  <button className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-[11.5px] px-3 py-1 rounded-full transition-colors shadow-sm" onClick={() => showToast('Reminder sent to faculty')}>
                    Remind
                  </button>
                </td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View Profile</button>
                  </ActionMenu>
                </td>
                <td className="text-slate-800">Tom Kizito</td>
                <td className="font-mono text-[12.5px] text-slate-500">CSE 1212</td>
                <td><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[11px] font-bold">UE</span></td>
                <td className="text-slate-600">BCS Sem 1</td>
                <td className="text-slate-600 font-medium">20 Nov</td>
                <td className="text-slate-400">—</td>
                <td><span className="bg-amber-50 text-amber-600 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-amber-200">Pending</span></td>
                <td>
                  <button className="text-slate-500 hover:text-slate-800 font-medium text-[11.5px] px-2 py-1 rounded-md transition-colors" onClick={() => showToast('Reminder sent to faculty')}>
                    Remind
                  </button>
                </td>
              </tr>
                </>
              )}
            </tbody>
          </table>
        </ScrollTable>
        <div className="p-4 border-t border-slate-100">
          <Pagination page={page} totalPages={3} totalCount={22} onPageChange={setPage} />
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
