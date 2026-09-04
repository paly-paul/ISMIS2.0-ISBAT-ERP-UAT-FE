'use client'

import { useRef } from 'react'

interface OtpInputProps {
  value: string[]
  onChange: (value: string[]) => void
}

export default function OtpInput({ value, onChange }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const set = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return
    const next = [...value]
    next[i] = v
    onChange(next)
    if (v && i < 5) refs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      refs.current[i - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('')
    const next = [...value]
    digits.forEach((d, idx) => { next[idx] = d })
    onChange(next)
    refs.current[Math.min(digits.length, 5)]?.focus()
  }

  return (
    <div className="isb-otp">
      {value.map((v, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          value={v}
          onChange={e => set(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          maxLength={1}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
        />
      ))}
    </div>
  )
}
