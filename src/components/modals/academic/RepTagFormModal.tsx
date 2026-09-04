'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { RepetitionTagInput } from '@/lib/api/academic/repetitionTag'
import { useRepetitionTag } from '@/hooks/academic/useRepetitionTags'
import { useProgramLevels } from '@/hooks/academic/useProgramLevels'
import { AuthError } from '@/lib/api/client'

// Add and Edit share this form — differ in prefill and which mutation runs.
interface RepTagFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  courseUnitRepetitionGuid: string | null
  createRepetitionTag: {
    mutate: (input: RepetitionTagInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateRepetitionTag: {
    mutate: (variables: { guid: string; input: RepetitionTagInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function RepTagFormModal({ isOpen, onClose, showToast, mode, courseUnitRepetitionGuid, createRepetitionTag, updateRepetitionTag }: RepTagFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: tag, isLoading, isError, error } = useRepetitionTag(courseUnitRepetitionGuid, isOpen && isEdit)

  const [tagCode, setTagCode] = useState('')
  const [tagName, setTagName] = useState('')
  const [programLevelGuid, setProgramLevelGuid] = useState('')
  const [saved, setSaved]     = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [errors, setErrors]   = useState<Record<string, string>>({})

  const { data: programLevels = [] } = useProgramLevels()
  const programLevelOptions = programLevels.map(p => ({ value: p.programLevelGuid, label: p.levelName }))

  // Fill the form when the tag loads on edit, recovering the linked programme level; blank on fresh create.
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && tag) {
      setTagCode(tag.tagCode)
      setTagName(tag.tagName)
      setProgramLevelGuid(programLevels.find(p => p.levelCode === tag.levelCode)?.programLevelGuid ?? '')
      setErrors({})
    } else if (!isEdit) {
      setTagCode(''); setTagName(''); setProgramLevelGuid(''); setErrors({})
    }
  }, [isOpen, isEdit, tag, programLevels])

  if (!isOpen) return null

  function handleClose() {
    setSaved(false); setFailure(null)
    setTagCode(''); setTagName(''); setProgramLevelGuid(''); setErrors({})
    onClose()
  }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!tagCode.trim()) e.tagCode = 'Repetition Tag Code is required'
    if (!tagName.trim()) e.tagName = 'Description is required'
    if (!programLevelGuid) e.programLevelGuid = 'Please select a Programme Level'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const input: RepetitionTagInput = { tagCode, tagName, programLevelGuid }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Repetition tag updated successfully' : 'Repetition tag added successfully') }
    const onError = (error: Error) => {
      const code = error instanceof AuthError ? error.code : undefined
      setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} repetition tag${code ? ` (${code})` : ''}. Please try again.`)
    }

    if (isEdit && courseUnitRepetitionGuid) {
      updateRepetitionTag.mutate({ guid: courseUnitRepetitionGuid, input }, { onSuccess, onError })
    } else {
      createRepetitionTag.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateRepetitionTag.isPending : createRepetitionTag.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Repetition Tag Updated!' : 'Repetition Tag Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new repetition tag has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Repetition Tag" : "Couldn't Add Repetition Tag"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Repetition Tag"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load repetition tag details.') : 'Failed to load repetition tag details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !tag)) {
    return (
      <div className="modal-overlay open" id="edit-rep-tag-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Repetition Tag</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading repetition tag details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-rep-tag-modal' : 'new-rep-tag-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-reload'}`}></i> {isEdit ? 'Edit Repetition Tag' : 'Add Repetition Tag'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Repetition Tag Code <span className="req">*</span></div>
            <input
              className="ctrl font-mono uppercase"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. RT-CU-001'}
              maxLength={20}
              value={tagCode}
              onChange={e => { setTagCode(e.target.value.toUpperCase()); clearError('tagCode') }}
              style={errors.tagCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.tagCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.tagCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Programme Level <span className="req">*</span></div>
            <SearchSelect
              placeholder="Select level…"
              value={programLevelGuid}
              onChange={v => { setProgramLevelGuid(v); clearError('programLevelGuid') }}
              options={programLevelOptions}
            />
            {errors.programLevelGuid && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.programLevelGuid}</p>}
          </div>
          <div className="fg span2">
            <div className="lbl">Description <span className="req">*</span></div>
            <input
              className="ctrl"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. Standard repeat for failed course units'}
              value={tagName}
              onChange={e => { setTagName(e.target.value); clearError('tagName') }}
              style={errors.tagName ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.tagName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.tagName}</p>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Repetition Tag' : 'Add Repetition Tag')}
          </button>
        </div>
      </div>
    </div>
  )
}
