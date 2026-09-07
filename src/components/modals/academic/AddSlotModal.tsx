'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SearchSelect } from '@/components/SearchSelect'
import { ScrollTable } from '@/components/ScrollTable'
import { useEmployees } from '@/hooks/employee/useEmployees'
import { useBatchTimes } from '@/hooks/config/useBatchTimes'
import { useTimeSlotDropdown } from '@/hooks/academic/useTimeSlots'
import { useWeekdays } from '@/hooks/config/useWeekdays'
import { useRooms } from '@/hooks/academic/useRooms'
import {
  useTimetableCourseUnits,
  useTimetableEligibleBatches,
  useTimetableDetail,
  useCreateTimetable,
  useUpdateTimetable,
  TimetableBatchLink,
} from '@/hooks/academic/useTimetable'
import { AuthError } from '@/lib/api/client'

interface AddSlotModalProps extends ModalProps {
  mode: 'add' | 'edit'
  // Locked to whatever the page's own View filter currently has selected —
  // there's no picker for either in this modal, matching how the page is
  // the one place that decides which intake/term is being scheduled.
  intakeGuid: string | null
  term: number
  // Edit mode only.
  timetableGuid?: string | null
}

// Create/Edit a timetable entry (post-timetable.md / put-timetable.md). One
// entry = one lecturer, in one room, at one time slot on one weekday,
// teaching one or more batches of ONE course unit — this modal deliberately
// scopes to a single Course Unit pick (unlike the doc's own `batches[]`,
// which technically allows different course units in the same entry) since
// GET /timetables/eligible-batches is itself scoped to one courseUnitGuid at
// a time; combining several different units into one entry would need a
// separate "add another course unit" picker this form doesn't have. Editing
// an existing entry whose batches already span more than one course unit
// only shows/keeps the ones matching whichever course unit this form has
// selected — a real, flagged limitation, not a silent data-loss risk (the
// PUT is a full replacement of `batches`, so submitting drops the others).
export function AddSlotModal({ isOpen, onClose, showToast, mode, intakeGuid, term, timetableGuid }: AddSlotModalProps) {
  const [lecturerGuid, setLecturerGuid] = useState('')
  const [batchTimeGuid, setBatchTimeGuid] = useState('')
  const [timeSlotGuid, setTimeSlotGuid] = useState('')
  const [weekDayGuid, setWeekDayGuid] = useState('')
  const [roomGuid, setRoomGuid] = useState('')
  const [load, setLoad] = useState('')
  const [url, setUrl] = useState('')
  const [courseUnitGuid, setCourseUnitGuid] = useState('')
  const [selectedBatchGuids, setSelectedBatchGuids] = useState<Set<string>>(new Set())
  const [failure, setFailure] = useState<string | null>(null)

  const isEdit = mode === 'edit'

  const { data: employees = [] } = useEmployees(isOpen)
  const lecturerOptions = employees.map(e => ({ value: e.employeeGuid, label: `${e.empName} (${e.shortCode})` }))

  const { data: batchTimes = [] } = useBatchTimes()
  const batchTimeOptions = batchTimes.map(b => ({ value: b.batchTimeGuid, label: b.batchTime }))

  const { data: timeSlots = [] } = useTimeSlotDropdown(batchTimeGuid || null)
  const timeSlotOptions = timeSlots.map(t => ({ value: t.timeSlotGuid, label: `${t.timeSlot} (${t.startTime.slice(0, 5)}–${t.endTime.slice(0, 5)})` }))

  const { data: weekdays = [] } = useWeekdays()
  const weekdayOptions = weekdays.map(w => ({ value: w.weekDayGuid, label: w.dayName }))

  const { data: rooms = [] } = useRooms()
  const roomOptions = rooms.map(r => ({ value: r.roomGuid, label: r.location ? `${r.roomCode} — ${r.location}` : r.roomCode }))
  const selectedRoom = rooms.find(r => r.roomGuid === roomGuid)

  const { data: courseUnits = [] } = useTimetableCourseUnits(intakeGuid, term, isOpen)
  // courseUnitCode/courseUnitName are both nullable per get-courseunit-
  // dropdown.md — guarded rather than interpolating a literal "null" into
  // the label.
  const courseUnitOptions = courseUnits.map(c => ({ value: c.courseUnitGuid, label: `${c.courseUnitCode ?? '—'} — ${c.courseUnitName ?? 'Unnamed course unit'}` }))

  const { data: eligibleBatches = [], isLoading: isBatchesLoading } = useTimetableEligibleBatches(intakeGuid, term, courseUnitGuid || null, isOpen)

  const { data: detail } = useTimetableDetail(isEdit ? timetableGuid ?? null : null, isOpen && isEdit)

  const createTimetableMutation = useCreateTimetable()
  const updateTimetableMutation = useUpdateTimetable()

  function resetForm() {
    setLecturerGuid('')
    setBatchTimeGuid('')
    setTimeSlotGuid('')
    setWeekDayGuid('')
    setRoomGuid('')
    setLoad('')
    setUrl('')
    setCourseUnitGuid('')
    setSelectedBatchGuids(new Set())
    setFailure(null)
  }

  // Reset on open for Add mode; prefill from the fetched detail for Edit —
  // same "guard on isOpen, re-run once detail resolves" convention as this
  // app's other real Edit modals.
  useEffect(() => {
    if (!isOpen) return
    if (!isEdit) { resetForm(); return }
    if (!detail) return
    setLecturerGuid(detail.lecturerGuid)
    setBatchTimeGuid(detail.batchTimeGuid)
    setTimeSlotGuid(detail.timeSlotGuid)
    setWeekDayGuid(detail.weekDayGuid)
    setRoomGuid(detail.roomGuid)
    setLoad(String(detail.load))
    setUrl(detail.url ?? '')
    // See this component's own header comment — only the first course unit
    // present on the existing entry's batches is offered for editing here.
    const firstCourseUnitGuid = detail.batches[0]?.courseUnitGuid ?? ''
    setCourseUnitGuid(firstCourseUnitGuid)
    setSelectedBatchGuids(new Set(detail.batches.filter(b => b.courseUnitGuid === firstCourseUnitGuid).map(b => b.batchGuid)))
    setFailure(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEdit, detail])

  // Changing the course unit invalidates whatever batches were checked for
  // the previous one — eligible-batches is scoped per course unit, so a
  // stale batchGuid from a different unit would silently 400 as
  // "Batch not found" on submit otherwise.
  function changeCourseUnit(v: string) {
    setCourseUnitGuid(v)
    setSelectedBatchGuids(new Set())
  }

  function toggleBatch(batchGuid: string) {
    setSelectedBatchGuids(prev => {
      const next = new Set(prev)
      if (next.has(batchGuid)) next.delete(batchGuid)
      else next.add(batchGuid)
      return next
    })
  }

  if (!isOpen) return null

  function handleClose() {
    resetForm()
    onClose()
  }

  function handleSubmit() {
    if (!intakeGuid) { showToast('No academic session selected.', 'warn'); return }
    if (!lecturerGuid) { showToast('Please select a Lecturer.', 'warn'); return }
    if (!batchTimeGuid) { showToast('Please select a Batch Time.', 'warn'); return }
    if (!timeSlotGuid) { showToast('Please select a Time Slot.', 'warn'); return }
    if (!weekDayGuid) { showToast('Please select a Day.', 'warn'); return }
    if (!roomGuid) { showToast('Please select a Room.', 'warn'); return }
    if (!courseUnitGuid) { showToast('Please select a Course Unit.', 'warn'); return }
    if (selectedBatchGuids.size === 0) { showToast('Please select at least one batch to schedule.', 'warn'); return }
    const loadNum = +load
    if (!load.trim() || isNaN(loadNum) || loadNum <= 0) { showToast('Load must be greater than 0.', 'warn'); return }

    const batches: TimetableBatchLink[] = eligibleBatches
      .filter(b => selectedBatchGuids.has(b.batchGuid))
      .map(b => ({ courseUnitGuid, batchGuid: b.batchGuid, semesterGuid: b.semesterGuid }))

    const input = {
      batchTimeGuid,
      lecturerGuid,
      timeSlotGuid,
      weekDayGuid,
      roomGuid,
      intakeGuid,
      term,
      load: loadNum,
      url: url.trim() || null,
      batches,
    }

    setFailure(null)
    if (isEdit) {
      if (!timetableGuid) return
      updateTimetableMutation.mutate(
        { guid: timetableGuid, input },
        {
          onSuccess: () => { showToast('Timetable entry updated', 'success'); handleClose() },
          onError: (error: Error) => {
            // Clash rejections (lecturer/batch already scheduled at this
            // slot+day) and every "not found" case come back as a plain
            // message on the generic-failure branch — surface as-is.
            const code = error instanceof AuthError ? error.code : undefined
            setFailure(error.message || `Failed to update timetable entry${code ? ` (${code})` : ''}. Please try again.`)
          },
        },
      )
    } else {
      createTimetableMutation.mutate(input, {
        onSuccess: () => { showToast('Timetable entry created', 'success'); handleClose() },
        onError: (error: Error) => {
          const code = error instanceof AuthError ? error.code : undefined
          setFailure(error.message || `Failed to create timetable entry${code ? ` (${code})` : ''}. Please try again.`)
        },
      })
    }
  }

  const isSubmitting = createTimetableMutation.isPending || updateTimetableMutation.isPending

  return (
    <div className="modal-overlay open" id="add-slot-modal" onClick={handleClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-calendar"></i> {isEdit ? 'Edit Schedule' : 'Create New Schedule'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="g3">
          <div className="fg span2">
            <div className="lbl">Lecturer <span className="req">*</span></div>
            <SearchSelect placeholder="— Select Lecturer —" options={lecturerOptions} value={lecturerGuid} onChange={setLecturerGuid} />
          </div>
          <div className="fg">
            <div className="lbl">Load (Hrs) <span className="req">*</span></div>
            <input className="ctrl no-spinner" type="number" min={1} placeholder="e.g. 3" value={load} onChange={e => setLoad(e.target.value)} />
          </div>
        </div>

        <div className="sec-divider">Course Unit &amp; Batches</div>
        <div className="fg mb-[14px]">
          <div className="lbl">Course Unit <span className="req">*</span></div>
          <SearchSelect placeholder="— Select Course Unit —" options={courseUnitOptions} value={courseUnitGuid} onChange={changeCourseUnit} />
        </div>
        {courseUnitGuid && (
          <ScrollTable className="mb-[14px]">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Batch Code</th>
                  <th>Semester</th>
                  <th>Student Count</th>
                </tr>
              </thead>
              <tbody>
                {isBatchesLoading ? (
                  <tr><td colSpan={4} className="text-center text-g400" style={{ padding: 16 }}>Loading eligible batches…</td></tr>
                ) : eligibleBatches.length === 0 ? (
                  <tr><td colSpan={4} className="text-center text-g400" style={{ padding: 16 }}>No batches are eligible for this course unit in the current session/term.</td></tr>
                ) : eligibleBatches.map(b => (
                  <tr key={b.batchGuid}>
                    <td><input type="checkbox" checked={selectedBatchGuids.has(b.batchGuid)} onChange={() => toggleBatch(b.batchGuid)} /></td>
                    <td className="font-mono">{b.batchCode}</td>
                    <td>{b.semesterName}</td>
                    <td>{b.studentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        )}

        <div className="sec-divider">Time Slot &amp; Venue</div>
        <div className="g3">
          <div className="fg">
            <div className="lbl">Batch Time <span className="req">*</span></div>
            <SearchSelect
              placeholder="— Select Batch Time —"
              options={batchTimeOptions}
              value={batchTimeGuid}
              onChange={v => { setBatchTimeGuid(v); setTimeSlotGuid('') }}
            />
          </div>
          <div className="fg">
            <div className="lbl">Time Slot <span className="req">*</span></div>
            <SearchSelect
              placeholder={batchTimeGuid ? '— Select Time Slot —' : '— Select Batch Time First —'}
              options={timeSlotOptions}
              value={timeSlotGuid}
              onChange={setTimeSlotGuid}
              disabled={!batchTimeGuid}
            />
          </div>
          <div className="fg">
            <div className="lbl">Day <span className="req">*</span></div>
            <SearchSelect placeholder="— Select Day —" options={weekdayOptions} value={weekDayGuid} onChange={setWeekDayGuid} />
          </div>
          <div className="fg">
            <div className="lbl">Room / Venue <span className="req">*</span></div>
            <SearchSelect placeholder="— Select Room —" options={roomOptions} value={roomGuid} onChange={setRoomGuid} />
          </div>
          <div className="fg"><div className="lbl">Capacity</div><input className="ctrl" value={selectedRoom?.capacity ?? ''} disabled /></div>
          <div className="fg span3"><div className="lbl">Online URL <span className="text-g400" style={{ fontWeight: 500 }}>(optional)</span></div><input className="ctrl" placeholder="https://meet.isbat.ac.ug/… (for online/hybrid sessions)" value={url} onChange={e => setUrl(e.target.value)} /></div>
        </div>

        {failure && (
          <div className="danger-box mt-[10px]">
            <i className="lni lni-warning"></i> {failure}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isSubmitting} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}
