interface PolicyFooterProps {
  tone?: 'light' | 'dark'
  includeStudentSupport?: boolean
}

export default function PolicyFooter({ tone = 'light', includeStudentSupport = false }: PolicyFooterProps) {
  const color = tone === 'dark' ? 'rgba(255,255,255,.7)' : 'var(--isb-muted)'
  const linkColor = tone === 'dark' ? 'rgba(255,255,255,.85)' : 'var(--isb-ink-2)'
  const dotted = tone === 'dark' ? 'rgba(255,255,255,.35)' : 'var(--isb-line)'

  return (
    <div style={{ fontSize: 11, color, lineHeight: 1.6 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
        {[
          { href: '#', label: 'IT Policy' },
          { href: '#', label: 'Privacy Policy' },
          { href: '#', label: 'Data Security' },
          { href: '#', label: 'Data Processing Consent' },
        ].map(({ href, label }) => (
          <a
            key={label}
            href={href}
            style={{ color: linkColor, textDecoration: 'none', borderBottom: `1px dotted ${dotted}` }}
          >
            {label}
          </a>
        ))}
      </div>
      <div style={{ marginTop: 8 }}>
        IT Support ·{' '}
        <a href="mailto:itsupport@isbatuniversity.ac.ug" style={{ color: linkColor }}>
          itsupport@isbatuniversity.ac.ug
        </a>
        {' · '}
        <span className="nums">+256 414 532 500</span>
      </div>
      {includeStudentSupport && (
        <div style={{ marginTop: 4 }}>
          Student Support ·{' '}
          <a href="mailto:studentsupport@isbatuniversity.ac.ug" style={{ color: linkColor }}>
            studentsupport@isbatuniversity.ac.ug
          </a>
        </div>
      )}
    </div>
  )
}
