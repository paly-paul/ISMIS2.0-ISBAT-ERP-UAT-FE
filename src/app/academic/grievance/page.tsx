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
            <div className="pg-title">Grievance Management</div>
            <div className="pg-sub">Post-result student appeals · Grievance window from Intake Master</div>
          </div>
        </div>
        <div className="undefined-box">
          <div className="text-[var(--fs-stat)] mb-3"><i className="lni lni-volume-high"></i></div>
          <div className="font-extrabold text-[var(--fs-2xl)] text-g900 mb-2">Grievance Module</div>
          <div className="text-[var(--fs-base)] text-g500 mb-4 max-w-[480px] mx-auto">Grievance workflow details — student appeal process, re-check criteria, outcome recording, and notification flow — have <strong>not yet been covered in a KT session.</strong></div>
          <div className="badge badge-purple mb-3"><i className="lni lni-clipboard"></i> Module Not Yet Defined — Details to be captured in KT Session</div>
          <div className="text-[var(--fs-sm)] text-g400">Known facts: Students submit grievance before the Grievance End Date. Appeals are processed post-result publication.</div>
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}
