import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Companion to DatePicker: a .ctrl input showing "hh:mm AM" plus a clock
// button that opens hour / minute / AM-PM columns. The value is "HH:mm"
// (24h), the same string a native <input type="time"> gives, so it drops in
// wherever one was used.
interface Props {
  value?: string // HH:mm, 24h
  onChange: (hhmm: string) => void
  placeholder?: string
  minuteStep?: number // minute column step; typed values can be any minute
  disabled?: boolean
  hasError?: boolean
}

function pad(n: number) { return String(n).padStart(2, '0') }

function parseHhmm(v?: string): { h: number; m: number } | null {
  const m = v?.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = Number(m[1]); const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return { h, m: min }
}

function toDisplay(v?: string) {
  const t = parseHhmm(v)
  if (!t) return ''
  const h12 = t.h % 12 === 0 ? 12 : t.h % 12
  return `${pad(h12)}:${pad(t.m)} ${t.h < 12 ? 'AM' : 'PM'}`
}

// Accepts what people type: "9", "930", "9:30", "9.30 pm", "21:30", "12am".
// Without AM/PM, 1–6 is read as PM (exam hours), everything else as written.
function parseTyped(raw: string): string | null {
  const text = raw.trim().toLowerCase()
  if (!text) return ''
  const m = text.match(/^(\d{1,2})(?:[:.\s]?(\d{2}))?\s*(am|pm|a|p)?$/)
  if (!m) return null
  let h = Number(m[1]); const min = m[2] ? Number(m[2]) : 0
  const mer = m[3]?.[0]
  if (min > 59) return null
  if (mer) {
    if (h < 1 || h > 12) return null
    if (mer === 'p' && h !== 12) h += 12
    if (mer === 'a' && h === 12) h = 0
  } else {
    if (h > 23) return null
    if (h >= 1 && h <= 6) h += 12
  }
  return `${pad(h)}:${pad(min)}`
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)

export default function TimePicker({ value, onChange, placeholder = 'hh:mm', minuteStep = 1, disabled, hasError }: Props) {
  const [open, setOpen] = useState(false)
  const [display, setDisplay] = useState(toDisplay(value))
  const [error, setError] = useState('')
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number }>({ top: 0, left: 0 })
  const ref = useRef<HTMLDivElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => setDisplay(toDisplay(value)), [value])

  const t = parseHhmm(value)
  const selH12 = t ? (t.h % 12 === 0 ? 12 : t.h % 12) : null
  const selMer = t ? (t.h < 12 ? 'AM' : 'PM') : null
  // Keep an off-step minute (e.g. 08:54) visible and selected in the list.
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep)
  if (t && !minutes.includes(t.m)) { minutes.push(t.m); minutes.sort((a, b) => a - b) }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as Node
      if (popRef.current?.contains(target) || ref.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function updatePos() {
    const anchor = ref.current
    if (!anchor) return
    const b = anchor.getBoundingClientRect()
    const height = 290
    const below = window.innerHeight - b.bottom - 10
    const above = b.top - 10
    if (below < height && above > below) setPos({ bottom: window.innerHeight - b.top + 4, left: b.left })
    else setPos({ top: b.bottom + 6, left: b.left })
  }

  useEffect(() => {
    if (!open) return
    updatePos()
    const reposition = () => updatePos()
    window.addEventListener('resize', reposition)
    document.addEventListener('scroll', reposition, true)
    // Centre the selected hour / minute in each column. Measured from screen
    // positions — offsetTop is unreliable inside the fixed-position popover.
    requestAnimationFrame(() => {
      popRef.current?.querySelectorAll<HTMLElement>('.pk-col .pk-sel').forEach(el => {
        const col = el.parentElement
        if (!col) return
        const c = col.getBoundingClientRect()
        const r = el.getBoundingClientRect()
        col.scrollTop += r.top - c.top - (c.height - r.height) / 2
      })
    })
    return () => {
      window.removeEventListener('resize', reposition)
      document.removeEventListener('scroll', reposition, true)
    }
  }, [open])

  // Picking any part keeps the others; with no value yet, defaults to :00 AM.
  function set(part: { h12?: number; m?: number; mer?: 'AM' | 'PM' }) {
    const h12 = part.h12 ?? selH12 ?? 9
    const mer = part.mer ?? selMer ?? 'AM'
    const min = part.m ?? t?.m ?? 0
    const h = (h12 % 12) + (mer === 'PM' ? 12 : 0)
    setError('')
    onChange(`${pad(h)}:${pad(min)}`)
  }

  function commitTyped() {
    const parsed = parseTyped(display)
    if (parsed === null) { setError('Enter a time like 09:30 AM'); return }
    setError('')
    if (parsed !== (value ?? '')) onChange(parsed)
    else setDisplay(toDisplay(value))
  }

  return (
    <>
      <div ref={ref} style={{ position: 'relative', width: '100%' }}>
        <input
          className="ctrl"
          type="text"
          placeholder={placeholder}
          value={display}
          disabled={disabled}
          onChange={e => setDisplay(e.target.value)}
          onBlur={commitTyped}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          onFocus={() => setOpen(false)}
          style={{ width: '100%', paddingRight: 30, borderColor: hasError || error ? 'var(--red)' : undefined }}
        />
        <button
          type="button"
          aria-label="Open time picker"
          disabled={disabled}
          onClick={() => { if (!open) updatePos(); setOpen(v => !v) }}
          style={{
            position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, padding: 0, border: 'none', background: 'transparent',
            cursor: disabled ? 'not-allowed' : 'pointer', color: 'var(--g500)', fontSize: 14, lineHeight: 1,
          }}
        >
          <i className="lni lni-alarm-clock" />
        </button>
      </div>
      {error && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{error}</div>}

      {open && typeof window !== 'undefined' && createPortal(
        <div ref={popRef} className="pk-pop" style={{ top: pos.top, bottom: pos.bottom, left: pos.left }}>
          <div className="pk-cols">
            <div>
              <div className="pk-col-hdr">Hour</div>
              <div className="pk-col">
                {HOURS.map(h => (
                  <button key={h} type="button" className={`pk-cell${selH12 === h ? ' pk-sel' : ''}`} onMouseDown={e => e.preventDefault()} onClick={() => set({ h12: h })}>
                    {pad(h)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="pk-col-hdr">Min</div>
              <div className="pk-col">
                {minutes.map(m => (
                  <button key={m} type="button" className={`pk-cell${t?.m === m ? ' pk-sel' : ''}`} onMouseDown={e => e.preventDefault()} onClick={() => set({ m })}>
                    {pad(m)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="pk-col-hdr">&nbsp;</div>
              <div className="pk-col pk-col-static">
                {(['AM', 'PM'] as const).map(mer => (
                  <button key={mer} type="button" className={`pk-cell${selMer === mer ? ' pk-sel' : ''}`} onMouseDown={e => e.preventDefault()} onClick={() => set({ mer })}>
                    {mer}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="pk-foot">
            <button
              type="button"
              className="text-[13px] text-[#3a6bc9] hover:underline"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { const n = new Date(); onChange(`${pad(n.getHours())}:${pad(n.getMinutes())}`) }}
            >
              Now
            </button>
            <button type="button" className="btn btn-primary btn-sm" onMouseDown={e => e.preventDefault()} onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
