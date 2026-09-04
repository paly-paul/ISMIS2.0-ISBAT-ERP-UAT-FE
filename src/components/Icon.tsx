export type IconName =
  | 'user' | 'lock' | 'mail' | 'phone' | 'arrow' | 'back' | 'check'
  | 'alert' | 'shield' | 'grad' | 'brief' | 'eye' | 'eyeoff' | 'caps'
  | 'refresh' | 'clock' | 'doc' | 'sparkle'

interface IconProps {
  name: IconName
  size?: number
  color?: string
  stroke?: number
}

export default function Icon({ name, size = 16, color = 'currentColor', stroke = 1.75 }: IconProps) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (name) {
    case 'user':    return <svg {...p}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>
    case 'lock':    return <svg {...p}><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
    case 'mail':    return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></svg>
    case 'phone':   return <svg {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>
    case 'arrow':   return <svg {...p}><path d="M5 12h14M13 5l7 7-7 7"/></svg>
    case 'back':    return <svg {...p}><path d="M19 12H5M11 5l-7 7 7 7"/></svg>
    case 'check':   return <svg {...p}><path d="M5 12l4 4L19 6"/></svg>
    case 'alert':   return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16v.5"/></svg>
    case 'shield':  return <svg {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/></svg>
    case 'grad':    return <svg {...p}><path d="M2 9l10-4 10 4-10 4L2 9z"/><path d="M6 11v4c0 2 3 3 6 3s6-1 6-3v-4"/></svg>
    case 'brief':   return <svg {...p}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
    case 'eye':     return <svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
    case 'eyeoff':  return <svg {...p}><path d="M3 3l18 18"/><path d="M10.6 6.1A10.9 10.9 0 0 1 12 6c6.5 0 10 6 10 6a16 16 0 0 1-3.3 3.9"/><path d="M6.5 6.5C4 8.3 2 12 2 12s3.5 6 10 6c1.4 0 2.7-.3 3.9-.7"/></svg>
    case 'caps':    return <svg {...p}><path d="M12 4l7 8h-4v6h-6v-6H5l7-8z"/></svg>
    case 'refresh': return <svg {...p}><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>
    case 'clock':   return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
    case 'doc':     return <svg {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>
    case 'sparkle': return <svg {...p}><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z"/></svg>
    default: return null
  }
}
