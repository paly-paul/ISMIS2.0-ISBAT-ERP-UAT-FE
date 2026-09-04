const LABELS = ['Weak', 'Fair', 'Good', 'Strong']
const COLORS = ['#C84848', '#D9A51E', '#2EA862', '#2EA862']

interface StrengthBarProps {
  level?: 0 | 1 | 2 | 3
}

export default function StrengthBar({ level = 0 }: StrengthBarProps) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              flex: 1, height: 3, borderRadius: 3,
              background: i <= level ? COLORS[level] : 'var(--isb-line)',
              transition: 'background .2s',
            }}
          />
        ))}
      </div>
      <div style={{
        fontSize: 11, color: 'var(--isb-muted)', marginTop: 6,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>Password strength</span>
        <span style={{ color: COLORS[level], fontWeight: 500 }}>{LABELS[level]}</span>
      </div>
    </div>
  )
}

// Estimate password strength from the input.
export function computeStrength(pw: string): 0 | 1 | 2 | 3 {
  let score = 0
  if (pw.length >= 10) score++
  if (/\d/.test(pw)) score++
  if (/[^a-zA-Z0-9]/.test(pw)) score++
  return Math.min(score, 3) as 0 | 1 | 2 | 3
}
