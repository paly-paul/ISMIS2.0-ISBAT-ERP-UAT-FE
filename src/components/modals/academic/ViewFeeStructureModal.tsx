'use client'
import { useState } from 'react'
import { ModalProps } from '../types'
import { useProgramFeeLines, ProgramFeeStructureHeader } from '@/hooks/academic/useProgramFeeStructure'
import { useProgramMasters } from '@/hooks/academic/useProgramMaster'
import { useProgramApprovals } from '@/hooks/academic/useProgramApproval'
import { useIntakes } from '@/hooks/academic/useIntakes'
import { useSemestersForProgram } from '@/hooks/academic/useSemesters'
import { FailurePopup } from '../shared/FailurePopup'
import { AuthError } from '@/lib/api/client'

interface ViewFeeStructureModalProps extends ModalProps {
  feeStructure?: ProgramFeeStructureHeader
  onEdit?: (feeStructure: ProgramFeeStructureHeader) => void
}

export function ViewFeeStructureModal({ isOpen, onClose, feeStructure, onEdit }: ViewFeeStructureModalProps) {
  const { data: feeLines = [], isLoading: feeLinesLoading, isError: feeLinesError, error: feeLinesErrorObj } = useProgramFeeLines(feeStructure?.feeHdGuid ?? null, isOpen && !!feeStructure)

  const { data: programs = [] } = useProgramMasters()
  // GET /api/v1/academic/program-master only ever lists approved programmes
  // (see programme-approval/page.tsx — a programme sits under the separate
  // not-approved list until someone approves it). A fee structure can
  // already be attached to a programme that's still pending approval, so a
  // plain programs.find() against that approved-only list came back empty —
  // "— (—)" — for one of those. Fall back to the not-approved list before
  // giving up, same guid shape either way.
  const { data: notApprovedData } = useProgramApprovals(1, 1000)
  const notApprovedPrograms = notApprovedData?.items ?? []
  const { data: intakes = [] } = useIntakes()
  const { data: semesters = [] } = useSemestersForProgram(feeStructure?.programGuid ?? '', isOpen && !!feeStructure?.programGuid)

  const [activeSection, setActiveSection] = useState<'details' | 'discounts' | 'semesters'>('details')
  const [feeAccordion, setFeeAccordion] = useState(0)

  if (!isOpen || !feeStructure) return null

  if (feeLinesError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Fee Lines"
            subtitle={feeLinesErrorObj instanceof AuthError ? (feeLinesErrorObj.message || 'Failed to load details.') : 'Failed to load details.'}
            onClose={onClose}
          />
        </div>
      </div>
    )
  }

  const matchedProgram = programs.find(p => p.programGuid === feeStructure.programGuid)
    ?? notApprovedPrograms.find(p => p.programGuid === feeStructure.programGuid)
  const programName = matchedProgram?.programName || '—'
  const programCode = matchedProgram?.programCode || '—'
  const intakeName = intakes.find(i => i.intakeGuid === feeStructure.intakeGuid)?.description || '—'

  return (
    <div className="modal-overlay open" id="view-feestruct-modal">
      {/* height: auto (capped by maxHeight, overriding modal-flex's fixed
          height: 85vh) so a short tab — Basic Details / Fees & Discounts,
          nowhere near 85vh of content — doesn't leave a big empty gap above
          the footer; a genuinely tall tab (Semester Fees with many items)
          still caps out and scrolls inside .modal-scroll same as before.
          Same fix as ViewProgrammeModal, which has the identical tabbed
          structure. */}
      <div className="modal modal-80 modal-flex" style={{ height: 'auto', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Fee Structure — <span className="font-mono">{feeStructure.feeCode}</span></div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        {feeLinesLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240, flex: 1 }}>
            <span style={{ color: 'var(--g400)' }}>Loading fee structure details…</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Horizontal Tabs */}
            <div style={{ 
              display: 'flex', 
              borderBottom: '1px solid var(--g200)', 
              padding: '0 24px', 
              gap: 0,
              background: '#fafafa',
              flexShrink: 0
            }}>
              <div
                onClick={() => setActiveSection('details')}
                style={{
                  flex: 1, justifyContent: 'center',
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '16px 0',
                  background: activeSection === 'details' ? 'var(--b50)' : 'transparent',
                  borderBottom: activeSection === 'details' ? '2px solid var(--b500)' : '2px solid transparent',
                  color: activeSection === 'details' ? 'var(--b700)' : 'var(--g600)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer', transition: 'all .15s'
                }}
              >
                <i className="lni lni-information" style={{ fontSize: 16 }}></i>
                Basic Details
              </div>
              
              <div
                onClick={() => setActiveSection('discounts')}
                style={{
                  flex: 1, justifyContent: 'center',
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '16px 0',
                  background: activeSection === 'discounts' ? 'var(--b50)' : 'transparent',
                  borderBottom: activeSection === 'discounts' ? '2px solid var(--b500)' : '2px solid transparent',
                  color: activeSection === 'discounts' ? 'var(--b700)' : 'var(--g600)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer', transition: 'all .15s'
                }}
              >
                <i className="lni lni-tag" style={{ fontSize: 16 }}></i>
                Fees &amp; Discounts
              </div>

              <div
                onClick={() => setActiveSection('semesters')}
                style={{
                  flex: 1, justifyContent: 'center',
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '16px 0',
                  background: activeSection === 'semesters' ? 'var(--b50)' : 'transparent',
                  borderBottom: activeSection === 'semesters' ? '2px solid var(--b500)' : '2px solid transparent',
                  color: activeSection === 'semesters' ? 'var(--b700)' : 'var(--g600)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer', transition: 'all .15s'
                }}
              >
                <i className="lni lni-coin" style={{ fontSize: 16 }}></i>
                Semester Fees
              </div>
            </div>

            <div className="modal-scroll" style={{ padding: '24px', flex: 1, overflowY: 'auto', background: '#fff' }}>
              {activeSection === 'details' && (
                <>
                  <div className="view-detail-grid">
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Programme</div>
                      <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>
                        {programName} ({programCode})
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Intake</div>
                      <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>
                        {intakeName}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Fee Code</div>
                      <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
                        {feeStructure.feeCode}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Fee Description</div>
                      <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>
                        {feeStructure.feeDesc || '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Base Currency</div>
                      <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>
                        {feeStructure.localOrForeign ? 'Foreign' : 'Local'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Status</div>
                      <div>
                        {feeStructure.status ? <span className="badge badge-green"><span className="bdot"></span>Active</span> : <span className="badge badge-grey">Inactive</span>}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeSection === 'discounts' && (
                <>
                  <div className="view-detail-grid">
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Lumpsum Discount Type</div>
                      <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>
                        {feeStructure.calcType === 2 ? 'Percentage' : 'Amount'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Lumpsum Discount Value</div>
                      <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>
                        {feeStructure.amtPer ?? '0'} {feeStructure.calcType === 2 ? '%' : ''}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Lateral Entry Fee</div>
                      <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>
                        {feeStructure.lef ?? '0'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Credit Exemption Fee</div>
                      <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>
                        {feeStructure.cef ?? '0'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Aptech Credit Exemption Fee</div>
                      <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>
                        {feeStructure.ace ?? '0'}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeSection === 'semesters' && (
                <>
                  {semesters.length === 0 && (
                    <div className="text-g400 italic text-sm mt-4">No semesters found for this programme.</div>
                  )}
                  <div className="flex flex-col gap-2">
                    {semesters.map((sem, si) => {
                      const isOpen = feeAccordion === si
                      const items = feeLines.filter(f => f.semesterGuid === sem.semesterGuid) || []
                      const total = items.reduce((s, f) => s + (f.amount || 0), 0)
                      const totalCurrencyCode = items[0]?.currencyName ?? ''

                      return (
                        <div key={sem.semesterGuid} style={{ border: '1.5px solid var(--b100)', borderRadius: 'var(--rsm)', overflow: 'hidden' }}>
                          <button
                            type="button"
                            onClick={() => setFeeAccordion(isOpen ? -1 : si)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', width: '100%', background: isOpen ? 'var(--b50)' : 'var(--white)', border: 'none', borderBottom: isOpen ? '1px solid var(--b100)' : 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
                          >
                            <span className="badge badge-blue" style={{ flexShrink: 0 }}>Sem {si + 1}</span>
                            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--b700)' }}>{sem.semName}</span>
                            {items.length > 0
                              ? <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--g400)', marginRight: 8 }}>{items.length} item{items.length !== 1 ? 's' : ''} · {total.toLocaleString()} {totalCurrencyCode}</span>
                              : <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--g400)', fontStyle: 'italic', marginRight: 8 }}>No items</span>
                            }
                            <i className="lni lni-chevron-down" style={{ fontSize: 11, color: 'var(--g400)', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }} />
                          </button>

                          <div style={{ overflow: 'hidden', maxHeight: isOpen ? 800 : 0, transition: 'max-height 0.3s ease' }}>
                            <div style={{ padding: '10px 14px' }}>
                              {items.length > 0 && (
                                <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 90px 130px', gap: 6, padding: '0 0 4px', fontSize: 10.5, fontWeight: 700, color: 'var(--g400)', letterSpacing: '0.05em' }}>
                                  <span style={{ textAlign: 'center' }}>Pri.</span><span>Ledger</span><span>Amount</span><span>Currency</span>
                                </div>
                              )}
                              <div className="flex flex-col gap-1">
                                {items.length === 0 && (
                                  <div className="text-g400 italic" style={{ fontSize: 12.5, marginBottom: 8 }}>No fee items for this semester.</div>
                                )}
                                {items.map((f, idx) => (
                                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 90px 130px', gap: 6, alignItems: 'center', background: 'var(--white)', border: '1px solid var(--g200)', borderRadius: 'var(--rxs)', padding: '6px 8px', fontSize: 12.5 }}>
                                    <div style={{ textAlign: 'center', fontWeight: 600, color: 'var(--g500)' }}>{f.ledgerNum}</div>
                                    {/* ledgerName/currencyName come straight off the fee-line response
                                        itself (confirmed field, see ProgramFeeLineDetail) — no need to
                                        cross-reference the separate ledgers/financeCurrencies lists,
                                        which don't necessarily contain every ledger/currency this
                                        programme's fee lines reference. */}
                                    <div style={{ fontWeight: 500, color: 'var(--g900)' }}>{f.ledgerName || '—'}</div>
                                    <div style={{ fontFamily: 'var(--font-mono)' }}>{f.amount}</div>
                                    <div>{f.currencyName || '—'}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="modal-footer" style={{ borderTop: '1px solid var(--g200)' }}>
          <span className="flex-1"></span>
          {onEdit && feeStructure && (
            <button className="btn btn-neu" style={{ marginRight: 8 }} onClick={() => onEdit(feeStructure)}>
              <i className="lni lni-pencil"></i> Edit
            </button>
          )}
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
