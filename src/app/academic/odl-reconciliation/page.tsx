'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'

export default function Page() {
  const router = useRouter()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)

  function nav(id: string) { router.push('/academic/' + id) }
  function openModal(id: string) { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">ODL Payment Reconciliation</div>
            <div className="pg-sub">Accounts team manually reconciles DPO payments · Moves confirmed applicants to regular application form</div>
          </div>
          <button className="btn btn-neu" onClick={() => nav('odl-applications')}>← ODL Applications</button>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-credit-cards"></i></span> Pending Reconciliation (4)</div>
            <span className="badge badge-amber">Accounts Action Required</span>
          </div>
          <div className="flex flex-col gap-[10px]">

            <div className="border-[1.5px] border-g200 rounded-[var(--rsm)] p-4 bg-surface">
              <div className="flex items-start justify-between flex-wrap gap-[10px]">
                <div>
                  <div className="flex items-center gap-2 mb-[6px]">
                    <span className="font-bold text-[var(--fs-md)]">Ssebulime Patrick</span>
                    <span className="font-mono text-[var(--fs-xs)] text-b700">ODL-2026-001</span>
                    <span className="badge badge-purple">Pending Recon.</span>
                  </div>
                  <div className="flex gap-4 flex-wrap text-[var(--fs-sm)] text-g500">
                    <span><i className="lni lni-envelope"></i> patrick.ss@gmail.com</span>
                    <span><i className="lni lni-book"></i> MBA ODL</span>
                    <span><i className="lni lni-credit-cards"></i> DPO Token: <span className="font-mono text-b700">TKN-4829</span></span>
                    <span><i className="lni lni-calendar"></i> Paid: 10 Apr 2026</span>
                    <span><i className="lni lni-dollar"></i> Amount: UGX 50,000</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-neu btn-sm" onClick={() => showToast('Viewing DPO transaction TKN-4829...', 'success')}><i className="lni lni-search-alt"></i> Verify Token</button>
                  <button className="btn btn-danger btn-sm" onClick={() => showToast('Reconciliation rejected. Applicant notified.', 'warn')}><i className="lni lni-close"></i> Reject</button>
                  <button className="btn btn-success btn-sm" onClick={() => showToast('ODL-2026-001 reconciled. Ssebulime Patrick moved to regular application.', 'success')}><i className="lni lni-checkmark"></i> Confirm Reconciled</button>
                </div>
              </div>
            </div>

            <div className="border-[1.5px] border-g200 rounded-[var(--rsm)] p-4 bg-surface">
              <div className="flex items-start justify-between flex-wrap gap-[10px]">
                <div>
                  <div className="flex items-center gap-2 mb-[6px]">
                    <span className="font-bold text-[var(--fs-md)]">Nakiyaga Flavia</span>
                    <span className="font-mono text-[var(--fs-xs)] text-b700">ODL-2026-002</span>
                    <span className="badge badge-purple">Pending Recon.</span>
                  </div>
                  <div className="flex gap-4 flex-wrap text-[var(--fs-sm)] text-g500">
                    <span><i className="lni lni-envelope"></i> f.nakiyaga@email.com</span>
                    <span><i className="lni lni-book"></i> BSc. IT ODL</span>
                    <span><i className="lni lni-credit-cards"></i> DPO Token: <span className="font-mono text-b700">TKN-4831</span></span>
                    <span><i className="lni lni-calendar"></i> Paid: 11 Apr 2026</span>
                    <span><i className="lni lni-dollar"></i> Amount: UGX 50,000</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-neu btn-sm" onClick={() => showToast('Viewing DPO transaction TKN-4831...', 'success')}><i className="lni lni-search-alt"></i> Verify Token</button>
                  <button className="btn btn-danger btn-sm" onClick={() => showToast('Reconciliation rejected.', 'warn')}><i className="lni lni-close"></i> Reject</button>
                  <button className="btn btn-success btn-sm" onClick={() => showToast('ODL-2026-002 reconciled. Nakiyaga Flavia moved to regular application.', 'success')}><i className="lni lni-checkmark"></i> Confirm Reconciled</button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}
