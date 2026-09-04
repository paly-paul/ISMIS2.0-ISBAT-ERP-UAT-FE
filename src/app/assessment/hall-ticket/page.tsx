'use client'
import { useState } from 'react'
import { ScrollTable } from '@/components/ScrollTable'
import { TableSearch } from '@/components/TableSearch'
import { ActionMenu } from '@/components/ActionMenu'
import { SearchSelect } from '@/components/SearchSelect'
import { Pagination } from '@/components/Pagination'
import { FilterTh } from '@/components/FilterTh'
import { Toast } from '@/components/Toast'

export default function HallTicketIssuancePage() {
  const [term, setTerm] = useState('Term 1')
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

  return (
    <div className="page active">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Hall Ticket Issuance</div>
          <div className="pg-sub">Clearance panel — Issue button enabled only when all criteria are met</div>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row gap-4 md:items-end">
          <div className="flex-1">
            <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">Term</label>
            <SearchSelect
                options={[
                  { value: 'Term 1', label: 'Term 1' },
                  { value: 'Term 2', label: 'Term 2' }
                ]}
                value={term}
                onChange={setTerm}
                className="w-full"
              />
          </div>
          <div className="w-full md:w-auto" style={{ flex: 1.5 }}>
            <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">Programme</label>
            <SearchSelect
                options={[
                  'BSc Computer Science',
                  'BBA'
                ]}
                className="w-full"
              />
          </div>
          <div className="w-full md:w-auto" style={{ flex: 1.5 }}>
            <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">Semester</label>
            <SearchSelect
                options={[
                  'Semester 1'
                ]}
                className="w-full"
              />
          </div>
          <div className="flex-1">
            <input type="text" className="ctrl w-full" placeholder="Search" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        
        {/* Clearance Criteria */}
        <div className="card">
          <div className="card-title mb-4 flex items-center gap-2">
            Clearance Criteria 
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${term === 'Term 1' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
              {term}
            </span>
          </div>
          
          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center text-[13px]">
              <span className="text-slate-700 font-medium">CW Submitted (Term 1)</span>
              <span className="text-green-500 bg-green-50 rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px] border border-green-200">✓</span>
            </div>
            <div className="flex justify-between items-center text-[13px]">
              <span className="text-slate-700 font-medium">CBT Completed (Term 1)</span>
              <span className="text-green-500 bg-green-50 rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px] border border-green-200">✓</span>
            </div>
            <div className="flex justify-between items-center text-[13px]">
              <span className="text-slate-700 font-medium">50% Fee Cleared</span>
              <span className="text-red-500 bg-red-50 rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px] border border-red-200">✗</span>
            </div>
            
            {term === 'Term 2' && (
              <>
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-slate-700 font-medium">100% Fee Cleared</span>
                  <span className="text-red-500 bg-red-50 rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px] border border-red-200">✗</span>
                </div>
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-slate-700 font-medium">NCHE Fee (20,000 UGX)</span>
                  <span className="text-amber-500 bg-amber-50 rounded-full w-5 h-5 flex items-center justify-center font-bold text-[11px] border border-amber-200">!</span>
                </div>
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-slate-700 font-medium">Guild Fee (10,000 UGX/sem)</span>
                  <span className="text-red-500 bg-red-50 rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px] border border-red-200">✗</span>
                </div>
              </>
            )}
          </div>
          
          <div className="pt-4 border-t border-slate-100 text-[12px] text-slate-500">
            {term === 'Term 1' ? (
              'Term 1 requires: 50% fee + CW + CBT completion.'
            ) : (
              'Term 2 requires: 100% fee + CW + CBT + NCHE fee (20,000 UGX) + Guild fee (10,000 UGX).'
            )}
          </div>
        </div>

        {/* Selected Student */}
        <div className="card">
          <div className="card-title mb-4">Selected Student</div>
          
          <div className="space-y-3 mb-6">
            <div className="flex text-[13px]">
              <div className="w-[100px] text-slate-500 font-medium">Name:</div>
              <div className="font-semibold text-slate-900">Amara Nkosi</div>
            </div>
            <div className="flex text-[13px]">
              <div className="w-[100px] text-slate-500 font-medium">Reg. No.:</div>
              <div className="font-semibold text-slate-800 font-mono">BCS/2024/0031</div>
            </div>
            <div className="flex text-[13px]">
              <div className="w-[100px] text-slate-500 font-medium">Fee Paid:</div>
              <div className="font-medium text-slate-700">$125 / $250 (50%)</div>
            </div>
            <div className="flex text-[13px] items-center">
              <div className="w-[100px] text-slate-500 font-medium">CW Status:</div>
              <div><span className="badge badge-green">Submitted</span></div>
            </div>
            <div className="flex text-[13px] items-center">
              <div className="w-[100px] text-slate-500 font-medium">CBT Status:</div>
              <div><span className="badge badge-green">Submitted</span></div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button className="btn btn-success opacity-60 cursor-not-allowed" disabled>
              Issue Hall Ticket
            </button>
            <div className="text-[11px] text-red-500 mt-2 font-medium">Issue blocked — 50% fee clearance not met</div>
          </div>
        </div>

      </div>

      <div className="card">
        <div className="card-hdr">
          <div className="text-[13.5px] font-bold text-slate-900">Student Clearance List</div>
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
                <th>Student</th>
                <th>Fee %</th>
                <th>CW</th>
                <th>CBT</th>
                <FilterTh 
                  label="Clearance" 
                  opts={['Ready', 'Fee Pending', 'CW/CBT Pending']} 
                  isOpen={openFilter === 'clearance'} 
                  activeFilter={filters['clearance'] || []} 
                  onToggle={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'clearance' ? null : 'clearance') }} 
                  onSelect={(vals) => handleFilterSelect('clearance', vals)} 
                  onClear={() => handleFilterSelect('clearance', [])} 
                  onClose={() => setOpenFilter(null)} 
                />
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm text-green-600" onClick={() => showToast('Hall ticket issued')}><i className="lni lni-ticket"></i> Issue Ticket</button>
                  </ActionMenu>
                </td>
                <td><span className="font-bold text-[var(--blue)] font-mono">BCS/2024/0017</span></td>
                <td className="text-slate-800">Emmanuel Okello</td>
                <td><span className="badge badge-green">100%</span></td>
                <td><span className="badge badge-green">✓</span></td>
                <td><span className="badge badge-green">✓</span></td>
                <td><span className="badge badge-green">Ready</span></td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm opacity-50 cursor-not-allowed"><i className="lni lni-ticket"></i> Issue Ticket</button>
                  </ActionMenu>
                </td>
                <td><span className="font-bold text-[var(--blue)] font-mono">BCS/2024/0031</span></td>
                <td className="text-slate-800">Amara Nkosi</td>
                <td><span className="badge badge-red">50%</span></td>
                <td><span className="badge badge-green">✓</span></td>
                <td><span className="badge badge-green">✓</span></td>
                <td><span className="badge badge-red">Fee Pending</span></td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm opacity-50 cursor-not-allowed"><i className="lni lni-ticket"></i> Issue Ticket</button>
                  </ActionMenu>
                </td>
                <td><span className="font-bold text-[var(--blue)] font-mono">BCS/2024/0044</span></td>
                <td className="text-slate-800">Grace Akello</td>
                <td><span className="badge badge-amber">60%</span></td>
                <td><span className="badge badge-red">✗</span></td>
                <td><span className="badge badge-red">✗</span></td>
                <td><span className="badge badge-red">CW/CBT Pending</span></td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm text-green-600" onClick={() => showToast('Hall ticket issued')}><i className="lni lni-ticket"></i> Issue Ticket</button>
                  </ActionMenu>
                </td>
                <td><span className="font-bold text-[var(--blue)] font-mono">BCS/2024/0058</span></td>
                <td className="text-slate-800">David Ssemwogerere</td>
                <td><span className="badge badge-green">100%</span></td>
                <td><span className="badge badge-green">✓</span></td>
                <td><span className="badge badge-green">✓</span></td>
                <td><span className="badge badge-green">Ready</span></td>
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
