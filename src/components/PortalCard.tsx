'use client'

import { useState } from 'react'
import Icon, { type IconName } from './Icon'

interface PortalCardProps {
  onClick: () => void
  icon: IconName
  title: string
  sub: string
  meta: string
  accent: string
}

export default function PortalCard({ icon, title, sub, meta, accent, onClick }: PortalCardProps) {
  const [hover, setHover] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        all: 'unset', cursor: 'pointer',
        display: 'grid', gridTemplateColumns: '44px 1fr auto',
        alignItems: 'center', gap: 16, padding: '18px 20px', borderRadius: 10,
        border: `1px solid ${hover ? accent : 'var(--isb-line)'}`,
        background: hover ? '#fff' : 'var(--isb-paper-2)',
        boxShadow: hover ? `0 6px 20px rgba(14,22,40,.06), 0 0 0 3px ${accent}18` : 'none',
        transition: 'all .18s', width: '100%',
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 10, background: `${accent}15`,
        color: accent, display: 'grid', placeContent: 'center', flexShrink: 0,
      }}>
        <Icon name={icon} size={22} color={accent} stroke={1.6} />
      </div>
      <div style={{ textAlign: 'left', minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500,
          color: 'var(--isb-ink)',
        }}>
          {title}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--isb-muted)', marginTop: 2 }}>{sub}</div>
        <div style={{
          fontSize: 10.5, color: 'var(--isb-muted)', fontFamily: 'var(--font-mono)',
          marginTop: 6, opacity: .7,
        }}>
          {meta}
        </div>
      </div>
      <Icon name="arrow" size={18} color={accent} />
    </button>
  )
}
