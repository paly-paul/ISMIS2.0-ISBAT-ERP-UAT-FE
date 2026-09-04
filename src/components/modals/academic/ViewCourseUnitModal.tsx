'use client'
import { useState } from 'react'
import { ModalProps } from '../types'
import { FailurePopup } from '../shared/FailurePopup'
import { AuthError } from '@/lib/api/client'
import { useCourseUnit } from '@/hooks/academic/useCourseUnits'
import { openDocumentForViewing } from '@/lib/documentViewer'

interface ViewCourseUnitModalProps extends ModalProps {
  courseUnitGuid: string | null
  onEdit?: () => void
  canEdit?: boolean
}

function Field({ label, value, mono, wide }: { label: string; value: React.ReactNode; mono?: boolean; wide?: boolean }) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--g500)', marginBottom: '4px' }}>{label}</div>
      <div className={mono ? 'font-mono' : undefined} style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

export function ViewCourseUnitModal({ isOpen, onClose, courseUnitGuid, onEdit, canEdit }: ViewCourseUnitModalProps) {
  const { data: courseUnit, isLoading, isError, error } = useCourseUnit(courseUnitGuid, isOpen)
  const [activeTab, setActiveTab] = useState<'overview' | 'outline' | 'syllabus'>('overview')
  const [activeChapterIdx, setActiveChapterIdx] = useState(0)

  if (!isOpen) return null

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Course Unit"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load details.') : 'Failed to load details.'}
            onClose={onClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !courseUnit) {
    return (
      <div className="modal-overlay open">
        <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Course Unit</div>
            <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading course unit details?</span>
          </div>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'lni lni-grid-alt' },
    { id: 'outline', label: 'Course Outline', icon: 'lni lni-list' },
    { id: 'syllabus', label: 'Syllabus', icon: 'lni lni-files' }
  ] as const

  return (
    <div className="modal-overlay open">
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}>
        <div className="modal-hdr modal-hdr-blue shrink-0">
          <div className="modal-title"><i className="lni lni-eye"></i> View Course Unit &mdash; <span className="font-mono">{courseUnit.courseUnitCode}</span></div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        {/* Custom Tab Bar */}
        <div className="flex border-b border-slate-200 bg-slate-50 shrink-0 w-full">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex justify-center items-center gap-2 px-2 py-3 text-[13px] font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'border-blue-600 text-blue-700 bg-blue-50/50' 
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <i className={tab.icon}></i> {tab.label}
            </button>
          ))}
        </div>

        <div className="modal-scroll flex-1" style={{ padding: activeTab === 'outline' ? '0' : '24px', overflowY: activeTab === 'outline' ? 'hidden' : 'auto', display: activeTab === 'outline' ? 'flex' : 'block', flexDirection: 'column' }}>
          
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="view-detail-grid">
              <Field label="Course Unit Code" value={courseUnit.courseUnitCode} mono />
              <Field label="Course Unit Name" value={courseUnit.courseUnitName} />
              <Field label="Maximum Credits" value={courseUnit.maxCredits} />
              
              <Field label="Repetition Tag" value={courseUnit.courseUnitRepetitionName || '—'} wide />

              <div style={{ gridColumn: '1 / -1', marginTop: 12, marginBottom: 8, fontSize: 13, fontWeight: 700, color: 'var(--b800)', borderBottom: '1px solid var(--b100)', paddingBottom: 6 }}>
                Exam Weighting
              </div>
              <Field label="Mid Term %" value={courseUnit.mid} />
              <Field label="Course Work %" value={courseUnit.cw} />
              <Field label="CBT %" value={courseUnit.ca} />
            </div>
          )}

          {/* TAB: OUTLINE */}
          {activeTab === 'outline' && (() => {
            if (!courseUnit.outlines || courseUnit.outlines.length === 0) {
              return (
                <div className="p-8 m-6 text-center bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-[13px]">
                  <i className="lni lni-empty-file text-3xl mb-2 text-slate-300 block"></i>
                  No course outline has been defined for this unit.
                </div>
              )
            }
            const activeChapter = courseUnit.outlines[activeChapterIdx] || courseUnit.outlines[0]
            const chapterCap = courseUnit.chapterCount || 0
            return (
              <div className="fsm-layout" style={{ flex: 1, minHeight: 0 }}>
                {/* Left sidebar — one entry per chapter */}
                <div className="fsm-sidebar">
                  <div style={{ padding: '14px 14px 6px', fontSize: 10.5, fontWeight: 700, color: 'var(--g400)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                    Chapters <span style={{ color: 'var(--b500)' }}>({chapterCap > 0 ? `${courseUnit.outlines.length}/${chapterCap}` : courseUnit.outlines.length})</span>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
                    {courseUnit.outlines.map((ch, ci) => (
                      <div
                        key={ch.courseUnitOutlineGuid || ci}
                        onClick={() => setActiveChapterIdx(ci)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '9px 10px', borderRadius: 'var(--rsm)', marginBottom: 2,
                          background: activeChapterIdx === ci ? 'var(--b500)' : 'transparent',
                          color: activeChapterIdx === ci ? '#fff' : 'var(--g700)',
                          cursor: 'pointer', transition: 'background .15s',
                        }}
                      >
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: activeChapterIdx === ci ? 'rgba(255,255,255,.2)' : 'var(--b100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <i className="lni lni-bookmark" style={{ fontSize: 13, color: activeChapterIdx === ci ? '#fff' : 'var(--b600)' }}></i>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.chapterName || `Chapter ${ch.chapter}`}</div>
                          <div style={{ fontSize: 11, opacity: .65, lineHeight: 1.3 }}>{ch.topics ? ch.topics.length : 0} topic{(ch.topics ? ch.topics.length : 0) !== 1 ? 's' : ''}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right panel — active chapter's title + topics */}
                <div className="fsm-main" style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                  {activeChapter && (
                    <>
                      <div className="bg-slate-50 px-4 py-3 border border-slate-200 rounded-lg flex items-center gap-3 mb-4">
                        <div className="bg-blue-100 text-blue-700 font-bold text-[12px] px-2 py-0.5 rounded">CH {activeChapter.chapter}</div>
                        <div className="font-semibold text-slate-800 text-[15px]">{activeChapter.chapterName}</div>
                      </div>

                      <div className="flex flex-col gap-3">
                        {activeChapter.topics && activeChapter.topics.length > 0 ? activeChapter.topics.map((topic, tidx) => (
                          <div key={topic.courseUnitTopicGuid || tidx} className="flex gap-4 text-[13px] border-b border-slate-100 pb-3 last:border-0">
                            <div className="text-slate-400 font-mono mt-0.5 min-w-[20px] text-right">{topic.studySequence}.</div>
                            <div className="text-slate-700 leading-relaxed flex-1">{topic.courseUnitTopicDetails}</div>
                          </div>
                        )) : (
                          <div className="text-[13px] text-slate-400 italic p-4 text-center border border-slate-100 rounded-lg bg-slate-50">No topics defined for this chapter.</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })()}

          {/* TAB: SYLLABUS */}
          {activeTab === 'syllabus' && (
            <div>
              {!courseUnit.syllabus ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-[13px]">
                  <i className="lni lni-files text-3xl mb-2 text-slate-300 block"></i>
                  No syllabus document has been attached to this unit.
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-600 text-2xl mb-4">
                    <i className="lni lni-empty-file"></i>
                  </div>
                  <h3 className="text-[15px] font-bold text-slate-800 mb-2">Syllabus Document Available</h3>
                  <p className="text-[13px] text-slate-600 mb-6 max-w-md">The syllabus for {courseUnit.courseUnitCode} has been uploaded and is securely stored. You can view it directly in your browser.</p>
                  <button 
                    className="btn btn-primary"
                    onClick={() => openDocumentForViewing(courseUnit.syllabus!)}
                  >
                    <i className="lni lni-eye"></i> View Full Syllabus
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
        
        <div className="modal-footer shrink-0" style={{ borderTop: '1px solid var(--g200)' }}>
          <span className="flex-1"></span>
          {canEdit && onEdit && (
            <button className="btn btn-neu" onClick={onEdit}>
              <i className="lni lni-pencil"></i> Edit Details
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
