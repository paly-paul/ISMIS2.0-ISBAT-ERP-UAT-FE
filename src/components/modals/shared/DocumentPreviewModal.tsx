'use client'
import { useEffect, useState } from 'react'
import { DocumentPreview, resolveDocumentPreview, downloadDocument } from '@/lib/documentViewer'

interface DocumentPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  url: string | null
  title?: string
}

// Renders a document inline — PDFs in the browser's native viewer (iframe),
// images as <img>, Office files via Office Online. Anything else falls back to
// a Download prompt. See resolveDocumentPreview in lib/documentViewer.ts.
export function DocumentPreviewModal({ isOpen, onClose, url, title = 'Document Preview' }: DocumentPreviewModalProps) {
  const [preview, setPreview] = useState<DocumentPreview | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!isOpen || !url) return
    let cancelled = false
    let current: DocumentPreview | null = null
    setPreview(null)
    setFailed(false)
    resolveDocumentPreview(url)
      .then(p => { if (cancelled) p.revoke(); else { current = p; setPreview(p) } })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true; current?.revoke() }
  }, [isOpen, url])

  if (!isOpen || !url) return null

  return (
    <div className="modal-overlay open">
      <div className="modal modal-80" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', height: '90vh', overflow: 'hidden' }}>
        <div className="modal-hdr modal-hdr-blue shrink-0">
          <div className="modal-title"><i className="lni lni-eye"></i> {title}</div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ flex: 1, minHeight: 0, background: 'var(--g100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {failed ? (
            <div className="empty">
              <div className="empty-icon"><i className="lni lni-warning"></i></div>
              <div className="empty-title">Couldn&apos;t Load Document</div>
              <div className="empty-sub">The link may have expired. Try downloading it instead.</div>
            </div>
          ) : !preview ? (
            <span style={{ color: 'var(--g400)', fontSize: 12.5 }}>Loading document…</span>
          ) : preview.kind === 'image' ? (
            <img src={preview.src} alt={title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          ) : preview.kind === 'text' ? (
            <pre className="font-mono" style={{ alignSelf: 'stretch', width: '100%', margin: 0, padding: '18px 22px', overflow: 'auto', background: 'var(--white)', color: 'var(--g800)', fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {preview.text || 'This document is empty.'}
            </pre>
          ) : preview.kind === 'pdf' || preview.kind === 'office' ? (
            <iframe src={preview.src} title={title} style={{ width: '100%', height: '100%', border: 'none', background: 'var(--white)' }} />
          ) : (
            <div className="empty">
              <div className="empty-icon"><i className="lni lni-files"></i></div>
              <div className="empty-title">Preview Not Available</div>
              <div className="empty-sub">This file type can&apos;t be shown in the browser. Download it to view.</div>
            </div>
          )}
        </div>

        <div className="modal-footer shrink-0">
          <button className="btn btn-neu" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => downloadDocument(url)}><i className="lni lni-download"></i> Download</button>
        </div>
      </div>
    </div>
  )
}
