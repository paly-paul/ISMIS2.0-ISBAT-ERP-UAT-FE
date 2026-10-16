'use client'
import { useEffect, useMemo, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { RepetitionTagInput } from '@/lib/api/academic/repetitionTag'
import { useRepetitionTag } from '@/hooks/academic/useRepetitionTags'
import { useSearchProgramLevelsInfinite } from '@/hooks/academic/useProgramLevels'
import { AuthError } from '@/lib/api/client'
import { flattenUniquePages } from '@/lib/pagination'
import { scrollToFirstError } from '@/lib/scrollToFirstError'

// post-/put-course-unit-repetition.md (CreateCourseUnitRepetitionCommandValidator):
// tagCode required ≤ 50 (uppercased server-side, unique → duplicate_tag_code),
// tagName required ≤ 100, programLevelGuid required and must exist.
const TAG_CODE_MAX = 50
const TAG_NAME_MAX = 100

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
  const [levelSearch, setLevelSearch] = useState('')
  const [committedLevelSearch, setCommittedLevelSearch] = useState('')
  const [levelPickerOpen, setLevelPickerOpen] = useState(false)
  const LEVEL_PAGE_SIZE = 20
  const levelQuery = useSearchProgramLevelsInfinite(committedLevelSearch, LEVEL_PAGE_SIZE, isOpen && levelPickerOpen)
  const programLevels = useMemo(
    () => flattenUniquePages(levelQuery.data?.pages ?? [], level => level.programLevelGuid),
    [levelQuery.data],
  )

  const [tagCode, setTagCode] = useState('')
  const [tagName, setTagName] = useState('')
  const [programLevelGuid, setProgramLevelGuid] = useState('')
  const [saved, setSaved]     = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [errors, setErrors]   = useState<Record<string, string>>({})

  useEffect(() => {
    const timer = setTimeout(() => setCommittedLevelSearch(levelSearch.trim()), 300)
    return () => clearTimeout(timer)
  }, [levelSearch])

  // Fill the form when the tag loads on edit; blank on fresh create. Runs
  // only when the modal opens or the tag arrives — NOT when the level list
  // changes. programLevels used to be a dependency, so opening the Programme
  // Level dropdown (which loads the list) re-ran this: Add cleared the typed
  // code/description, Edit reset them to the saved values.
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && tag) {
      setTagCode(tag.tagCode)
      setTagName(tag.tagName)
      // The tag carries its programLevelGuid (get-course-unit-repetition-by-
      // guid.md), so Edit no longer depends on the level list to prefill.
      setProgramLevelGuid(tag.programLevelGuid ?? '')
      setErrors({})
    } else if (!isEdit) {
      setTagCode(''); setTagName(''); setProgramLevelGuid(''); setErrors({})
    }
  }, [isOpen, isEdit, tag])

  // Fallback for a tag without programLevelGuid: recover the level by code
  // once the list has loaded — and only while nothing is selected, so it
  // never overrides the user's own pick.
  useEffect(() => {
    if (!isOpen || !isEdit || !tag || tag.programLevelGuid || programLevelGuid) return
    const matchingLevel = programLevels.find(p => p.levelCode === tag.levelCode)
    if (matchingLevel) setProgramLevelGuid(matchingLevel.programLevelGuid)
  }, [isOpen, isEdit, tag, programLevels, programLevelGuid])

  if (!isOpen) return null

  const programLevelOptions = programLevels.map(p => ({ value: p.programLevelGuid, label: p.levelName }))
  if (isEdit && programLevelGuid && !programLevelOptions.some(option => option.value === programLevelGuid)) {
    programLevelOptions.unshift({ value: programLevelGuid, label: tag?.levelName || tag?.levelCode || programLevelGuid })
  }

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
    const code = tagCode.trim()
    const name = tagName.trim()
    if (!code) e.tagCode = 'Repetition Tag Code is required'
    else if (code.length > TAG_CODE_MAX) e.tagCode = `Repetition Tag Code must not exceed ${TAG_CODE_MAX} characters`
    if (!programLevelGuid) e.programLevelGuid = 'Please select a Programme Level'
    if (!name) e.tagName = 'Description is required'
    else if (name.length > TAG_NAME_MAX) e.tagName = `Description must not exceed ${TAG_NAME_MAX} characters`
    setErrors(e)
    scrollToFirstError(e)
    return Object.keys(e).length === 0
  }

  // Field-level server errors go back under their field; anything else
  // (auth, server faults) uses the failure popup.
  function serverFieldError(code: string | undefined, msg: string): Record<string, string> | null {
    if (code === 'duplicate_tag_code') return { tagCode: 'A repetition tag with this code already exists.' }
    if (/program level not found/i.test(msg)) return { programLevelGuid: 'This programme level no longer exists. Pick another one.' }
    if (code === 'validation_error') {
      if (/tag ?code/i.test(msg)) return { tagCode: msg }
      if (/tag ?name/i.test(msg)) return { tagName: msg }
      if (/program ?level/i.test(msg)) return { programLevelGuid: msg }
    }
    return null
  }

  function handleSubmit() {
    if (!validate()) return
    // Trimmed — the API stores what it's sent (tagCode is only uppercased).
    const input: RepetitionTagInput = { tagCode: tagCode.trim(), tagName: tagName.trim(), programLevelGuid }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Repetition tag updated successfully' : 'Repetition tag added successfully') }
    const onError = (error: Error) => {
      const code = error instanceof AuthError ? error.code : undefined
      const fieldErr = serverFieldError(code, error.message || '')
      if (fieldErr) {
        setErrors(prev => ({ ...prev, ...fieldErr }))
        scrollToFirstError(fieldErr)
        return
      }
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
              maxLength={TAG_CODE_MAX}
              value={tagCode}
              // Uppercase (the server uppercases anyway) and no spaces — a
              // code is a single token.
              onChange={e => { setTagCode(e.target.value.toUpperCase().replace(/\s+/g, '')); clearError('tagCode') }}
              style={errors.tagCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.tagCode && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.tagCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Programme Level <span className="req">*</span></div>
            <SearchSelect
              placeholder="Select level…"
              value={programLevelGuid}
              onSearch={setLevelSearch}
              onOpenChange={setLevelPickerOpen}
              isLoading={levelQuery.isLoading}
              hasNextPage={levelQuery.hasNextPage}
              isFetchingNextPage={levelQuery.isFetchingNextPage}
              onLoadMore={() => levelQuery.fetchNextPage()}
              onChange={v => { setProgramLevelGuid(v); clearError('programLevelGuid') }}
              options={programLevelOptions}
            />
            {errors.programLevelGuid && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.programLevelGuid}</p>}
          </div>
          <div className="fg span2">
            <div className="lbl">Description <span className="req">*</span></div>
            <input
              className="ctrl"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. Standard repeat for failed course units'}
              maxLength={TAG_NAME_MAX}
              value={tagName}
              onChange={e => { setTagName(e.target.value); clearError('tagName') }}
              style={errors.tagName ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.tagName && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.tagName}</p>}
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
