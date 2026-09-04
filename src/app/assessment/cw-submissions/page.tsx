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

export default function CwSubmissionsPage() {
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
          <div className="pg-title">CW Submissions</div>
          <div className="pg-sub">View submissions per subject · Enter marks (out of 25) · Prorated automatically</div>
        </div>
        <div className="pg-actions">
          <SearchSelect
                options={[
                  'CSE 1301 – Algorithms',
                  'MGT 2101 – Business Mgmt'
                ]}
                className="w-full"
              />
        </div>
      </div>

      <div className="card">
        {/* Info Banner */}
        <div className="bg-[#eff6ff] border border-[#dbeafe] rounded-lg p-3.5 flex gap-3 text-[12.5px] items-center mb-5 mx-5 mt-5">
          <div className="font-semibold text-[#3b82f6]">Standard Model — CW Weight: 15 marks</div>
          <div className="text-[#64748b]">Raw entered out of 25 → prorated to 15 marks · Formula: (mark/25)×15</div>
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
                <th>Reg. No.</th>
                <th>Student Name</th>
                <th>Submitted</th>
                <FilterTh 
                  label="Fee Status" 
                  opts={['Cleared', 'Blocked']} 
                  isOpen={openFilter === 'fee'} 
                  activeFilter={filters['fee'] || []} 
                  onToggle={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'fee' ? null : 'fee') }} 
                  onSelect={(vals) => handleFilterSelect('fee', vals)} 
                  onClear={() => handleFilterSelect('fee', [])} 
                  onClose={() => setOpenFilter(null)} 
                />
                <th className="text-center">Raw Mark (/25)</th>
                <th className="text-center">Prorated (/15)</th>
                <th>Evaluated By</th>
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
                    <button className="btn btn-neu btn-sm" onClick={() => showToast('Mark saved successfully')}><i className="lni lni-save"></i> Save</button>
                  </ActionMenu>
                </td>
                <td><span className="font-bold text-[var(--blue)] font-mono">BCS/2024/0031</span></td>
                <td className="text-slate-800">Amara Nkosi</td>
                <td className="text-slate-500">12 Nov</td>
                <td><span className="badge badge-green">Cleared</span></td>
                <td className="text-center">
                  <input type="number" defaultValue="21" className="ctrl text-center w-[60px] font-semibold" />
                </td>
                <td className="text-center font-bold text-purple-700">12.6</td>
                <td className="text-slate-500 leading-snug">Sarah<br/>Mugisha</td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm" onClick={() => showToast('Mark saved successfully')}><i className="lni lni-save"></i> Save</button>
                  </ActionMenu>
                </td>
                <td><span className="font-bold text-[var(--blue)] font-mono">BCS/2024/0017</span></td>
                <td className="text-slate-800">Emmanuel Okello</td>
                <td className="text-slate-500">13 Nov</td>
                <td><span className="badge badge-green">Cleared</span></td>
                <td className="text-center">
                  <input type="number" defaultValue="18" className="ctrl text-center w-[60px] font-semibold" />
                </td>
                <td className="text-center font-bold text-purple-700">10.8</td>
                <td className="text-slate-500 leading-snug">Sarah<br/>Mugisha</td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm" disabled><i className="lni lni-save"></i> Save</button>
                  </ActionMenu>
                </td>
                <td><span className="font-bold text-[var(--blue)] font-mono">BCS/2024/0044</span></td>
                <td className="text-slate-800">Grace Akello</td>
                <td className="text-slate-500">14 Nov</td>
                <td><span className="badge badge-red">Blocked</span></td>
                <td className="text-center">
                  <input type="text" placeholder="—" disabled className="ctrl text-center w-[60px] font-semibold" />
                </td>
                <td className="text-center text-slate-400">—</td>
                <td><span className="badge badge-red">Fee Incomplete</span></td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-save"></i> Save</button>
                  </ActionMenu>
                </td>
                <td><span className="font-bold text-[var(--blue)] font-mono">BCS/2024/0058</span></td>
                <td className="text-slate-800">
                  <div className="leading-snug">David<br/>Ssemwogerere</div>
                </td>
                <td className="text-slate-500">11 Nov</td>
                <td><span className="badge badge-green">Cleared</span></td>
                <td className="text-center">
                  <input type="number" defaultValue="25" className="ctrl text-center w-[60px] font-semibold" />
                </td>
                <td className="text-center font-bold text-purple-700">15.0</td>
                <td className="text-slate-500 leading-snug">Sarah<br/>Mugisha</td>
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
