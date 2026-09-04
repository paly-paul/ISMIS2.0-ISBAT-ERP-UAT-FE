'use client'
import { ScrollTable } from '@/components/ScrollTable'
import { TableSearch } from '@/components/TableSearch'
import { ActionMenu } from '@/components/ActionMenu'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { FilterTh } from '@/components/FilterTh'
import { Toast } from '@/components/Toast'
import { useState, useEffect } from 'react'

export default function CbtOverviewPage() {
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
          <div className="pg-title">CBT Overview</div>
          <div className="pg-sub">Class Test status across all subjects · 60 min · Server-side timing</div>
        </div>
      </div>

      <div className="card">
        
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
                <th>Subject</th>
                <th>Programme</th>
                <th>Sec A (1m)</th>
                <th>Sec B (2m)</th>
                <th>Sec C (3m)</th>
                <th>Total</th>
                <th>Scheduled</th>
                <th>Submitted</th>
                <FilterTh 
                  label="Status" 
                  opts={['Complete', 'In Progress', 'Not Scheduled']} 
                  isOpen={openFilter === 'status'} 
                  activeFilter={filters['status'] || []} 
                  onToggle={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'status' ? null : 'status') }} 
                  onSelect={(vals) => handleFilterSelect('status', vals)} 
                  onClear={() => handleFilterSelect('status', [])} 
                  onClose={() => setOpenFilter(null)} 
                />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoadingState colSpan={10} />
              ) : (
                <>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View Details</button>
                  </ActionMenu>
                </td>
                <td>
                  <span className="font-bold text-[var(--blue)] font-mono">CSE 1212</span><br/>
                  <span className="text-slate-500 text-[12px]">Data Structures</span>
                </td>
                <td className="text-slate-700">BCS Sem 1</td>
                <td className="text-slate-700">10 Q</td>
                <td className="text-slate-700">10 Q</td>
                <td className="text-slate-700">5 Q</td>
                <td className="font-semibold text-slate-800">50m</td>
                <td className="text-slate-500">10 Nov</td>
                <td className="text-slate-700 font-mono text-[12px]">62 / 62</td>
                <td><span className="badge badge-green">Complete</span></td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View Details</button>
                  </ActionMenu>
                </td>
                <td>
                  <span className="font-bold text-[var(--blue)] font-mono">CSE 1301</span><br/>
                  <span className="text-slate-500 text-[12px]">Algorithms</span>
                </td>
                <td className="text-slate-700">BCS Sem 1</td>
                <td className="text-slate-700">10 Q</td>
                <td className="text-slate-700">8 Q</td>
                <td className="text-slate-700">4 Q</td>
                <td className="font-semibold text-slate-800">50m</td>
                <td className="text-blue-500 font-medium text-[12px]">Active Now</td>
                <td className="text-slate-700 font-mono text-[12px]">38 / 62</td>
                <td><span className="bg-blue-50 text-blue-600 border border-blue-200 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">In Progress</span></td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm" onClick={() => showToast('Schedule opened')}><i className="lni lni-cog"></i> Schedule</button>
                  </ActionMenu>
                </td>
                <td>
                  <span className="font-bold text-[var(--blue)] font-mono">MGT 2101</span><br/>
                  <span className="text-slate-500 text-[12px]">Business Mgmt</span>
                </td>
                <td className="text-slate-700">BBA Sem 3</td>
                <td className="text-slate-400">—</td>
                <td className="text-slate-400">—</td>
                <td className="text-slate-400">—</td>
                <td className="text-slate-400">—</td>
                <td className="text-slate-400">Not Set</td>
                <td className="text-slate-400">—</td>
                <td><span className="bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">Not Scheduled</span></td>
              </tr>
                </>
              )}
            </tbody>
          </table>
        </ScrollTable>
        <div className="p-4 border-t border-slate-100">
          <Pagination page={page} totalPages={3} totalCount={24} onPageChange={setPage} />
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
