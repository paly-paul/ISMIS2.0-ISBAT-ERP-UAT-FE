'use client'

import { useState, useEffect } from 'react'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import DatePicker from '@/components/DatePicker'
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

export function CbtScheduleModal({ isOpen, onClose, testGuid, unitCode, unitName }: CbtScheduleModalProps) {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [saved, setSaved] = useState(false)
  const showToast = (msg: string, type: string = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Fetch current schedule
  const { data: schedule, isLoading } = useIaTestSchedule(testGuid)
  const updateMut = useUpdateIaTestSchedule(testGuid || '')

  // Form State
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [duration, setDuration] = useState<number | ''>('')
  const [maxMark, setMaxMark] = useState<number | ''>('')
  const [testType, setTestType] = useState<number>(0)
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
      setDuration(schedule.durationMinutes ?? '')
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
        setDuration('')
        setMaxMark('')
        setTestType(0)
        setPublishStatus(0)
        setExamRuleGuid('')
    }
  }, [schedule, isOpen])

  // Auto-calculate duration based on start and end date/time
  useEffect(() => {
    if (startDate && startTime && endDate && endTime) {
      const startDt = new Date(`${startDate}T${startTime}`)
      const endDt = new Date(`${endDate}T${endTime}`)
      if (!isNaN(startDt.getTime()) && !isNaN(endDt.getTime()) && endDt > startDt) {
        const diffMs = endDt.getTime() - startDt.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        setDuration(diffMins)
      }
    }
  }, [startDate, startTime, endDate, endTime])

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
      if (err.code === 'not_found' || err.message?.includes('404')) {
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
      <div className="modal-overlay open" onClick={onClose}>
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
    <div className="modal-overlay open" onClick={onClose}>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Dates */}
              <div>
                <label className="lbl">Start Date & Time <span className="text-red-500">*</span></label>
                <div className="flex gap-2 mt-1">
                  <div className="flex-1">
                    <DatePicker value={startDate} onChange={setStartDate} />
                  </div>
                  <div className="w-[110px]">
                    <input type="time" className="ctrl w-full" value={startTime} onChange={e => setStartTime(e.target.value)} />
                  </div>
                </div>
              </div>
              <div>
                <label className="lbl">End Date & Time <span className="text-red-500">*</span></label>
                <div className="flex gap-2 mt-1">
                  <div className="flex-1">
                    <DatePicker value={endDate} onChange={setEndDate} />
                  </div>
                  <div className="w-[110px]">
                    <input type="time" className="ctrl w-full" value={endTime} onChange={e => setEndTime(e.target.value)} />
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
            
            <div className="mt-8 bg-[#eff6ff] border border-[#dbeafe] rounded-md p-3 flex gap-3 text-[12.5px] text-[#3b82f6] items-start">
              <div className="mt-0.5 text-[#2563eb]">
                <i className="lni lni-information"></i>
              </div>
              <div>
                Timing is controlled server-side. Balance time is saved to database on every student action (Save Next, Previous, Submit, Window Close) to handle connectivity interruptions.
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
      <Toast toast={toast} />
      <ExamRuleLookupModal 
        isOpen={lookupOpen} 
        onClose={() => setLookupOpen(false)} 
        onSelect={guid => setExamRuleGuid(guid)} 
      />
    </div>
  )
}
