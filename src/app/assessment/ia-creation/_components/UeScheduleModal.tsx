'use client'

import { useState, useEffect } from 'react'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import DatePicker from '@/components/DatePicker'
import { useIaUeSchedule, useUpdateIaUeSchedule } from '@/hooks/assessment/useIaUeSchedule'
import { useExamRules } from '@/hooks/assessment/useExamRules'
import { SuccessPopup } from '@/components/modals/shared/SuccessPopup'
import { ExamRuleLookupModal } from './ExamRuleLookupModal'

interface UeScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  examGuid: string | null
  unitCode: string
  unitName: string
}

export function UeScheduleModal({ isOpen, onClose, examGuid, unitCode, unitName }: UeScheduleModalProps) {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [saved, setSaved] = useState(false)
  const showToast = (msg: string, type: string = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Fetch current schedule
  const { data: schedule, isLoading } = useIaUeSchedule(examGuid)
  const updateMut = useUpdateIaUeSchedule(examGuid || '')

  // Form State
  const [examDate, setExamDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [maxMark, setMaxMark] = useState<number | ''>('')
  const [examType, setExamType] = useState<number>(0)
  const [universityExamType, setUniversityExamType] = useState<number>(0)
  const [publishStatus, setPublishStatus] = useState<number>(0)
  const [examRuleGuid, setExamRuleGuid] = useState<string>('')
  const [lookupOpen, setLookupOpen] = useState(false)

  // Fetch Exam Rules for the dropdown
  const { data: rulesData, isLoading: rulesLoading } = useExamRules(1, 100, '', isOpen)
  const activeRules = rulesData?.items?.filter(r => r.status !== 3) || []
  const ruleOptions = activeRules.map(r => ({
    value: r.examRuleGuid,
    label: `${r.ruleCode} - ${r.ruleName}`
  }))

  // Populate form when data loads
  useEffect(() => {
    if (schedule && isOpen) {
      if (schedule.examDate) {
        // examDate arrives as YYYY-MM-DD from the backend (or YYYY-MM-DDT00:00:00)
        setExamDate(schedule.examDate.split('T')[0])
      } else {
        setExamDate('')
      }
      
      setStartTime(schedule.startTime ? schedule.startTime.slice(0, 5) : '')
      setEndTime(schedule.endTime ? schedule.endTime.slice(0, 5) : '')
      setMaxMark(schedule.maxMark ?? '')
      setExamType(schedule.examType ?? 0)
      setUniversityExamType(schedule.universityExamType ?? 0)
      setPublishStatus(schedule.publishStatus ?? 0)
      
      if (schedule.examRuleGuid) {
        setExamRuleGuid(schedule.examRuleGuid)
      } else {
        setExamRuleGuid('')
      }
    } else if (!isOpen) {
      // reset form when closed
      setExamDate('')
      setStartTime('')
      setEndTime('')
      setMaxMark('')
      setExamType(0)
      setUniversityExamType(0)
      setPublishStatus(0)
      setExamRuleGuid('')
    }
  }, [schedule, isOpen])

  async function handleSave() {
    if (!examGuid) return

    // Validation
    if (!examDate || !startTime || !endTime) {
      showToast('Exam Date and Start/End Times are required', 'error')
      return
    }
    
    // Check if end time is after start time
    const startDt = new Date(`1970-01-01T${startTime}`)
    const endDt = new Date(`1970-01-01T${endTime}`)
    if (endDt <= startDt) {
      showToast('End Time must be after Start Time', 'error')
      return
    }

    if (maxMark === '' || maxMark < 0) {
      showToast('Max Mark cannot be negative', 'error')
      return
    }

    try {
      await updateMut.mutateAsync({
        examDate,
        startTime: `${startTime}:00`,
        endTime: `${endTime}:00`,
        maxMark: Number(maxMark),
        examType,
        universityExamType,
        publishStatus,
        examRuleGuid: examRuleGuid || null,
      })
      showToast('University Exam Scheduled successfully')
      setSaved(true)
    } catch (err: any) {
      if (err.code === 'not_found' || err.message?.includes('404')) {
        showToast('This University Exam or Exam Rule does not exist.', 'error')
      } else if (err.code === 'bad_request' || err.code === 'validation_error') {
        showToast(err.message || 'Validation failed. Check your inputs.', 'error')
      } else {
        showToast(err.message || 'Failed to save schedule.', 'error')
      }
    }
  }

  if (!isOpen) return null

  if (saved) {
    return (
      <div className="modal-overlay open" onClick={onClose}>
        <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
          <SuccessPopup
            title="University Exam Scheduled!"
            subtitle="The university exam schedule has been saved successfully."
            onClose={() => { setSaved(false); onClose(); }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal modal-md modal-flex" style={{ maxWidth: '700px', borderRadius: '12px' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-hdr modal-hdr-blue" style={{ display: 'flex', alignItems: 'center', padding: '16px 20px' }}>
          <div className="modal-title text-white font-medium text-base" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="lni lni-graduation" style={{ fontSize: '18px' }}></i> Schedule University Exam
          </div>
          <button className="modal-close text-white hover:text-white/80 transition-colors" onClick={onClose} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <i className="lni lni-close" style={{ fontSize: '18px' }}></i>
          </button>
        </div>

        {/* Content */}
        <div className="modal-scroll p-6 pb-40 bg-white flex-1 overflow-y-auto">
          <div className={`transition-opacity duration-300 ${isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            
            <div className="mb-6 border-b border-slate-200 pb-4">
                <div className="text-sm text-slate-500 font-medium mb-1">University Exam for Subject:</div>
                <div className="text-lg font-semibold text-slate-900">
                    {unitCode} — {unitName}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date */}
              <div>
                <label className="lbl">Exam Date <span className="text-red-500">*</span></label>
                <div className="mt-1">
                  <DatePicker value={examDate} onChange={setExamDate} />
                </div>
              </div>

              {/* Times */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="lbl">Start Time <span className="text-red-500">*</span></label>
                  <input type="time" className="ctrl w-full mt-1" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className="lbl">End Time <span className="text-red-500">*</span></label>
                  <input type="time" className="ctrl w-full mt-1" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </div>

              {/* Marks */}
              <div>
                <label className="lbl">Max Mark <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="ctrl w-full mt-1"
                  value={maxMark}
                  onChange={e => setMaxMark(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              {/* Exam Rule Picker */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="lbl mb-0">Exam Rule (Optional)</label>
                  <button 
                    className="text-[13px] text-[#3a6bc9] hover:underline" 
                    onClick={() => setLookupOpen(true)}
                  >
                    View Rule Details
                  </button>
                </div>
                <SearchSelect
                  options={ruleOptions}
                  value={examRuleGuid}
                  onChange={val => setExamRuleGuid(val)}
                  placeholder={rulesLoading ? "Loading rules..." : "Select Exam Rule..."}
                  className="w-full mt-1"
                  disabled={isLoading || rulesLoading}
                />
              </div>

              {/* Exam Type */}
              <div>
                <label className="lbl">Exam Type <span className="text-red-500">*</span></label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="examType"
                      checked={examType === 0}
                      onChange={() => setExamType(0)}
                    />
                    Online
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="examType"
                      checked={examType === 1}
                      onChange={() => setExamType(1)}
                    />
                    Offline
                  </label>
                </div>
              </div>

              {/* UE Type */}
              <div>
                <label className="lbl">UE Type <span className="text-red-500">*</span></label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="universityExamType"
                      checked={universityExamType === 0}
                      onChange={() => setUniversityExamType(0)}
                    />
                    Theory
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="universityExamType"
                      checked={universityExamType === 1}
                      onChange={() => setUniversityExamType(1)}
                    />
                    Practical
                  </label>
                </div>
              </div>

              {/* Publish Status */}
              <div>
                <label className="lbl">Publish Status <span className="text-red-500">*</span></label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="publishStatus"
                      checked={publishStatus === 0}
                      onChange={() => setPublishStatus(0)}
                    />
                    Unpublished
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="publishStatus"
                      checked={publishStatus === 1}
                      onChange={() => setPublishStatus(1)}
                    />
                    Published
                  </label>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-200">
              <button className="btn btn-neu" onClick={onClose} disabled={updateMut.isPending}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={updateMut.isPending || isLoading}
              >
                {updateMut.isPending ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <Toast toast={toast} />
      <ExamRuleLookupModal 
        isOpen={lookupOpen} 
        onClose={() => setLookupOpen(false)} 
        onSelect={guid => setExamRuleGuid(guid)} 
      />
    </div>
  )
}
