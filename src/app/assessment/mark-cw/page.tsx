'use client'
import { ScrollTable } from '@/components/ScrollTable'
import { TableSearch } from '@/components/TableSearch'
import { SearchSelect } from '@/components/SearchSelect'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { FilterTh } from '@/components/FilterTh'
import { Toast } from '@/components/Toast'
import { ActionMenu } from '@/components/ActionMenu'
import { useState, useEffect } from 'react'

export default function MarkEntryCwPage() {
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [toast, setToast] = useState<{ msg: string, type: string } | null>(null)

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
          <div className="pg-title">Mark Entry — Coursework</div>
          <div className="pg-sub">Enter raw marks out of 25 · Prorated automatically to course weightage</div>
        </div>
        <div className="pg-actions flex items-center gap-3">
          <SearchSelect
            options={[
              'CSE 1301 - Algorithms (Standard/15m)'
            ]}
            className="w-full"
          />
          <button className="btn btn-primary whitespace-nowrap" onClick={() => showToast('Marks saved successfully')}>
            Save All Marks
          </button>
        </div>
      </div>

      <div className="card mb-5">
        <div className="p-5 pb-0">
          <div className="bg-[#f5f3ff] border border-[#ede9fe] rounded-md p-3 flex gap-3 text-[13px] text-[#6d28d9] items-center font-medium mb-4">
            Standard Model · CW Weightage: 15 marks · Proration: (raw/25)×15
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
                <th style={{ width: 50 }}></th>
                <th>REG. NO.</th>
                <th>STUDENT NAME</th>
                <FilterTh
                  label="SUBMISSION"
                  opts={['Submitted', 'Blocked']}
                  isOpen={openFilter === 'submission'}
                  activeFilter={filters['submission'] || []}
                  onToggle={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'submission' ? null : 'submission') }}
                  onSelect={(vals) => handleFilterSelect('submission', vals)}
                  onClear={() => handleFilterSelect('submission', [])}
                  onClose={() => setOpenFilter(null)}
                />
                <th>SPONSORED</th>
                <th>FEE %</th>
                <th>RAW (/25)</th>
                <th>PRORATED (/15)</th>
                <th>SUBMITTED BY</th>
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
                        <button className="btn btn-neu btn-sm">
                          <i className="lni lni-timer"></i> View Audit Log
                        </button>
                        <button className="btn btn-neu btn-sm" style={{ color: 'var(--red)' }}>
                          <i className="lni lni-reload"></i> Reset Score
                        </button>
                      </ActionMenu>
                    </td>
                    <td className="font-mono text-slate-500 text-[12.5px]">BCS/2024/0031</td>
                    <td className="text-slate-800">Amara Nkosi</td>
                    <td><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-md text-[11px] font-semibold">Submitted</span></td>
                    <td className="text-slate-600">No</td>
                    <td className="text-slate-800 font-medium">100%</td>
                    <td>
                      <input type="text" className="w-[60px] px-2 py-1 border border-slate-200 rounded text-center text-[13px] focus:outline-none focus:border-purple-500" defaultValue="21" />
                    </td>
                    <td className="text-purple-700 font-bold">12.6</td>
                    <td className="text-slate-500">Sarah Mugisha</td>
                  </tr>
                  <tr>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm">
                          <i className="lni lni-timer"></i> View Audit Log
                        </button>
                        <button className="btn btn-neu btn-sm" style={{ color: 'var(--red)' }}>
                          <i className="lni lni-reload"></i> Reset Score
                        </button>
                      </ActionMenu>
                    </td>
                    <td className="font-mono text-slate-500 text-[12.5px]">BCS/2024/0017</td>
                    <td className="text-slate-800">Emmanuel Okello</td>
                    <td><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-md text-[11px] font-semibold">Submitted</span></td>
                    <td className="text-slate-600">No</td>
                    <td className="text-slate-800 font-medium">100%</td>
                    <td>
                      <input type="text" className="w-[60px] px-2 py-1 border border-slate-200 rounded text-center text-[13px] focus:outline-none focus:border-purple-500" defaultValue="18" />
                    </td>
                    <td className="text-purple-700 font-bold">10.8</td>
                    <td className="text-slate-500">Sarah Mugisha</td>
                  </tr>
                  <tr>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm">
                          <i className="lni lni-timer"></i> View Audit Log
                        </button>
                        <button className="btn btn-neu btn-sm" style={{ color: 'var(--red)' }}>
                          <i className="lni lni-reload"></i> Reset Score
                        </button>
                      </ActionMenu>
                    </td>
                    <td className="font-mono text-slate-500 text-[12.5px]">BCS/2024/0044</td>
                    <td className="text-slate-800">Grace Akello</td>
                    <td><span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-md text-[11px] font-semibold">Blocked</span></td>
                    <td className="text-slate-600">No</td>
                    <td className="text-red-500 font-medium">30%</td>
                    <td>
                      <input type="text" className="w-[60px] px-2 py-1 border border-slate-200 bg-slate-50 rounded text-center text-[13px] text-slate-400 cursor-not-allowed" defaultValue="—" disabled />
                    </td>
                    <td className="text-purple-700 font-bold">—</td>
                    <td className="text-slate-500">—</td>
                  </tr>
                  <tr>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm">
                          <i className="lni lni-timer"></i> View Audit Log
                        </button>
                        <button className="btn btn-neu btn-sm" style={{ color: 'var(--red)' }}>
                          <i className="lni lni-reload"></i> Reset Score
                        </button>
                      </ActionMenu>
                    </td>
                    <td className="font-mono text-slate-500 text-[12.5px]">BCS/2024/0099</td>
                    <td className="text-slate-800">Peter Ssali</td>
                    <td><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-md text-[11px] font-semibold">Submitted</span></td>
                    <td><span className="bg-cyan-50 text-cyan-600 px-2 py-0.5 rounded-md text-[11px] font-semibold">Yes</span></td>
                    <td className="text-slate-500 font-medium">Exempt</td>
                    <td>
                      <input type="text" className="w-[60px] px-2 py-1 border border-slate-200 rounded text-center text-[13px] focus:outline-none focus:border-purple-500" defaultValue="23" />
                    </td>
                    <td className="text-purple-700 font-bold">13.8</td>
                    <td className="text-slate-500">Sarah Mugisha</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </ScrollTable>
        <div className="p-4 border-t border-slate-100">
          <Pagination page={page} totalPages={6} totalCount={62} onPageChange={setPage} />
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
