'use client'
import { SearchSelect } from '@/components/SearchSelect'
import { TableSearch } from '@/components/TableSearch'
import { Toast } from '@/components/Toast'
import { useState } from 'react'

export default function CwRectificationPage() {
  const [toast, setToast] = useState<{msg: string, type: string} | null>(null)
  const [search, setSearch] = useState('')

  const showToast = (msg: string, type: string = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }
  return (
    <div className="page active">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">CW Rectification</div>
          <div className="pg-sub">Consolidated: Reopen · Delete · Reevaluate · Recheck — all in one screen</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="card">
          <div className="card-title mb-4">Find Submission</div>
          
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">Programme</label>
              <SearchSelect
                options={[
                  'BSc Computer Science'
                ]}
                className="w-full"
              />
            </div>
            <div className="flex-1">
              <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">Semester</label>
              <SearchSelect
                options={[
                  'Semester 1'
                ]}
                className="w-full"
              />
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 mb-5">
            <div className="flex-1">
              <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">Subject</label>
              <SearchSelect
                options={[
                  'CSE 1212 – Data Structures',
                  'CSE 1301 – Algorithms'
                ]}
                className="w-full"
              />
            </div>
            <div className="flex-1">
              <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">Student (Reg. No.)</label>
              <input type="text" className="ctrl w-full" placeholder="BCS/2024/0031" />
            </div>
          </div>
          
          <button className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-[12.5px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2" onClick={() => showToast('Submission found')}>
            <i className="lni lni-search-alt"></i> Find Submission
          </button>
        </div>

        <div className="card">
          <div className="card-title mb-4">Submission Details</div>
          <div className="space-y-3">
            <div className="flex text-[13px]">
              <div className="w-[120px] text-slate-500 font-medium">Student:</div>
              <div className="font-medium text-slate-800">Amara Nkosi</div>
            </div>
            <div className="flex text-[13px]">
              <div className="w-[120px] text-slate-500 font-medium">Reg. No.:</div>
              <div className="font-medium text-[var(--blue)] font-mono">BCS/2024/0031</div>
            </div>
            <div className="flex text-[13px]">
              <div className="w-[120px] text-slate-500 font-medium">Subject:</div>
              <div className="font-medium text-slate-800">CSE 1212 – Data Structures</div>
            </div>
            <div className="flex text-[13px]">
              <div className="w-[120px] text-slate-500 font-medium">Submitted:</div>
              <div className="font-medium text-slate-800">12 Nov 2024, 3:45 PM</div>
            </div>
            <div className="flex text-[13px]">
              <div className="w-[120px] text-slate-500 font-medium">Current Mark:</div>
              <div className="font-medium text-slate-700">21 / 25 → <strong className="text-slate-900 font-bold">12.6 / 15</strong></div>
            </div>
            <div className="flex text-[13px]">
              <div className="w-[120px] text-slate-500 font-medium">Evaluated By:</div>
              <div className="font-medium text-slate-800">Sarah Mugisha</div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-[13px] font-bold text-slate-800 mb-4">Available Actions</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Action 1: Reopen */}
        <div className="bg-white border border-slate-200 rounded-[14px] shadow-sm p-5 border-l-[4px] border-l-[#3b82f6] flex flex-col items-start">
          <div className="text-[13.5px] font-bold text-[#2563eb] flex items-center gap-2 mb-1.5">
            <i className="lni lni-lock-unlock"></i> Reopen Submission
          </div>
          <div className="text-[12.5px] text-slate-500 leading-snug mb-5 flex-1">
            For student error (wrong file uploaded). Student receives <strong className="text-slate-700">same questions</strong> as original assignment.
          </div>
          <button className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-[12.5px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors" onClick={() => showToast('Coursework reopened')}>
            Reopen Coursework
          </button>
        </div>

        {/* Action 2: Delete */}
        <div className="bg-white border border-slate-200 rounded-[14px] shadow-sm p-5 border-l-[4px] border-l-[#f59e0b] flex flex-col items-start">
          <div className="text-[13.5px] font-bold text-[#d97706] flex items-center gap-2 mb-1.5">
            <i className="lni lni-trash-can"></i> Delete Submission
          </div>
          <div className="text-[12.5px] text-slate-500 leading-snug mb-5 flex-1">
            For faculty question error. Student receives <strong className="text-slate-700">new randomised questions</strong> on relaunch. Clears all prior attempt data.
          </div>
          <button className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-[12.5px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors" onClick={() => showToast('Submission deleted')}>
            Delete Submission
          </button>
        </div>

        {/* Action 3: Reevaluation */}
        <div className="bg-white border border-slate-200 rounded-[14px] shadow-sm p-5 border-l-[4px] border-l-[#10b981] flex flex-col items-start">
          <div className="text-[13.5px] font-bold text-[#059669] flex items-center gap-2 mb-1.5">
            <i className="lni lni-reload"></i> Reevaluation — Tier 1
          </div>
          <div className="text-[12.5px] text-slate-500 leading-snug mb-5 flex-1">
            Routes submission back to <strong className="text-slate-700">original faculty</strong> for mark review. A pending alert is added to their dashboard. Used for routine grading variance (1–2% of cases).
          </div>
          <button className="badge badge-green" onClick={() => showToast('Sent for reevaluation')}>
            Send for Reevaluation
          </button>
        </div>

        {/* Action 4: Recheck */}
        <div className="bg-white border border-slate-200 rounded-[14px] shadow-sm p-5 border-l-[4px] border-l-[#ef4444] flex flex-col items-start">
          <div className="text-[13.5px] font-bold text-[#dc2626] flex items-center gap-2 mb-1.5">
            <i className="lni lni-shield"></i> Recheck — Tier 2 (Admin/Dean Only)
          </div>
          <div className="text-[12.5px] text-slate-500 leading-snug mb-5 flex-1">
            Bypasses original faculty entirely. Routes to <strong className="text-slate-700">independent auditor</strong>. Reserved for suspected bias or unjustified batch failures. Original evaluator identity is hidden from auditor.
          </div>
          <button className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-2 text-[12.5px] font-semibold shadow-sm hover:bg-red-100 transition-colors" onClick={() => showToast('Recheck triggered')}>
            Trigger Administrative Recheck
          </button>
        </div>

      </div>
      <Toast toast={toast} />
    </div>
  )
}
