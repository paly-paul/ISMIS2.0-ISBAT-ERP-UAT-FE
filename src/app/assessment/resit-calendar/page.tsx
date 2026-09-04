'use client'
import { ScrollTable } from '@/components/ScrollTable'
import { TableSearch } from '@/components/TableSearch'
import { ActionMenu } from '@/components/ActionMenu'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { FilterTh } from '@/components/FilterTh'
import { Toast } from '@/components/Toast'
import { useState, useEffect } from 'react'

export default function ResitCalendarPage() {
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
          <div className="pg-title">Resit Calendar & Applications</div>
          <div className="pg-sub">Define resit windows · Track applications and payment status</div>
        </div>
        <div className="pg-actions">
          <button className="btn btn-primary whitespace-nowrap" onClick={() => showToast('Opening new resit window prompt')}>
            + Open Resit Window
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-stretch gap-5 mb-5">
        
        {/* Active Resit Window */}
        <div className="w-full lg:w-1/2 bg-white border-[1.5px] border-slate-200 rounded-[14px] shadow-[3px_3px_8px_#c8d4e0,-3px_-3px_8px_#ffffff] p-5 flex flex-col">
          <div className="card-title mb-4">Active Resit Window</div>
          
          <div className="grid grid-cols-[130px_1fr] gap-y-3 text-[13px] mb-5">
            <div className="text-slate-500">Session:</div>
            <div className="font-semibold text-slate-900">2024/25 Semester 1 Post-UE</div>
            
            <div className="text-slate-500">Application Open:</div>
            <div className="font-semibold text-slate-900">15 Nov 2024</div>
            
            <div className="text-slate-500">Application Close:</div>
            <div className="font-semibold text-slate-900">30 Nov 2024</div>
            
            <div className="text-slate-500">Resit Dates:</div>
            <div className="font-semibold text-slate-900">10–15 Dec 2024</div>
            
            <div className="text-slate-500 mt-1">Status:</div>
            <div className="mt-1">
              <span className="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-[11px] font-bold">Window Open</span>
            </div>
          </div>

          <div className="bg-[#eff6ff] border border-[#dbeafe] rounded-md p-2.5 flex gap-2.5 text-[12px] text-[#2563eb] items-start mt-auto">
            <div className="bg-[#2563eb] text-white w-[18px] h-[18px] rounded-sm flex items-center justify-center flex-shrink-0 text-[11px] mt-0.5"><i className="lni lni-information"></i></div>
            <div className="leading-snug">System auto-locks the portal after 30 Nov. Only students with failed IA or UE components are eligible to apply.</div>
          </div>
        </div>

        {/* Fee Structure */}
        <div className="w-full lg:w-1/2 bg-white border-[1.5px] border-slate-200 rounded-[14px] shadow-[3px_3px_8px_#c8d4e0,-3px_-3px_8px_#ffffff] p-5 flex flex-col">
          <div className="card-title mb-4">Fee Structure — Resit</div>
          
          <div className="flex-1">
            <table className="w-full text-[13px] text-left">
              <thead className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-md">COMPONENT</th>
                  <th className="py-2.5 px-3">FEE (UGX)</th>
                  <th className="py-2.5 px-3 rounded-r-md">FEE (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 px-3 text-slate-700">Internal Assessment (IA) Resit</td>
                  <td className="py-3 px-3 font-medium text-slate-900">150,000</td>
                  <td className="py-3 px-3 font-medium text-slate-900">$40</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-slate-700">University Examination (UE) Resit</td>
                  <td className="py-3 px-3 font-medium text-slate-900">200,000</td>
                  <td className="py-3 px-3 font-medium text-slate-900">$55</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-slate-700 font-bold">IA + UE (Both)</td>
                  <td className="py-3 px-3 font-bold text-slate-900">330,000</td>
                  <td className="py-3 px-3 font-bold text-slate-900">$90</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-[11.5px] text-slate-500">
            Fee differentiation: IA resit / UE resit. Payment gates access to resit seating.
          </div>
        </div>

      </div>

      <div className="card">
        <div className="p-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="text-[13.5px] font-bold text-slate-900">Resit Applications</div>
            <span className="bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-blue-100">23 registered · 18 fee cleared</span>
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
                <th>REG. NO.</th>
                <th>STUDENT</th>
                <th>PROGRAMME</th>
                <th>FAILED COMPONENT</th>
                <th>RESIT TYPE</th>
                <th>FEE</th>
                <th>PAYMENT</th>
                <FilterTh 
                  label="STATUS" 
                  opts={['Cleared', 'Awaiting Fee']} 
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
                <TableLoadingState colSpan={9} />
              ) : (
                <>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View</button>
                  </ActionMenu>
                </td>
                <td className="font-mono text-slate-500 text-[12.5px]">BCS/2024/0058</td>
                <td className="text-slate-800">David Ssemwogerere</td>
                <td className="text-slate-600">BCS Sem 1</td>
                <td className="text-slate-700">UE – Algorithms</td>
                <td className="text-slate-700">UE Resit</td>
                <td className="font-medium text-slate-900">$55</td>
                <td><span className="badge badge-green">Paid</span></td>
                <td><span className="badge badge-green">Cleared</span></td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View</button>
                  </ActionMenu>
                </td>
                <td className="font-mono text-slate-500 text-[12.5px]">BBA/2024/0091</td>
                <td className="text-slate-800">Kevin Mugumya</td>
                <td className="text-slate-600">BBA Sem 3</td>
                <td className="text-slate-700">IA – Business Mgmt</td>
                <td className="text-slate-700">IA Resit</td>
                <td className="font-medium text-slate-900">$40</td>
                <td><span className="badge badge-amber">Pending</span></td>
                <td><span className="badge badge-amber">Awaiting Fee</span></td>
              </tr>
                </>
              )}
            </tbody>
          </table>
        </ScrollTable>
        <div className="p-4 border-t border-slate-100">
          <Pagination page={page} totalPages={2} totalCount={23} onPageChange={setPage} />
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
