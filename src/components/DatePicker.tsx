import React, { useState, useEffect, useRef } from 'react'
import { SearchSelect } from '@/components/SearchSelect'

interface Props {
  value?: string // yyyy-mm-dd
  onChange: (ymd: string) => void
  placeholder?: string
  maxYmd?: string // optional max allowed date (yyyy-mm-dd)
  // Mirrors the app-wide "red border on the .ctrl element" validation
  // convention used by plain <input>s elsewhere — lets call sites keep that
  // same visual behavior after swapping from a native date input to this.
  hasError?: boolean
}

function pad(n: number) { return String(n).padStart(2, '0') }

function toDisplay(ymd?: string) {
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

function ymdToDate(ymd?: string) {
  if (!ymd) return null
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function dateToYmd(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Live dd/mm/yyyy formatting as the user types — strips anything that
// isn't a digit and re-inserts the slashes at the right positions, so
// typing "12011985" progressively reads "12" → "12/01" → "12/01/1985"
// instead of sitting there as a bare number until blur (which is what made
// it look like a numeric field rather than a date one). Deleting a slash
// with backspace still works correctly since this rebuilds from the digits
// alone every time, not from cursor position.
function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function compareYmd(left?: string, right?: string) {
  if (!left || !right) return 0
  const [leftY, leftM, leftD] = left.split('-').map(Number)
  const [rightY, rightM, rightD] = right.split('-').map(Number)
  if (!leftY || !leftM || !leftD || !rightY || !rightM || !rightD) return 0
  if (leftY !== rightY) return leftY - rightY
  if (leftM !== rightM) return leftM - rightM
  return leftD - rightD
}

export default function DatePicker({ value, onChange, placeholder = 'dd/mm/yyyy', maxYmd, hasError }: Props) {
  const [open, setOpen] = useState(false)
  const [display, setDisplay] = useState<string>(toDisplay(value))
  const [viewDate, setViewDate] = useState<Date>(ymdToDate(value) ?? new Date())
  const ref = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState('')

  useEffect(() => setDisplay(toDisplay(value)), [value])
  useEffect(() => setViewDate(ymdToDate(value) ?? new Date()), [value])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as HTMLElement
      // The month/year SearchSelect dropdowns inside the calendar render via
      // a React portal straight onto document.body (see SearchSelect.tsx),
      // so a click on one of their options lands physically outside this
      // component's own wrapper div. Without this check, that "outside"
      // click closed the whole calendar before the month/year selection
      // ever registered.
      if (target.closest('.ss-drop')) return
      if (ref.current && !ref.current.contains(target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function prevMonth() { const d = new Date(viewDate); d.setMonth(d.getMonth() - 1); setViewDate(d) }
  function nextMonth() { const d = new Date(viewDate); d.setMonth(d.getMonth() + 1); setViewDate(d) }

  function pick(day: number) {
    const d = new Date(viewDate)
    d.setDate(day)
    const ymd = dateToYmd(d)
    if (maxYmd && compareYmd(ymd, maxYmd) > 0) {
      setError('Date cannot be in the future')
      return
    }
    setError('')
    setDisplay(toDisplay(ymd))
    onChange(ymd)
    setOpen(false)
  }

  function daysMatrix(): (number | null)[] {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const first = new Date(year, month, 1)
    const startDay = (first.getDay() + 6) % 7 // Monday=0
    const days = new Date(year, month + 1, 0).getDate()
    const cells: (number | null)[] = []
    for (let i = 0; i < startDay; i++) cells.push(null)
    for (let d = 1; d <= days; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }

  // Shared by both onBlur (typed text is left incomplete/abandoned) and
  // onChange (typed text just became a complete 8-digit date) — same
  // dd/mm/yyyy → ymd parse + max-date check either way.
  function commitDisplay(text: string) {
    const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (m) {
      const [, dd, mm, yyyy] = m
      const ymd = `${yyyy}-${mm}-${dd}`
      if (maxYmd && compareYmd(ymd, maxYmd) > 0) {
        setError('Date cannot be in the future')
        return
      }
      setError('')
      if (value !== ymd) onChange(ymd)
    } else if (!text) {
      if (value !== '') onChange('')
    }
  }

  function onInputChange(raw: string) {
    const formatted = formatDateInput(raw)
    setDisplay(formatted)
    // Commit as soon as the date is fully typed (dd/mm/yyyy complete) rather
    // than waiting for blur — matches picking a day on the calendar, which
    // already commits immediately on click.
    if (formatted.length === 10) commitDisplay(formatted)
  }

  function onInputBlur() {
    commitDisplay(display)
  }

  const monthName = viewDate.toLocaleString('en-GB', { month: 'long' })
  const year = viewDate.getFullYear()
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const currentYear = new Date().getFullYear()
  // Wide enough to cover both directions this component is actually used
  // for: Date of Birth fields (employee/student — needs 80-100 years back)
  // and forward-looking planning fields (intake/exam years — only a few
  // years out). The old range (currentYear ± 20) silently made anyone born
  // before ~2006 unable to pick their real birth year from the dropdown.
  const yearRange = Array.from({ length: 111 }, (_, i) => currentYear - 100 + i)
  const monthOptions = months.map((m, idx) => ({ value: String(idx), label: m }))
  const yearOptions = yearRange.map(y => ({ value: String(y), label: String(y) }))

  return (
    <>
      <div style={{ position: 'relative', width: '100%' }} ref={ref}>
      <div style={{ position: 'relative' }}>
        <input
          className="ctrl"
          type="text"
          placeholder={placeholder}
          value={display}
          onChange={e => onInputChange(e.target.value)}
          onBlur={onInputBlur}
          inputMode="numeric"
          maxLength={10}
          onFocus={() => setOpen(false)}
          style={{ minWidth: 120, width: '100%', paddingRight: 30, borderColor: hasError ? 'var(--red)' : undefined }}
        />
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-label="Open calendar"
          style={{
            position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, padding: 0, border: 'none', background: 'transparent',
            cursor: 'pointer', color: 'var(--g500)', fontSize: 14, lineHeight: 1,
          }}
        >
          <i className="lni lni-calendar" />
        </button>
      </div>

      {open && (
        <div
          style={{ position: 'absolute', zIndex: 60, marginTop: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.12)', background: 'white', borderRadius: 8 }}
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Fixed width, not just a minWidth — previously the popup had no
              real width cap and just grew to fit the header row (130px month
              + 96px year select + gaps + nav buttons, 300px+ total), which
              then stretched the 7-column day grid into oversized cells to
              match. ~228px is a normal compact-calendar width; the
              month/year select widths below are sized to still show every
              month name (up to "September") and a 4-digit year in full. */}
          <div style={{ padding: 8, width: 228 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 4 }}>
              <button type="button" className="btn btn-neu btn-sm" onMouseDown={e => e.preventDefault()} onClick={prevMonth} style={{ padding: '3px 6px' }}>{'<'}</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 106 }}>
                  {/* No `placeholder` here — month/year always have a real
                      value (there's no meaningful "cleared" state for the
                      calendar's own current view), but passing one is what
                      makes SearchSelect render its × clear button. That
                      button was eating into the narrow width from the
                      space-saving pass above, which is what left "September"/
                      "2026" truncated to "Septe…"/"2." despite the trigger
                      itself having room for the text alone. */}
                  <SearchSelect
                    options={monthOptions}
                    value={String(viewDate.getMonth())}
                    onChange={v => setViewDate(new Date(viewDate.getFullYear(), Number(v), 1))}
                  />
                </div>
                <div style={{ width: 66 }}>
                  <SearchSelect
                    options={yearOptions}
                    value={String(viewDate.getFullYear())}
                    onChange={v => setViewDate(new Date(Number(v), viewDate.getMonth(), 1))}
                  />
                </div>
              </div>
              <button type="button" className="btn btn-neu btn-sm" onMouseDown={e => e.preventDefault()} onClick={nextMonth} style={{ padding: '3px 6px' }}>{'>'}</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center', marginBottom: 4, color: '#666', fontSize: 10.5 }}>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {daysMatrix().map((cell, i) => {
                if (cell === null) return <div key={i} />
                const selDate = value && ymdToDate(value)
                const selected = selDate && selDate.getFullYear() === viewDate.getFullYear() && selDate.getMonth() === viewDate.getMonth() && selDate.getDate() === cell
                const cellDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), cell as number)
                const cellYmd = dateToYmd(cellDate)
                const disabled = !!maxYmd && compareYmd(cellYmd, maxYmd) > 0
                return (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { if (!disabled) pick(cell as number) }}
                    disabled={disabled}
                    aria-disabled={disabled}
                    style={{ padding: 5, borderRadius: 6, background: selected ? '#0b5cff' : 'transparent', color: selected ? 'white' : (disabled ? '#bbb' : '#111'), border: 'none', fontSize: 12, opacity: disabled ? 0.6 : 1 }}
                  >
                    {cell}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
      </div>
      {error && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 6 }}>{error}</div>}
    </>
  )
}
