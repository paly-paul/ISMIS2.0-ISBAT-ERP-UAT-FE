'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { ProgramLevelInput } from '@/lib/api/academic/programLevel'
import { useProgramLevel } from '@/hooks/academic/useProgramLevels'
import { useFinanceCurrencies } from '@/hooks/finance/useFinanceCurrencies'
import { AuthError } from '@/lib/api/client'

// Add and Edit share this form — differ in prefill, the post-save redirect
// (Add only), and which mutation runs.
interface ProgrammeLevelFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  programLevelGuid: string | null
  createProgramLevel: {
    mutate: (input: ProgramLevelInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateProgramLevel: {
    mutate: (variables: { guid: string; input: ProgramLevelInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function ProgrammeLevelFormModal({ isOpen, onClose, showToast, mode, programLevelGuid, createProgramLevel, updateProgramLevel }: ProgrammeLevelFormModalProps) {
  const isEdit = mode === 'edit'
  const router = useRouter()
  const { data: programLevel, isLoading, isError, error } = useProgramLevel(programLevelGuid, isOpen && isEdit)

  const [saved, setSaved]                 = useState(false)
  const [failure, setFailure]             = useState<string | null>(null)
  // New-only: after a successful create, the page redirects to Programme
  // Group once the success popup is dismissed.
  const [redirectAfterClose, setRedirectAfterClose] = useState(false)
  const [levelCode, setLevelCode]         = useState('')
  const [levelName, setLevelName]         = useState('')
  const [yearCount, setYearCount]         = useState('')
  const [minCreditLoad, setMinCreditLoad] = useState('')
  const [appFee, setAppFee]               = useState('')
  const [lateFee, setLateFee]             = useState('')
  const [currency, setCurrency]           = useState('')
  const [errors, setErrors]               = useState<Record<string, string>>({})

  // useFinanceCurrencies, not useCurrencies/currencyMaster.ts — the payload needs a real currencyGuid;
  // sending Currency Master's intCurrency gets rejected with "Currency is required".
  const { data: currencies = [] } = useFinanceCurrencies()
  const currencyOptions = currencies.map(c => ({ value: c.currencyGuid, label: `${c.currencyCode} — ${c.currencyName}` }))

  // Prefill on edit once the level loads; re-runs per guid since react-query resets `programLevel` to undefined between them.
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && programLevel) {
      setLevelCode(programLevel.levelCode)
      setLevelName(programLevel.levelName)
      setYearCount(String(programLevel.yearCount))
      setMinCreditLoad(String(programLevel.minCreditLoad))
      setAppFee(String(programLevel.appFee))
      setLateFee(String(programLevel.lateFee))
      setCurrency(programLevel.currencyGuid ?? '')
      setErrors({})
    } else if (!isEdit) {
      setLevelCode(''); setLevelName(''); setYearCount(''); setMinCreditLoad('')
      setAppFee(''); setLateFee(''); setCurrency(''); setErrors({})
    }
  }, [isOpen, isEdit, programLevel])

  if (!isOpen) return null

  function handleClose() {
    setSaved(false); setFailure(null)
    setLevelCode(''); setLevelName(''); setYearCount(''); setMinCreditLoad('')
    setAppFee(''); setLateFee(''); setCurrency(''); setErrors({})
    onClose()
    if (redirectAfterClose) {
      router.push('/academic/programme-group')
    }
    setRedirectAfterClose(false)
  }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!levelCode.trim()) e.levelCode = 'Level Code is required'
    if (!levelName.trim()) e.levelName = 'Level Name is required'
    if (!yearCount || +yearCount <= 0) e.yearCount = 'Year Count must be greater than 0'
    if (!minCreditLoad || +minCreditLoad < 0) e.minCreditLoad = 'Minimum Credit Load is required'
    if (!appFee || +appFee < 0) e.appFee = 'Application Fee is required'
    if (!lateFee || +lateFee < 0) e.lateFee = 'Late Fee is required'
    if (!currency) e.currency = 'Select a currency before proceeding'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // Map known backend failures to a field error where the cause is
  // actionable right there (duplicate levelCode); anything else shows the
  // failure popup instead.
  function handleSaveError(error: Error) {
    const code = error instanceof AuthError ? error.code : undefined
    if (code === 'bad_request') {
      setErrors(prev => ({ ...prev, levelCode: error.message || 'A programme level with this code already exists.' }))
      return
    }
    setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} programme level. Please try again.`)
  }

  function handleSubmit() {
    if (!validate()) return
    const input: ProgramLevelInput = {
      levelCode,
      levelName,
      yearCount: +yearCount,
      minCreditLoad: +minCreditLoad,
      appFee: +appFee,
      lateFee: +lateFee,
      currencyGuid: currency,
    }

    if (isEdit && programLevelGuid) {
      updateProgramLevel.mutate(
        { guid: programLevelGuid, input },
        { onSuccess: () => { setSaved(true); showToast('Programme Level updated successfully') }, onError: handleSaveError },
      )
    } else {
      createProgramLevel.mutate(
        input,
        { onSuccess: () => { setSaved(true); setRedirectAfterClose(true); showToast('Programme Level added successfully') }, onError: handleSaveError },
      )
    }
  }

  const isPending = isEdit ? updateProgramLevel.isPending : createProgramLevel.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Programme Level Updated!' : 'Programme Level Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new programme level has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Programme Level" : "Couldn't Add Programme Level"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Programme Level"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load programme level details.') : 'Failed to load programme level details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !programLevel)) {
    return (
      <div className="modal-overlay open" id="edit-alevel-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Programme Level</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading programme level details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-alevel-modal' : 'new-alevel-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title">
            <i className={`lni ${isEdit ? 'lni-pencil' : 'lni-graduation'}`}></i> {isEdit ? <>Edit Programme Level — <span className="font-mono">{programLevel!.levelCode}</span></> : 'Add Programme Level'}
          </div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Level Code <span className="req">*</span></div>
            <input
              className="ctrl"
              placeholder="e.g. DIP"
              value={levelCode}
              onChange={e => { setLevelCode(e.target.value); clearError('levelCode') }}
              style={errors.levelCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.levelCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.levelCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Level Name <span className="req">*</span></div>
            <input
              className="ctrl"
              placeholder="e.g. Diploma"
              value={levelName}
              onChange={e => { setLevelName(e.target.value); clearError('levelName') }}
              style={errors.levelName ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.levelName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.levelName}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Year Count <span className="req">*</span></div>
            <input
              className="ctrl"
              type="number"
              placeholder="e.g. 2"
              min={1}
              max={10}
              value={yearCount}
              onChange={e => { setYearCount(e.target.value); clearError('yearCount') }}
              style={errors.yearCount ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.yearCount && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.yearCount}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Minimum Credit Load <span className="req">*</span></div>
            <input
              className="ctrl"
              type="number"
              placeholder="e.g. 15"
              min={0}
              value={minCreditLoad}
              onChange={e => { setMinCreditLoad(e.target.value); clearError('minCreditLoad') }}
              style={errors.minCreditLoad ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.minCreditLoad && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.minCreditLoad}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Application Fee <span className="req">*</span></div>
            <input
              className="ctrl"
              type="number"
              placeholder="e.g. 50000"
              min={0}
              value={appFee}
              onChange={e => { setAppFee(e.target.value); clearError('appFee') }}
              style={errors.appFee ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.appFee && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.appFee}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Late Fee <span className="req">*</span></div>
            <input
              className="ctrl"
              type="number"
              placeholder="e.g. 10000"
              min={0}
              value={lateFee}
              onChange={e => { setLateFee(e.target.value); clearError('lateFee') }}
              style={errors.lateFee ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.lateFee && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.lateFee}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Currency <span className="req">*</span></div>
            <SearchSelect
              placeholder="Select currency…"
              options={currencyOptions}
              value={currency}
              onChange={v => { setCurrency(v); clearError('currency') }}
            />
            {errors.currency && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.currency}</p>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Update Level' : 'Save Level')}
          </button>
        </div>
      </div>
    </div>
  )
}
