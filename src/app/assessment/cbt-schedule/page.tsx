'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import DatePicker from '@/components/DatePicker'
import TimePicker from '@/components/TimePicker'
import { useIaTestSchedule, useUpdateIaTestSchedule } from '@/hooks/assessment/useIaTestSchedule'
import { useExamRules } from '@/hooks/assessment/useExamRules'
import Link from 'next/link'
import { ExamRuleLookupModal } from '@/app/assessment/ia-creation/_components/ExamRuleLookupModal'

function getTodayYmd(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function CbtScheduleContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const testGuid = searchParams.get('testGuid')
  const progName = searchParams.get('progName')
  const semName = searchParams.get('semName')
  const unitCode = searchParams.get('unitCode')
  const unitName = searchParams.get('unitName')

  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const showToast = (msg: string, type: string = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Fetch current schedule
  const { data: schedule, isLoading, isError: loadFailed, error: loadError } = useIaTestSchedule(testGuid)
  const [ruleError, setRuleError] = useState<string | null>(null)
  const [testMissing, setTestMissing] = useState(false)
  const [lookupOpen, setLookupOpen] = useState(false)
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
  const { data: rulesData, isLoading: rulesLoading } = useExamRules(1, 100, '')
  const activeRules = rulesData?.items?.filter(r => r.status === 2) || []
  const ruleOptions = activeRules.map(r => ({
    value: r.examRuleGuid,
    label: `${r.ruleCode} - ${r.ruleName}`
  }))

  // Populate form when data loads
  useEffect(() => {
    if (schedule) {
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
      }
    }
  }, [schedule])

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
        durationMinutes: Number(duration),
        maxMark: Number(maxMark),
        testType,
        publishStatus,
        examRuleGuid: examRuleGuid || null,
      })
      showToast('CBT Scheduled successfully')
      setTimeout(() => {
        router.push('/assessment/ia-creation')
      }, 1000)
    } catch (err: any) {
      // AuthError: `code` from the envelope, `message` = errors[0].
      const msg: string = err?.message || ''
      const lower = msg.toLowerCase()
      if (lower.includes('question') || lower.includes('paper') || lower.includes('qp')) {
        showToast('Please upload the question paper before scheduling the exam.', 'error')
        return
      }
      const aboutRule = /rule/i.test(msg)
      if (err?.code === 'not_found' && aboutRule) {
        // The picked rule no longer exists: clear it and ask for a re-pick.
        setExamRuleGuid('')
        setRuleError(msg || 'The selected exam rule no longer exists. Pick another one.')
      } else if (err?.code === 'not_found') {
        // The test itself is gone (deleted/changed since the grid loaded).
        setTestMissing(true)
        showToast(msg || 'This class test no longer exists.', 'error')
      } else if (err?.code === 'bad_request' && aboutRule) {
        // "Exam rule is not active" → inline on the rule field.
        setRuleError(msg)
      } else if (err?.code === 'validation_error') {
        const all: string[] = err?.errors?.length ? err.errors : [msg || 'Validation failed. Check your inputs.']
        showToast(all.join(' '), 'error')
      } else {
        showToast(msg || 'Failed to save the schedule.', 'error')
      }
    }
  }

  // Update-only page: a testGuid that doesn't resolve is an error, not a
  // prompt to create (cbt-schedule-page.md, Business logic notes).
  if (testGuid && (testMissing || (loadFailed && (loadError as { code?: string } | null)?.code === 'not_found'))) {
    return (
      <div className="page active">
        <div className="card p-8 text-center max-w-xl mx-auto mt-10">
          <i className="lni lni-warning text-3xl" style={{ color: 'var(--amber)' }}></i>
          <div className="text-lg font-semibold text-g900 mt-3">This class test no longer exists</div>
          <div className="text-sm text-g500 mt-1">It was deleted or changed after the Assessment Structure grid was loaded. Refresh the grid and pick the test again.</div>
          <Link href="/assessment/ia-creation" className="btn btn-primary mt-5 inline-flex"><i className="lni lni-arrow-left"></i> Back to Assessment Structure</Link>
        </div>
        <Toast toast={toast} />
      </div>
    )
  }

  if (!testGuid) {
    return (
      <div className="page active relative overflow-hidden flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
        {/* Background Decorative Elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-50/60 rounded-full blur-3xl -z-10 pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-100/50 rounded-full blur-2xl -z-10 pointer-events-none"></div>

        {/* Content */}
        <div className="text-blue-500 mb-8 relative flex items-center justify-center">
          <div className="absolute inset-0 bg-blue-200 rounded-full blur-lg opacity-50 animate-pulse"></div>
          <i className="lni lni-calendar relative text-7xl drop-shadow-sm"></i>
        </div>
        
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-4 text-center">
          Direct Access <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Restricted</span>
        </h2>
        
        <p className="text-slate-500 max-w-lg mx-auto text-center text-base leading-relaxed mb-10">
          CBT scheduling is linked to specific Class Tests. Please return to the <strong>Assessment Structure</strong> to select the test you wish to schedule.
        </p>

        <Link 
          href="/assessment/ia-creation" 
          className="group relative inline-flex items-center justify-center gap-3 bg-slate-900 text-white px-8 py-3.5 rounded-full font-medium shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:bg-slate-800 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:-translate-y-0.5 overflow-hidden"
        >
          <i className="lni lni-arrow-left transition-transform group-hover:-translate-x-1"></i>
          Return to Assessment Structure
        </Link>
      </div>
    )
  }

  return (
    <div className="page active pb-20">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">CBT Schedule</div>
          <div className="pg-sub">
            {progName} • {semName}
          </div>
        </div>
        <div className="pg-actions flex items-center gap-2">
          <Link href="/assessment/ia-creation" className="btn btn-neu btn-sm">
            Cancel
          </Link>
          <button
            className="btn btn-primary btn-sm flex items-center gap-1.5"
            onClick={handleSave}
            disabled={updateMut.isPending || isLoading}
          >
            {updateMut.isPending ? 'Saving...' : '+ Schedule CBT'}
          </button>
        </div>
      </div>

      <div className="card max-w-4xl">
        <div className="mb-6 border-b border-g200 pb-4">
          <div className="text-sm text-g500 font-medium mb-1">Class Test for Subject:</div>
          <div className="text-lg font-semibold text-g900">
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

        <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-opacity duration-300 ${isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          {/* Dates */}
            <div>
              <label className="lbl">Start Date & Time <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
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
              <div className="flex gap-2">
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
            <div>
              <label className="lbl">Max Mark <span className="text-red-500">*</span></label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="ctrl w-full"
                value={maxMark}
                onChange={e => setMaxMark(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label className="lbl">Duration (mins) <span className="text-red-500">*</span></label>
              <input
                type="number"
                min="1"
                className="ctrl w-full"
                value={duration}
                onChange={e => setDuration(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>

            {/* Radio options */}
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
          <div className="md:col-span-2">
            <label className="lbl">Exam Rule (Optional)</label>
            <div className="flex gap-2 mt-1 max-w-xl">
              <SearchSelect
                options={ruleOptions}
                value={examRuleGuid}
                onChange={val => { setExamRuleGuid(val); setRuleError(null) }}
                placeholder={rulesLoading ? "Loading rules..." : "Select Exam Rule..."}
                className="flex-1 min-w-0"
                disabled={isLoading || rulesLoading}
              />
              <button type="button" className="btn btn-neu" onClick={() => setLookupOpen(true)} disabled={isLoading} title="Search exam rules" aria-label="Search exam rules">
                <i className="lni lni-search-alt"></i>
              </button>
              {/* Clearing unlinks the rule: Save sends examRuleGuid: null. */}
              <button type="button" className="btn btn-neu" onClick={() => { setExamRuleGuid(''); setRuleError(null) }} disabled={isLoading || !examRuleGuid} title="Unlink exam rule">
                Clear
              </button>
            </div>
            {ruleError && <div className="text-xs mt-1" style={{ color: 'var(--red)' }}><i className="lni lni-warning"></i> {ruleError}</div>}
            <ExamRuleLookupModal isOpen={lookupOpen} onClose={() => setLookupOpen(false)} onSelect={guid => { setExamRuleGuid(guid); setRuleError(null) }} selectedGuid={examRuleGuid} />
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
      </div>

      <Toast toast={toast} />
    </div>
  )
}

export default function CbtSchedulePage() {
  return (
    <Suspense fallback={<div className="page active p-10">Loading...</div>}>
      <CbtScheduleContent />
    </Suspense>
  )
}
