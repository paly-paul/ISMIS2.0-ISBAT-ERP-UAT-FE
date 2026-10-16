'use client'

import { useState, useEffect, useRef } from 'react'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import DatePicker from '@/components/DatePicker'
import TimePicker from '@/components/TimePicker'
import { useIaTestSchedule, useUpdateIaTestSchedule } from '@/hooks/assessment/useIaTestSchedule'
import { useExamRules } from '@/hooks/assessment/useExamRules'
import { SuccessPopup } from '@/components/modals/shared/SuccessPopup'
import { ExamRuleLookupModal } from './ExamRuleLookupModal'

interface CbtScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  testGuid: string | null
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

export function CbtScheduleModal({ isOpen, onClose, testGuid, unitCode, unitName }: CbtScheduleModalProps) {
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
  const { data: schedule, isLoading } = useIaTestSchedule(testGuid)
  const updateMut = useUpdateIaTestSchedule(testGuid || '')

  // Form State
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [duration, setDuration] = useState<number | ''>(90)
  const [maxMark, setMaxMark] = useState<number | ''>('')
  const [testType, setTestType] = useState<number>(0)
  const [publishStatus, setPublishStatus] = useState<number>(0)
  const [examRuleGuid, setExamRuleGuid] = useState<string>('')
  const [lookupOpen, setLookupOpen] = useState(false)

  function handleStartDateChange(d: string) {
    const today = getTodayYmd()
    if (d && d < today) {
      showToast('Before date is not possible', 'error')
      return
    }
    setStartDate(d)
    if (d && endDate && endDate < d) {
      showToast('Before date is not possible', 'error')
      setEndDate('')
    }
  }

  function handleEndDateChange(d: string) {
    const today = getTodayYmd()
    const minAllowed = startDate || today
    if (d && d < minAllowed) {
      showToast('Before date is not possible', 'error')
      return
    }
    setEndDate(d)
  }

  function handleEndTimeChange(t: string) {
    setEndTime(t)
    if (startDate && endDate && startDate === endDate && startTime && t && t <= startTime) {
      showToast('End Time must be after Start Time', 'error')
    }
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
      if (schedule.scheduledStartDateTime) {
        const [d, t] = schedule.scheduledStartDateTime.split('T')
        setStartDate(d)
        setStartTime(t.slice(0, 5))
      } else {
        setStartDate('')
        setStartTime('')
      }
      
      if (schedule.scheduledEndDateTime) {
        const [d, t] = schedule.scheduledEndDateTime.split('T')
        setEndDate(d)
        setEndTime(t.slice(0, 5))
      } else {
        setEndDate('')
        setEndTime('')
      }
      const isAlreadyScheduled = Boolean(schedule.scheduledStartDateTime && schedule.scheduledEndDateTime)
      if (isAlreadyScheduled && schedule.durationMinutes) {
        setDuration(schedule.durationMinutes)
      } else {
        setDuration(90)
      }
      setMaxMark(schedule.maxMark ?? '')
      setTestType(schedule.testType ?? 0)
      setPublishStatus(schedule.publishStatus ?? 0)
      if (schedule.examRuleGuid) {
        setExamRuleGuid(schedule.examRuleGuid)
      } else {
        setExamRuleGuid('')
      }
    } else if (!isOpen) {
        // reset form when closed
        setStartDate('')
        setStartTime('')
        setEndDate('')
        setEndTime('')
        setDuration(90)
        setMaxMark('')
        setTestType(0)
        setPublishStatus(0)
        setExamRuleGuid('')
    }
  }, [schedule, isOpen])

  async function handleSave() {
    if (!testGuid) return

    // Validation
    if (!startDate || !startTime || !endDate || !endTime) {
      showToast('Start and End Date/Time are required', 'error')
      return
    }
    const startDt = new Date(`${startDate}T${startTime}`)
    const endDt = new Date(`${endDate}T${endTime}`)
    
    if (endDt <= startDt) {
      showToast('End Date/Time must be after Start Date/Time', 'error')
      return
    }
    if (duration === '' || duration <= 0) {
      showToast('Duration must be greater than 0', 'error')
      return
    }
    if (maxMark === '' || maxMark < 0) {
      showToast('Max Mark cannot be negative', 'error')
      return
    }

    try {
      await updateMut.mutateAsync({
        scheduledStartDateTime: `${startDate}T${startTime}:00`,
        scheduledEndDateTime: `${endDate}T${endTime}:00`,
        maxMark: Number(maxMark),
        durationMinutes: Number(duration),
        testType: testType,
        publishStatus,
        examRuleGuid: examRuleGuid || null,
      })
      showToast('CBT Scheduled successfully')
      setSaved(true)
    } catch (err: any) {
      const errMsg = (err?.message || '').toLowerCase()
      if (errMsg.includes('question') || errMsg.includes('paper') || errMsg.includes('qp')) {
        showToast('Please upload the question paper before scheduling the exam.', 'error')
      } else if (err.code === 'not_found' || err.message?.includes('404')) {
        showToast('This Class Test or Exam Rule does not exist.', 'error')
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
            title="Class Test Scheduled!"
            subtitle="The class test schedule has been saved successfully."
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
            <i className="lni lni-calendar" style={{ fontSize: '18px' }}></i> Schedule Class Test (CBT)
          </div>
          <button className="modal-close text-white hover:text-white/80 transition-colors" onClick={onClose} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <i className="lni lni-close" style={{ fontSize: '18px' }}></i>
          </button>
        </div>

        {/* Content */}
        <div className="modal-scroll p-6 pb-40 bg-white flex-1 overflow-y-auto">
          <div className={`transition-opacity duration-300 ${isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            
            <div className="mb-6 border-b border-slate-200 pb-4">
                <div className="text-sm text-slate-500 font-medium mb-1">Class Test for Subject:</div>
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
              {/* Dates */}
              <div>
                <label className="lbl">Start Date & Time <span className="text-red-500">*</span></label>
                <div className="flex gap-2 mt-1">
                  <div className="flex-1">
                    <DatePicker 
                      value={startDate} 
                      onChange={handleStartDateChange} 
                      minYmd={getTodayYmd()} 
                      rangeMessage="Before date is not possible"
                      onError={msg => showToast(msg, 'error')}
                    />
                  </div>
                  <div className="w-[140px]">
                    <TimePicker value={startTime} onChange={setStartTime} />
                  </div>
                </div>
              </div>
              <div>
                <label className="lbl">End Date & Time <span className="text-red-500">*</span></label>
                <div className="flex gap-2 mt-1">
                  <div className="flex-1">
                    <DatePicker 
                      value={endDate} 
                      onChange={handleEndDateChange} 
                      minYmd={startDate || getTodayYmd()} 
                      rangeMessage="Before date is not possible"
                      onError={msg => showToast(msg, 'error')}
                    />
                  </div>
                  <div className="w-[140px]">
                    <TimePicker value={endTime} onChange={handleEndTimeChange} />
                  </div>
                </div>
              </div>

              {/* Marks & Duration */}
              <div className="hidden">
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
              <div>
                <label className="lbl">Duration (mins) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="1"
                  className="ctrl w-full mt-1"
                  value={duration}
                  onChange={e => setDuration(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              {/* Type */}
              <div>
                <label className="lbl">Test Type</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="testType"
                      checked={testType === 0}
                      onChange={() => setTestType(0)}
                    />
                    Online
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="testType"
                      checked={testType === 1}
                      onChange={() => setTestType(1)}
                    />
                    Offline
                  </label>
                </div>
              </div>

              {/* Publish Status */}
              <div>
                <label className="lbl">Publish Status</label>
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
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-200">
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
