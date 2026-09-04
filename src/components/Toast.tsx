'use client'

interface ToastProps {
  toast: { msg: string; type: string } | null
}

export function Toast({ toast }: ToastProps) {
  if (!toast) return null
  return (
    <div className={`toast${toast.type ? ' toast-' + toast.type : ''} show`}>
      {toast.msg}
    </div>
  )
}
