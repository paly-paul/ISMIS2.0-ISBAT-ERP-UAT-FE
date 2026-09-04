'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Pagination } from '@/components/Pagination'
import { TableSearch } from '@/components/TableSearch'
import { Toast } from '@/components/Toast'

export default function AssessmentDashboard() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{msg: string, type: string} | null>(null)

  const showToast = (msg: string, type: string = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function nav(id: string) {
    router.push('/assessment/' + id)
  }

  return (
    <div className="page active">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Assessment Dashboard</div>
          <div className="pg-sub">2024/25 · Semester 1 · Academic Registrar View</div>
        </div>
        <div className="flex gap-2 items-center">
          <span className="badge badge-purple">Registrar</span>
          <button className="btn btn-neu btn-sm" onClick={() => showToast('Summary exported successfully')}><i className="lni lni-download"></i> Export Summary</button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <div className="card card-sm flex flex-col gap-1">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg mb-1 bg-purple-100 text-purple-700">📋</div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pending QP Uploads</div>
          <div className="text-3xl font-bold text-slate-900 leading-none">7</div>
          <div className="text-[11px] text-slate-500">3 overdue (&gt;5 days)</div>
          <div className="h-1 rounded-full bg-slate-100 overflow-hidden mt-1"><div className="h-full rounded-full bg-red-500 transition-all w-[57%]"></div></div>
        </div>
        <div className="card card-sm flex flex-col gap-1">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg mb-1 bg-amber-100 text-amber-600">⏳</div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">QP Awaiting Vetting</div>
          <div className="text-3xl font-bold text-slate-900 leading-none">2</div>
          <div className="text-[11px] text-slate-500">Avg wait: 1.4 days</div>
          <div className="h-1 rounded-full bg-slate-100 overflow-hidden mt-1"><div className="h-full rounded-full bg-green-500 transition-all w-[28%]"></div></div>
        </div>
        <div className="card card-sm flex flex-col gap-1">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg mb-1 bg-blue-100 text-blue-600">🎫</div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hall Tickets Pending</div>
          <div className="text-3xl font-bold text-slate-900 leading-none">14</div>
          <div className="text-[11px] text-slate-500">Fee clearance incomplete</div>
          <div className="h-1 rounded-full bg-slate-100 overflow-hidden mt-1"><div className="h-full rounded-full bg-amber-500 transition-all w-[40%]"></div></div>
        </div>
        <div className="card card-sm flex flex-col gap-1">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg mb-1 bg-red-100 text-red-600">⚠️</div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reevaluation Requests</div>
          <div className="text-3xl font-bold text-slate-900 leading-none">4</div>
          <div className="text-[11px] text-slate-500">1 escalated to Recheck</div>
          <div className="h-1 rounded-full bg-slate-100 overflow-hidden mt-1"><div className="h-full rounded-full bg-red-500 transition-all w-[75%]"></div></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Pending Tasks with TAT */}
        {/* Pending Tasks with TAT */}
        <div className="bg-white rounded-[14px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 p-5">
          <div className="font-bold text-[15px] mb-4 flex items-center gap-2">
            📌 Pending Actions
            <span className="bg-red-50 text-red-500 rounded-full px-2.5 py-0.5 text-[11px] font-semibold">7 items</span>
          </div>

          <div className="flex items-start gap-3 p-3 bg-white rounded-[12px] border border-slate-100 mb-2.5 shadow-sm">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 bg-[#fef9c3] text-amber-600">🔍</div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[13px] font-semibold text-slate-900">QP Vetting Pending — MGT 2101</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">Vetting Committee · Business Management<br />· BBA Sem 3</div>
                </div>
                <button className="px-3 py-1 bg-white border border-slate-200 rounded-full text-slate-700 text-[11px] font-medium shadow-sm hover:bg-slate-50 transition-colors">Review</button>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <div className="w-[100px] h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-amber-500 w-[55%]"></div></div>
                <span className="text-[10px] font-semibold text-amber-600">Day 2 of 3-day SLA</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-white rounded-[12px] border border-slate-100 mb-2.5 shadow-sm">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 bg-[#fee2e2] text-red-600">⚖️</div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[13px] font-semibold text-slate-900">Recheck Flagged — CSE 1212</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">Batch failure rate 78% · Suspected<br />grading bias</div>
                </div>
                <button className="px-3 py-1 bg-red-50 border border-red-200 rounded-full text-red-500 text-[11px] font-medium hover:bg-red-100 transition-colors">Assign Auditor</button>
              </div>
              <div className="flex items-start gap-3 mt-2">
                <div className="w-[100px] h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1"><div className="h-full rounded-full bg-red-500 w-[90%]"></div></div>
                <span className="text-[10px] font-semibold text-red-500 leading-tight">Awaiting auditor<br />assignment</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-white rounded-[12px] border border-slate-100 shadow-sm">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 bg-[#e0f2fe] text-blue-600">🎫</div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[13px] font-semibold text-slate-900">14 Hall Tickets — Fee Clearance<br />Incomplete</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">Term 1 · BSc programmes · NCHE/Guild<br />checks pending</div>
                </div>
                <button className="px-3 py-1 bg-white border border-slate-200 rounded-full text-slate-700 text-[11px] font-medium shadow-sm hover:bg-slate-50 transition-colors">View</button>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <div className="w-[100px] h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-amber-500 w-[50%]"></div></div>
                <span className="text-[10px] font-semibold text-amber-600">Exam in 5 days</span>
              </div>
            </div>
          </div>
        </div>

        {/* Assessment Progress by Programme */}
        <div className="bg-white rounded-[14px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 p-5">
          <div className="font-bold text-[15px] mb-4">📊 Semester Progress by Programme</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="text-[11px] font-bold text-white uppercase bg-[#4f46e5]">
                  <th className="px-3 py-3">Programme</th>
                  <th className="px-3 py-3">CW</th>
                  <th className="px-3 py-3">CBT</th>
                  <th className="px-3 py-3">QP Status</th>
                  <th className="px-3 py-3 text-center">HT</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-3 py-3 border-b border-slate-100 align-middle"><div className="font-bold text-slate-900 text-[13px]">BCS Sem 1</div><div className="text-[12px] text-slate-500">62 students</div></td>
                  <td className="px-3 py-3 border-b border-slate-100 align-middle"><span className="bg-[#dcfce7] text-[#166534] rounded-full px-2.5 py-1 text-[11px] font-medium">Done</span></td>
                  <td className="px-3 py-3 border-b border-slate-100 align-middle"><span className="bg-[#dcfce7] text-[#166534] rounded-full px-2.5 py-1 text-[11px] font-medium">Done</span></td>
                  <td className="px-3 py-3 border-b border-slate-100 align-middle"><span className="bg-[#fef3c7] text-[#b45309] rounded-full px-2.5 py-1 text-[11px] font-medium">Pending</span></td>
                  <td className="px-3 py-3 border-b border-slate-100 align-middle text-center"><span className="bg-slate-100 text-slate-400 rounded-full px-2 py-0.5 text-[11px] font-bold">—</span></td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-3 py-3 border-b border-slate-100 align-middle"><div className="font-bold text-slate-900 text-[13px]">BIT Sem 2</div><div className="text-[12px] text-slate-500">48 students</div></td>
                  <td className="px-3 py-3 border-b border-slate-100 align-middle"><span className="bg-[#dcfce7] text-[#166534] rounded-full px-2.5 py-1 text-[11px] font-medium">Done</span></td>
                  <td className="px-3 py-3 border-b border-slate-100 align-middle"><span className="bg-[#fef3c7] text-[#b45309] rounded-full px-2.5 py-1 text-[11px] font-medium">Active</span></td>
                  <td className="px-3 py-3 border-b border-slate-100 align-middle"><span className="bg-[#f3e8ff] text-[#7e22ce] rounded-full px-2.5 py-1 text-[11px] font-medium">Vetting</span></td>
                  <td className="px-3 py-3 border-b border-slate-100 align-middle text-center"><span className="bg-slate-100 text-slate-400 rounded-full px-2 py-0.5 text-[11px] font-bold">—</span></td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-3 py-3 border-b border-slate-100 align-middle"><div className="font-bold text-slate-900 text-[13px]">BBA Sem 3</div><div className="text-[12px] text-slate-500">55 students</div></td>
                  <td className="px-3 py-3 border-b border-slate-100 align-middle"><span className="bg-[#dcfce7] text-[#166534] rounded-full px-2.5 py-1 text-[11px] font-medium">Done</span></td>
                  <td className="px-3 py-3 border-b border-slate-100 align-middle"><span className="bg-[#dcfce7] text-[#166534] rounded-full px-2.5 py-1 text-[11px] font-medium">Done</span></td>
                  <td className="px-3 py-3 border-b border-slate-100 align-middle"><span className="bg-[#dcfce7] text-[#166534] rounded-full px-2.5 py-1 text-[11px] font-medium">Verified</span></td>
                  <td className="px-3 py-3 border-b border-slate-100 align-middle text-center"><span className="bg-[#fef3c7] text-[#b45309] rounded-full px-2.5 py-1 text-[11px] font-medium">Pending</span></td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-3 py-3 border-b border-slate-100 align-middle"><div className="font-bold text-slate-900 text-[13px]">BMIT Sem 1</div><div className="text-[12px] text-slate-500">38 students</div></td>
                  <td className="px-3 py-3 border-b border-slate-100 align-middle"><div className="bg-[#fee2e2] text-[#b91c1c] rounded-xl px-2 py-1 text-[11px] font-medium text-center leading-tight inline-block min-w-[50px]">3<br />Pending</div></td>
                  <td className="px-3 py-3 border-b border-slate-100 align-middle"><div className="bg-slate-100 text-slate-500 rounded-xl px-2 py-1 text-[11px] font-medium text-center leading-tight inline-block min-w-[50px]">Not<br />Set</div></td>
                  <td className="px-3 py-3 border-b border-slate-100 align-middle text-center"><span className="bg-slate-100 text-slate-400 rounded-full px-2 py-0.5 text-[11px] font-bold">—</span></td>
                  <td className="px-3 py-3 border-b border-slate-100 align-middle text-center"><span className="bg-slate-100 text-slate-400 rounded-full px-2 py-0.5 text-[11px] font-bold">—</span></td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-3 py-3 border-b-0 border-slate-100 align-middle"><div className="font-bold text-slate-900 text-[13px]">MSc CS Sem 1</div><div className="text-[12px] text-slate-500">22 students</div></td>
                  <td className="px-3 py-3 border-b-0 border-slate-100 align-middle"><span className="bg-[#dcfce7] text-[#166534] rounded-full px-2.5 py-1 text-[11px] font-medium">Done</span></td>
                  <td className="px-3 py-3 border-b-0 border-slate-100 align-middle"><span className="bg-[#dcfce7] text-[#166534] rounded-full px-2.5 py-1 text-[11px] font-medium">Done</span></td>
                  <td className="px-3 py-3 border-b-0 border-slate-100 align-middle"><span className="bg-[#dcfce7] text-[#166534] rounded-full px-2.5 py-1 text-[11px] font-medium">Verified</span></td>
                  <td className="px-3 py-3 border-b-0 border-slate-100 align-middle text-center"><span className="bg-[#d1fae5] text-[#047857] rounded-full px-2.5 py-1 text-[11px] font-medium">Issued</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={2} totalCount={12} onPageChange={setPage} />
        </div>
      </div>

      {/* Tertiary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        {/* Fee Clearance Gate */}
        <div className="bg-white rounded-[14px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 p-5 flex flex-col">
          <div className="font-bold text-[14px] mb-1 text-slate-900">💰 Fee Clearance Gate</div>
          <div className="text-[12px] text-slate-500 mb-4 border-b border-slate-100 pb-3">Term 1 — 50% threshold</div>
          <div className="flex flex-col gap-3 flex-1">
            <div className="flex justify-between items-center text-[13px] text-slate-700">
              <span>CW Submitted (Term 1)</span>
              <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-[10px]">✓</span>
            </div>
            <div className="flex justify-between items-center text-[13px] text-slate-700">
              <span>CBT Completed (Term 1)</span>
              <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-[10px]">✓</span>
            </div>
            <div className="flex justify-between items-center text-[13px] text-slate-700">
              <span>50% Fee Cleared</span>
              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[11px] font-bold">!</span>
            </div>
            <div className="flex justify-between items-center text-[13px] text-slate-700">
              <span>Hall Ticket Issued</span>
              <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-bold">✕</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            14 students pending fee gate
          </div>
        </div>

        {/* Resit Summary */}
        <div className="bg-white rounded-[14px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 p-5 flex flex-col">
          <div className="font-bold text-[14px] mb-1 text-slate-900">🔄 Resit Summary</div>
          <div className="text-[12px] text-slate-500 mb-4 border-b border-slate-100 pb-3">2024/25 Sem 1 — Post-UE</div>
          <div className="flex flex-col gap-4 flex-1">
            <div className="flex justify-between items-center text-[13px] text-slate-700">
              <span>Applications Open</span>
              <span className="bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-[11px] font-medium">Nov 15–30</span>
            </div>
            <div className="flex justify-between items-center text-[13px] text-slate-700">
              <span>Registered Students</span>
              <span className="bg-blue-100 text-blue-700 rounded-full px-2.5 py-0.5 text-[11px] font-medium">23</span>
            </div>
            <div className="flex justify-between items-center text-[13px] text-slate-700">
              <span>Fee Cleared</span>
              <span className="bg-green-100 text-green-700 rounded-full px-2.5 py-0.5 text-[11px] font-medium">18</span>
            </div>
            <div className="flex justify-between items-center text-[13px] text-slate-700">
              <span>Seats Allocated</span>
              <span className="bg-purple-100 text-purple-700 rounded-full px-2.5 py-0.5 text-[11px] font-medium">18</span>
            </div>
          </div>
        </div>

        {/* Dispute Queue */}
        <div className="bg-white rounded-[14px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 p-5 flex flex-col">
          <div className="font-bold text-[14px] mb-1 text-slate-900">📬 Dispute Queue</div>
          <div className="text-[12px] text-slate-500 mb-4 border-b border-slate-100 pb-3">Active cases this semester</div>
          <div className="flex flex-col gap-4 flex-1">
            <div className="flex justify-between items-center text-[13px] text-slate-700">
              <span>CW Reopen Requests</span>
              <span className="bg-blue-100 text-blue-700 rounded-full px-2.5 py-0.5 text-[11px] font-medium">2</span>
            </div>
            <div className="flex justify-between items-center text-[13px] text-slate-700">
              <span>CW Delete Requests</span>
              <span className="bg-[#fef9c3] text-[#a16207] rounded-full px-2.5 py-0.5 text-[11px] font-medium">1</span>
            </div>
            <div className="flex justify-between items-center text-[13px] text-slate-700">
              <span>Reevaluation (Tier 1)</span>
              <span className="bg-orange-100 text-orange-700 rounded-full px-2.5 py-0.5 text-[11px] font-medium">4</span>
            </div>
            <div className="flex justify-between items-center text-[13px] text-slate-700">
              <span>Recheck (Tier 2)</span>
              <span className="bg-red-100 text-red-600 rounded-full px-2.5 py-0.5 text-[11px] font-medium">1</span>
            </div>
          </div>
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
