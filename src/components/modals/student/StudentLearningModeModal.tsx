'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SearchSelect } from '@/components/SearchSelect'
import { useLearningModeOptions, useStudentLearningModeDetail, useUpdateStudentLearningMode } from '@/hooks/student/useLearningMode'

interface Props extends ModalProps {
  studentGuid: string | null
  studentName?: string
}

// Same learning-mode update the /student/learning-mode page does, pulled
// into a modal so Student Master's row action menu can change it in place
// instead of navigating away — same idea as StudentRefugeeModal. Reuses the
// same hooks, so the page and this modal share one cache.
export function StudentLearningModeModal({ isOpen, onClose, showToast, studentGuid, studentName }: Props) {
  const { data: detail, isLoading } = useStudentLearningModeDetail(isOpen ? studentGuid : null)
  const { data: options = [] } = useLearningModeOptions()
  const updateLearningMode = useUpdateStudentLearningMode()
  const [selectedMode, setSelectedMode] = useState('')

  // Seed the picker with the student's current mode once it loads (nothing
  // selected if they've never had one — learningMode comes back null).
  useEffect(() => {
    if (!isOpen) return
    setSelectedMode(detail?.learningMode != null ? String(detail.learningMode) : '')
  }, [isOpen, detail?.studentGuid, detail?.learningMode])

  if (!isOpen || !studentGuid) return null

  function handleApply() {
    if (!studentGuid) return
    const modeNum = Number(selectedMode)
    if (!selectedMode || !modeNum) { showToast('Please select a learning mode.', 'warn'); return }
    updateLearningMode.mutate(
      { studentGuid, learningMode: modeNum },
      {
        onSuccess: result => { showToast(`Learning mode updated to ${result.learningModeLabel}.`, 'ok'); onClose() },
        onError: (error: Error) => showToast(error.message || 'Failed to update learning mode.', 'err'),
      },
    )
  }

  return (
    <div className="modal-overlay open">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr"><div className="modal-title"><i className="lni lni-display"></i> Learning Mode</div><button className="modal-close" onClick={onClose}>✕</button></div>
        <div>
          <div className="fg"><label className="lbl">Student</label><input className="ctrl" readOnly value={detail?.studentName ?? studentName ?? '—'} /></div>

          {isLoading ? (
            <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading learning mode…</div>
          ) : (
            <>
              <div className="g2">
                <div className="fg"><label className="lbl">Programme</label><input className="ctrl" readOnly value={detail?.programName ?? '—'} /></div>
                <div className="fg"><label className="lbl">Semester</label><input className="ctrl" readOnly value={detail?.semesterName ?? '—'} /></div>
              </div>
              <div className="fg"><label className="lbl">Current Mode</label><input className="ctrl" readOnly value={detail?.learningModeLabel ?? 'Not set'} /></div>
              <div className="fg">
                <label className="lbl">New Learning Mode <span className="req">*</span></label>
                <SearchSelect
                  placeholder="— Select mode —"
                  options={options.map(o => ({ value: String(o.value), label: o.label }))}
                  value={selectedMode}
                  onChange={setSelectedMode}
                />
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handleApply} disabled={isLoading || updateLearningMode.isPending}>
            <i className="lni lni-checkmark"></i> {updateLearningMode.isPending ? 'Saving…' : 'Apply Mode Change'}
          </button>
        </div>
      </div>
    </div>
  )
}
