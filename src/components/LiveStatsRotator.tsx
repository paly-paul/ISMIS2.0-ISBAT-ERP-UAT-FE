'use client'

import { useState, useEffect } from 'react'

const STATS = [
  { big: '400+',   label: 'Students enrolled this intake',    trend: '+6.2% vs last intake' },
  { big: '142',    label: 'Applications being vetted today',  trend: 'Spring 2026 · 20261' },
  { big: '60+',    label: 'Active academic programmes',       trend: '12 undergraduate · 24 graduate' },
  { big: '418',    label: 'Faculty & teaching staff online',  trend: 'Last 24 hours' },
  { big: '98.4%',  label: 'Registrations completed on time', trend: 'Records · Spring 2026' },
]

export default function LiveStatsRotator({ intervalMs = 3200 }: { intervalMs?: number }) {
  const [i, setI] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setI(v => (v + 1) % STATS.length), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])

  const s = STATS[i]

  return (
    <div style={{ color: '#fff' }}>
      <div style={{
        fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
        opacity: .65, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span
          className="pulse"
          style={{ width: 6, height: 6, borderRadius: 99, background: '#7FE3AD', display: 'inline-block' }}
        />
        Live · Spring 2026 Intake
      </div>

      <div
        key={i}
        className="fade-up nums"
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 72, lineHeight: 1, fontWeight: 500, letterSpacing: '-0.02em',
        }}
      >
        {s.big}
      </div>

      <div key={`l${i}`} className="fade-up" style={{ fontSize: 15, opacity: .9, marginTop: 12, maxWidth: 340 }}>
        {s.label}
      </div>

      <div key={`t${i}`} className="fade-up" style={{ fontSize: 12, opacity: .55, marginTop: 6 }}>
        {s.trend}
      </div>

      {/* Dots */}
      <div style={{ display: 'flex', gap: 5, marginTop: 34 }}>
        {STATS.map((_, idx) => (
          <div
            key={idx}
            style={{
              width: idx === i ? 22 : 6, height: 3, borderRadius: 3,
              background: idx === i ? '#fff' : 'rgba(255,255,255,.3)',
              transition: 'all .4s',
            }}
          />
        ))}
      </div>
    </div>
  )
}
