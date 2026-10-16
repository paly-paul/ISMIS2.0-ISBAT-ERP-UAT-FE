'use client'
import { useLayoutEffect, useRef, useState } from 'react'
import { ModalProps } from '../types'
import { useProgramFeeLines, ProgramFeeStructureHeader } from '@/hooks/academic/useProgramFeeStructure'
import { useProgramMasters } from '@/hooks/academic/useProgramMaster'
import { useProgramApprovals } from '@/hooks/academic/useProgramApproval'
import { useIntakesByGuids } from '@/hooks/academic/useIntakes'
import { useSemestersForProgram } from '@/hooks/academic/useSemesters'
import { FailurePopup } from '../shared/FailurePopup'
import { AuthError } from '@/lib/api/client'

interface ViewFeeStructureModalProps extends ModalProps {
  feeStructure?: ProgramFeeStructureHeader
  onEdit?: (feeStructure: ProgramFeeStructureHeader) => void
}

type Tab = 'details' | 'discounts' | 'semesters'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'details', label: 'Basic Details', icon: 'lni-information' },
  { id: 'discounts', label: 'Fees & Discounts', icon: 'lni-tag' },
  { id: 'semesters', label: 'Semester Fees', icon: 'lni-coin' },
]

// Layout, tabs, fields and empty states mirror ViewProgrammeModal /
// ViewCourseUnitModal so the View modals read as one family.
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--g500)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--g900)', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="sec-divider" style={{ gridColumn: '1 / -1', marginTop: 6, marginBottom: 0 }}>{children}</div>
}

function EmptyPanel({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 16px', border: '1.5px dashed var(--g200)', borderRadius: 'var(--rsm)', color: 'var(--g500)', fontSize: 13 }}>
      <i className={`lni ${icon}`} style={{ fontSize: 28, color: 'var(--g300)', display: 'block', marginBottom: 8 }} aria-hidden="true" />
      {children}
    </div>
  )
}

const plural = (n: number, word: string) => `${n} ${word}${n !== 1 ? 's' : ''}`
const PANEL_PADDING = '20px clamp(14px, 4vw, 24px)'

export function ViewFeeStructureModal({ isOpen, onClose, feeStructure, onEdit }: ViewFeeStructureModalProps) {
  const { data: feeLines = [], isLoading: feeLinesLoading, isError: feeLinesError, error: feeLinesErrorObj } = useProgramFeeLines(feeStructure?.feeHdGuid ?? null, isOpen && !!feeStructure)

  const { data: programs = [] } = useProgramMasters(isOpen)
  // GET /api/v1/academic/program-master only ever lists approved programmes
  // (see programme-approval/page.tsx — a programme sits under the separate
  // not-approved list until someone approves it). A fee structure can
  // already be attached to a programme that's still pending approval, so a
  // plain programs.find() against that approved-only list came back empty —
  // "— (—)" — for one of those. Fall back to the not-approved list before
  // giving up, same guid shape either way.
  const { data: notApprovedData } = useProgramApprovals(1, 1000)
  const notApprovedPrograms = notApprovedData?.items ?? []
  // Resolves just this one record's own intakeGuid (2026-09-10) instead of
  // useIntakes(isOpen)'s full 1000-row snapshot fetched just to look up a
  // single guid — same batched-by-guid convention as ViewProgrammeModal.
  const intakesByGuid = useIntakesByGuids(feeStructure?.intakeGuid ? [feeStructure.intakeGuid] : [])
  const { data: semesters = [] } = useSemestersForProgram(feeStructure?.programGuid ?? '', isOpen && !!feeStructure?.programGuid)

  const [activeTab, setActiveTab] = useState<Tab>('details')

  // Same sliding underline as ViewProgrammeModal.
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement>>>({})
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  useLayoutEffect(() => {
    const el = tabRefs.current[activeTab]
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [activeTab, isOpen, feeLinesLoading])

  if (!isOpen || !feeStructure) return null

  function handleClose() {
    setActiveTab('details')
    onClose()
  }

  if (feeLinesError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Fee Lines"
            subtitle={feeLinesErrorObj instanceof AuthError ? (feeLinesErrorObj.message || 'Failed to load details.') : 'Failed to load details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  const header = (
    <div className="modal-hdr modal-hdr-blue">
      <div className="modal-title"><i className="lni lni-eye"></i> View Fee Structure &mdash; <span className="font-mono">{feeStructure.feeCode}</span></div>
      <button className="modal-close" onClick={handleClose} aria-label="Close"><i className="lni lni-close"></i></button>
    </div>
  )

  if (feeLinesLoading) {
    return (
      <div className="modal-overlay open" id="view-feestruct-modal">
        <div className="modal modal-80 modal-flex" onClick={e => e.stopPropagation()}>
          {header}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <span style={{ color: 'var(--g400)' }}>Loading fee structure details…</span>
          </div>
        </div>
      </div>
    )
  }

  const matchedProgram = programs.find(p => p.programGuid === feeStructure.programGuid)
    ?? notApprovedPrograms.find(p => p.programGuid === feeStructure.programGuid)
  const programName = matchedProgram?.programName || '—'
  const programCode = matchedProgram?.programCode
  const intakeName = (feeStructure.intakeGuid ? intakesByGuid.get(feeStructure.intakeGuid) : undefined)?.description || '—'
  const isPercentage = feeStructure.calcType === 2

  return (
    <div className="modal-overlay open" id="view-feestruct-modal">
      {/* modal-flex's fixed 85vh (no height: auto override) so switching tabs
          doesn't resize the modal — each panel scrolls its own content. */}
      <div className="modal modal-80 modal-flex" onClick={e => e.stopPropagation()}>
        {header}

        <div className="tab-bar" role="tablist" aria-label="Fee structure details" style={{ flexShrink: 0, padding: 0, background: 'var(--surface)' }}>
          {TABS.map(t => {
            const active = activeTab === t.id
            const count = t.id === 'semesters' ? semesters.length : 0
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                ref={el => { if (el) tabRefs.current[t.id] = el }}
                className={`tab-btn${active ? ' active' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setActiveTab(t.id)}
              >
                <i className={`lni ${t.icon}`} aria-hidden="true" /> {t.label}
                {count > 0 && <span className={`badge ${active ? 'badge-blue' : 'badge-grey'}`}>{count}</span>}
              </button>
            )
          })}
          <span className="tab-indicator" style={{ left: indicator.left, width: indicator.width }} />
        </div>

        {/* ── Basic Details ── */}
        {activeTab === 'details' && (
          <div key="details" className="modal-scroll tab-panel-in" style={{ padding: PANEL_PADDING }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', rowGap: 20, columnGap: 24 }}>
              <Field label="Programme" value={<>{programName}{programCode && <> <span className="font-mono" style={{ color: 'var(--g500)' }}>({programCode})</span></>}</>} />
              <Field label="Intake" value={intakeName} />
              <Field label="Fee Code" value={<span className="font-mono">{feeStructure.feeCode}</span>} />
              <Field label="Fee Description" value={feeStructure.feeDesc || '—'} />
              <Field label="Base Currency" value={feeStructure.localOrForeign ? 'Foreign' : 'Local'} />
              <Field
                label="Status"
                value={feeStructure.status ? <span className="badge badge-green"><span className="bdot"></span>Active</span> : <span className="badge badge-grey">Inactive</span>}
              />
            </div>
          </div>
        )}

        {/* ── Fees & Discounts ── */}
        {activeTab === 'discounts' && (
          <div key="discounts" className="modal-scroll tab-panel-in" style={{ padding: PANEL_PADDING }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', rowGap: 20, columnGap: 24 }}>
              <SectionTitle>Lumpsum Discount</SectionTitle>
              <Field label="Discount Type" value={isPercentage ? 'Percentage' : 'Amount'} />
              <Field label="Discount Value" value={`${feeStructure.amtPer ?? 0}${isPercentage ? '%' : ''}`} />

              <SectionTitle>Programme-level Fees</SectionTitle>
              <Field label="Lateral Entry Fee" value={feeStructure.lef ?? 0} />
              <Field label="Credit Exemption Fee" value={feeStructure.cef ?? 0} />
              <Field label="Aptech Credit Exemption Fee" value={feeStructure.ace ?? 0} />
            </div>
          </div>
        )}

        {/* ── Semester Fees: each semester's ledger lines, in priority order ── */}
        {activeTab === 'semesters' && (
          <div key="semesters" className="modal-scroll tab-panel-in" style={{ padding: PANEL_PADDING }}>
            {semesters.length === 0 ? (
              <EmptyPanel icon="lni-coin">No semesters have been set up for this programme.</EmptyPanel>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {semesters.map((sem, si) => {
                  const items = feeLines.filter(f => f.semesterGuid === sem.semesterGuid)
                  const total = items.reduce((sum, f) => sum + (f.amount || 0), 0)
                  return (
                    <div key={sem.semesterGuid}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span className="badge badge-blue">Sem {si + 1}</span>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--g800)' }}>{sem.semName}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--g500)', fontVariantNumeric: 'tabular-nums' }}>
                          {items.length > 0 ? `${plural(items.length, 'item')} · ${total.toLocaleString()} ${items[0]?.currencyName ?? ''}` : 'No items'}
                        </span>
                      </div>
                      {items.length > 0 && (
                        <ol style={{ listStyle: 'none', margin: 0, padding: 0, border: '1px solid var(--g200)', borderRadius: 'var(--rsm)' }}>
                          {items.map((f, idx) => (
                            <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderBottom: idx < items.length - 1 ? '1px solid var(--g100)' : 'none', fontSize: 13 }}>
                              <span className="font-mono" style={{ minWidth: 22, textAlign: 'right', color: 'var(--g400)' }} title="Ledger priority">{f.ledgerNum}.</span>
                              {/* ledgerName/currencyName come straight off the fee-line response
                                  itself (confirmed field, see ProgramFeeLineDetail) — no need to
                                  cross-reference the separate ledgers/financeCurrencies lists,
                                  which don't necessarily contain every ledger/currency this
                                  programme's fee lines reference. */}
                              <span style={{ flex: 1, minWidth: 0, color: 'var(--g800)' }}>{f.ledgerName || '—'}</span>
                              <span style={{ fontWeight: 600, color: 'var(--g900)', fontVariantNumeric: 'tabular-nums' }}>
                                {(f.amount || 0).toLocaleString()} <span style={{ color: 'var(--g500)', fontWeight: 500 }}>{f.currencyName || ''}</span>
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="modal-footer">
          <span className="text-sm" style={{ color: 'var(--g500)' }}>
            {plural(semesters.length, 'semester')} · {plural(feeLines.length, 'fee line')}
          </span>
          <span className="flex-1"></span>
          {onEdit && (
            <button className="btn btn-neu" onClick={() => onEdit(feeStructure)}>
              <i className="lni lni-pencil"></i> Edit Details
            </button>
          )}
          <button className="btn btn-primary" onClick={handleClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
