'use client'

import { ScrollTable } from '@/components/ScrollTable'
import { TableSearch } from '@/components/TableSearch'
import { ActionMenu } from '@/components/ActionMenu'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { FilterTh } from '@/components/FilterTh'
import { Toast } from '@/components/Toast'
import { useState, useEffect } from 'react'

export default function CbtMonitorPage() {
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
      <div className="pg-hdr flex justify-between items-start">
        <div>
          <div className="pg-title">CBT Monitor</div>
          <div className="pg-sub">Live view — CSE 1301 Algorithms · Time Remaining: <strong className="text-red-500 font-bold">00:23:45</strong></div>
        </div>
        <div className="pg-actions">
          <div className="text-blue-500 font-semibold text-[13px] bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 shadow-sm">
            38 Active · 24 Submitted · 0 Timed Out
          </div>
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
                <th>Reg. No.</th>
                <th>Student</th>
                <FilterTh 
                  label="Status" 
                  opts={['Active', 'Submitted', 'Blocked']} 
                  isOpen={openFilter === 'status'} 
                  activeFilter={filters['status'] || []} 
                  onToggle={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'status' ? null : 'status') }} 
                  onSelect={(vals) => handleFilterSelect('status', vals)} 
                  onClear={() => handleFilterSelect('status', [])} 
                  onClose={() => setOpenFilter(null)} 
                />
                <th className="text-center">Answered</th>
                <th>Saved At</th>
                <th>Balance Time</th>
                <th>Score (Auto)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoadingState colSpan={8} />
              ) : (
                <>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm" onClick={() => showToast('Loading details...')}><i className="lni lni-eye"></i> View Details</button>
                  </ActionMenu>
                </td>
                <td><span className="font-bold text-[var(--blue)] font-mono">BCS/2024/0031</span></td>
                <td className="text-slate-800">Amara Nkosi</td>
                <td className="text-center"><span className="bg-blue-50 text-blue-600 border border-blue-200 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">Active</span></td>
                <td className="text-center font-mono text-[12px] text-slate-700">22 / 25</td>
                <td className="text-slate-500 font-mono text-[12px]">14:38:02</td>
                <td className="text-amber-600 font-bold font-mono text-[12px]">00:23:45</td>
                <td className="text-slate-400 font-bold">—</td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View Details</button>
                  </ActionMenu>
                </td>
                <td><span className="font-bold text-[var(--blue)] font-mono">BCS/2024/0017</span></td>
                <td className="text-slate-800">Emmanuel Okello</td>
                <td className="text-center"><span className="badge badge-green">Submitted</span></td>
                <td className="text-center font-mono text-[12px] text-slate-700">25 / 25</td>
                <td className="text-slate-500 font-mono text-[12px]">14:20:11</td>
                <td className="text-slate-400 font-mono text-[12px]">—</td>
                <td className="text-slate-900 font-bold">38 / 50</td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View Details</button>
                  </ActionMenu>
                </td>
                <td><span className="font-bold text-[var(--blue)] font-mono">BCS/2024/0044</span></td>
                <td className="text-slate-800">Grace Akello</td>
                <td className="text-center"><span className="badge badge-red">Blocked</span></td>
                <td className="text-center text-slate-400 font-mono text-[12px]">—</td>
                <td className="text-slate-400 font-mono text-[12px]">—</td>
                <td className="text-slate-400 font-mono text-[12px]">—</td>
                <td className="text-slate-400 font-bold">—</td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View Details</button>
                  </ActionMenu>
                </td>
                <td><span className="font-bold text-[var(--blue)] font-mono">BCS/2024/0058</span></td>
                <td className="text-slate-800">David Ssemwogerere</td>
                <td className="text-center"><span className="badge badge-green">Submitted</span></td>
                <td className="text-center font-mono text-[12px] text-slate-700">25 / 25</td>
                <td className="text-slate-500 font-mono text-[12px]">14:15:33</td>
                <td className="text-slate-400 font-mono text-[12px]">—</td>
                <td className="text-slate-900 font-bold">46 / 50</td>
              </tr>
                </>
              )}
            </tbody>
          </table>
        </ScrollTable>
        <div className="p-4 border-t border-slate-100">
          <Pagination page={page} totalPages={7} totalCount={62} onPageChange={setPage} />
        </div>

        <div className="bg-[#fffbeb] border border-[#fde68a] rounded-md p-3 flex gap-3 text-[12.5px] text-[#b45309] items-center m-5 mt-2">
          <div className="mt-0 text-[#d97706]"><i className="lni lni-warning"></i></div>
          <div><strong className="font-semibold">Grace Akello (BCS/2024/0044) is blocked</strong> — fee clearance incomplete. Cannot launch CBT.</div>
        </div>

      </div>
      <Toast toast={toast} />
    </div>
  )
}
