'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { StreamInput } from '@/lib/api/academic/stream'
import { useStream } from '@/hooks/config/useStreams'
import { AuthError } from '@/lib/api/client'

interface StreamFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  streamGuid: string | null
  createStream: {
    mutate: (input: StreamInput, options?: { onSuccess?: () => void }) => void
    isPending: boolean
  }
  updateStream: {
    mutate: (variables: { guid: string; input: StreamInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function StreamFormModal({ isOpen, onClose, showToast, mode, streamGuid, createStream, updateStream }: StreamFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: stream, isLoading, isError, error } = useStream(isEdit ? streamGuid : null, isOpen && isEdit)

  const [saved, setSaved]           = useState(false)
  const [failure, setFailure]       = useState<string | null>(null)
  const [streamCode, setStreamCode] = useState('')
  const [streamName, setStreamName] = useState('')
  const [errors, setErrors]         = useState<Record<string, string>>({})

  // Fill the form when the selected stream loads.
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && stream) {
      setStreamCode(stream.streamCode)
      setStreamName(stream.streamName)
    } else if (!isEdit) {
      setStreamCode(''); setStreamName('')
    }
    setErrors({})
  }, [isOpen, isEdit, stream])

  if (!isOpen) return null

  function handleClose() { setSaved(false); setFailure(null); setErrors({}); onClose() }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!streamCode.trim()) e.streamCode = 'Stream Code is required'
    if (!streamName.trim()) e.streamName = 'Stream Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const input: StreamInput = { streamCode, streamName }

    if (isEdit && streamGuid) {
      updateStream.mutate(
        { guid: streamGuid, input },
        {
          onSuccess: () => { setSaved(true); showToast('Stream updated successfully') },
          onError: (error: Error) => setFailure(error.message || 'Failed to update stream. Please try again.'),
        },
      )
    } else {
      createStream.mutate(input, { onSuccess: () => { setSaved(true); showToast('Stream added successfully') } })
    }
  }

  const isPending = isEdit ? updateStream.isPending : createStream.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Stream Updated!' : 'Stream Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new specialization stream has been saved successfully.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (failure) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup title="Couldn't Update Stream" subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Stream"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load stream details.') : 'Failed to load stream details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !stream)) {
    return (
      <div className="modal-overlay open" id="edit-stream-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Stream</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading stream details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-stream-modal' : 'new-stream-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-certificate'}`}></i> {isEdit ? 'Edit Stream' : 'Add Stream'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Stream Code <span className="req">*</span></div>
            <input
              className="ctrl font-mono uppercase"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. SE'}
              maxLength={8}
              value={streamCode}
              onChange={e => { setStreamCode(e.target.value); clearError('streamCode') }}
              style={errors.streamCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.streamCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.streamCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Stream Name <span className="req">*</span></div>
            <input
              className="ctrl"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. Software Engineering'}
              value={streamName}
              onChange={e => { setStreamName(e.target.value); clearError('streamName') }}
              style={errors.streamName ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.streamName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.streamName}</p>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Stream' : 'Add Stream')}
          </button>
        </div>
      </div>
    </div>
  )
}
