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
            <div className="pg-title">Academic Access Gate</div>
            <div className="pg-sub">Cross-module · Interacts with S3 (Finance) and S10 (Student) · Controls attendance and LMS access based on payment status</div>
          </div>
          <span className="badge badge-purple self-center"><i className="lni lni-link"></i> S2 + S3 + S10</span>
        </div>

        <div className="danger-box mb-[18px]">
          <i className="lni lni-lock"></i> <span><strong>Access Block Rule:</strong> Non-payment of the <em>current semester fee</em> results in an <strong>absolute block</strong> on the student&apos;s access to both class attendance and the LMS. This is separate from the 50% assessment submission threshold — full non-payment blocks everything. <strong>Sponsorship status bypasses all payment checks.</strong></span>
        </div>

        <div className="g3 mb-[18px]">
          <div className="p-4 bg-[var(--red-bg)] border-2 border-[var(--red-bd)] rounded-[var(--radius)]">
            <div className="text-[var(--fs-xs)] font-bold uppercase text-clr-red mb-2"><i className="lni lni-ban"></i> Fee Not Paid → BLOCKED</div>
            <div className="text-[var(--fs-sm)] text-[#7f1d1d] flex flex-col gap-[5px]">
              <div><i className="lni lni-close"></i> Class Attendance (biometric + manual)</div>
              <div><i className="lni lni-close"></i> LMS Access (materials, submissions)</div>
              <div><i className="lni lni-close"></i> Assessment Submission (CW + CBT)</div>
              <div><i className="lni lni-close"></i> Progression to next semester</div>
            </div>
          </div>
          <div className="p-4 bg-[var(--amber-bg)] border-2 border-[var(--amber-bd)] rounded-[var(--radius)]">
            <div className="text-[var(--fs-xs)] font-bold uppercase text-clr-amber mb-2"><i className="lni lni-warning"></i> ≥50% Fee Paid → PARTIAL</div>
            <div className="text-[var(--fs-sm)] text-[#78350f] flex flex-col gap-[5px]">
              <div><i className="lni lni-checkmark"></i> Class Attendance allowed</div>
              <div><i className="lni lni-checkmark"></i> LMS view access (read-only)</div>
              <div><i className="lni lni-checkmark"></i> Assessment question viewing</div>
              <div><i className="lni lni-close"></i> Assessment submission blocked</div>
            </div>
            <div className="text-[var(--fs-xs)] text-clr-amber mt-2 italic">50% threshold on original pre-discount fee</div>
          </div>
          <div className="p-4 bg-[var(--green-bg)] border-2 border-[var(--green-bd)] rounded-[var(--radius)]">
            <div className="text-[var(--fs-xs)] font-bold uppercase text-clr-green mb-2"><i className="lni lni-checkmark-circle"></i> Sponsored Student → FULL ACCESS</div>
            <div className="text-[var(--fs-sm)] text-[#064e3b] flex flex-col gap-[5px]">
              <div><i className="lni lni-checkmark"></i> All payment gates bypassed</div>
              <div><i className="lni lni-checkmark"></i> Assessment submission allowed</div>
              <div><i className="lni lni-checkmark"></i> Session progression bypassed</div>
              <div><i className="lni lni-checkmark"></i> Full LMS access</div>
            </div>
            <div className="text-[var(--fs-xs)] text-clr-green mt-2 italic">Sponsorship verified from Finance Module (S3)</div>
          </div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-dollar"></i></span> Finance Auto-Settlement Priority Reference (S3)</div>
            <span className="badge badge-purple">Read-only — Owned by Finance Module</span>
          </div>
          <div className="info-box mb-[14px]">
            <i className="lni lni-credit-cards"></i> <span>When a student pays a <strong>lump sum in any currency</strong>, the system auto-converts to base currency (USD for international) and settles fee components in strict priority order. Remaining balance applied to next priority only after full clearance of current.</span>
          </div>
          <div className="g3">
            <div className="p-[14px] bg-b50 border-[1.5px] border-[var(--b100)] rounded-[var(--rsm)] text-center">
              <div className="text-[var(--fs-2xs)] font-bold uppercase text-b700 mb-[6px]">PRIORITY 1</div>
              <div className="text-[var(--fs-lg)] font-extrabold text-b800">Admission Fee</div>
              <div className="text-[var(--fs-base)] font-bold text-b700 mt-1 font-mono">$50 / UGX 50,000</div>
              <div className="text-[var(--fs-xs)] text-g400 mt-1">One-time at application</div>
            </div>
            <div className="p-[14px] bg-[var(--amber-bg)] border-[1.5px] border-[var(--amber-bd)] rounded-[var(--rsm)] text-center">
              <div className="text-[var(--fs-2xs)] font-bold uppercase text-clr-amber mb-[6px]">PRIORITY 2</div>
              <div className="text-[var(--fs-lg)] font-extrabold text-clr-amber">Registration / Entry Fee</div>
              <div className="text-[var(--fs-base)] font-bold text-clr-amber mt-1 font-mono">$200 initial / Entry fee per sem</div>
              <div className="text-[var(--fs-xs)] text-g400 mt-1">Required before registration</div>
            </div>
            <div className="p-[14px] bg-[var(--green-bg)] border-[1.5px] border-[var(--green-bd)] rounded-[var(--rsm)] text-center">
              <div className="text-[var(--fs-2xs)] font-bold uppercase text-clr-green mb-[6px]">PRIORITY 3</div>
              <div className="text-[var(--fs-lg)] font-extrabold text-clr-green">Tuition Fee</div>
              <div className="text-[var(--fs-base)] font-bold text-clr-green mt-1 font-mono">$750 / semester</div>
              <div className="text-[var(--fs-xs)] text-g400 mt-1">50% needed for assessment; 100% for progression</div>
            </div>
          </div>
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}
