'use client'

interface ToastProps {
  toast: { msg: string; type: string } | null
}

export function Toast({ toast }: ToastProps) {
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
    </div>
  )
}
