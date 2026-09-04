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

export default function MarkEntryUePage() {
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
          <div className="pg-title">Mark Entry — University Examination</div>
          <div className="pg-sub">Enter UE marks · Matching Code for anonymous marking · IA + UE pass gate enforced</div>
        </div>
        <div className="pg-actions flex items-center gap-3">
          <SearchSelect
                options={[
                  'CSE 1301 - Algorithms (Standard/70m)'
                ]}
                className="w-full"
              />
          <button className="btn btn-primary whitespace-nowrap" onClick={() => showToast('All UE marks saved successfully')}>
            Save All
          </button>
        </div>
      </div>

      <div className="card mb-5">
        <div className="p-5 pb-0">
          <div className="bg-[#eff6ff] border border-[#dbeafe] rounded-md p-4 flex gap-3 text-[13px] text-[#2563eb] items-start mb-4">
            <div className="mt-0.5"><i className="lni lni-information text-[16px]"></i></div>
            <div className="leading-relaxed text-[#1e40af]">
              <strong>Matching Code:</strong> Each student has a 4-digit code (on hall ticket) + 4-digit script code for anonymous marking. Match codes before entering marks. <strong>Pass gate: min 50% in IA AND min 50% in UE separately.</strong>
            </div>
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
                <th>MATCHING<br/>CODE</th>
                <th>REG. NO.</th>
                <th>STUDENT</th>
                <th>IA TOTAL<br/>(/30)</th>
                <th>IA PASS</th>
                <th>UE RAW<br/>(/100)</th>
                <th>UE<br/>(/70)</th>
                <th>UE PASS</th>
                <FilterTh 
                  label="RESULT" 
                  opts={['PASS', 'FAIL (UE)']} 
                  isOpen={openFilter === 'result'} 
                  activeFilter={filters['result'] || []} 
                  onToggle={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'result' ? null : 'result') }} 
                  onSelect={(vals) => handleFilterSelect('result', vals)} 
                  onClear={() => handleFilterSelect('result', [])} 
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
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View</button>
                  </ActionMenu>
                </td>
                <td className="font-mono text-slate-600 text-[13px]">4821-7734</td>
                <td className="font-mono text-slate-500 text-[12.5px]">BCS/2024/0031</td>
                <td className="text-slate-800">Amara Nkosi</td>
                <td className="font-medium text-slate-800 text-[13px]">23.4</td>
                <td>
                  <div className="flex flex-col items-center justify-center bg-green-50 text-green-700 w-12 h-12 rounded-full border border-green-200">
                    <span className="font-bold text-[10px]">✓</span>
                    <span className="text-[10px] font-semibold">(78%)</span>
                  </div>
                </td>
                <td>
                  <input type="text" className="w-[60px] px-2 py-1 border border-slate-200 rounded text-center text-[13px] focus:outline-none focus:border-purple-500" defaultValue="72" />
                </td>
                <td className="text-purple-700 font-bold">50.4</td>
                <td>
                  <div className="flex flex-col items-center justify-center bg-green-50 text-green-700 w-12 h-12 rounded-full border border-green-200">
                    <span className="font-bold text-[10px]">✓</span>
                    <span className="text-[10px] font-semibold">(72%)</span>
                  </div>
                </td>
                <td><span className="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-[11px] font-bold">PASS</span></td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View</button>
                  </ActionMenu>
                </td>
                <td className="font-mono text-slate-600 text-[13px]">4822-9901</td>
                <td className="font-mono text-slate-500 text-[12.5px]">BCS/2024/0017</td>
                <td className="text-slate-800">Emmanuel Okello</td>
                <td className="font-medium text-slate-800 text-[13px]">21.6</td>
                <td>
                  <div className="flex flex-col items-center justify-center bg-green-50 text-green-700 w-12 h-12 rounded-full border border-green-200">
                    <span className="font-bold text-[10px]">✓</span>
                    <span className="text-[10px] font-semibold">(72%)</span>
                  </div>
                </td>
                <td>
                  <input type="text" className="w-[60px] px-2 py-1 border border-slate-200 rounded text-center text-[13px] focus:outline-none focus:border-purple-500" defaultValue="58" />
                </td>
                <td className="text-purple-700 font-bold">40.6</td>
                <td>
                  <div className="flex flex-col items-center justify-center bg-amber-50 text-amber-600 w-12 h-12 rounded-full border border-amber-200">
                    <span className="font-bold text-[10px]">✓</span>
                    <span className="text-[10px] font-semibold">(58%)</span>
                  </div>
                </td>
                <td><span className="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-[11px] font-bold">PASS</span></td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View</button>
                  </ActionMenu>
                </td>
                <td className="font-mono text-slate-600 text-[13px]">4823 3312</td>
                <td className="font-mono text-slate-500 text-[12.5px]">BCS/2024/0058</td>
                <td className="text-slate-800">David<br/>Ssemwogerere</td>
                <td className="font-medium text-slate-800 text-[13px]">28.8</td>
                <td>
                  <div className="flex flex-col items-center justify-center bg-green-50 text-green-700 w-12 h-12 rounded-full border border-green-200">
                    <span className="font-bold text-[10px]">✓</span>
                    <span className="text-[10px] font-semibold">(96%)</span>
                  </div>
                </td>
                <td>
                  <input type="text" className="w-[60px] px-2 py-1 border border-slate-200 rounded text-center text-[13px] focus:outline-none focus:border-purple-500" defaultValue="42" />
                </td>
                <td className="text-purple-700 font-bold">29.4</td>
                <td>
                  <div className="flex flex-col items-center justify-center bg-red-50 text-red-600 w-12 h-12 rounded-full border border-red-200">
                    <span className="font-bold text-[10px]">X</span>
                    <span className="text-[10px] font-semibold">(42%)</span>
                  </div>
                </td>
                <td><span className="badge badge-red">FAIL<br/>(UE)</span></td>
              </tr>
                </>
              )}
            </tbody>
          </table>
        </ScrollTable>
        
        <div className="p-4 border-t border-slate-100">
          <Pagination page={page} totalPages={6} totalCount={62} onPageChange={setPage} />
        </div>
        
        <div className="p-5 pt-0 mt-4">
          <div className="bg-[#fffbeb] border border-[#fde68a] rounded-md p-3 flex gap-3 text-[12.5px] text-[#b45309] items-start shadow-sm mt-4">
            <div className="mt-0.5 text-[#d97706]"><i className="lni lni-warning"></i></div>
            <div><span className="text-amber-800">David Ssemwogerere: UE score 42% is below the 50% pass threshold. Student is flagged for Resit (UE component).</span></div>
          </div>
        </div>

      </div>
      <Toast toast={toast} />
    </div>
  )
}
