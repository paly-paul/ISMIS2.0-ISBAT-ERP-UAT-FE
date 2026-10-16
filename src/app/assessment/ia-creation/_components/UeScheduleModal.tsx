'use client'

import { useState, useEffect, useRef } from 'react'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import DatePicker from '@/components/DatePicker'
import TimeRangePicker, { isTimeRangeValid } from '@/components/TimeRangePicker'
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

function getTodayYmd(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function UeScheduleModal({ isOpen, onClose, examGuid, unitCode, unitName }: UeScheduleModalProps) {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [saved, setSaved] = useState(false)
  const showToast = (msg: string, type: string = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }
    setToast({ msg, type })
    const isErrorOrWarn = ['error', 'err', 'danger', 'warn', 'warning'].includes((type || '').toLowerCase().trim())
    const duration = isErrorOrWarn ? 8000 : 4000
    toastTimerRef.current = setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, duration)
  }

  // Fetch current schedule
  const { data: schedule, isLoading } = useIaUeSchedule(examGuid)
  const updateMut = useUpdateIaUeSchedule(examGuid || '')

  // Form State
  const [examDate, setExamDate] = useState<string>(getTodayYmd)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [maxMark, setMaxMark] = useState<number | ''>('')
  const [examType, setExamType] = useState<number>(0)
  const [universityExamType, setUniversityExamType] = useState<number>(0)
  const [publishStatus, setPublishStatus] = useState<number>(0)
  const [examRuleGuid, setExamRuleGuid] = useState<string>('')
  const [lookupOpen, setLookupOpen] = useState(false)

  function handleExamDateChange(d: string) {
    const today = getTodayYmd()
    if (d && d < today) {
      showToast('Before date is not possible', 'error')
      return
    }
    setExamDate(d)
  }

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
      // If the schedule was already saved with valid start and end times, preserve the saved date.
      // Otherwise (newly scheduling or backend default placeholder in July), default to current date (ASM-018).
      const isAlreadyScheduled = Boolean(
        schedule.startTime &&
        schedule.endTime &&
        schedule.startTime !== '00:00:00' &&
        schedule.startTime !== '00:00'
      )

      if (isAlreadyScheduled && schedule.examDate) {
        setExamDate(schedule.examDate.split('T')[0])
      } else {
        setExamDate(getTodayYmd())
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
      setExamDate(getTodayYmd())
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
    if (!isTimeRangeValid(startTime, endTime)) {
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
      const errMsg = (err?.message || '').toLowerCase()
      if (errMsg.includes('question') || errMsg.includes('paper') || errMsg.includes('qp')) {
        showToast('Please upload the question paper before scheduling the exam.', 'error')
      } else if (err.code === 'not_found' || err.message?.includes('404')) {
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
      <div className="modal-overlay open">
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
    <div className="modal-overlay open">
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

            {/* ASM-045: Notice to upload question paper before scheduling */}
            <div className="mb-6 p-3.5 bg-amber-50/90 border border-amber-200 rounded-lg flex items-start gap-3 text-xs text-amber-900 shadow-xs">
              <i className="lni lni-warning text-amber-600 text-base flex-shrink-0 mt-0.5"></i>
              <div className="leading-relaxed">
                <span className="font-semibold text-amber-950">Notice:</span> Please ensure the question paper is uploaded before scheduling the exam.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date */}
              <div>
                <label className="lbl">Exam Date <span className="text-red-500">*</span></label>
                <div className="mt-1">
                  <DatePicker 
                    value={examDate} 
                    onChange={handleExamDateChange} 
                    minYmd={getTodayYmd()} 
                    rangeMessage="Before date is not possible"
                    onError={msg => showToast(msg, 'error')}
                  />
                </div>
              </div>

              {/* Times */}
              <TimeRangePicker start={startTime} end={endTime} onStartChange={setStartTime} onEndChange={setEndTime} required />


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
      <Toast toast={toast} onClose={() => setToast(null)} />
      <ExamRuleLookupModal 
        isOpen={lookupOpen} 
        onClose={() => setLookupOpen(false)} 
        onSelect={guid => setExamRuleGuid(guid)} 
        selectedGuid={examRuleGuid}
      />
    </div>
  )
}
