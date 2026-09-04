'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { ProgramGroupInput } from '@/lib/api/academic/programGroup'
import { useProgramGroup } from '@/hooks/academic/useProgramGroups'
import { useProgramLevels } from '@/hooks/academic/useProgramLevels'
import { AuthError } from '@/lib/api/client'

// Add and Edit share this form — differ in prefill, the post-save redirect
// (Add only), and which mutation runs.
interface ProgrammeGroupFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  programGroupGuid: string | null
  createProgramGroup: {
    mutate: (input: ProgramGroupInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateProgramGroup: {
    mutate: (variables: { guid: string; input: ProgramGroupInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function ProgrammeGroupFormModal({ isOpen, onClose, showToast, mode, programGroupGuid, createProgramGroup, updateProgramGroup }: ProgrammeGroupFormModalProps) {
  const isEdit = mode === 'edit'
  const router = useRouter()
  const { data: programGroup, isLoading, isError, error } = useProgramGroup(programGroupGuid, isOpen && isEdit)

  const [saved, setSaved]             = useState(false)
  const [failure, setFailure]         = useState<string | null>(null)
  // New-only: after a successful create, the page redirects to Programme
  // Master once the success popup is dismissed.
  const [redirectAfterClose, setRedirectAfterClose] = useState(false)
  const [groupCode, setGroupCode]     = useState('')
  const [groupName, setGroupName]     = useState('')
  const [programLevel, setProgramLevel] = useState('')
  const [errors, setErrors]           = useState<Record<string, string>>({})

  const { data: programLevels = [] } = useProgramLevels()
  const programLevelOptions = programLevels.map(l => ({ value: l.programLevelGuid, label: l.levelName }))

  // Prefill on edit once the group loads; re-runs per guid since react-query resets `programGroup` to undefined between them.
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && programGroup) {
      setGroupCode(programGroup.groupCode)
      setGroupName(programGroup.groupName)
      setProgramLevel(programGroup.programLevelGuid)
      setErrors({})
    } else if (!isEdit) {
      setGroupCode(''); setGroupName(''); setProgramLevel(''); setErrors({})
    }
  }, [isOpen, isEdit, programGroup])

  if (!isOpen) return null

  function handleClose() {
    setSaved(false); setFailure(null)
    setGroupCode(''); setGroupName(''); setProgramLevel(''); setErrors({})
    onClose()
    if (redirectAfterClose) {
      router.push('/academic/programme-master')
    }
    setRedirectAfterClose(false)
  }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!groupCode.trim()) e.groupCode = 'Group Code is required'
    if (!groupName.trim()) e.groupName = 'Group Name is required'
    if (!programLevel)     e.programLevel = 'Select a programme level before proceeding'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // Map known backend failures to a field error where the cause is
  // actionable right there (duplicate groupCode); anything else shows the
  // failure popup instead.
  function handleSaveError(error: Error) {
    const code = error instanceof AuthError ? error.code : undefined
    if (code === 'bad_request') {
      setErrors(prev => ({ ...prev, groupCode: error.message || 'A programme group with this code already exists.' }))
      return
    }
    setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} programme group. Please try again.`)
  }

  function handleSubmit() {
    if (!validate()) return
    const input: ProgramGroupInput = { groupCode, groupName, programLevelGuid: programLevel }

    if (isEdit && programGroupGuid) {
      updateProgramGroup.mutate(
        { guid: programGroupGuid, input },
        { onSuccess: () => { setSaved(true); showToast('Programme Group updated successfully') }, onError: handleSaveError },
      )
    } else {
      createProgramGroup.mutate(
        input,
        { onSuccess: () => { setSaved(true); setRedirectAfterClose(true); showToast('Programme Group added successfully') }, onError: handleSaveError },
      )
    }
  }

  const isPending = isEdit ? updateProgramGroup.isPending : createProgramGroup.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Programme Group Updated!' : 'Programme Group Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new programme group has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Programme Group" : "Couldn't Add Programme Group"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Programme Group"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load programme group details.') : 'Failed to load programme group details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !programGroup)) {
    return (
      <div className="modal-overlay open" id="edit-proggroup-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Programme Group</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading programme group details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-proggroup-modal' : 'new-proggroup-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title">
            <i className={`lni ${isEdit ? 'lni-pencil' : 'lni-folder'}`}></i> {isEdit ? <>Edit Programme Group — <span className="font-mono">{programGroup!.groupCode}</span></> : 'Add Programme Group'}
          </div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          {!isEdit && (
            <div className="fg span2">
              <div className="lbl">Programme Level <span className="req">*</span></div>
              <SearchSelect
                placeholder="Select programme level…"
                options={programLevelOptions}
                value={programLevel}
                onChange={v => { setProgramLevel(v); clearError('programLevel') }}
              />
              {errors.programLevel && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.programLevel}</p>}
            </div>
          )}
          <div className="fg">
            <div className="lbl">Group Code <span className="req">*</span></div>
            <input
              className="ctrl"
              placeholder="e.g. SCI"
              value={groupCode}
              onChange={e => { setGroupCode(e.target.value); clearError('groupCode') }}
              style={errors.groupCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.groupCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.groupCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Group Name <span className="req">*</span></div>
            <input
              className="ctrl"
              placeholder="e.g. Science Group"
              value={groupName}
              onChange={e => { setGroupName(e.target.value); clearError('groupName') }}
              style={errors.groupName ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.groupName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.groupName}</p>}
          </div>
          {isEdit && (
            <div className="fg span2">
              <div className="lbl">Programme Level <span className="req">*</span></div>
              <SearchSelect
                placeholder="Select programme level…"
                options={programLevelOptions}
                value={programLevel}
                onChange={v => { setProgramLevel(v); clearError('programLevel') }}
              />
              {errors.programLevel && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.programLevel}</p>}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Update Group' : 'Save Group')}
          </button>
        </div>
      </div>
    </div>
  )
}
