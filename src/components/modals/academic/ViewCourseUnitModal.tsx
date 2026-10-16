'use client'
import { useLayoutEffect, useRef, useState } from 'react'
import { ModalProps } from '../types'
import { FailurePopup } from '../shared/FailurePopup'
import { AuthError } from '@/lib/api/client'
import { useCourseUnit } from '@/hooks/academic/useCourseUnits'
import { getCourseUnitById } from '@/lib/api/academic/courseUnit'
import { DocumentPreviewModal } from '../shared/DocumentPreviewModal'

interface ViewCourseUnitModalProps extends ModalProps {
  courseUnitGuid: string | null
  onEdit?: () => void
  canEdit?: boolean
}

type Tab = 'overview' | 'outline' | 'syllabus'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'lni-grid-alt' },
  { id: 'outline', label: 'Course Outline', icon: 'lni-list' },
  { id: 'syllabus', label: 'Syllabus', icon: 'lni-files' },
]

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--g500)', marginBottom: 4 }}>{label}</div>
      <div className={mono ? 'font-mono' : undefined} style={{ fontSize: 14, color: 'var(--g900)', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="sec-divider" style={{ gridColumn: '1 / -1', marginTop: 6, marginBottom: 0 }}>{children}</div>
}

// mid / cw / ca are on-off flags (1 = Enabled), not percentages — the
// percentages are cwWeightage / cbtWeightage / ueWeightage. The old Overview
// printed the flags under "%" headings, so every unit showed "1 / 1 / 1".
function IncludedChip({ label, on }: { label: string; on: boolean }) {
  return (
    <span className={`badge ${on ? 'badge-green' : 'badge-grey'}`}>
      <i className={`lni ${on ? 'lni-checkmark' : 'lni-close'}`} aria-hidden="true" /> {label}
    </span>
  )
}

function approvalBadge(approved: number | null | undefined) {
  if (approved === 1) return <span className="badge badge-green"><i className="lni lni-checkmark" aria-hidden="true" /> Approved</span>
  if (approved === 0) return <span className="badge badge-amber">Not approved</span>
  return <span className="badge badge-grey">Not set</span>
}

export function ViewCourseUnitModal({ isOpen, onClose, showToast, courseUnitGuid, onEdit, canEdit }: ViewCourseUnitModalProps) {
  const { data: courseUnit, isLoading, isError, error } = useCourseUnit(courseUnitGuid, isOpen)
  const [syllabusLoading, setSyllabusLoading] = useState(false)
  // Shown in an in-page preview (PDF/image inline, with Download), not a new tab.
  const [syllabusPreview, setSyllabusPreview] = useState<string | null>(null)

  // The syllabus is a pre-signed S3 URL that expires within minutes, so the
  // one on the cached record can't be trusted — fetch the unit fresh at
  // click time, same as Course Units' own handleSyllabus.
  async function viewSyllabus() {
    if (!courseUnitGuid) return
    setSyllabusLoading(true)
    try {
      const fresh = await getCourseUnitById(courseUnitGuid)
      if (!fresh.syllabus) { showToast('Syllabus is no longer attached to this unit', 'error'); return }
      setSyllabusPreview(fresh.syllabus)
    } catch {
      showToast('Failed to load the syllabus document. Please try again.', 'error')
    } finally {
      setSyllabusLoading(false)
    }
  }
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [activeChapterIdx, setActiveChapterIdx] = useState(0)

  // Same sliding underline as the app's other .tab-bar screens.
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement>>>({})
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  useLayoutEffect(() => {
    const el = tabRefs.current[activeTab]
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [activeTab, isOpen, courseUnit])

  if (!isOpen) return null

  function handleClose() {
    setActiveTab('overview'); setActiveChapterIdx(0)
    onClose()
  }

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Course Unit"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load details.') : 'Failed to load details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !courseUnit) {
    return (
      <div className="modal-overlay open">
        <div className="modal modal-lg modal-flex" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Course Unit</div>
            <button className="modal-close" onClick={handleClose} aria-label="Close"><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <span style={{ color: 'var(--g400)' }}>Loading course unit details…</span>
          </div>
        </div>
      </div>
    )
  }

  const outlines = courseUnit.outlines ?? []
  const chapterCap = courseUnit.chapterCount || 0
  const activeChapter = outlines[activeChapterIdx] ?? outlines[0]
  const totalTopics = outlines.reduce((sum, o) => sum + (o.topics?.length ?? 0), 0)

  const weights = [
    { key: 'cw',  label: 'Course Work',     short: 'CW',  value: courseUnit.cwWeightage ?? 0,  on: !!courseUnit.cw, color: 'var(--b400)' },
    { key: 'cbt', label: 'Class Test',      short: 'CBT', value: courseUnit.cbtWeightage ?? 0, on: !!courseUnit.ca, color: 'var(--amber)' },
    { key: 'ue',  label: 'University Exam', short: 'UE',  value: courseUnit.ueWeightage ?? 0,  on: true,            color: 'var(--green)' },
  ]
  const weightTotal = weights.reduce((sum, w) => sum + w.value, 0)

  return (
    <div className="modal-overlay open">
      {/* modal-flex's fixed 85vh (no height: auto override) so switching tabs doesn't resize the modal —
          each panel is flex: 1 and scrolls its own content. */}
      <div className="modal modal-lg modal-flex" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Course Unit &mdash; <span className="font-mono">{courseUnit.courseUnitCode}</span></div>
          <button className="modal-close" onClick={handleClose} aria-label="Close"><i className="lni lni-close"></i></button>
        </div>

        {/* Direct .modal children get 18px 22px padding by default; the tab
            bar and body opt out so the bar runs edge to edge. */}
        <div className="tab-bar" role="tablist" aria-label="Course unit details" style={{ flexShrink: 0, padding: 0, background: 'var(--surface)' }}>
          {TABS.map(t => {
            const active = activeTab === t.id
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
                {t.id === 'outline' && outlines.length > 0 && (
                  <span className={`badge ${active ? 'badge-blue' : 'badge-grey'}`}>{outlines.length}</span>
                )}
              </button>
            )
          })}
          <span className="tab-indicator" style={{ left: indicator.left, width: indicator.width }} />
        </div>

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div key="overview" className="modal-scroll tab-panel-in" style={{ padding: '20px clamp(14px, 4vw, 24px)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', rowGap: 20, columnGap: 24 }}>
              <Field label="Course Unit Code" value={courseUnit.courseUnitCode} mono />
              <Field label="Course Unit Name" value={courseUnit.courseUnitName} />
              <Field label="Maximum Credits" value={courseUnit.maxCredits} />
              <Field label="No. of Chapters" value={chapterCap > 0 ? chapterCap : '—'} />
              <Field label="Repetition Tag" value={courseUnit.courseUnitRepetitionName || '—'} />
              <Field label="Approval" value={approvalBadge(courseUnit.approved)} />

              <SectionTitle>Assessment Components</SectionTitle>
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <IncludedChip label="Mid Term" on={!!courseUnit.mid} />
                <IncludedChip label="Course Work" on={!!courseUnit.cw} />
                <IncludedChip label="Class Test (CBT)" on={!!courseUnit.ca} />
              </div>

              <SectionTitle>Final Weighting</SectionTitle>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
                  {weights.map(w => (
                    <div key={w.key} style={{ border: '1.5px solid var(--g200)', borderRadius: 'var(--rsm)', padding: '10px 12px', opacity: w.on ? 1 : 0.55 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--g500)' }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, background: w.color, flexShrink: 0 }} aria-hidden="true" />
                        {w.label}
                        {!w.on && <span className="badge badge-grey" style={{ marginLeft: 'auto' }}>Off</span>}
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--g900)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{w.value}<span style={{ fontSize: 13, color: 'var(--g500)', fontWeight: 600 }}>%</span></div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', height: 7, borderRadius: 6, overflow: 'hidden', background: 'var(--g100)', gap: 2 }} aria-hidden="true">
                  {weights.filter(w => w.value > 0).map(w => <div key={w.key} style={{ flex: w.value, background: w.color }} title={`${w.short}: ${w.value}%`} />)}
                  {weightTotal < 100 && <div style={{ flex: 100 - weightTotal }} />}
                </div>
                <div style={{ textAlign: 'right', fontSize: 'var(--fs-sm)', color: 'var(--g500)', marginTop: 6 }}>
                  Total: <strong style={{ color: weightTotal === 100 ? 'var(--green)' : 'var(--red)' }}>{weightTotal}</strong> / 100
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Course Outline ── */}
        {activeTab === 'outline' && (
          outlines.length === 0 ? (
            <div key="outline-empty" className="modal-scroll tab-panel-in" style={{ padding: 24 }}>
              <div style={{ textAlign: 'center', padding: '32px 16px', border: '1.5px dashed var(--g200)', borderRadius: 'var(--rsm)', color: 'var(--g500)', fontSize: 13 }}>
                <i className="lni lni-empty-file" style={{ fontSize: 28, color: 'var(--g300)', display: 'block', marginBottom: 8 }} aria-hidden="true" />
                No course outline has been defined for this unit.
              </div>
            </div>
          ) : (
            <div key="outline" className="fsm-layout tab-panel-in" style={{ padding: 0, minHeight: 260 }}>
              <div className="fsm-sidebar">
                <div style={{ padding: '14px 14px 6px', fontSize: 10.5, fontWeight: 700, color: 'var(--g400)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                  Chapters <span style={{ color: 'var(--b500)' }}>({chapterCap > 0 ? `${outlines.length}/${chapterCap}` : outlines.length})</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
                  {outlines.map((ch, ci) => {
                    const active = activeChapterIdx === ci
                    const topicCount = ch.topics?.length ?? 0
                    return (
                      <button
                        key={ch.courseUnitOutlineGuid || ci}
                        type="button"
                        onClick={() => setActiveChapterIdx(ci)}
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
                          {ch.chapter}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontWeight: 600, fontSize: 13, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.chapterName || `Chapter ${ch.chapter}`}</span>
                          <span style={{ display: 'block', fontSize: 11, opacity: .7, lineHeight: 1.3 }}>{topicCount} topic{topicCount !== 1 ? 's' : ''}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="fsm-main">
                {activeChapter && (() => {
                  const topics = [...(activeChapter.topics ?? [])].sort((a, b) => a.studySequence - b.studySequence)
                  const classes = topics.reduce((sum, t) => sum + (t.taughtBy || 0), 0)
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', border: '1.5px solid var(--g200)', borderRadius: 'var(--rsm)', background: 'var(--surface)', marginBottom: 14 }}>
                        <span className="badge badge-blue">CH {activeChapter.chapter}</span>
                        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--g900)' }}>{activeChapter.chapterName}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--g500)' }}>
                          {topics.length} topic{topics.length !== 1 ? 's' : ''} · {classes} class{classes !== 1 ? 'es' : ''}
                        </span>
                      </div>
                      {topics.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 16, color: 'var(--g400)', fontSize: 13, fontStyle: 'italic' }}>No topics defined for this chapter.</div>
                      ) : (
                        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                          {topics.map((t, ti) => (
                            <li key={t.courseUnitTopicGuid || ti} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 2px', borderBottom: ti < topics.length - 1 ? '1px solid var(--g100)' : 'none' }}>
                              <span className="font-mono" style={{ minWidth: 22, textAlign: 'right', color: 'var(--g400)', fontSize: 13, paddingTop: 1 }}>{t.studySequence}.</span>
                              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--g800)', lineHeight: 1.45 }}>{t.courseUnitTopicDetails}</span>
                              <span className="badge badge-grey" style={{ flexShrink: 0 }} title="No. of classes">
                                {t.taughtBy} class{t.taughtBy !== 1 ? 'es' : ''}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          )
        )}

        {/* ── Syllabus ── */}
        {activeTab === 'syllabus' && (
          <div key="syllabus" className="modal-scroll tab-panel-in" style={{ padding: 24 }}>
            {!courseUnit.syllabus ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', border: '1.5px dashed var(--g200)', borderRadius: 'var(--rsm)', color: 'var(--g500)', fontSize: 13 }}>
                <i className="lni lni-files" style={{ fontSize: 28, color: 'var(--g300)', display: 'block', marginBottom: 8 }} aria-hidden="true" />
                No syllabus document has been attached to this unit.
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '28px 16px', border: '1.5px solid var(--b100)', borderRadius: 'var(--rsm)', background: 'var(--b50)' }}>
                <i className="lni lni-empty-file" style={{ fontSize: 30, color: 'var(--b600)', display: 'block', marginBottom: 10 }} aria-hidden="true" />
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--g900)', marginBottom: 6 }}>Syllabus document attached</div>
                <p style={{ fontSize: 13, color: 'var(--g600)', margin: '0 auto 16px', maxWidth: 420 }}>
                  The syllabus for {courseUnit.courseUnitCode} is stored securely and opens in your browser.
                </p>
                <button className="btn btn-primary" onClick={viewSyllabus} disabled={syllabusLoading}>
                  <i className="lni lni-eye"></i> {syllabusLoading ? 'Opening…' : 'View Syllabus'}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="modal-footer">
          <span className="text-sm" style={{ color: 'var(--g500)' }}>
            {outlines.length} chapter{outlines.length !== 1 ? 's' : ''} · {totalTopics} topic{totalTopics !== 1 ? 's' : ''}
          </span>
          <span className="flex-1"></span>
          {canEdit && onEdit && (
            <button className="btn btn-neu" onClick={onEdit}>
              <i className="lni lni-pencil"></i> Edit Details
            </button>
          )}
          <button className="btn btn-primary" onClick={handleClose}>Close</button>
        </div>
      </div>
      <DocumentPreviewModal
        isOpen={!!syllabusPreview}
        onClose={() => setSyllabusPreview(null)}
        url={syllabusPreview}
        title={`Syllabus — ${courseUnit?.courseUnitCode ?? ''}`}
      />
    </div>
  )
}
