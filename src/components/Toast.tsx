'use client'

interface ToastProps {
  toast: { msg: string; type: string } | null
  onClose?: () => void
}

export function Toast({ toast, onClose }: ToastProps) {
  if (!toast) return null
  const rawType = (toast.type || '').toLowerCase().trim()
  const normalizedType =
    rawType === 'error' || rawType === 'err' || rawType === 'danger'
      ? 'danger'
      : rawType === 'success' || rawType === 'ok'
      ? 'success'
      : rawType === 'warning' || rawType === 'warn'
      ? 'warn'
      : rawType === 'info'
      ? 'info'
      : rawType

  const icon =
    normalizedType === 'success'
      ? 'lni-checkmark-circle'
      : normalizedType === 'danger'
      ? 'lni-warning'
      : normalizedType === 'warn'
      ? 'lni-alarm'
      : normalizedType === 'info'
      ? 'lni-information'
      : null

  return (
    <div className={`toast${normalizedType ? ' toast-' + normalizedType : ''} show`}>
      {icon && <i className={`lni ${icon}`} style={{ fontSize: 18, flexShrink: 0 }} />}
      <span style={{ flex: 1 }}>{toast.msg}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notification"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            opacity: 0.8,
            cursor: 'pointer',
            padding: '0 4px',
            fontSize: 16,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            marginLeft: 8,
          }}
          className="hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      )}
    </div>
  )
}
