'use client'
import { useState } from 'react'
import { ScrollTable } from '@/components/ScrollTable'
import { TableSearch } from '@/components/TableSearch'
import { ActionMenu } from '@/components/ActionMenu'
import { Pagination } from '@/components/Pagination'
import { FilterTh } from '@/components/FilterTh'
import { Toast } from '@/components/Toast'

export default function ModerationPage() {
  const [activeTab, setActiveTab] = useState<'ia' | 'ue'>('ia')
  const [search, setSearch] = useState('')
  const [iaGrace, setIaGrace] = useState(0)
  const [ueGrace, setUeGrace] = useState(0)
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

  return (
    <div className="page active">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Result & Moderation Console</div>
          <div className="pg-sub">Apply grace marks · Preview eligible students · intIAMode / intUEMode columns preserved separately</div>
        </div>
        <div className="pg-actions">
          <button className="btn btn-primary whitespace-nowrap" onClick={() => showToast('Results published to student portal')}>
            Publish Results
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-stretch gap-5 mb-5">
        
        {/* Moderation Parameters */}
        <div className="w-full lg:w-[60%] bg-white border-[1.5px] border-slate-200 rounded-[14px] shadow-[3px_3px_8px_#c8d4e0,-3px_-3px_8px_#ffffff] p-5 flex flex-col">
          <div className="card-title mb-4">Moderation Parameters</div>
          
          <div className="border-b border-slate-200 mb-5 flex gap-4">
            <button 
              className={`pb-2 text-[13px] transition-colors ${activeTab === 'ia' ? 'font-bold text-purple-700 border-b-[2px] border-purple-700' : 'font-medium text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('ia')}
            >
              IA Moderation
            </button>
            <button 
              className={`pb-2 text-[13px] transition-colors ${activeTab === 'ue' ? 'font-bold text-purple-700 border-b-[2px] border-purple-700' : 'font-medium text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('ue')}
            >
              UE Moderation
            </button>
          </div>

          <div className="mb-5 flex-1 flex flex-col justify-center">
            <label className="text-[12px] font-semibold text-slate-700 block mb-3">
              Grace Marks to Add ({activeTab === 'ia' ? 'IA' : 'UE'}) — {activeTab === 'ia' ? 'intIAMode' : 'intUEMode'}
            </label>
            <div className="relative">
              <input 
                type="range" 
                min="0" 
                max="5" 
                value={activeTab === 'ia' ? iaGrace : ueGrace} 
                onChange={(e) => activeTab === 'ia' ? setIaGrace(parseInt(e.target.value)) : setUeGrace(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600 outline-none block"
              />
            </div>
            <div className="mt-2 text-[11px] font-medium text-slate-500 flex justify-between items-center">
              <span>0</span>
              <span className="text-purple-700 font-bold">{activeTab === 'ia' ? iaGrace : ueGrace} {activeTab === 'ia' ? (iaGrace === 1 ? 'mark' : 'marks') : (ueGrace === 1 ? 'mark' : 'marks')}</span>
              <span>5</span>
            </div>
          </div>

          <div className="bg-[#eff6ff] border border-[#dbeafe] rounded-md p-2.5 flex gap-2.5 text-[12px] text-[#2563eb] items-start mt-auto">
            <div className="bg-[#2563eb] text-white w-[18px] h-[18px] rounded-sm flex items-center justify-center flex-shrink-0 text-[11px] mt-0.5"><i className="lni lni-information"></i></div>
            <div className="leading-snug">Original {activeTab === 'ia' ? 'IA' : 'UE'} baseline scores are never modified. Grace marks stored separately in {activeTab === 'ia' ? 'intIAMode' : 'intUEMode'} column.</div>
          </div>
        </div>

        {/* Result Summary */}
        <div className="w-full lg:w-[40%] bg-white border-[1.5px] border-slate-200 rounded-[14px] shadow-[3px_3px_8px_#c8d4e0,-3px_-3px_8px_#ffffff] p-5 flex flex-col">
          <div className="card-title mb-4">Result Summary</div>
          
          <div className="grid grid-cols-2 gap-3 flex-1">
            <div className="text-center p-3 bg-green-50 rounded-md border border-green-100 flex flex-col justify-center min-h-[85px]">
              <div className="text-[28px] font-bold text-green-600 leading-none mb-1">2</div>
              <div className="text-[11.5px] font-medium text-slate-600">Pass</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-md border border-red-100 flex flex-col justify-center min-h-[85px]">
              <div className="text-[28px] font-bold text-red-500 leading-none mb-1">1</div>
              <div className="text-[11.5px] font-medium text-slate-600">Fail</div>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-md border border-amber-100 flex flex-col justify-center min-h-[85px]">
              <div className="text-[28px] font-bold text-amber-500 leading-none mb-1">0</div>
              <div className="text-[11.5px] font-medium text-slate-600">Eligible for Grace</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-md border border-purple-100 flex flex-col justify-center min-h-[85px]">
              <div className="text-[28px] font-bold text-purple-600 leading-none mb-1">3</div>
              <div className="text-[11.5px] font-medium text-slate-600">Total Students</div>
            </div>
          </div>
        </div>

      </div>

      <div className="card">
        <div className="p-5 pb-4 border-b border-slate-100">
          <div className="text-[13.5px] font-bold text-slate-900 flex items-center gap-2">
            Student Results Grid 
            <span className="text-[11.5px] font-medium text-slate-500 font-normal ml-1">Highlighted rows = eligible for grace marks</span>
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
                <th>STUDENT</th>
                <th>IA (/30)</th>
                <th>IA GRACE</th>
                <th>IA FINAL</th>
                <th>UE (/70)</th>
                <th>UE GRACE</th>
                <th>UE FINAL</th>
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
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View</button>
                  </ActionMenu>
                </td>
                <td className="text-slate-800">Amara Nkosi</td>
                <td className="font-medium text-slate-700">23.4</td>
                <td className={`text-slate-400 ${iaGrace > 0 ? 'text-purple-600 font-medium' : ''}`}>+{iaGrace}</td>
                <td className="font-bold text-slate-900">{(23.4 + iaGrace).toFixed(1)}</td>
                <td className="font-medium text-slate-700">50.4</td>
                <td className={`text-slate-400 ${ueGrace > 0 ? 'text-purple-600 font-medium' : ''}`}>+{ueGrace}</td>
                <td className="font-bold text-slate-900">{(50.4 + ueGrace).toFixed(1)}</td>
                <td><span className="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-[11px] font-bold">PASS</span></td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View</button>
                  </ActionMenu>
                </td>
                <td className="text-slate-800">Emmanuel Okello</td>
                <td className="font-medium text-slate-700">21.6</td>
                <td className={`text-slate-400 ${iaGrace > 0 ? 'text-purple-600 font-medium' : ''}`}>+{iaGrace}</td>
                <td className="font-bold text-slate-900">{(21.6 + iaGrace).toFixed(1)}</td>
                <td className="font-medium text-slate-700">40.6</td>
                <td className={`text-slate-400 ${ueGrace > 0 ? 'text-purple-600 font-medium' : ''}`}>+{ueGrace}</td>
                <td className="font-bold text-slate-900">{(40.6 + ueGrace).toFixed(1)}</td>
                <td><span className="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-[11px] font-bold">PASS</span></td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View</button>
                  </ActionMenu>
                </td>
                <td className="text-slate-800">David Ssemwogerere</td>
                <td className="font-medium text-slate-700">28.8</td>
                <td className={`text-slate-400 ${iaGrace > 0 ? 'text-purple-600 font-medium' : ''}`}>+{iaGrace}</td>
                <td className="font-bold text-slate-900">{(28.8 + iaGrace).toFixed(1)}</td>
                <td className="font-medium text-slate-700">29.4</td>
                <td className={`text-slate-400 ${ueGrace > 0 ? 'text-purple-600 font-medium' : ''}`}>+{ueGrace}</td>
                <td className="font-bold text-slate-900">{(29.4 + ueGrace).toFixed(1)}</td>
                <td><span className="badge badge-red">FAIL (UE)</span></td>
              </tr>
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
