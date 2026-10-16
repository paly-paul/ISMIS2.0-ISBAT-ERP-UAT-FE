'use client'
import { useEffect, useState } from 'react'
import { Toast } from '@/components/Toast'
import { PaymentSuccessModal } from '@/components/modals/finance/PaymentSuccessModal'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import { RejectedTab } from './_components/RejectedTab'
import { PassoutLibraryDepositTab } from './_components/PassoutLibraryDepositTab'
import { FakeCertTab } from './_components/FakeCertTab'

// Dev-only toggle between real API data and the seeded, in-memory mock data
// in ./_components/mockData.ts — separate from the app-wide, build-time
// NEXT_PUBLIC_AUTH_MOCK flag, so the whole 3-tab refund flow can be clicked
// through with no backend at all (useful when the dev gateway doesn't have
// the right seed data for one of the three refund-eligibility categories
// yet). Never rendered in production. Persisted in localStorage purely as a
// per-browser dev convenience — never a source of truth, so every read is
// wrapped in try/catch and falls back to API mode on any failure (private
// browsing, blocked storage, etc.).
const MOCK_MODE_STORAGE_KEY = 'isbat_payment_refund_mock_mode'
const SHOW_MOCK_TOGGLE = process.env.NODE_ENV !== 'production'

function readStoredMockMode(): boolean {
  if (!SHOW_MOCK_TOGGLE || typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(MOCK_MODE_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

// Rebuilt 2026-09-15 against the Refund-Eligibility Search API set (repo
// root) — the page changed from one flat "search any student, pick a
// ledger" form into three distinct eligibility-search tabs, one per refund
// category the business actually works from:
//   1. Rejected by Registrar     — refund whatever a rejected applicant
//                                  paid before rejection (main ledger).
//   2. Passout / Library Deposit — bulk-refund Library Deposit lines for
//                                  students who have passed out.
//   3. Fake-Certificate Termination — refund students terminated
//                                  mid-program for a fabricated certificate.
// Each category has its own search endpoint (its own DTO shape — none of
// them return the same fields), so a single generic search box could no
// longer cover all three. Categories 1 and 3 share the single-application,
// pick-one-ledger-line flow (RefundLedgerPicker in ./_components/shared);
// Category 2 is a bulk, multi-student flow with its own component.

// Permission gating on this page's Submit/bulk-refund buttons is commented
// out per request — every tab's `permissionsCreate` prop below is hardcoded
// `true` instead of reading `permissions.add`, in both Mock Data and Live
// API mode (the toggle only ever swapped what feeds the data, never touched
// this permission source, so the same override covers both). Restore real
// gating by swapping the commented line back in below.
const FORCE_ENABLE_REFUND_BUTTONS = true

type Tab = 'rejected' | 'passout' | 'fake-cert'
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'passout',   label: 'Passout / Library Deposit',  icon: 'lni-graduation' },
  { id: 'rejected',  label: 'Rejected by Registrar',      icon: 'lni-cross-circle' },
  { id: 'fake-cert', label: 'Fake-Certificate Termination', icon: 'lni-shield' },
]

export default function PaymentRefundPage() {
  const permissions = usePagePermissions()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const [successModal, setSuccessModal] = useState<{ title: string; rows: [string, string][] } | null>(null)
  function handleRefunded(rows: [string, string][]) {
    setSuccessModal({ title: 'Refund Recorded', rows })
  }

  const [activeTab, setActiveTab] = useState<Tab>('passout')

  // Starts false on every render (server and first client render must
  // match) and is corrected from localStorage right after mount — avoids a
  // hydration mismatch from reading window.localStorage during render.
  const [useMock, setUseMock] = useState(false)
  useEffect(() => { setUseMock(readStoredMockMode()) }, [])

  function toggleMockMode() {
    const next = !useMock
    setUseMock(next)
    try { window.localStorage.setItem(MOCK_MODE_STORAGE_KEY, String(next)) } catch { /* best-effort only */ }
    showToast(next ? 'Using mock data (dev only) — no API calls will be made.' : 'Using live API data.', next ? 'warn' : 'success')
  }

  return (
    <>
      <div className="page active" id="page-payment-refund">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Payment Console - Refund</div>
            <div className="pg-sub">Search a refund-eligible category → pick a payment → record the refund</div>
          </div>
          <div className="flex items-center gap-3">
            {SHOW_MOCK_TOGGLE && (
              <label
                className="flex items-center gap-2 cursor-pointer"
                style={{ fontSize: 12, color: 'var(--g500)' }}
                title="Dev only — switches every search/refund action on this page between the real API and seeded, in-memory mock data. Never shown in production."
              >
                <span>{useMock ? 'Mock Data' : 'Live API'}</span>
                <span
                  role="switch"
                  aria-checked={useMock}
                  onClick={toggleMockMode}
                  style={{
                    position: 'relative', width: 36, height: 20, borderRadius: 999, cursor: 'pointer',
                    background: useMock ? 'var(--amber)' : 'var(--g300)', transition: 'background .15s',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2, left: useMock ? 18 : 2, width: 16, height: 16, borderRadius: '50%',
                    background: 'var(--white)', transition: 'left .15s', boxShadow: 'var(--neu-sm)',
                  }} />
                </span>
              </label>
            )}          </div>
        </div>

        {SHOW_MOCK_TOGGLE && useMock && (
          <div className="info-box mb-5"><i className="lni lni-warning"></i> Mock Data mode is on (dev only) — every search/refund action below uses seeded, in-memory data, not the real API.</div>
        )}

        {/* .pc-tabs/.pc-tab-btn — same pill switcher Payment Console uses
            for its own Semester Payment / Other Payment tabs, in place of
            the generic .tab-bar sliding-indicator style used elsewhere. */}
        <div className="pc-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`pc-tab-btn${activeTab === t.id ? ' active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {/* Fixed, slightly-larger-than-text size (inline, scoped to
                  just this page's tab icons rather than the shared
                  .pc-tab-btn rule) — LineIcons glyphs aren't drawn at
                  consistent visual weight/size at a shared font-size;
                  lni-cross-circle in particular reads noticeably smaller
                  than lni-graduation/lni-shield otherwise. lineHeight: 1
                  strips the font's default extra leading, which is what
                  was pushing the enlarged glyph's box (and so its
                  flex-centered position) out of line with the label text
                  next to it. */}
              <i className={`lni ${t.icon}`} style={{ fontSize: 16, lineHeight: 1 }}></i> {t.label}
            </button>
          ))}
        </div>

        <div key={activeTab} className="tab-panel-in">
          {activeTab === 'rejected' && (
            <RejectedTab showToast={showToast} permissionsCreate={FORCE_ENABLE_REFUND_BUTTONS /* was: permissions.add */} onRefunded={handleRefunded} useMock={useMock} />
          )}
          {activeTab === 'passout' && (
            <PassoutLibraryDepositTab showToast={showToast} permissionsCreate={FORCE_ENABLE_REFUND_BUTTONS /* was: permissions.add */} useMock={useMock} />
          )}
          {activeTab === 'fake-cert' && (
            <FakeCertTab showToast={showToast} permissionsCreate={FORCE_ENABLE_REFUND_BUTTONS /* was: permissions.add */} onRefunded={handleRefunded} useMock={useMock} />
          )}
        </div>
      </div>

      <PaymentSuccessModal
        isOpen={!!successModal}
        onClose={() => setSuccessModal(null)}
        showToast={showToast}
        title={successModal?.title ?? ''}
        rows={successModal?.rows ?? []}
      />
      <Toast toast={toast} />
    </>
  )
}
