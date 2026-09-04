'use client'
import { useState } from 'react'
import { ScrollTable } from '@/components/ScrollTable'
import { TableSearch } from '@/components/TableSearch'
import { ActionMenu } from '@/components/ActionMenu'
import { SearchSelect } from '@/components/SearchSelect'
import { Pagination } from '@/components/Pagination'
import { FilterTh } from '@/components/FilterTh'
import { Toast } from '@/components/Toast'

export default function QpUploadVettingPage() {
  const [activeTab, setActiveTab] = useState('faculty')
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
          <div className="pg-title">QP Upload & Vetting</div>
          <div className="pg-sub">Faculty upload · Committee split-pane review · Lock on verify</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 border-b border-slate-200 mb-6">
        <button 
          className={`px-4 py-2.5 text-[13.5px] flex items-center gap-2 transition-colors ${activeTab === 'faculty' ? 'font-bold text-purple-700 border-b-[3px] border-purple-700' : 'font-medium text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('faculty')}
        >
          <i className="lni lni-upload"></i> Faculty Upload
        </button>
        <button 
          className={`px-4 py-2.5 text-[13.5px] flex items-center gap-2 transition-colors ${activeTab === 'vetting' ? 'font-bold text-purple-700 border-b-[3px] border-purple-700' : 'font-medium text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('vetting')}
        >
          <i className="lni lni-users"></i> Vetting Committee
          <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full text-[10px] font-bold ml-1 border border-red-100">2</span>
        </button>
      </div>

      {activeTab === 'faculty' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          
          {/* Left Side: Upload Form */}
          <div className="lg:col-span-3 bg-white border-[1.5px] border-slate-200 rounded-[14px] shadow-[3px_3px_8px_#c8d4e0,-3px_-3px_8px_#ffffff] p-5">
            <div className="card-title mb-4">Upload Question Paper</div>
            
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="flex-1">
                <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">Subject</label>
                <SearchSelect
                options={[
                  'CSE 1212 – Data Structures'
                ]}
                className="w-full"
              />
              </div>
              <div className="flex-1">
                <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">Exam Type</label>
                <SearchSelect
                options={[
                  'University Examination (UG)',
                  'University Examination (PG)'
                ]}
                className="w-full"
              />
              </div>
            </div>
            
            <div className="mb-4">
              <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">UG Pattern Reminder</label>
              <div className="bg-slate-50 border border-slate-200 rounded-md p-4 text-[12.5px] text-slate-700 leading-relaxed shadow-inner">
                <strong className="text-slate-800">Sec A:</strong> 10 MCQ (2m each) — prepare 20<br/>
                <strong className="text-slate-800">Sec B:</strong> Any 4 of 6 (15m each) — prepare 12<br/>
                <strong className="text-slate-800">Sec C:</strong> Any 1 of 2 (20m each) — prepare 4<br/>
                <span className="text-slate-500 mt-1 block">Total: 100 marks (prorated to weightage)</span>
              </div>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center mb-5 cursor-pointer transition-colors hover:border-purple-400 group">
              <div className="text-[28px] mb-2 text-slate-800 group-hover:text-purple-600 transition-colors"><i className="lni lni-empty-file"></i></div>
              <div className="text-[13px] font-semibold text-slate-900">Upload QP file (supports rich text, drawings, screenshots)</div>
              <div className="text-[11px] text-slate-500 mt-1">.docx / .pdf / Excel template</div>
            </div>

            <button className="btn btn-primary" onClick={() => showToast('Submitted to vetting queue')}>
              Submit to Vetting Queue
            </button>
          </div>

          {/* Right Side: Status */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="p-5 pb-3">
                <div className="text-[13.5px] font-bold text-slate-900">My QP Status</div>
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
                <table style={{ fontSize: '11px' }}>
                  <thead>
                    <tr>
                      <th>SUBJECT</th>
                      <th>UPLOADED</th>
                      <FilterTh 
                        label="STATUS" 
                        opts={['Verified', 'Pending Upload']} 
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
                    <tr>
                      <td className="font-mono text-slate-700">CSE 1301</td>
                      <td className="text-slate-500">02 Nov</td>
                      <td><span className="badge badge-green">✓ Verified</span></td>
                    </tr>
                    <tr>
                      <td className="font-mono text-slate-700">CSE 1212</td>
                      <td className="text-slate-400">—</td>
                      <td><span className="badge badge-red">Pending Upload</span></td>
                    </tr>
                  </tbody>
                </table>
              </ScrollTable>
              <div className="p-3 border-t border-slate-100">
                <Pagination page={page} totalPages={1} totalCount={2} onPageChange={setPage} />
              </div>
            </div>

            <div className="bg-[#fffbeb] border border-[#fde68a] rounded-md p-3 flex gap-3 text-[12.5px] text-[#b45309] items-start mb-4 shadow-sm">
              <div className="mt-0.5 text-[#d97706]"><i className="lni lni-warning"></i></div>
              <div><strong className="font-semibold text-amber-800">CSE 1301 is locked.</strong> QP was verified by committee on 05 Nov. Editing is no longer possible.</div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-md p-3 relative overflow-hidden flex items-center justify-center opacity-70">
              <div className="text-center">
                <div className="text-slate-400 mb-1"><i className="lni lni-lock-alt text-[16px]"></i></div>
                <div className="text-[11px] font-bold text-slate-600">Locked — Verified 05 Nov by Dr. Sarah Mugisha</div>
              </div>
            </div>

          </div>

        </div>
      )}

      {activeTab === 'vetting' && (
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-[13.5px] font-bold text-slate-900">Vetting Queue</div>
            <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-red-100">2 awaiting review</span>
          </div>
          
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>SUBJECT</th>
                  <th>FACULTY</th>
                  <th>SUBMITTED</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <ActionMenu>
                      <button className="btn btn-neu btn-sm"><i className="lni lni-search-alt"></i> View</button>
                    </ActionMenu>
                  </td>
                  <td><span className="font-bold text-[var(--blue)] font-mono text-[12.5px]">MGT 2101</span></td>
                  <td className="text-slate-800">James Ochieng</td>
                  <td className="text-slate-500 font-mono text-[12.5px]">06 Nov</td>
                  <td>
                    <button className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-[12px] px-3 py-1.5 rounded-full transition-colors shadow-sm" onClick={() => showToast('Opened for review')}>
                      Open for Review
                    </button>
                  </td>
                </tr>
                <tr>
                  <td>
                    <ActionMenu>
                      <button className="btn btn-neu btn-sm"><i className="lni lni-search-alt"></i> View</button>
                    </ActionMenu>
                  </td>
                  <td><span className="font-bold text-[var(--blue)] font-mono text-[12.5px]">BIO 2201</span></td>
                  <td className="text-slate-800">Joseph Ayuma</td>
                  <td className="text-slate-500 font-mono text-[12.5px]">07 Nov</td>
                  <td>
                    <button className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-[12px] px-3 py-1.5 rounded-full transition-colors shadow-[var(--neu-sm)]" onClick={() => showToast('Opened for review')}>
                      Open for Review
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </ScrollTable>
          <div className="p-4 border-t border-slate-100">
            <Pagination page={page} totalPages={1} totalCount={2} onPageChange={setPage} />
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  )
}
