'use client'
import { useState, useEffect, useRef } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { useProgramMasters } from '@/hooks/academic/useProgramMaster'
import { useIntakes, useCurrentAcademicIntake } from '@/hooks/academic/useIntakes'
import { useCurrencies } from '@/hooks/finance/useCurrencies'
import { useFinanceCurrencies } from '@/hooks/finance/useFinanceCurrencies'
import { useSemestersForProgram } from '@/hooks/academic/useSemesters'
import { useLedgers } from '@/hooks/finance/useLedgers'
import {
  useSaveProgramFeeStructureComplete,
  useUpdateProgramFeeStructureComplete,
  useProgramFeeLines,
  useProgramFeeStructures,
  ProgramFeeLineSaveInput,
  ProgramFeeStructureHeader,
} from '@/hooks/academic/useProgramFeeStructure'

// title dropped per Fee_Structure_Change_Requests.md #1 — it was never part
// of the confirmed save-complete payload anyway (ProgramFeeLineSaveInput has
// no title field), just decorative UI. ledgerPriority is real now — GET
// fee-lines/:feeHdGuid confirms LedgerNum is an independent, user-set
// priority (a real sample has three lines for one semester listed as
// ledgerNum 1/3/2, not matching array order at all), so this is sent as
// ledgerNum on save instead of the "local-only, no confirmed field" state it
// used to be in.
type FeeItem = { id: number; amount: string; currencyGuid: string; ledgerGuid: string; ledgerPriority: string }
// Keyed by real semesterGuid — save-complete's feeLines each carry a real
// semesterGuid, unlike Program Master's own embedded fee structure (which
// uses semCode, a 1-based int position — see the note on
// FeeLineUpdateInput in lib/api/academic/programMaster.ts for that other
// convention). There's no fixed semester count to default to, so this
// starts empty and fills in once a programme's real semesters load.
type SemFeesMap = Record<string, FeeItem[]>

type Structure = {
  id: number
  programme: string
  feeCode: string
  description: string
  currency: string
  intake: string
  discountType: string
  createdVia: 'new' | 'copy'
  semFees: SemFeesMap
  // Header-level fields for the save-complete/update-complete POST/PUT.
  localOrForeign: boolean
  // Real field now (previously hardcoded true on every save) — Edit needs
  // to carry through whatever the existing record's status actually is
  // rather than silently reactivating an inactive structure on every save.
  // No UI toggle exists for it yet, so it's otherwise untouched.
  status: boolean
  amtPer: string
  lef: string
  lefCurrency: string
  cef: string
  cefCurrency: string
  ace: string
  aceCurrency: string
}

function blankItem(id: number): FeeItem {
  return { id, amount: '', currencyGuid: '', ledgerGuid: '', ledgerPriority: '' }
}

function makeDefaultStructures(): Structure[] {
  return [{
    id: 1, programme: '', feeCode: '', description: '', currency: 'UGX', intake: '', discountType: 'Amount', createdVia: 'new', semFees: {},
    localOrForeign: false, status: true, amtPer: '', lef: '', lefCurrency: '', cef: '', cefCurrency: '', ace: '', aceCurrency: '',
  }]
}

let nextId = 200
let nextStructId = 100

export function FeeStructureModal({ isOpen, onClose, showToast, mode, editData }: ModalProps & { mode?: 'edit'; editData?: ProgramFeeStructureHeader }) {
  const { data: programs = [] }   = useProgramMasters()
  const { data: intakes = [] }    = useIntakes()
  const { data: currencies = [] } = useCurrencies()
  const saveFeeStructureComplete   = useSaveProgramFeeStructureComplete()
  const updateFeeStructureComplete = useUpdateProgramFeeStructureComplete()
  // Real fetch-by-guid now — GET fee-lines/:feeHdGuid, same convention as
  // the rest of the app's real Edit modals. Header fields (feeCode,
  // calcType, lef/cef/ace, intakeGuid, etc.) come from editData itself (the
  // list row the page already fetched), not from this endpoint — it only
  // ever returns the line items.
  const { data: feeLines, isLoading: feeLinesLoading, isError: feeLinesError } = useProgramFeeLines(editData?.feeHdGuid ?? null, isOpen && mode === 'edit' && !!editData)
  // Copy Fee Code — real now: sourced from every existing fee structure via
  // the same GET-all endpoint the main page's table uses, not the old
  // session-only "other structures added in this modal" list. Fetched
  // unconditionally (matches the rest of this modal's non-guid-scoped
  // lookups, e.g. useProgramMasters/useIntakes above), not gated on isOpen.
  const { data: allFeeStructuresData } = useProgramFeeStructures(1, 1000)
  const allFeeStructures = allFeeStructuresData?.items ?? []
  // Per-source-guid on-demand fetch of the picked structure's real fee
  // lines — the GET-all list only ever returns header fields, never the
  // lines themselves (see programFeeStructure.ts's ProgramFeeStructureHeader
  // note). Only enabled once something's actually been picked.
  const [copySourceId, setCopySourceId] = useState('')
  const { data: copySourceLines } = useProgramFeeLines(copySourceId || null, !!copySourceId)
  // Per Fee_Structure_Change_Requests.md #4 — Create no longer offers an
  // Intake dropdown at all, it's forced to whatever intake is currently
  // flagged current (the same "Current Academic Intake" hero-card filter
  // already used on /academic/intake-master), shown read-only.
  const { data: currentAcademicIntake } = useCurrentAcademicIntake()

  const programOptions = programs.map(p => ({ value: p.programGuid, label: `${p.programName} (${p.programCode})` }))
  // Same real intakeGuid convention as ProgrammeModal's Intake step. Still
  // needed even though the field is now always read-only — SearchSelect
  // resolves the display label for the selected guid from this list.
  const intakeOptions  = intakes.map(i => ({ value: i.intakeGuid, label: `${i.intakeCode} — ${i.description}` }))
  // Currency.intCurrency (a number) is what the header payload's Lec/Cec/Acec
  // fields need — unconfirmed for save-complete specifically (the sample
  // payload showed them all null), kept as-is to match the one confirmed
  // header contract (ProgramFeeStructureHeaderInput) rather than guessed.
  const currencyIntOptions = currencies.map(c => ({ value: String(c.intCurrency), label: `${c.currencyCode} — ${c.currencyName}` }))

  const [saved, setSaved]           = useState(false)
  const [failure, setFailure]       = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [structures, setStructures] = useState<Structure[]>(() => makeDefaultStructures())
  const [activeIdx, setActiveIdx]   = useState(0)
  const [activeAcc, setActiveAcc]   = useState(0)

  // Guards this prefill against running more than once per open-session —
  // same fix as ProgrammeModal's own fullDetails effect: neither
  // useProgramFeeLines nor useProgramFeeStructures overrides the global
  // QueryClient's defaults (staleTime: 0, refetchOnWindowFocus: true), so a
  // background refetch while the user is mid-edit could otherwise silently
  // reset their in-progress fee items back to the server's original data.
  const prefilledForRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isOpen) { prefilledForRef.current = null; return }
    if (mode !== 'edit' || !editData || !feeLines) return
    if (prefilledForRef.current === editData.feeHdGuid) return
    prefilledForRef.current = editData.feeHdGuid

    const semFees: SemFeesMap = {}
    feeLines.forEach(l => {
      const list = semFees[l.semesterGuid] ?? (semFees[l.semesterGuid] = [])
      list.push({ id: nextId++, amount: String(l.amount), currencyGuid: l.currencyGuid, ledgerGuid: l.ledgerGuid, ledgerPriority: String(l.ledgerNum) })
    })

    setStructures([{
      id: nextStructId++,
      programme: editData.programGuid,
      feeCode: editData.feeCode,
      description: editData.feeDesc,
      // No currency field exists at the header level (only per-fee-line) —
      // Local/Foreign is the only currency-ish signal actually present,
      // same convention used on the main page's table.
      currency: editData.localOrForeign ? 'USD' : 'UGX',
      intake: editData.intakeGuid ?? '',
      discountType: editData.calcType === 2 ? 'Percentage' : 'Amount',
      createdVia: 'new',
      semFees,
      localOrForeign: editData.localOrForeign,
      status: editData.status,
      amtPer: editData.amtPer != null ? String(editData.amtPer) : '',
      lef: editData.lef != null ? String(editData.lef) : '',
      lefCurrency: editData.lec != null ? String(editData.lec) : '',
      cef: editData.cef != null ? String(editData.cef) : '',
      cefCurrency: editData.cec != null ? String(editData.cec) : '',
      ace: editData.ace != null ? String(editData.ace) : '',
      aceCurrency: editData.acec != null ? String(editData.acec) : '',
    }])
    setActiveIdx(0)
  }, [isOpen, mode, editData, feeLines])

  // Per Fee_Structure_Change_Requests.md #4, Create mode used to have no
  // Intake picker at all — every structure was force-locked onto whatever
  // intake was flagged current, re-applied on every render via this effect.
  // Commented out per request — Intake is now a normal editable picker in
  // both Create and Edit (see the JSX below), so nothing should silently
  // override whatever the user actually selects. addStructure() below still
  // pre-fills a new structure's Intake with the Current Academic Intake as a
  // convenience default, it just no longer gets forced back afterward.
  // useEffect(() => {
  //   if (isOpen && mode !== 'edit' && currentAcademicIntake) {
  //     setStructures(prev => prev.map(s => s.intake === currentAcademicIntake.intakeGuid ? s : { ...s, intake: currentAcademicIntake.intakeGuid }))
  //   }
  // }, [isOpen, mode, currentAcademicIntake])

  // Applies the picked Copy Fee Code source once its real fee lines have
  // loaded. feeCode/description are deliberately left untouched so the copy
  // never collides with the source's own code — same convention as
  // ProgrammeModal's own Copy Fee Code. copySourceId is intentionally left
  // set afterwards (not reset to '') so the dropdown keeps showing what was
  // copied from, instead of snapping back to the placeholder right after a
  // successful copy — appliedCopyRef guards against re-applying every time
  // this effect happens to re-run for an unrelated reason.
  const appliedCopyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!copySourceId || !copySourceLines) return
    if (appliedCopyRef.current === copySourceId) return
    appliedCopyRef.current = copySourceId
    const source = allFeeStructures.find(item => item.feeHdGuid === copySourceId)
    if (!source) return
    const semFees: SemFeesMap = {}
    copySourceLines.forEach(l => {
      const list = semFees[l.semesterGuid] ?? (semFees[l.semesterGuid] = [])
      list.push({ id: nextId++, amount: String(l.amount), currencyGuid: l.currencyGuid, ledgerGuid: l.ledgerGuid, ledgerPriority: String(l.ledgerNum) })
    })
    setStructures(prev => prev.map((s, i) => i !== activeIdx ? s : {
      ...s,
      localOrForeign: source.localOrForeign,
      discountType: source.calcType === 2 ? 'Percentage' : 'Amount',
      amtPer: source.amtPer != null ? String(source.amtPer) : '',
      lef: source.lef != null ? String(source.lef) : '',
      lefCurrency: source.lec != null ? String(source.lec) : '',
      cef: source.cef != null ? String(source.cef) : '',
      cefCurrency: source.cec != null ? String(source.cec) : '',
      ace: source.ace != null ? String(source.ace) : '',
      aceCurrency: source.acec != null ? String(source.acec) : '',
      semFees,
    }))
    showToast(`Copied fees from ${source.feeCode.trim()}`)
  }, [copySourceId, copySourceLines, allFeeStructures, activeIdx, showToast])

  const active = structures[activeIdx]

  // Real Copy Fee Code source list now — every existing fee structure for
  // this SAME programme (a fee line's semesterGuid only means anything
  // within its own programme's semester space, so a cross-programme copy
  // would silently attach fee lines to semesters that don't belong here).
  // The record currently being edited is included and selectable like any
  // other — still labeled "(Current)" for reference, just no longer
  // click-disabled.
  const copySourceOptions = allFeeStructures
    .filter(item => item.programGuid === active.programme)
    .map(item => {
      const isCurrent = mode === 'edit' && editData?.feeHdGuid === item.feeHdGuid
      return { value: item.feeHdGuid, label: isCurrent ? `${item.feeCode.trim()} (Current)` : item.feeCode.trim() }
    })

  // Real semesters for the currently selected programme — drives the
  // per-semester accordion below instead of a fixed Sem 1-6 range. These
  // must stay above the `if (!isOpen) return null` below — every hook in
  // this component has to run on every render regardless of isOpen, or
  // React loses track of hook order between a closed and open render.
  const { data: semesters = [] } = useSemestersForProgram(active.programme, !!active.programme)
  const { data: financeCurrencies = [] } = useFinanceCurrencies()
  const financeCurrencyOptions = financeCurrencies.map(c => ({ value: c.currencyGuid, label: `${c.currencyCode} — ${c.currencyName}` }))
  const { data: ledgers = [] } = useLedgers()
  const ledgerOptions = ledgers.map(l => ({ value: l.ledgerGuid, label: l.ledgerName }))

  if (!isOpen) return null

  if (mode === 'edit' && editData && feeLinesError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup title="Couldn't Load Fee Structure" subtitle="Failed to load fee line details." onClose={onClose} />
        </div>
      </div>
    )
  }

  if (mode === 'edit' && editData && (feeLinesLoading || prefilledForRef.current !== editData.feeHdGuid)) {
    return (
      <div className="modal-overlay open" id="edit-fee-structure-modal">
        <div className="modal modal-80 modal-flex" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-dollar"></i> Edit Fee Structure</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
            <span style={{ color: 'var(--g400)' }}>Loading fee structure details…</span>
          </div>
        </div>
      </div>
    )
  }

  // Intake was wrongly required here — ProgramFeeStructureHeaderInput types
  // intakeGuid as `string | null` (genuinely optional on the wire, confirmed
  // by GET /Programfee-structure returning intakeGuid: null on most rows in
  // a real sample), and the field is always read-only in this modal (no
  // picker in either Create or Edit). Requiring it truthy meant Save was
  // permanently stuck disabled the moment you edited any structure that
  // didn't already have an intake — there was no way to satisfy the check.
  // currency is a purely decorative display string (never sent to the
  // backend at all — see handleSubmitAll), so it doesn't belong in a
  // "ready to submit" check either.
  function structureComplete(s: Structure) {
    return !!(s.feeCode.trim() && s.description.trim())
  }
  // Every fee item needs a currency and ledger selected; otherwise the payload sends empty and the backend rejects it.
  function structHasCurrencyGaps(s: Structure) {
    return Object.values(s.semFees).some(items => items.some(item => !item.currencyGuid))
  }
  function structHasLedgerGaps(s: Structure) {
    return Object.values(s.semFees).some(items => items.some(item => !item.ledgerGuid))
  }
  const activeComplete   = structureComplete(active)
  const anyCurrencyGaps  = structures.some(structHasCurrencyGaps)
  const anyLedgerGaps    = structures.some(structHasLedgerGaps)
  const allComplete      = structures.every(structureComplete) && !anyCurrencyGaps && !anyLedgerGaps

  function handleClose() { setSaved(false); setFailure(null); setStructures(makeDefaultStructures()); setActiveIdx(0); setActiveAcc(0); setCopySourceId(''); appliedCopyRef.current = null; prefilledForRef.current = null; onClose() }

  // ── Structure management ─────────────────────────────────
  function addStructure() {
    const newStruct: Structure = {
      id: nextStructId++, programme: '', feeCode: '', description: '', currency: 'UGX',
      intake: mode !== 'edit' ? (currentAcademicIntake?.intakeGuid ?? '') : '',
      discountType: 'Amount', createdVia: 'new', semFees: {},
      localOrForeign: false, status: true, amtPer: '', lef: '', lefCurrency: '', cef: '', cefCurrency: '', ace: '', aceCurrency: '',
    }
    setStructures(prev => [...prev, newStruct])
    setActiveIdx(structures.length)
  }

  function removeStructure(idx: number) {
    if (structures.length <= 1) return
    setStructures(prev => prev.filter((_, i) => i !== idx))
    setActiveIdx(prev => (prev >= idx && prev > 0 ? prev - 1 : prev))
  }

  function updateStructureMeta(field: 'programme' | 'feeCode' | 'description' | 'currency' | 'intake' | 'discountType' | 'amtPer' | 'lef' | 'lefCurrency' | 'cef' | 'cefCurrency' | 'ace' | 'aceCurrency', val: string) {
    setStructures(prev => prev.map((s, i) => i === activeIdx ? { ...s, [field]: val } : s))
  }

  function updateLocalOrForeign(val: string) {
    setStructures(prev => prev.map((s, i) => i === activeIdx ? { ...s, localOrForeign: val === 'true' } : s))
  }

  // Lateral Entry/Credit Exemption/Aptech Credit Exemption Fee each had their
  // own Currency dropdown, even though in practice all three are meant to
  // share one currency — same consolidation as ProgrammeModal's identical
  // section. lefCurrency/cefCurrency/aceCurrency remain genuinely separate
  // wire fields (Lec/Cec/Acec on the header payload — see handleSubmitAll), this
  // only collapses the UI to one control that sets all three at once.
  function updateSharedFeeCurrency(val: string) {
    setStructures(prev => prev.map((s, i) => i === activeIdx
      ? { ...s, lefCurrency: val, cefCurrency: val, aceCurrency: val }
      : s
    ))
  }

  // ── Fee item management (scoped to active structure, keyed by semesterGuid) ─
  function addItem(semesterGuid: string) {
    setStructures(prev => prev.map((s, i) =>
      i === activeIdx
        ? { ...s, semFees: { ...s.semFees, [semesterGuid]: [...(s.semFees[semesterGuid] ?? []), blankItem(nextId++)] } }
        : s
    ))
  }

  function removeItem(semesterGuid: string, id: number) {
    setStructures(prev => prev.map((s, i) =>
      i === activeIdx
        ? { ...s, semFees: { ...s.semFees, [semesterGuid]: (s.semFees[semesterGuid] ?? []).filter(f => f.id !== id) } }
        : s
    ))
  }

  function updateItem(semesterGuid: string, id: number, field: keyof FeeItem, val: string) {
    setStructures(prev => prev.map((s, i) =>
      i === activeIdx
        ? { ...s, semFees: { ...s.semFees, [semesterGuid]: (s.semFees[semesterGuid] ?? []).map(f => f.id === id ? { ...f, [field]: val } : f) } }
        : s
    ))
  }

  function moveItem(semesterGuid: string, idx: number, dir: -1 | 1) {
    const to = idx + dir
    setStructures(prev => prev.map((s, i) => {
      if (i !== activeIdx) return s
      const items = s.semFees[semesterGuid] ?? []
      if (to < 0 || to >= items.length) return s
      const next = [...items]
      ;[next[idx], next[to]] = [next[to], next[idx]]
      return { ...s, semFees: { ...s.semFees, [semesterGuid]: next } }
    }))
  }

  // LedgerNum is a real, independently-set per-line priority (confirmed via
  // GET fee-lines/:feeHdGuid — see the note on ProgramFeeLineDetail in
  // programFeeStructure.ts), not derived from the Ledger master's own
  // ledgerNum field the way it was read from before (which always produced
  // 0, since that field is a per-ledger id unrelated to this ordering) —
  // sourced from the item's own real, user-editable ledgerPriority input.
  function buildFeeLines(s: Structure): ProgramFeeLineSaveInput[] {
    return Object.entries(s.semFees).flatMap(([semesterGuid, items]) =>
      items.map(item => ({
        semesterGuid,
        ledgerGuid: item.ledgerGuid,
        currencyGuid: item.currencyGuid,
        ledgerNum: +item.ledgerPriority || 0,
        amount: +item.amount || 0,
      }))
    )
  }

  // Edit mode PUTs the one existing structure via update-complete (real now
  // — see updateProgramFeeStructureComplete). Create mode saves every
  // structure in the sidebar as its own header+lines save-complete call;
  // each call is independently a complete record on the backend, so a
  // failure partway through leaves the earlier ones saved — surfaced via
  // FailurePopup rather than attempted rollback.
  async function handleSubmitAll() {
    if (!allComplete) return
    setSubmitting(true)
    try {
      if (mode === 'edit' && editData) {
        const s = structures[0]
        await updateFeeStructureComplete.mutateAsync({
          feeHdGuid: editData.feeHdGuid,
          input: {
            feeHdGuid: editData.feeHdGuid,
            feeCode: s.feeCode,
            feeDesc: s.description,
            status: s.status,
            localOrForeign: s.localOrForeign,
            programGuid: s.programme,
            lef: s.lef ? +s.lef : null,
            cef: s.cef ? +s.cef : null,
            ace: s.ace ? +s.ace : null,
            lec: s.lefCurrency ? +s.lefCurrency : null,
            cec: s.cefCurrency ? +s.cefCurrency : null,
            acec: s.aceCurrency ? +s.aceCurrency : null,
            calcType: s.discountType === 'Percentage' ? 2 : 1,
            amtPer: s.amtPer ? +s.amtPer : null,
            intakeGuid: s.intake || null,
            feeLines: buildFeeLines(s),
          },
        })
      } else {
        for (const s of structures) {
          await saveFeeStructureComplete.mutateAsync({
            feeCode: s.feeCode,
            feeDesc: s.description,
            status: s.status,
            localOrForeign: s.localOrForeign,
            programGuid: s.programme,
            lef: s.lef ? +s.lef : null,
            cef: s.cef ? +s.cef : null,
            ace: s.ace ? +s.ace : null,
            lec: s.lefCurrency ? +s.lefCurrency : null,
            cec: s.cefCurrency ? +s.cefCurrency : null,
            acec: s.aceCurrency ? +s.aceCurrency : null,
            calcType: s.discountType === 'Percentage' ? 2 : 1,
            amtPer: s.amtPer ? +s.amtPer : null,
            intakeGuid: s.intake || null,
            feeLines: buildFeeLines(s),
          })
        }
      }
      setSaved(true)
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Failed to save fee structure(s). Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={mode === 'edit' ? 'Fee Structure Updated!' : 'Fee Structure Saved!'}
            subtitle={mode === 'edit' ? 'Your changes have been saved successfully.' : `${structures.length} fee structure${structures.length > 1 ? 's' : ''} saved successfully.`}
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
          <FailurePopup title="Couldn't Save Fee Structure" subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="new-fee-structure-modal">
      <div className="modal modal-80 modal-flex" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-dollar"></i> {mode === 'edit' ? 'Edit' : 'Add'} Fee Structure</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        {/* ── Two-panel layout ──────────────────────────────────── */}
        <div className="fsm-layout">

          {/* Left sidebar — structure list */}
          <div className="fsm-sidebar">
            <div style={{ padding: '14px 14px 6px', fontSize: 10.5, fontWeight: 700, color: 'var(--g400)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
              Fee Structures <span style={{ color: 'var(--b500)' }}>({structures.length})</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
              {structures.map((s, i) => (
                <div
                  key={s.id}
                  onClick={() => { setActiveIdx(i); setActiveAcc(0); setCopySourceId(''); appliedCopyRef.current = null }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 10px', borderRadius: 'var(--rsm)', marginBottom: 2,
                    background: activeIdx === i ? 'var(--b500)' : 'transparent',
                    color: activeIdx === i ? '#fff' : 'var(--g700)',
                    cursor: 'pointer', transition: 'background .15s',
                  }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: activeIdx === i ? 'rgba(255,255,255,.2)' : 'var(--b100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className="lni lni-coin" style={{ fontSize: 13, color: activeIdx === i ? '#fff' : 'var(--b600)' }}></i>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>Structure {i + 1}</div>
                    <div style={{ fontSize: 11, opacity: .65, lineHeight: 1.3 }}>{s.currency}</div>
                  </div>
                  {structures.length > 1 && (
                    <button
                      onClick={e => { e.stopPropagation(); removeStructure(i) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: activeIdx === i ? 'rgba(255,255,255,.65)' : 'var(--g300)', display: 'flex', alignItems: 'center', borderRadius: 'var(--rxs)', flexShrink: 0 }}
                    ><i className="lni lni-trash-can" style={{ fontSize: 12 }}></i></button>
                  )}
                </div>
              ))}
            </div>
            {mode !== 'edit' && (
              <div style={{ borderTop: '1.5px solid var(--g200)', padding: '6px 8px 10px' }}>
                <button className="btn btn-neu btn-sm" style={{ width: '100%' }} onClick={addStructure} disabled={!activeComplete}>
                  <i className="lni lni-plus"></i> Add Fee Structure
                </button>
              </div>
            )}
          </div>

          {/* Right panel — active structure configuration */}
          <div className="fsm-main">

            {/* Programme selector — read-only once editing an existing
                structure (Fee_Structure_Change_Requests.md #3): the
                associated Programme is shown but can't be changed. */}
            <div className="fg m-0 mb-[18px]">
              <div className="lbl">Programme {mode !== 'edit' && <span className="req">*</span>}</div>
              <SearchSelect
                placeholder="— Select a programme to begin —"
                value={active.programme}
                onChange={val => { updateStructureMeta('programme', val); setCopySourceId(''); appliedCopyRef.current = null }}
                options={programOptions}
                disabled={mode === 'edit'}
              />
            </div>

            {/* Locked until a programme is chosen */}
            <div style={{ opacity: active.programme ? 1 : 0.4, pointerEvents: active.programme ? 'auto' : 'none', transition: 'opacity .2s' }}>

            {/* Active structure banner */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, padding: '12px 16px', background: 'var(--b50)', borderRadius: 'var(--rsm)', border: '1.5px solid var(--b100)' }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--b100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="lni lni-coin" style={{ color: 'var(--b600)', fontSize: 17 }}></i>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--b800)' }}>
                  {active.feeCode || `Structure ${activeIdx + 1}`} — {active.currency}{active.description ? ` · ${active.description}` : ''}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--g400)' }}>
                  Structure {activeIdx + 1} of {structures.length}
                </div>
              </div>
            </div>

            {/* Global fee controls */}
            <div className="g3 mb-[14px]">
              <div className="fg m-0">
                <div className="lbl">Fee Code</div>
                <input className="ctrl font-mono uppercase" type="text" value={active.feeCode} onChange={e => updateStructureMeta('feeCode', e.target.value)} />
              </div>
              <div className="fg m-0">
                <div className="lbl">Fee Description</div>
                <input className="ctrl" type="text" placeholder="e.g. Local undergraduate fee structure" value={active.description} onChange={e => updateStructureMeta('description', e.target.value)} />
              </div>
              <div className="fg m-0">
                <div className="lbl">Base Currency</div>
                <SearchSelect
                  options={[
                    { value: 'UGX', label: 'UGX (Ugandan Shilling)' },
                    { value: 'USD', label: 'USD (US Dollar)' },
                    { value: 'KES', label: 'KES (Kenyan Shilling)' },
                    { value: 'EUR', label: 'EUR (Euro)' },
                    { value: 'GBP', label: 'GBP (British Pound)' },
                  ]}
                  value={active.currency}
                  onChange={val => updateStructureMeta('currency', val)}
                />
              </div>
              <div className="fg m-0">
                <div className="lbl">Copy Fee Code</div>
                <SearchSelect
                  placeholder={active.programme ? '— Select source structure —' : 'Select a programme first'}
                  value={copySourceId}
                  onChange={setCopySourceId}
                  options={copySourceOptions}
                />
              </div>
              {/* Was always read-only (Fee_Structure_Change_Requests.md #3/#4)
                  — commented out per request, disabled removed below so
                  Intake is a normal editable picker in both Create and Edit. */}
              <div className="fg m-0">
                <div className="lbl">Intake</div>
                <SearchSelect
                  placeholder="— Select intake —"
                  value={active.intake}
                  onChange={v => updateStructureMeta('intake', v)}
                  options={intakeOptions}
                />
              </div>
              <div className="fg m-0">
                <div className="lbl">Student Type</div>
                <SearchSelect
                  options={[
                    { value: 'false', label: 'Local' },
                    { value: 'true',  label: 'Foreign / International' },
                  ]}
                  value={String(active.localOrForeign)}
                  onChange={updateLocalOrForeign}
                />
              </div>
            </div>

            {/* Programme-level fees & discounts */}
            <div className="bg-[linear-gradient(135deg,#f0f5ff_0%,var(--white)_70%)] border-[1.5px] border-dashed border-[var(--b200)] rounded-[var(--rsm)] p-[14px_16px] mb-[18px]">
              <div className="flex items-center gap-2 font-bold uppercase mb-3" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '.08em', color: '#2d448f' }}>
                <i className="lni lni-tag" style={{ fontSize: 'var(--fs-md)' }}></i>
                <span>Programme-level Fees &amp; Discounts</span>
                <span className="badge badge-blue normal-case tracking-normal font-semibold ml-auto">Applied across all semesters</span>
              </div>
              <div className="g3">
                <div className="fg m-0">
                  <div className="lbl">Lumpsum Discount Type</div>
                  <SearchSelect options={['Amount', 'Percentage']} value={active.discountType} onChange={val => updateStructureMeta('discountType', val)} />
                </div>
                <div className="fg m-0">
                  <div className="lbl">{active.discountType === 'Percentage' ? 'Lumpsum Discount Percentage' : 'Lumpsum Discount Amount'}</div>
                  <div className="flex items-center gap-2">
                    {/* Percentage indicator kept — unambiguous. The Amount-mode
                        currency badge is dropped, not just correct-but-still-shown:
                        active.currency (Base Currency) is already visible right
                        above this field and in the sidebar's "Structure N / USD"
                        label, so repeating it here was redundant, same call as
                        ProgrammeModal's identical section. */}
                    {active.discountType === 'Percentage' && (
                      <span className="text-g500 font-bold min-w-[28px] text-center" style={{ fontSize: 'var(--fs-sm)' }}>%</span>
                    )}
                    <input className="ctrl flex-1" type="number" placeholder="0" min={0} max={active.discountType === 'Percentage' ? 100 : undefined} value={active.amtPer} onChange={e => updateStructureMeta('amtPer', e.target.value)} />
                  </div>
                </div>
                <div className="fg m-0"><div className="lbl">Lateral Entry Fee</div><input className="ctrl" type="number" placeholder="0" min={0} value={active.lef} onChange={e => updateStructureMeta('lef', e.target.value)} /></div>
                <div className="fg m-0"><div className="lbl">Credit Exemption Fee</div><input className="ctrl" type="number" placeholder="0" min={0} value={active.cef} onChange={e => updateStructureMeta('cef', e.target.value)} /></div>
                <div className="fg m-0"><div className="lbl">Aptech Credit Exemption Fee</div><input className="ctrl" type="number" placeholder="0" min={0} value={active.ace} onChange={e => updateStructureMeta('ace', e.target.value)} /></div>
                {/* One shared Currency picker for all three fees above, replacing the
                    three separate-but-identical dropdowns each used to have — see
                    updateSharedFeeCurrency() above. Same consolidation as
                    ProgrammeModal's identical section. */}
                <div className="fg m-0">
                  <div className="lbl">Currency <span className="text-g400 font-normal normal-case">(Lateral Entry / Credit Exemption / Aptech Credit Exemption)</span></div>
                  <SearchSelect options={currencyIntOptions} value={active.lefCurrency} onChange={updateSharedFeeCurrency} />
                </div>
              </div>
            </div>

            {/* Per-semester accordion — driven by the selected programme's real semesters */}
            <div className="flex flex-col gap-2">
              {active.programme && semesters.length === 0 && (
                <div className="text-g400 italic" style={{ fontSize: 12.5 }}>No semesters found for this programme.</div>
              )}
              {semesters.map((sem, si) => {
                const items  = active.semFees[sem.semesterGuid] ?? []
                const isOpen = activeAcc === si
                const total  = items.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0)
                const totalCurrencyCode = financeCurrencies.find(c => c.currencyGuid === items[0]?.currencyGuid)?.currencyCode ?? ''
                return (
                  <div key={sem.semesterGuid} style={{ border: '1.5px solid var(--b100)', borderRadius: 'var(--rsm)', overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setActiveAcc(isOpen ? -1 : si)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', width: '100%', background: isOpen ? 'var(--b50)' : 'var(--white)', border: 'none', borderBottom: isOpen ? '1px solid var(--b100)' : 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
                    >
                      <span className="badge badge-blue" style={{ flexShrink: 0 }}>Sem {si + 1}</span>
                      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--b700)' }}>{sem.semName}</span>
                      {items.length > 0
                        ? <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--g400)', marginRight: 8 }}>{items.length} item{items.length !== 1 ? 's' : ''} · {total.toLocaleString()} {totalCurrencyCode}</span>
                        : <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--g400)', fontStyle: 'italic', marginRight: 8 }}>No items</span>
                      }
                      <i className="lni lni-chevron-down" style={{ fontSize: 11, color: 'var(--g400)', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }} />
                    </button>
                    <div style={{ overflow: 'hidden', maxHeight: isOpen ? 800 : 0, transition: 'max-height 0.3s ease' }}>
                      <div style={{ padding: '10px 14px' }}>
                        {items.length > 0 && (
                          <div className="fsm-item-hdr">
                            <span style={{ textAlign: 'center' }}>Pri.</span><span>Ledger</span><span>Ledger Priority</span><span>Amount</span><span>Currency</span><span></span>
                          </div>
                        )}
                        <div className="flex flex-col gap-1">
                          {items.length === 0 && (
                            <div className="text-g400 italic" style={{ fontSize: 12.5, marginBottom: 8 }}>No fee items — click &ldquo;Add Fee Item&rdquo; to begin.</div>
                          )}
                          {items.map((f, idx) => (
                            <div key={f.id} className="fsm-item-row">
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                                <button className="btn btn-neu" style={{ width: 26, height: 14, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }} onClick={() => moveItem(sem.semesterGuid, idx, -1)} disabled={idx === 0}><i className="lni lni-chevron-up"></i></button>
                                <button className="btn btn-neu" style={{ width: 26, height: 14, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }} onClick={() => moveItem(sem.semesterGuid, idx, 1)} disabled={idx === items.length - 1}><i className="lni lni-chevron-down"></i></button>
                              </div>
                              <SearchSelect placeholder="— Select Ledger —" options={ledgerOptions} value={f.ledgerGuid} onChange={val => updateItem(sem.semesterGuid, f.id, 'ledgerGuid', val)} />
                              <input className="ctrl" value={f.ledgerPriority} onChange={e => updateItem(sem.semesterGuid, f.id, 'ledgerPriority', e.target.value)} type="number" min={0} placeholder="e.g. 1" />
                              <input className="ctrl" value={f.amount} onChange={e => updateItem(sem.semesterGuid, f.id, 'amount', e.target.value)} type="number" min={0} placeholder="0" />
                              <SearchSelect placeholder="— Currency —" options={financeCurrencyOptions} value={f.currencyGuid} onChange={val => updateItem(sem.semesterGuid, f.id, 'currencyGuid', val)} />
                              <button className="btn btn-danger btn-sm" style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} onClick={() => removeItem(sem.semesterGuid, f.id)}><i className="lni lni-trash-can"></i></button>
                            </div>
                          ))}
                          <button className="btn btn-neu btn-sm mt-2" style={{ alignSelf: 'flex-start', fontSize: 11 }} onClick={() => addItem(sem.semesterGuid)}>
                            <i className="lni lni-plus"></i> Add Fee Item
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {(anyCurrencyGaps || anyLedgerGaps) && (
                <p style={{ color: 'var(--red)', fontSize: 12 }}>Select a currency and ledger for every fee item before saving.</p>
              )}
              <div className="flex justify-end mt-2">
                <button className="btn btn-primary" onClick={handleSubmitAll} disabled={!allComplete || submitting}>
                  <i className="lni lni-checkmark"></i> {submitting ? 'Saving…' : 'Save Fee Structure'}
                </button>
              </div>
            </div>
            </div>{/* end gate wrapper */}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
