'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { CourseUnit, CourseUnitInput, getCourseUnitById } from '@/lib/api/academic/courseUnit'
import { UpsertCourseUnitOutlineInput } from '@/lib/api/academic/courseUnitOutlines'
import { openDocumentForViewing, downloadDocument } from '@/lib/documentViewer'
import { useCourseUnit, useUpsertCourseUnitOutlines } from '@/hooks/academic/useCourseUnits'
import { useRepetitionTags } from '@/hooks/academic/useRepetitionTags'
import { useEmployees } from '@/hooks/employee/useEmployees'
import { AuthError } from '@/lib/api/client'

// Add and Edit share this form — differ in prefill, whether Step 1 POSTs or
// PUTs the unit details, and whether there's an existing-syllabus panel to show.
//
// courseUnitOutlineGuid/courseUnitTopicGuid carry the real guid when a
// chapter/topic came from the loaded record on Edit (via useCourseUnit,
// backed by GET .../details) — undefined for one freshly added in this
// editing session, and always undefined on Create. Threaded through to
// handleSubmit's outline payload so the upsert endpoint updates existing
// rows in place instead of creating a new one and soft-deleting the old one
// on every save.
type Topic   = { name: string; taughtBy: string; studySequence: string; courseUnitTopicGuid?: string }
type Chapter = { title: string; topics: Topic[]; courseUnitOutlineGuid?: string }

// Study Sequence defaults to the topic's 1-based position within its
// chapter when added, but is now a real editable field — the user can
// override it to any value (e.g. to reorder without dragging, or to leave
// gaps) rather than it always being silently forced back to array position
// on submit.
function blankTopic(order: number): Topic { return { name: '', taughtBy: '', studySequence: String(order) } }
function blankChapter(): Chapter { return { title: '', topics: [blankTopic(1)] } }

interface CourseUnitFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  courseUnitGuid: string | null
  createCourseUnit: {
    mutate: (input: CourseUnitInput, options?: { onSuccess?: (data: CourseUnit) => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateCourseUnit: {
    mutate: (variables: { guid: string; input: CourseUnitInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function CourseUnitFormModal({ isOpen, onClose, showToast, mode, courseUnitGuid, createCourseUnit, updateCourseUnit }: CourseUnitFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: courseUnit, isLoading, isError, error } = useCourseUnit(courseUnitGuid, isOpen && isEdit)
  const upsertOutlines = useUpsertCourseUnitOutlines()

  const [saved, setSaved]               = useState(false)
  const [failure, setFailure]           = useState<string | null>(null)
  const [step, setStep]                 = useState(1)
  // New-only: set once Step 1's Save & Continue creates the course unit via
  // POST /courseunits — Step 2 then only writes chapters/topics through the
  // separate courseunit-outlines PUT, using this guid. Also doubles as the
  // "already created" guard: Step 1's fields lock once this is set, and
  // re-clicking Save & Continue just advances instead of POSTing again —
  // that endpoint only ever creates, so a second call would either 400 on
  // the same courseUnitCode or create a second, orphaned unit.
  const [createdCourseUnitGuid, setCreatedCourseUnitGuid] = useState<string | null>(null)
  const [chapters, setChapters]         = useState<Chapter[]>([blankChapter()])
  const [activeChapterIdx, setActiveChapterIdx] = useState(0)
  const [unitCode, setUnitCode]         = useState('')
  const [unitName, setUnitName]         = useState('')
  const [numChapters, setNumChapters]   = useState('')
  const [credits, setCredits]           = useState('')
  const [repetitionTagGuid, setRepetitionTagGuid] = useState('')
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null)
  const [syllabusLinkLoading, setSyllabusLinkLoading] = useState(false)
  const [errors, setErrors]               = useState<Record<string, string>>({})
  const [chapterErrors, setChapterErrors] = useState<string[]>([])
  // Keyed by "chapterIdx-topicIdx" — taughtBy (employeeGuid) is required by
  // the backend; omitting it on any topic 400s the whole outline save, not
  // just that one topic, so this has to be caught client-side before submit
  // rather than left to surface as an opaque failure popup.
  const [topicTaughtByErrors, setTopicTaughtByErrors] = useState<Set<string>>(new Set())
  const [includeCW, setIncludeCW]       = useState(true)
  const [includeCBT, setIncludeCBT]     = useState(true)
  const [includeMid, setIncludeMid]     = useState(true)
  const [cwAssessed, setCwAssessed]     = useState('25')
  const [cbtAssessed, setCbtAssessed]   = useState('50')
  const [ueAssessed, setUeAssessed]     = useState('100')
  const [cwFinal, setCwFinal]           = useState('15')
  const [cbtFinal, setCbtFinal]         = useState('15')
  const [ueFinal, setUeFinal]           = useState('70')

  const { data: repetitionTags = [] } = useRepetitionTags()
  const repetitionTagOptions = repetitionTags.map(t => ({ value: t.courseUnitRepetitionGuid, label: `${t.tagCode} — ${t.tagName}` }))

  const { data: employees = [] } = useEmployees()
  const employeeOptions = employees.map(e => ({ value: e.employeeGuid, label: `${e.empName} (${e.shortCode})` }))

  const finalTotal = (includeCW ? (+cwFinal || 0) : 0) + (includeCBT ? (+cbtFinal || 0) : 0) + (+ueFinal || 0)
  const totalOk    = finalTotal === 100

  function weightDesc(assessed: string, final: string) {
    const a = +assessed, f = +final
    if (!a || !f) return 'Assessed / Final weight'
    return `${a} marks → prorated ${f} marks`
  }

  function redistributeFinalWeights(nextIncludeCW: boolean, nextIncludeCBT: boolean, nextIncludeUE: boolean, fixed: Partial<Record<'cw' | 'cbt' | 'ue', number>> = {}) {
    const keys = ['cw', 'cbt', 'ue'] as const
    const current = { cw: +cwFinal, cbt: +cbtFinal, ue: +ueFinal }
    const included = { cw: nextIncludeCW, cbt: nextIncludeCBT, ue: nextIncludeUE }
    const result = { cw: 0, cbt: 0, ue: 0 }
    const fixedTotal = keys.reduce((sum, key) => {
      if (included[key] && fixed[key] != null) return sum + fixed[key]!
      return sum
    }, 0)
    const activeKeys = keys.filter(key => included[key] && fixed[key] == null)

    if (activeKeys.length === 0) {
      if (included.ue) result.ue = 100 - fixedTotal
      return { ...result, ...fixed }
    }

    const totalActive = activeKeys.reduce((sum, key) => sum + current[key], 0)
    if (totalActive === 0) {
      if (activeKeys.length === 1) {
        result[activeKeys[0]] = 100 - fixedTotal
      } else {
        const keyCombo = activeKeys.slice().sort().join(',')
        const defaults: Record<string, number> = keyCombo === 'cbt,ue' ? { cbt: 20, ue: 80 }
          : keyCombo === 'cw,ue' ? { cw: 30, ue: 70 }
          : keyCombo === 'cw,cbt' ? { cw: 50, cbt: 50 }
          : { cw: 15, cbt: 15, ue: 70 }
        activeKeys.forEach(key => { result[key] = defaults[key] ?? 0 })
      }
    } else {
      let remaining = 100 - fixedTotal
      activeKeys.forEach((key, index) => {
        if (index === activeKeys.length - 1) {
          result[key] = remaining
        } else {
          const value = Math.round(current[key] * (100 - fixedTotal) / totalActive)
          result[key] = value
          remaining -= value
        }
      })
    }

    return { ...result, ...fixed }
  }

  // Prefill the form when the selected course unit loads (Edit only), or
  // reset to blanks when opening fresh for Create.
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && courseUnit) {
      setUnitCode(courseUnit.courseUnitCode)
      setUnitName(courseUnit.courseUnitName)
      setNumChapters(String(courseUnit.chapterCount))
      setCredits(String(courseUnit.maxCredits))
      setIncludeMid(!!courseUnit.mid)
      setIncludeCW(!!courseUnit.cw)
      setIncludeCBT(!!courseUnit.ca)
      setRepetitionTagGuid(courseUnit.courseUnitRepetitionGuid ?? '')
      setChapters(
        courseUnit.outlines?.length
          ? courseUnit.outlines.map(o => ({
              title: o.chapterName,
              courseUnitOutlineGuid: o.courseUnitOutlineGuid,
              // Sort by the server's real studySequence on load so on-screen
              // order matches what's actually stored, and prefill the field
              // itself from that same real value (not array position) — it's
              // user-editable now, so the true stored number matters, not
              // just a recomputed 1-based position.
              topics: [...o.topics]
                .sort((a, b) => a.studySequence - b.studySequence)
                .map(t => ({ name: t.courseUnitTopicDetails, taughtBy: t.employeeGuid, studySequence: String(t.studySequence), courseUnitTopicGuid: t.courseUnitTopicGuid })),
            }))
          : [blankChapter()]
      )
      setSyllabusFile(null)
      setStep(1)
      setActiveChapterIdx(0)
      setErrors({})
      setChapterErrors([])
      setTopicTaughtByErrors(new Set())
    } else if (!isEdit) {
      setStep(1); setChapters([blankChapter()]); setActiveChapterIdx(0); setErrors({}); setChapterErrors([])
      setTopicTaughtByErrors(new Set())
      setUnitCode(''); setUnitName(''); setNumChapters(''); setCredits(''); setRepetitionTagGuid('')
      setSyllabusFile(null)
      setIncludeCW(true); setIncludeCBT(true); setIncludeMid(true)
      setCwAssessed('25'); setCbtAssessed('50'); setUeAssessed('100')
      setCwFinal('15'); setCbtFinal('15'); setUeFinal('70')
      setCreatedCourseUnitGuid(null)
    }
  }, [isOpen, isEdit, courseUnit])

  function validateStep1() {
    const e: Record<string, string> = {}
    if (!unitCode.trim())  e.unitCode     = 'Unit Code is required'
    if (!unitName.trim())  e.unitName     = 'Unit Name is required'
    if (!credits)          e.credits      = 'Credits is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep2() {
    const chapErrs = chapters.map(ch => ch.title.trim() ? '' : 'Chapter title is required')
    setChapterErrors(chapErrs)

    const missingTaughtBy = new Set<string>()
    chapters.forEach((ch, ci) => {
      ch.topics.forEach((t, ti) => {
        if (!t.taughtBy) missingTaughtBy.add(`${ci}-${ti}`)
      })
    })
    setTopicTaughtByErrors(missingTaughtBy)

    if (missingTaughtBy.size > 0) {
      // Jump to the first chapter with a missing Taught By so the error is
      // actually visible — it could otherwise be sitting in a chapter the
      // user isn't currently looking at.
      const firstBadChapter = chapters.findIndex((_, ci) =>
        Array.from(missingTaughtBy).some(key => key.startsWith(`${ci}-`))
      )
      if (firstBadChapter !== -1) setActiveChapterIdx(firstBadChapter)
      showToast('Select Taught By for every topic before saving', 'error')
    }

    return chapErrs.every(err => !err) && missingTaughtBy.size === 0
  }

  // Edit only — `syllabus` is a presigned S3 URL good for only 5 minutes
  // (X-Amz-Expires=300 on a real response). courseUnit.syllabus comes from
  // useCourseUnit, which (unlike the list) does refetch on a fresh mount,
  // but not while the modal just sits open — if the user takes more than 5
  // minutes to get here, that URL is already dead. Fetch a genuinely fresh
  // copy right at click time instead of trusting whatever's already loaded.
  async function handleSyllabus(mode: 'view' | 'download') {
    if (!courseUnitGuid) return
    setSyllabusLinkLoading(true)
    try {
      const fresh = await getCourseUnitById(courseUnitGuid)
      if (!fresh.syllabus) { showToast('Syllabus is no longer attached to this unit', 'error'); return }
      if (mode === 'view') await openDocumentForViewing(fresh.syllabus)
      else downloadDocument(fresh.syllabus)
    } catch {
      showToast('Failed to load the syllabus document. Please try again.', 'error')
    } finally {
      setSyllabusLinkLoading(false)
    }
  }

  if (!isOpen) return null

  function handleClose() {
    setSaved(false); setFailure(null); setStep(1); setChapters([blankChapter()]); setActiveChapterIdx(0); setErrors({}); setChapterErrors([])
    setTopicTaughtByErrors(new Set())
    setUnitCode(''); setUnitName(''); setNumChapters(''); setCredits(''); setRepetitionTagGuid('')
    setSyllabusFile(null)
    setIncludeCW(true); setIncludeCBT(true); setIncludeMid(true)
    setCwAssessed('25'); setCbtAssessed('50'); setUeAssessed('100')
    setCwFinal('15'); setCbtFinal('15'); setUeFinal('70')
    setCreatedCourseUnitGuid(null)
    onClose()
  }

  // Step 2's Save/Update Course Unit — writes chapters/topics via the
  // separate outlines endpoint (never touched by create/updateCourseUnit —
  // see the comment in courseUnit.ts). Always sends the full outline state,
  // since the endpoint is a diff-based replace, not a partial patch.
  // courseUnitOutlineGuid/courseUnitTopicGuid pass through when a
  // chapter/topic came from the loaded record on Edit, so the upsert
  // updates existing rows in place instead of creating new ones.
  function handleSubmit() {
    const activeGuid = isEdit ? courseUnitGuid : createdCourseUnitGuid
    if (!activeGuid || !validateStep2()) {
      if (!activeGuid && !isEdit) setFailure('Unit details have not been saved yet — go back to Step 1.')
      return
    }

    const outlines: UpsertCourseUnitOutlineInput[] = chapters.map((ch, ci) => ({
      courseUnitOutlineGuid: ch.courseUnitOutlineGuid ?? null,
      chapter: ci + 1,
      chapterName: ch.title,
      topics: ch.topics.map((t, ti) => ({
        courseUnitTopicGuid: t.courseUnitTopicGuid ?? null,
        courseUnitTopicDetails: t.name,
        studySequence: +t.studySequence || ti + 1,
        employeeGuid: t.taughtBy,
      })),
    }))

    upsertOutlines.mutate(
      { courseUnitGuid: activeGuid, outlines },
      {
        onSuccess: () => { setSaved(true); showToast(isEdit ? 'Course unit updated successfully' : 'Course unit added successfully') },
        onError: (error: Error) => {
          const code = error instanceof AuthError ? error.code : undefined
          setFailure(error.message || `Failed to save the course outline${code ? ` (${code})` : ''}. Please try again.`)
        },
      },
    )
  }

  // chapter cap — Step 2 can never hold more chapters than Step 1's "No. of Chapters" (when set)
  const chapterCap = +numChapters || 0
  const atChapterCap = chapterCap > 0 && chapters.length >= chapterCap

  // Step 1's Save & Continue. On Create, POSTs /courseunits right away (Unit
  // Details only, no outlines) so Step 2 has a real courseUnitGuid to write
  // chapters/topics against — already-created guard: see
  // createdCourseUnitGuid above. On Edit, PUTs /courseunits/{guid} instead —
  // no "already created" guard needed there since the guid already exists
  // before this modal ever opens, so re-clicking Save & Continue just
  // re-PUTs the same fields, which is safe to repeat.
  function goToStep2() {
    if (!validateStep1()) return

    if (isEdit) {
      if (!courseUnitGuid || !courseUnit) return
      updateCourseUnit.mutate(
        {
          guid: courseUnitGuid,
          input: {
            courseUnitCode: unitCode,
            courseUnitName: unitName,
            maxCredits: +credits || 0,
            chapterCount: +numChapters || 0,
            courseUnitRepetitionGuid: repetitionTagGuid || null,
            mid: includeMid ? 1 : 0,
            cw: includeCW ? 1 : 0,
            ca: includeCBT ? 1 : 0,
            // Confirmed part of the GET .../details response (see
            // CourseUnitDetailFields.approved) — preserve the loaded
            // record's own value rather than forcing it.
            approved: courseUnit.approved,
            cbtWeightage: +cbtFinal || 0,
            cwWeightage: +cwFinal || 0,
            ueWeightage: +ueFinal || 0,
            syllabus: syllabusFile,
          },
        },
        {
          onSuccess: () => {
            // If the user lowered No. of Chapters after already building
            // some out, trim the excess from the end.
            if (chapterCap > 0 && chapters.length > chapterCap) {
              setChapters(p => p.slice(0, chapterCap))
              setChapterErrors(p => p.slice(0, chapterCap))
              setActiveChapterIdx(i => Math.min(i, chapterCap - 1))
            }
            setStep(2)
          },
          onError: (error: Error) => {
            const code = error instanceof AuthError ? error.code : undefined
            setFailure(error.message || `Failed to save unit details${code ? ` (${code})` : ''}. Please try again.`)
          },
        },
      )
      return
    }

    // Create path.
    // If the user lowered No. of Chapters after already building some out, trim the excess from the end.
    if (chapterCap > 0 && chapters.length > chapterCap) {
      setChapters(p => p.slice(0, chapterCap))
      setChapterErrors(p => p.slice(0, chapterCap))
      setActiveChapterIdx(i => Math.min(i, chapterCap - 1))
    }
    if (createdCourseUnitGuid) { setStep(2); return }

    createCourseUnit.mutate(
      {
        courseUnitCode: unitCode,
        courseUnitName: unitName,
        maxCredits: +credits || 0,
        // The real final chapter count isn't known yet at this point (Step
        // 2 hasn't been built out) — this is Step 1's own "No. of Chapters"
        // declaration, which the outlines upsert later enforces as a cap.
        chapterCount: +numChapters || 0,
        courseUnitRepetitionGuid: repetitionTagGuid || null,
        mid: includeMid ? 1 : 0,
        cw: includeCW ? 1 : 0,
        ca: includeCBT ? 1 : 0,
        // No UI control yet — defaults new units to approved.
        approved: 1,
        cbtWeightage: +cbtFinal || 0,
        cwWeightage: +cwFinal || 0,
        ueWeightage: +ueFinal || 0,
        syllabus: syllabusFile,
      },
      {
        onSuccess: (unit: CourseUnit) => { setCreatedCourseUnitGuid(unit.courseUnitGuid); showToast('Unit details saved'); setStep(2) },
        onError: (error: Error) => {
          const code = error instanceof AuthError ? error.code : undefined
          setFailure(error.message || `Failed to save unit details${code ? ` (${code})` : ''}. Please try again.`)
        },
      },
    )
  }

  // chapter helpers
  function addChapter() {
    if (atChapterCap) { showToast(`No. of Chapters is set to ${chapterCap} — remove a chapter or increase that value first`, 'error'); return }
    setChapters(p => [...p, blankChapter()])
    setChapterErrors(p => [...p, ''])
    setActiveChapterIdx(chapters.length)
  }
  function removeChapter(ci: number) {
    setChapters(p => p.filter((_, i) => i !== ci))
    setChapterErrors(p => p.filter((_, i) => i !== ci))
    // Every chapter after the removed one shifts down an index — rather
    // than remap keys, just clear pending topic errors; they'll be
    // recomputed correctly on the next submit attempt.
    setTopicTaughtByErrors(new Set())
    setActiveChapterIdx(current => {
      const newLength = chapters.length - 1
      if (ci < current) return current - 1
      if (ci === current) return Math.min(current, newLength - 1)
      return current
    })
  }
  function setChapterTitle(ci: number, v: string) {
    setChapters(p => p.map((c, i) => i === ci ? { ...c, title: v } : c))
    if (chapterErrors[ci]) setChapterErrors(p => p.map((e, i) => i === ci ? '' : e))
  }

  // topic helpers
  function addTopic(ci: number) {
    setChapters(p => p.map((c, i) => i === ci ? { ...c, topics: [...c.topics, blankTopic(c.topics.length + 1)] } : c))
    // Topic indices within this chapter shift for everything after the
    // insertion point — simplest to just drop all pending errors for this
    // chapter rather than try to remap keys; they'll be recomputed on the
    // next submit attempt anyway.
    setTopicTaughtByErrors(prev => new Set(Array.from(prev).filter(key => !key.startsWith(`${ci}-`))))
  }
  function removeTopic(ci: number, ti: number) {
    setChapters(p => p.map((c, i) => i === ci ? { ...c, topics: c.topics.filter((_, j) => j !== ti) } : c))
    setTopicTaughtByErrors(prev => new Set(Array.from(prev).filter(key => !key.startsWith(`${ci}-`))))
  }
  function setTopic(ci: number, ti: number, field: keyof Topic, v: string) {
    setChapters(p => p.map((c, i) => i === ci
      ? { ...c, topics: c.topics.map((t, j) => j === ti ? { ...t, [field]: v } : t) }
      : c
    ))
    if (field === 'taughtBy' && v) {
      setTopicTaughtByErrors(prev => {
        if (!prev.has(`${ci}-${ti}`)) return prev
        const next = new Set(prev)
        next.delete(`${ci}-${ti}`)
        return next
      })
    }
  }

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Course Unit Updated!' : 'Course Unit Saved!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new course unit has been added successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Course Unit" : "Couldn't Add Course Unit"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Course Unit"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load course unit details.') : 'Failed to load course unit details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !courseUnit)) {
    return (
      <div className="modal-overlay open" id="cu-edit-modal">
        <div className="modal modal-80 modal-flex" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Course Unit</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading course unit details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'cu-edit-modal' : 'cu-new-modal'}>
      <div className="modal modal-80 modal-flex" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-book'}`}></i> {isEdit ? 'Edit Course Unit' : 'Add Course Unit'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="prog-steps">
          <div className={`prog-step${step === 1 ? ' active' : ''}`}>
            <span className="prog-step-num">1</span>
            <span>Unit Details</span>
          </div>
          <div className="prog-step-line"></div>
          <div className={`prog-step${step === 2 ? ' active' : ''}`}>
            <span className="prog-step-num">2</span>
            <span>Course Outline</span>
          </div>
        </div>

        {/* ── Step 1: Basic Info ─────────────────────────────── */}
        {step === 1 && (
        <div className="modal-scroll">
          {!isEdit && createdCourseUnitGuid && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 14px', background: 'var(--green-bg)', border: '1.5px solid var(--green-bd)', borderRadius: 'var(--rsm)', fontSize: 12.5, color: 'var(--g700)' }}>
              <i className="lni lni-checkmark-circle" style={{ color: 'var(--green)', fontSize: 16 }}></i>
              Unit details already saved — locked to avoid creating a duplicate. Continue below to Course Outline.
            </div>
          )}
          <div style={!isEdit && createdCourseUnitGuid ? { opacity: .55, pointerEvents: 'none' } : undefined}>

          {/* ── Basic Info ─────────────────────────────────────── */}
          <div className="g3">
            <div className="fg">
              <div className="lbl">Unit Code <span className="req">*</span></div>
              <input
                className="ctrl font-mono uppercase"
                style={errors.unitCode ? { borderColor: 'var(--red)' } : undefined}
                placeholder={isEdit ? undefined : 'e.g. IT201'}
                value={unitCode}
                onChange={e => { setUnitCode(e.target.value); if (errors.unitCode) setErrors(p => ({ ...p, unitCode: '' })) }}
              />
              {errors.unitCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.unitCode}</p>}
            </div>
            <div className="fg">
              <div className="lbl">Unit Name <span className="req">*</span></div>
              <input
                className="ctrl"
                style={errors.unitName ? { borderColor: 'var(--red)' } : undefined}
                placeholder={isEdit ? undefined : 'e.g. Data Structures and Algorithms'}
                value={unitName}
                onChange={e => { setUnitName(e.target.value); if (errors.unitName) setErrors(p => ({ ...p, unitName: '' })) }}
              />
              {errors.unitName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.unitName}</p>}
            </div>
            <div className="fg">
              <div className="lbl">No. of Chapters</div>
              <input
                className="ctrl"
                style={errors.numChapters ? { borderColor: 'var(--red)' } : undefined}
                type="number"
                min={1}
                placeholder={isEdit ? undefined : 'e.g. 6'}
                value={numChapters}
                onChange={e => { setNumChapters(e.target.value); if (errors.numChapters) setErrors(p => ({ ...p, numChapters: '' })) }}
              />
              {errors.numChapters && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.numChapters}</p>}
            </div>
            <div className="fg">
              <div className="lbl">Credits <span className="req">*</span></div>
              <input
                className="ctrl"
                style={errors.credits ? { borderColor: 'var(--red)' } : undefined}
                type="number"
                min={1}
                placeholder={isEdit ? undefined : 'e.g. 3'}
                value={credits}
                onChange={e => { setCredits(e.target.value); if (errors.credits) setErrors(p => ({ ...p, credits: '' })) }}
              />
              {errors.credits && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.credits}</p>}
            </div>
            <div className="fg span2">
              <div className="lbl">Repetition Tag</div>
              <SearchSelect
                placeholder="— Select repetition tag —"
                value={repetitionTagGuid}
                onChange={setRepetitionTagGuid}
                options={repetitionTagOptions}
              />
            </div>
            <div className="fg span3">
              <div className="lbl">Include In</div>
              <div style={{ display: 'flex', gap: 28, marginTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--g700)' }}>
                  <input
                    type="checkbox"
                    checked={includeCBT}
                    onChange={e => {
                      const checked = e.target.checked
                      setIncludeCBT(checked)
                      if (!checked) {
                        const next = redistributeFinalWeights(includeCW, false, true)
                        setCbtFinal('0')
                        setCwFinal(String(next.cw))
                        setUeFinal(String(next.ue))
                      } else if (+cbtFinal === 0) {
                        const next = redistributeFinalWeights(includeCW, true, true, { cbt: 15 })
                        setCbtFinal(String(next.cbt))
                        setCwFinal(String(next.cw))
                        setUeFinal(String(next.ue))
                      }
                    }}
                    style={{ width: 15, height: 15, accentColor: 'var(--b500)', cursor: 'pointer' }}
                  />
                  Class Test
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--g700)' }}>
                  <input
                    type="checkbox"
                    checked={includeCW}
                    onChange={e => {
                      const checked = e.target.checked
                      setIncludeCW(checked)
                      if (!checked) {
                        const next = redistributeFinalWeights(false, includeCBT, true)
                        setCwFinal('0')
                        setCbtFinal(String(next.cbt))
                        setUeFinal(String(next.ue))
                      } else {
                        if (+cwFinal === 0) {
                          const next = redistributeFinalWeights(true, includeCBT, true, { cw: 15 })
                          setCwFinal(String(next.cw))
                          setCbtFinal(String(next.cbt))
                          setUeFinal(String(next.ue))
                        }
                        setIncludeMid(true)
                      }
                    }}
                    style={{ width: 15, height: 15, accentColor: 'var(--b500)', cursor: 'pointer' }}
                  />
                  Course Work
                </label>
              </div>
            </div>
          </div>

          {/* ── Assessment Weightage ──────────────────────────── */}
          <div className="mdl-section mdl-section--amber">
            <div className="mdl-section-hdr">
              <span className="mdl-section-icon"><i className="lni lni-bar-chart"></i></span>
              <div>
                <div className="mdl-section-title">Assessment Weightage</div>
                <div className="mdl-section-sub">Set assessed vs. final-weight marks for each component</div>
              </div>
            </div>

            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 88px 24px 88px 1fr', gap: '0 10px', alignItems: 'center', padding: '0 4px 10px', borderBottom: '1.5px solid var(--amber-bd)', marginBottom: 4 }}>
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--g400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Component</span>
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--g400)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Assessed</span>
              <span />
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--g400)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Final Wt.</span>
            </div>

            {/* Rows */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>

              {/* CW row */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 88px 24px 88px 1fr', gap: '0 10px',
                alignItems: 'center', padding: '13px 4px',
                borderBottom: '1px solid var(--g100)',
                transition: 'opacity .2s',
                ...(!includeCW ? { opacity: 0.38, filter: 'grayscale(0.5)', pointerEvents: 'none' } : {}),
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 3, height: 38, background: 'var(--b400)', borderRadius: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--b800)' }}>Coursework</div>
                    <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--g400)', letterSpacing: '0.03em' }}>CW · Internal Assessment</div>
                  </div>
                  {!includeCW && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'var(--g200)', color: 'var(--g500)', textTransform: 'uppercase', marginLeft: 4 }}>Off</span>}
                </div>
                <input className="ctrl wt-input" type="number" value={cwAssessed} min={0} onChange={e => setCwAssessed(e.target.value)} style={{ textAlign: 'center' }} />
                <span style={{ textAlign: 'center', fontWeight: 800, color: 'var(--b500)', fontSize: 18, lineHeight: 1 }}>→</span>
                <input className="ctrl wt-input" type="number" value={cwFinal} min={0} onChange={e => setCwFinal(e.target.value)} style={{ textAlign: 'center' }} />
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--g500)', paddingLeft: 4, lineHeight: 1.5 }}>{weightDesc(cwAssessed, cwFinal)}</span>
              </div>

              {/* CBT row */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 88px 24px 88px 1fr', gap: '0 10px',
                alignItems: 'center', padding: '13px 4px',
                borderBottom: '1px solid var(--g100)',
                transition: 'opacity .2s',
                ...(!includeCBT ? { opacity: 0.38, filter: 'grayscale(0.5)', pointerEvents: 'none' } : {}),
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 3, height: 38, background: 'var(--amber)', borderRadius: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--g800)' }}>Class Test</div>
                    <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--g400)', letterSpacing: '0.03em' }}>CBT · Internal Assessment</div>
                  </div>
                  {!includeCBT && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'var(--g200)', color: 'var(--g500)', textTransform: 'uppercase', marginLeft: 4 }}>Off</span>}
                </div>
                <input className="ctrl wt-input" type="number" value={cbtAssessed} min={0} onChange={e => setCbtAssessed(e.target.value)} style={{ textAlign: 'center' }} />
                <span style={{ textAlign: 'center', fontWeight: 800, color: 'var(--amber)', fontSize: 18, lineHeight: 1 }}>→</span>
                <input className="ctrl wt-input" type="number" value={cbtFinal} min={0} onChange={e => setCbtFinal(e.target.value)} style={{ textAlign: 'center' }} />
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--g500)', paddingLeft: 4, lineHeight: 1.5 }}>{weightDesc(cbtAssessed, cbtFinal)}</span>
              </div>

              {/* UE row */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 88px 24px 88px 1fr', gap: '0 10px',
                alignItems: 'center', padding: '13px 4px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 3, height: 38, background: 'var(--green)', borderRadius: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--g800)' }}>University Exam</div>
                    <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--g400)', letterSpacing: '0.03em' }}>UE · Final Examination</div>
                  </div>
                </div>
                <input className="ctrl wt-input" type="number" value={ueAssessed} min={0} onChange={e => setUeAssessed(e.target.value)} style={{ textAlign: 'center' }} />
                <span style={{ textAlign: 'center', fontWeight: 800, color: 'var(--green)', fontSize: 18, lineHeight: 1 }}>→</span>
                <input className="ctrl wt-input" type="number" value={ueFinal} min={0} onChange={e => setUeFinal(e.target.value)} style={{ textAlign: 'center' }} />
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--g500)', paddingLeft: 4, lineHeight: 1.5 }}>{weightDesc(ueAssessed, ueFinal)}</span>
              </div>
            </div>

            {/* Breakdown bar + total */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1.5px solid var(--amber-bd)' }}>
              <div style={{ display: 'flex', height: 7, borderRadius: 6, overflow: 'hidden', background: 'var(--g100)', gap: 2 }}>
                {includeCW && +cwFinal > 0 && <div style={{ flex: +cwFinal, background: 'var(--b400)', transition: 'flex .3s' }} title={`CW: ${cwFinal} marks`} />}
                {includeCBT && +cbtFinal > 0 && <div style={{ flex: +cbtFinal, background: 'var(--amber)', transition: 'flex .3s' }} title={`CBT: ${cbtFinal} marks`} />}
                {+ueFinal > 0 && <div style={{ flex: +ueFinal, background: 'var(--green)', transition: 'flex .3s' }} title={`UE: ${ueFinal} marks`} />}
                {!totalOk && finalTotal < 100 && <div style={{ flex: 100 - finalTotal, background: 'var(--g100)' }} />}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 9 }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  {includeCW && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--g500)', display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: 'var(--b400)' }} />CW · {cwFinal} marks</span>}
                  {includeCBT && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--g500)', display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: 'var(--amber)' }} />CBT · {cbtFinal} marks</span>}
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--g500)', display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: 'var(--green)' }} />UE · {ueFinal} marks</span>
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--g500)' }}>
                  Total: <strong style={{ color: totalOk ? 'var(--green)' : 'var(--red)' }}>{finalTotal}</strong> / 100
                  {!totalOk && <span style={{ marginLeft: 8, fontSize: 'var(--fs-xs)', color: 'var(--red)' }}>⚠ Must equal 100</span>}
                </div>
              </div>
            </div>
          </div>

          {/* ── Approved Syllabus ─────────────────────────────── */}
          <div className="mdl-section mdl-section--green">
            <div className="mdl-section-hdr">
              <span className="mdl-section-icon"><i className="lni lni-files"></i></span>
              <div>
                <div className="mdl-section-title">Approved Syllabus</div>
                <div className="mdl-section-sub">Attach the NCHE / UVTOP-approved syllabus document for this unit</div>
              </div>
            </div>
            {/* The upload dropzone below has an invisible <input type="file">
                absolutely covering the entire box (see .file-zone in
                globals.css) so the whole area is clickable to pick a file —
                a link nested inside it was being swallowed by that same
                overlay, opening the file picker instead of the document.
                Kept as its own line above the dropzone instead, outside the
                overlay's reach. Uses handleSyllabus (a fresh fetch at click
                time) rather than courseUnit.syllabus directly — that field
                is a presigned S3 URL good for only 5 minutes, so the
                already-loaded copy can easily be dead by the time the user
                actually clicks. Edit only — Create has no existing document
                to show yet. */}
            {isEdit && !syllabusFile && courseUnit?.syllabus && (
              <div
                className="flex items-center justify-between gap-3"
                style={{ background: 'var(--white)', border: '1.5px solid var(--green-bd)', borderRadius: 'var(--rsm)', padding: '10px 14px', marginBottom: 10 }}
              >
                <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                  <i className="lni lni-files" style={{ color: 'var(--green)', fontSize: 18, flexShrink: 0 }}></i>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--g700)' }}>Currently attached syllabus</span>
                </div>
                <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn btn-neu btn-sm"
                    onClick={() => handleSyllabus('view')}
                    disabled={syllabusLinkLoading}
                  >
                    <i className="lni lni-eye"></i> {syllabusLinkLoading ? 'Loading…' : 'View'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-neu btn-sm"
                    onClick={() => handleSyllabus('download')}
                    disabled={syllabusLinkLoading}
                  >
                    <i className="lni lni-download"></i> Download
                  </button>
                </div>
              </div>
            )}
            <div className="file-zone">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={e => setSyllabusFile(e.target.files?.[0] ?? null)}
              />
              <div className="file-zone-icon"><i className="lni lni-files"></i></div>
              <p>
                {syllabusFile
                  ? syllabusFile.name
                  : isEdit && courseUnit?.syllabus
                    ? 'Replace the currently attached syllabus (optional)'
                    : 'Upload approved syllabus document (PDF / Word)'}
              </p>
              <p className="text-g400" style={{ fontSize: 'var(--fs-xs)' }}>Must conform to NCHE or UVTOP accreditation{!isEdit ? ' — optional, can be added later' : ''}</p>
            </div>
          </div>

          </div>
        </div>
        )}

        {/* ── Step 2: Course Outline — two-panel layout (chapters left, active chapter's topics right) ────────────────────────── */}
        {step === 2 && (() => {
          const activeChapter = chapters[activeChapterIdx]
          return (
            <div className="fsm-layout">

              {/* Left sidebar — one entry per chapter */}
              <div className="fsm-sidebar">
                <div style={{ padding: '14px 14px 6px', fontSize: 10.5, fontWeight: 700, color: 'var(--g400)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                  Chapters <span style={{ color: 'var(--b500)' }}>({chapterCap > 0 ? `${chapters.length}/${chapterCap}` : chapters.length})</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
                  {chapters.map((ch, ci) => (
                    <div
                      key={ci}
                      onClick={() => setActiveChapterIdx(ci)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '9px 10px', borderRadius: 'var(--rsm)', marginBottom: 2,
                        background: activeChapterIdx === ci ? 'var(--b500)' : 'transparent',
                        color: activeChapterIdx === ci ? '#fff' : 'var(--g700)',
                        cursor: 'pointer', transition: 'background .15s',
                      }}
                    >
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: activeChapterIdx === ci ? 'rgba(255,255,255,.2)' : 'var(--b100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <i className="lni lni-bookmark" style={{ fontSize: 13, color: activeChapterIdx === ci ? '#fff' : 'var(--b600)' }}></i>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.title || `Chapter ${ci + 1}`}</div>
                        <div style={{ fontSize: 11, opacity: .65, lineHeight: 1.3 }}>{ch.topics.length} topic{ch.topics.length !== 1 ? 's' : ''}</div>
                      </div>
                      {chapters.length > 1 && (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); removeChapter(ci) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: activeChapterIdx === ci ? 'rgba(255,255,255,.65)' : 'var(--g300)', display: 'flex', alignItems: 'center', borderRadius: 'var(--rxs)', flexShrink: 0 }}
                          title="Remove chapter"
                        ><i className="lni lni-trash-can" style={{ fontSize: 12 }}></i></button>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1.5px solid var(--g200)', padding: '6px 8px 10px' }}>
                  <button type="button" className="btn btn-neu btn-sm" style={{ width: '100%' }} onClick={addChapter} disabled={atChapterCap} title={atChapterCap ? `No. of Chapters is set to ${chapterCap}` : undefined}>
                    <i className="lni lni-plus"></i> Add Chapter
                  </button>
                  {atChapterCap && <div style={{ fontSize: 10.5, color: 'var(--g400)', textAlign: 'center', marginTop: 6 }}>Chapter limit reached ({chapterCap})</div>}
                </div>
              </div>

              {/* Right panel — active chapter's title + topics */}
              <div className="fsm-main">
                {activeChapter && (
                  <>
                    <div className="fg" style={{ marginBottom: 18 }}>
                      <div className="lbl">Chapter Title <span className="req">*</span></div>
                      <input
                        className="ctrl"
                        style={{ fontWeight: 600, ...(chapterErrors[activeChapterIdx] ? { borderColor: 'var(--red)' } : {}) }}
                        value={activeChapter.title}
                        onChange={e => setChapterTitle(activeChapterIdx, e.target.value)}
                        placeholder={`Chapter ${activeChapterIdx + 1} title`}
                      />
                      {chapterErrors[activeChapterIdx] && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{chapterErrors[activeChapterIdx]}</p>}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 150px 130px 30px', gap: 6, padding: '0 0 6px', fontSize: 10.5, fontWeight: 700, color: 'var(--g400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <span></span>
                      <span>Topic</span>
                      <span>Study Sequence</span>
                      <span>Taught By</span>
                      <span></span>
                    </div>

                    <div className="flex flex-col gap-1">
                      {activeChapter.topics.map((t, ti) => {
                        const taughtByMissing = topicTaughtByErrors.has(`${activeChapterIdx}-${ti}`)
                        return (
                        <div key={ti} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 150px 130px 30px', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--g400)', textAlign: 'center' }}>{ti + 1}.</span>
                          <input className="ctrl" value={t.name} onChange={e => setTopic(activeChapterIdx, ti, 'name', e.target.value)} placeholder="e.g. Introduction to Arrays" />
                          {/* Auto-fills to the topic's 1-based position when added, but editable — the user can reorder/renumber without dragging. */}
                          <input
                            className="ctrl"
                            type="number"
                            min={1}
                            style={{ textAlign: 'center' }}
                            value={t.studySequence}
                            onChange={e => setTopic(activeChapterIdx, ti, 'studySequence', e.target.value)}
                          />
                          <SearchSelect
                            placeholder="— Select —"
                            value={t.taughtBy}
                            onChange={v => setTopic(activeChapterIdx, ti, 'taughtBy', v)}
                            options={employeeOptions}
                            style={taughtByMissing ? { boxShadow: '0 0 0 1.5px var(--red)', borderRadius: 'var(--rsm)' } : undefined}
                          />
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                            onClick={() => removeTopic(activeChapterIdx, ti)}
                            disabled={activeChapter.topics.length === 1}
                          >
                            <i className="lni lni-trash-can"></i>
                          </button>
                        </div>
                        )
                      })}
                      {activeChapter.topics.some((_, ti) => topicTaughtByErrors.has(`${activeChapterIdx}-${ti}`)) && (
                        <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 2 }}>Taught By is required for every topic</p>
                      )}
                      <button className="btn btn-neu btn-sm mt-1" style={{ alignSelf: 'flex-start', fontSize: 11 }} onClick={() => addTopic(activeChapterIdx)}>
                        <i className="lni lni-plus"></i> Add Topic
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })()}

        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <span className="flex-1"></span>
          {step === 2 && (
            <button className="btn btn-neu" onClick={() => setStep(1)}>
              <i className="lni lni-arrow-left"></i> Back
            </button>
          )}
          {step === 1 && (
            <button className="btn btn-primary" disabled={isEdit ? updateCourseUnit.isPending : createCourseUnit.isPending} onClick={goToStep2}>
              {(isEdit ? updateCourseUnit.isPending : createCourseUnit.isPending) ? 'Saving…' : <>Save &amp; Continue <i className="lni lni-arrow-right"></i></>}
            </button>
          )}
          {step === 2 && (
            <button className="btn btn-primary" disabled={upsertOutlines.isPending} onClick={handleSubmit}>
              <i className="lni lni-checkmark"></i> {upsertOutlines.isPending ? (isEdit ? 'Updating…' : 'Saving…') : (isEdit ? 'Update Course Unit' : 'Save Course Unit')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
