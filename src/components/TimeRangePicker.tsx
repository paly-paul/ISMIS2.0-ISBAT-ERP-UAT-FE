import TimePicker from './TimePicker'

// Start + End TimePickers side by side, for a time window on one date (e.g.
// a University Exam slot). Values are "HH:mm" (24h) like TimePicker. Flags an
// End that isn't after Start inline; the caller should still block saving.
interface Props {
  start: string
  end: string
  onStartChange: (hhmm: string) => void
  onEndChange: (hhmm: string) => void
  startLabel?: string
  endLabel?: string
  required?: boolean
  disabled?: boolean
  minuteStep?: number
  labelClassName?: string // to match a form that doesn't use .lbl
}

export function isTimeRangeValid(start: string, end: string) {
  return !!start && !!end && end > start // "HH:mm" compares correctly as text
}

export default function TimeRangePicker({
  start,
  end,
  onStartChange,
  onEndChange,
  startLabel = 'Start Time',
  endLabel = 'End Time',
  required,
  disabled,
  minuteStep,
  labelClassName = 'lbl',
}: Props) {
  const endBeforeStart = !!start && !!end && !isTimeRangeValid(start, end)
  const req = required ? <span className="text-red-500"> *</span> : null

  return (
    <div>
      <div className="flex gap-2">
        <div className="flex-1 min-w-0">
          <label className={labelClassName}>{startLabel}{req}</label>
          <div className="mt-1">
            <TimePicker value={start} onChange={onStartChange} disabled={disabled} minuteStep={minuteStep} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <label className={labelClassName}>{endLabel}{req}</label>
          <div className="mt-1">
            <TimePicker value={end} onChange={onEndChange} disabled={disabled} minuteStep={minuteStep} hasError={endBeforeStart} />
          </div>
        </div>
      </div>
      {endBeforeStart && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>End time must be after start time.</div>}
    </div>
  )
}
