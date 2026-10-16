'use client'
import { useLayoutEffect, useRef, useState } from 'react'
import { ModalProps } from '../types'
import { useProgramMasterFullDetails } from '@/hooks/academic/useProgramMaster'
import { useProgramGroup } from '@/hooks/academic/useProgramGroups'
import { useProgramLevel } from '@/hooks/academic/useProgramLevels'
import { useFacultiesByGuids } from '@/hooks/config/useFaculties'
import { useIntakesByGuids } from '@/hooks/academic/useIntakes'
import { useLedgers } from '@/hooks/finance/useLedgers'
import { useFinanceCurrencies } from '@/hooks/finance/useFinanceCurrencies'
import { AuthError } from '@/lib/api/client'
import { FailurePopup } from '../shared/FailurePopup'
import { formatDate } from '@/lib/date'

interface ViewProgrammeModalProps extends ModalProps {
  programGuid: string | null
  onEdit?: (guid: string) => void
}

type Tab = 'overview' | 'units' | 'fees'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'lni-grid-alt' },
  { id: 'units', label: 'Course Unit Allocation', icon: 'lni-book' },
  { id: 'fees', label: 'Fee Structure', icon: 'lni-coin' },
]

// Layout, tabs, sidebar lists and empty states mirror ViewCourseUnitModal so
// the two View modals read as one family.
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

// One row in a .fsm-sidebar list: numbered/iconed circle, title, subtitle.
function SidebarItem({ active, badge, title, subtitle, onClick }: { active: boolean; badge: React.ReactNode; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active || undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', font: 'inherit',
        padding: '9px 10px', borderRadius: 'var(--rsm)', marginBottom: 2, border: 'none',
        background: active ? 'var(--b500)' : 'transparent',
        color: active ? '#fff' : 'var(--g700)',
        cursor: 'pointer', transition: 'background .15s',
      }}
    >
      <span style={{ width: 28, height: 28, borderRadius: '50%', background: active ? 'rgba(255,255,255,.2)' : 'var(--b100)', color: active ? '#fff' : 'var(--b700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700 }}>
        {badge}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 600, fontSize: 13, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        <span style={{ display: 'block', fontSize: 11, opacity: .7, lineHeight: 1.3 }}>{subtitle}</span>
      </span>
    </button>
  )
}

function SidebarHeading({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ padding: '14px 14px 6px', fontSize: 10.5, fontWeight: 700, color: 'var(--g400)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
      {label} <span style={{ color: 'var(--b500)' }}>({count})</span>
    </div>
  )
}

// The bordered strip above each main panel (same as a chapter's header).
function PanelHeader({ badge, title, meta }: { badge: string; title: string; meta: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', border: '1.5px solid var(--g200)', borderRadius: 'var(--rsm)', background: 'var(--surface)', marginBottom: 14 }}>
      <span className="badge badge-blue">{badge}</span>
      <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--g900)' }}>{title}</span>
      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--g500)' }}>{meta}</span>
    </div>
  )
}

const plural = (n: number, word: string) => `${n} ${word}${n !== 1 ? 's' : ''}`

export function ViewProgrammeModal({ isOpen, onClose, programGuid, onEdit }: ViewProgrammeModalProps) {
  const { data: program, isLoading, isError, error } = useProgramMasterFullDetails(programGuid, isOpen)

  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [activeSemIdx, setActiveSemIdx] = useState(0)
  const [activeFeeIdx, setActiveFeeIdx] = useState(0)

  // Same sliding underline as ViewCourseUnitModal.
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement>>>({})
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  useLayoutEffect(() => {
    const el = tabRefs.current[activeTab]
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [activeTab, isOpen, program])

  // Labels for just this programme's own guids, fetched by guid rather than
  // loading every group/level/faculty/intake.
  const { data: programGroup } = useProgramGroup(program?.programGroupGuid ?? null, isOpen && !!program)
  const { data: programLevel } = useProgramLevel(program?.programLevelGuid ?? null, isOpen && !!program)
  const facultiesByGuid = useFacultiesByGuids(program?.facultyGuid ? [program.facultyGuid] : [])
  const intakesByGuid = useIntakesByGuids(program?.intakeGuid ? [program.intakeGuid] : [])
  const { data: ledgers = [] } = useLedgers(isOpen)
  const { data: financeCurrencies = [] } = useFinanceCurrencies(isOpen)

  if (!isOpen) return null

  function handleClose() {
    setActiveTab('overview'); setActiveSemIdx(0); setActiveFeeIdx(0)
    onClose()
  }

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Programme"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load details.') : 'Failed to load details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !program) {
    return (
      <div className="modal-overlay open">
        <div className="modal modal-80 modal-flex" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Programme</div>
            <button className="modal-close" onClick={handleClose} aria-label="Close"><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <span style={{ color: 'var(--g400)' }}>Loading programme details…</span>
          </div>
        </div>
      </div>
    )
  }

  const groupName = programGroup?.groupName || '—'
  const levelName = programLevel?.levelName || '—'
  const facultyName = facultiesByGuid.get(program.facultyGuid)?.facultyName || '—'
  const intakeName = (program.intakeGuid ? intakesByGuid.get(program.intakeGuid) : undefined)?.description || '—'

  const semesters = program.semesters ?? []
  const programUnits = program.programUnits ?? []
  const feeStructures = program.feeStructures ?? []
  const activeSem = semesters[activeSemIdx] ?? semesters[0]
  const activeFee = feeStructures[activeFeeIdx] ?? feeStructures[0]

  const ledgerName = (guid: string) => ledgers.find(l => l.ledgerGuid === guid)?.ledgerName || '—'
  const currencyCode = (guid: string | null | undefined) => financeCurrencies.find(c => c.currencyGuid === guid)?.currencyCode ?? ''

  return (
    <div className="modal-overlay open">
      {/* modal-flex's fixed 85vh (no height: auto override) so switching tabs doesn't resize the modal —
          each panel is flex: 1 and scrolls its own content. */}
      <div className="modal modal-80 modal-flex" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Programme &mdash; <span className="font-mono">{program.programCode}</span></div>
          <button className="modal-close" onClick={handleClose} aria-label="Close"><i className="lni lni-close"></i></button>
        </div>

        <div className="tab-bar" role="tablist" aria-label="Programme details" style={{ flexShrink: 0, padding: 0, background: 'var(--surface)' }}>
          {TABS.map(t => {
            const active = activeTab === t.id
            const count = t.id === 'units' ? programUnits.length : t.id === 'fees' ? feeStructures.length : 0
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

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div key="overview" className="modal-scroll tab-panel-in" style={{ padding: '20px clamp(14px, 4vw, 24px)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', rowGap: 20, columnGap: 24 }}>
              <Field label="Programme Code" value={program.programCode} />
              <Field label="Programme Name" value={program.programName} />
              <Field label="Programme Group" value={groupName} />
              <Field label="Programme Level" value={levelName} />
              <Field label="Faculty" value={facultyName} />
              <Field label="Intake" value={intakeName} />
              <Field label="Total Course Units" value={program.unitCount ?? '—'} />
              <Field label="Accreditation Date" value={program.dateAcc ? formatDate(program.dateAcc) : '—'} />

              <SectionTitle>Status &amp; Flags</SectionTitle>
              <Field
                label="Admission Status"
                value={program.pgmStatus ? <span className="badge badge-green"><span className="bdot"></span>Active</span> : <span className="badge badge-grey">Inactive</span>}
              />
              <Field
                label="Internal Assessment"
                value={program.noIa ? <span className="badge badge-amber"><i className="lni lni-checkmark" aria-hidden="true" /> No Internal Assessment</span> : <span className="badge badge-grey">Standard</span>}
              />
            </div>
          </div>
        )}

        {/* ── Course Unit Allocation: semesters left, that semester's units right ── */}
        {activeTab === 'units' && (
          semesters.length === 0 ? (
            <div key="units-empty" className="modal-scroll tab-panel-in" style={{ padding: 24 }}>
              <EmptyPanel icon="lni-book">No semesters have been set up for this programme.</EmptyPanel>
            </div>
          ) : (
            <div key="units" className="fsm-layout tab-panel-in" style={{ padding: 0, minHeight: 260 }}>
              <div className="fsm-sidebar">
                <SidebarHeading label="Semesters" count={semesters.length} />
                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
                  {semesters.map((sem, si) => (
                    <SidebarItem
                      key={sem.semCode}
                      active={activeSemIdx === si}
                      badge={si + 1}
                      title={sem.semName}
                      subtitle={plural(programUnits.filter(u => u.semCode === sem.semCode).length, 'unit')}
                      onClick={() => setActiveSemIdx(si)}
                    />
                  ))}
                </div>
              </div>

              <div className="fsm-main">
                {activeSem && (() => {
                  const units = programUnits.filter(u => u.semCode === activeSem.semCode)
                  return (
                    <>
                      <PanelHeader badge={`SEM ${activeSemIdx + 1}`} title={activeSem.semName} meta={plural(units.length, 'course unit')} />
                      {units.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 16, color: 'var(--g400)', fontSize: 13, fontStyle: 'italic' }}>No course units in this semester.</div>
                      ) : (
                        <div className="tbl-wrap">
                          <table>
                            <thead>
                              <tr><th>Code</th><th>Course Unit Name</th><th>Type</th><th>Category</th><th>Specialization</th></tr>
                            </thead>
                            <tbody>
                              {units.map(u => (
                                <tr key={u.courseUnitGuid}>
                                  <td className="font-mono text-b700">{u.courseUnitCode}</td>
                                  <td><strong>{u.courseUnitName}</strong></td>
                                  <td>{u.unitTypeName || '—'}</td>
                                  <td>{u.unitCatName || '—'}</td>
                                  <td>{u.streamName || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          )
        )}

        {/* ── Fee Structure: structures left, the picked one's details right ── */}
        {activeTab === 'fees' && (
          feeStructures.length === 0 ? (
            <div key="fees-empty" className="modal-scroll tab-panel-in" style={{ padding: 24 }}>
              <EmptyPanel icon="lni-coin">No fee structures have been configured for this programme.</EmptyPanel>
            </div>
          ) : (
            <div key="fees" className="fsm-layout tab-panel-in" style={{ padding: 0, minHeight: 260 }}>
              <div className="fsm-sidebar">
                <SidebarHeading label="Fee Structures" count={feeStructures.length} />
                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
                  {feeStructures.map((s, i) => (
                    <SidebarItem
                      key={s.feeHdGuid}
                      active={activeFeeIdx === i}
                      badge={<i className="lni lni-coin" aria-hidden="true" />}
                      title={s.feeCode}
                      subtitle={s.localOrForeign ? 'Foreign' : 'Local'}
                      onClick={() => setActiveFeeIdx(i)}
                    />
                  ))}
                </div>
              </div>

              <div className="fsm-main">
                {activeFee && (
                  <>
                    <PanelHeader
                      badge={activeFee.localOrForeign ? 'FOREIGN' : 'LOCAL'}
                      title={activeFee.feeCode}
                      meta={`Structure ${activeFeeIdx + 1} of ${feeStructures.length}`}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', rowGap: 20, columnGap: 24 }}>
                      <Field label="Fee Description" value={activeFee.feeDesc || '—'} />
                      <Field label="Lumpsum Discount Type" value={activeFee.calcType === 2 ? 'Percentage' : 'Amount'} />
                      <Field label="Lumpsum Discount Value" value={`${activeFee.amtPer ?? 0}${activeFee.calcType === 2 ? '%' : ''}`} />

                      <SectionTitle>Programme-level Fees</SectionTitle>
                      <Field label="Lateral Entry Fee" value={activeFee.lef ?? 0} />
                      <Field label="Credit Exemption Fee" value={activeFee.cef ?? 0} />
                      <Field label="Aptech Credit Exemption Fee" value={activeFee.ace ?? 0} />

                      <SectionTitle>Semester Fees</SectionTitle>
                      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {semesters.map((sem, si) => {
                          const items = (activeFee.feeLines ?? []).filter(f => f.semCode === sem.semCode)
                          const total = items.reduce((sum, f) => sum + (f.amount || 0), 0)
                          return (
                            <div key={sem.semCode}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <span className="badge badge-blue">Sem {si + 1}</span>
                                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--g800)' }}>{sem.semName}</span>
                                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--g500)', fontVariantNumeric: 'tabular-nums' }}>
                                  {items.length > 0 ? `${plural(items.length, 'item')} · ${total.toLocaleString()} ${currencyCode(items[0]?.currencyGuid)}` : 'No items'}
                                </span>
                              </div>
                              {items.length > 0 && (
                                <ol style={{ listStyle: 'none', margin: 0, padding: 0, border: '1px solid var(--g200)', borderRadius: 'var(--rsm)' }}>
                                  {items.map((f, idx) => (
                                    <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderBottom: idx < items.length - 1 ? '1px solid var(--g100)' : 'none', fontSize: 13 }}>
                                      <span className="font-mono" style={{ minWidth: 22, textAlign: 'right', color: 'var(--g400)' }} title="Ledger priority">{f.ledgerNum}.</span>
                                      <span style={{ flex: 1, minWidth: 0, color: 'var(--g800)' }}>{ledgerName(f.ledgerGuid)}</span>
                                      <span style={{ fontWeight: 600, color: 'var(--g900)', fontVariantNumeric: 'tabular-nums' }}>
                                        {(f.amount || 0).toLocaleString()} <span style={{ color: 'var(--g500)', fontWeight: 500 }}>{currencyCode(f.currencyGuid)}</span>
                                      </span>
                                    </li>
                                  ))}
                                </ol>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        )}

        <div className="modal-footer">
          <span className="text-sm" style={{ color: 'var(--g500)' }}>
            {plural(semesters.length, 'semester')} · {plural(programUnits.length, 'course unit')} · {plural(feeStructures.length, 'fee structure')}
          </span>
          <span className="flex-1"></span>
          {onEdit && programGuid && (
            <button className="btn btn-neu" onClick={() => onEdit(programGuid)}>
              <i className="lni lni-pencil"></i> Edit Details
            </button>
          )}
          <button className="btn btn-primary" onClick={handleClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
