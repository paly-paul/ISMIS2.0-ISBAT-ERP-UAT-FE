'use client'
import { useEffect, useRef, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import DatePicker from '@/components/DatePicker'
import { MultiSelect } from '@/components/MultiSelect'
import { ProgramMasterInput } from '@/lib/api/academic/programMaster'
import { useProgramLevels } from '@/hooks/academic/useProgramLevels'
import { useProgramGroups } from '@/hooks/academic/useProgramGroups'
import { useFaculties } from '@/hooks/config/useFaculties'
import { useCurrencies } from '@/hooks/finance/useCurrencies'
import { useFinanceCurrencies } from '@/hooks/finance/useFinanceCurrencies'
import { useStreams } from '@/hooks/config/useStreams'
import { useAllCourseUnits, useCourseUnit } from '@/hooks/academic/useCourseUnits'
import { useEmployees } from '@/hooks/employee/useEmployees'
import { useIntakes, useCurrentAcademicIntake } from '@/hooks/academic/useIntakes'
import { useUnitTypes } from '@/hooks/config/useUnitTypes'
import { useUnitCategories } from '@/hooks/config/useUnitCategories'
import { useLedgers } from '@/hooks/finance/useLedgers'
import {
  ProgramUnitUpdateInput, FeeStructureUpdateInput, ProgramMasterUpdateInput,
  ProgramMasterCreateInput, ProgramMasterSemester, useProgramMasterFullDetails, useCreateProgramMasterStep1,
} from '@/hooks/academic/useProgramMaster'
import { useProgramCourseUnits, useAddProgramCourseUnitsBulk, ProgramCourseUnitBulkItem } from '@/hooks/academic/useProgramCourseUnits'
import { useSaveProgramFeeStructureComplete, ProgramFeeStructureSaveCompleteInput } from '@/hooks/academic/useProgramFeeStructure'
import { AuthError } from '@/lib/api/client'

// Toggle between UGX and USD.
const LOCAL_OR_FOREIGN_OPTS = [
  { value: 'false', label: 'UGX' },
  { value: 'true', label: 'USD' },
]

// Map discount types to the API values.
const CALC_TYPES = [
  { value: '1', label: 'Amount' },
  { value: '2', label: 'Percentage' },
]

// SearchSelect works with strings, so store the selected currency id as text.
// currencyGuid is the edit-mode counterpart of currency (intCurrency) — Update
// wants a real currencyGuid on FeeLines where Create wants intCurrency, see
// the note on ProgramMasterUpdateInput in lib/api/academic/programMaster.ts.
// title dropped per Fee_Structure_Change_Requests.md (mirrored from the
// standalone /academic/fee-structure page's FeeStructureModal.tsx) — it was
// never part of FeeStructureInput's feeLines contract. Ledger Priority
// (LedgerNum on the wire) is no longer a manually-typed field on this type —
// confirmed per program_master_frontend_fixes.md that it's the fee line's
// 1-based position within its semester, auto-derived at submit time and
// displayed read-only (see the feeLines mapping in handleFinalSubmit and the
// "Pri." column below) — same "position IS the sequence" convention as
// Course Unit's read-only Study Sequence.
type FeeItem     = { id: number; amount: string; currency: string; currencyGuid: string; ledger: string }
type SemFees     = FeeItem[][]
// streamGuid here is the per-course-unit specialization pick — only meaningful
// (and only editable) when unitCat resolves to a "Specialization" category;
// otherwise Step 1's first specialization pick is what gets sent (see
// streamGuid fallback in handleFinalSubmit).
type CUItem      = { id: number; guid: string; code: string; name: string; credits: number; unitType: string; unitCat: string; streamGuid: string }
type SemUnits    = CUItem[][]
// type SpecRow     = { id: number; value: string } — only used by the commented-out multi-specialization list below
// All fields here map onto FeeStructureInput on submit (see
// handleFinalSubmit): feeCode→feeCode, description→feeDesc,
// localOrForeign→localOrForeign, lateralEntryFee/-Currency→lef/lec,
// creditExemptionFee/-Currency→cef/cec,
// aptechCreditExemptionFee/-Currency→ace/acec,
// discountType/discountAmount→calcType/amtPer, intakeGuid→intakeGuid, and
// semFees (the per-semester Ledger/Ledger Priority/Amount/Currency accordion)
// is the source of FeeStructureInput.feeLines.
type FeeStructure = {
  id: number
  feeCode: string
  description: string
  localOrForeign: string
  // Confirmed per program_master_frontend_fixes.md: Create wants a real
  // IntakeGuid here too now, not an integer IntakeCode — this field now
  // backs the (always read-only) Intake picker in both modes; Create
  // auto-fills it from the Current Academic Intake, Edit carries through
  // whatever the structure already has (see the effects below).
  intakeGuid: string
  discountType: string
  discountAmount: string
  lateralEntryFee: string
  lateralEntryFeeCurrency: string
  creditExemptionFee: string
  creditExemptionFeeCurrency: string
  aptechCreditExemptionFee: string
  aptechCreditExemptionFeeCurrency: string
  semFees: SemFees
}

function blankItem(id: number, defaultCurrencyGuid = '', defaultCurrencyLegacy = ''): FeeItem {
  return { id, amount: '', currency: defaultCurrencyLegacy, currencyGuid: defaultCurrencyGuid, ledger: '' }
}

// Semester count varies per programme rather than being a fixed number, so
// these are factories parameterized by count instead of a fixed-length
// module constant — see resizeSemesters/addSemester/removeSemester below.
// Semester-wise Fee Structure is optional (Program_Master_Change_Requests_Final.md),
// so a fresh structure starts with zero fee items in every semester — no
// pre-filled "Tuition Fee"/"Semester Entry Fee" stubs to either complete or
// clear before Save works.
function makeEmptySemFees(semCount: number): SemFees {
  return Array.from({ length: Math.max(semCount, 1) }, () => [])
}

function blankFeeStructure(id: number, semCount: number): FeeStructure {
  return {
    id,
    feeCode: '',
    description: '',
    localOrForeign: 'false',
    intakeGuid: '',
    discountType: '1',
    discountAmount: '',
    lateralEntryFee: '',
    lateralEntryFeeCurrency: '',
    creditExemptionFee: '',
    creditExemptionFeeCurrency: '',
    aptechCreditExemptionFee: '',
    aptechCreditExemptionFeeCurrency: '',
    semFees: makeEmptySemFees(semCount),
  }
}

function makeDefaultFeeStructures(semCount: number): FeeStructure[] {
  return [blankFeeStructure(1, semCount)]
}

// Keep the old course-unit options only as a reference; the live list now comes from the hook.
// const COURSE_UNIT_OPTS = [
//   { value: 'IT101', label: 'IT101 — Introduction to Programming (3 cr)',    code: 'IT101', name: 'Introduction to Programming',    credits: 3 },
//   { value: 'IT102', label: 'IT102 — Data Structures and Algorithms (3 cr)', code: 'IT102', name: 'Data Structures and Algorithms', credits: 3 },
//   { value: 'IT103', label: 'IT103 — Database Management Systems (3 cr)',    code: 'IT103', name: 'Database Management Systems',    credits: 3 },
//   { value: 'IT104', label: 'IT104 — Computer Networks (3 cr)',              code: 'IT104', name: 'Computer Networks',              credits: 3 },
//   { value: 'IT201', label: 'IT201 — Operating Systems (3 cr)',              code: 'IT201', name: 'Operating Systems',              credits: 3 },
//   { value: 'IT202', label: 'IT202 — Software Engineering (3 cr)',           code: 'IT202', name: 'Software Engineering',           credits: 3 },
//   { value: 'IT203', label: 'IT203 — Web Development (3 cr)',                code: 'IT203', name: 'Web Development',                credits: 3 },
//   { value: 'IT204', label: 'IT204 — Artificial Intelligence (3 cr)',        code: 'IT204', name: 'Artificial Intelligence',        credits: 3 },
//   { value: 'BA101', label: 'BA101 — Business Communication (2 cr)',         code: 'BA101', name: 'Business Communication',         credits: 2 },
//   { value: 'BA102', label: 'BA102 — Entrepreneurship (2 cr)',               code: 'BA102', name: 'Entrepreneurship',               credits: 2 },
//   { value: 'MT101', label: 'MT101 — Mathematics for Computing (3 cr)',      code: 'MT101', name: 'Mathematics for Computing',      credits: 3 },
//   { value: 'MT102', label: 'MT102 — Statistics and Probability (3 cr)',     code: 'MT102', name: 'Statistics and Probability',     credits: 3 },
// ]

let nextId        = 100
let nextCUId      = 200
// let nextSpecId    = 300 — only used by the commented-out multi-specialization list below
let nextFeeStructId = 10

// const SPEC_OPTS = [
//   'Computer Science',
//   'Information Technology',
//   'Software Engineering',
//   'Networking & Security',
//   'Data Science & Analytics',
//   'Business Administration',
//   'Finance & Accounting',
//   'Human Resource Management',
//   'Marketing Management',
//   'Civil Engineering',
//   'Electrical Engineering',
// ]

interface ProgrammeModalProps extends ModalProps {
  mode?: 'edit'
  // Which programme is being edited — only relevant when mode === 'edit'.
  programGuid?: string | null
  // GetFullDetails.bru doesn't return a currency for the programme, but
  // GetByGuid.bru's own docs confirm it returns "the same shape as the
  // list" — and the list's ProgramMaster.currencyGuid, while nullable, is
  // already loaded in page.tsx. Passed in from there rather than issuing a
  // second network call for data already in memory.
  initialCurrencyGuid?: string | null
  // No longer called by this modal — Add mode now saves through its own
  // per-step mutations (useCreateProgramMasterStep1/useAddProgramCourseUnitsBulk/
  // useSaveProgramFeeStructureComplete below) instead of one combined
  // save-complete call. Kept optional rather than removed so page.tsx's
  // existing useCreateProgramMaster() wiring isn't a breaking change to
  // touch as part of this refactor.
  createProgramMaster?: {
    mutate: (input: ProgramMasterInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateProgramMasterComplete?: {
    mutate: (vars: { programGuid: string; input: ProgramMasterUpdateInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function ProgrammeModal({ isOpen, onClose, showToast, mode, programGuid, initialCurrencyGuid, createProgramMaster, updateProgramMasterComplete }: ProgrammeModalProps) {
  const [step, setStep]           = useState(1)
  const [saved, setSaved]         = useState(false)
  const [failure, setFailure]     = useState<string | null>(null)

  // Add-mode-only "save & continue per step" flow (post-program-master.md /
  // post-program-course-units.md / post-fee-hd-save-complete.md) — genuinely
  // different from Edit mode, which still submits everything in one shot via
  // updateProgramMasterComplete at the very end. createdProgramGuid/
  // createdSemesters are set once Step 1's plain create call succeeds;
  // createdSemesters' real semesterGuid per semCode is what Steps 2/3 then
  // submit against instead of the local semCode-based array index. Once set,
  // createdProgramGuid also means "don't re-POST /program-master" — that
  // endpoint only ever creates, so a second call after Step 1 already
  // succeeded would either hit duplicate_program_code or silently create a
  // second, orphaned programme.
  const [createdProgramGuid, setCreatedProgramGuid] = useState<string | null>(null)
  const [createdSemesters, setCreatedSemesters]     = useState<ProgramMasterSemester[]>([])
  // Same "don't re-POST" guard as createdProgramGuid, for Step 2's bulk-add —
  // resubmitting unchanged units would hit duplicate_program_unit.
  const [unitsSubmitted, setUnitsSubmitted] = useState(false)
  const createProgramStep1 = useCreateProgramMasterStep1()
  const addProgramCourseUnits = useAddProgramCourseUnitsBulk()
  const saveFeeStructureComplete = useSaveProgramFeeStructureComplete()
  // Add mode only — Step 1's programme record already exists once this is
  // set, so its own fields lock (see the banner + pointerEvents wrapper in
  // Step 1's JSX below) rather than risking a duplicate/orphaned create.
  const programAlreadyCreated = mode !== 'edit' && !!createdProgramGuid
  // Step 1's real semesters are keyed by semCode (1-based), same as the
  // local semUnits/feeStructures arrays' 0-based index + 1 — so semCode is
  // the join key between "what the user is editing locally" and "what the
  // server actually generated a semesterGuid for".
  //
  // CONFIRMED GAP (2026-08): post-program-master.md's prose says the create
  // response's semesters[] carries a semesterGuid Steps 2/3 need, but a real
  // response only ever has { semCode, semName } — no guid, matching the
  // doc's own (misleading) example rather than its prose. Neither
  // full-details' semesters[] nor program-course-units' GET (which only
  // lists semesters that already have a unit on them — no help for a brand
  // new programme) has one either. Until the backend team confirms where a
  // fresh programme's semesterGuids actually come from, this always
  // resolves to '' — see the guards in handleStep2Continue and Step 3's
  // submit below, which refuse to submit an empty semesterGuid rather than
  // send one and get back a confusing not_found.
  function semesterGuidForIndex(si: number): string {
    return createdSemesters.find(s => s.semCode === si + 1)?.semesterGuid ?? ''
  }
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>(() => makeDefaultFeeStructures(1))
  const [activeFeeIdx, setActiveFeeIdx]   = useState(0)
  const [feeAccordion, setFeeAccordion]   = useState(0)
  // Which fee item is currently being dragged, for Step 3's drag-to-reorder
  // — scoped to a semester index (si) so a drop is only honored within the
  // same semester's list it started in, never across semesters.
  const [draggedItem, setDraggedItem] = useState<{ si: number; idx: number } | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  // Copy Fee Code (program_master_frontend_fixes.md, "Programme Details -
  // Fee Section Bugs" #2) — controlled value for the "Copy Fee Code"
  // SearchSelect below; previously had no value/onChange at all, so picking
  // an option did nothing. Reset whenever the active structure changes so a
  // stale source selection never lingers on a different structure.
  const [copySourceId, setCopySourceId] = useState('')
  // Guards the fullDetails prefill effect below against running more than
  // once per open-session for a given programme. Neither
  // useProgramMasterFullDetails nor useProgramCourseUnits overrides the
  // global QueryClient's defaults (staleTime: 0, refetchOnWindowFocus:
  // true), so a plain alt-tab/refocus while the user is mid-edit on Step
  // 2/3 can trigger a background refetch; if that refetch's result isn't
  // reference-identical to what's cached (react-query's structural sharing
  // only skips the new reference when the data is byte-for-byte the same),
  // the effect re-runs and silently overwrites whatever course units/fee
  // structures the user just added with the server's original (possibly
  // empty) data — so Save then submits nothing for either, even though they
  // looked filled in on screen a moment earlier.
  const prefilledForRef = useRef<string | null>(null)
  // Semester count isn't fixed — it varies per programme. Starts at 1 and
  // grows to match the picked Programme Level's semCount (Add mode) or the
  // real semesters returned by program-course-units (Edit mode); the user
  // can also Add/Remove Semester by hand in either mode (see addSemester/
  // removeSemester below). semLabels is the display name per slot — generic
  // "Semester N" until Edit mode's real semName data replaces it.
  const [semUnits, setSemUnits]     = useState<SemUnits>(() => [[]])
  const [pendingSel, setPendingSel] = useState<string[]>(() => [''])
  const [semLabels, setSemLabels]   = useState<string[]>(() => ['Semester 1'])
  const [activeAcc, setActiveAcc]   = useState<number>(0)
  // Which course unit's Syllabus/Outline/Taught By detail panel is expanded
  // in Step 2 — per Program_Master_Change_Requests_Final.md's "Additional
  // Feature". Cleared on semester switch since the id is scoped to whatever
  // semester's unit list it came from.
  const [expandedUnitId, setExpandedUnitId] = useState<number | null>(null)
  // The create payload only accepts one stream selection, so the old multi-select list is no longer used.
  // const [specs, setSpecs]           = useState<SpecRow[]>([])

  // These are the fields accepted by the programme create API.
  const [programCode, setProgramCode] = useState('')
  const [programName, setProgramName] = useState('')
  const [programGroupGuid, setProgramGroupGuid] = useState('')
  const [programLevelGuid, setProgramLevelGuid] = useState('')
  const [facultyGuid, setFacultyGuid] = useState('')
  const [appFee, setAppFee] = useState('')
  const [lateFee, setLateFee] = useState('')
  // Confirmed per program_master_frontend_fixes.md: Create wants a real
  // currencyGuid too now, not Currency.intCurrency — so this one state now
  // backs the Currency picker in both modes (previously Create used a
  // separate currencyCode/currencyIntOptions pair). In Edit mode it's
  // prefilled from initialCurrencyGuid (the list row's own currencyGuid)
  // below, not from full-details, which doesn't return one — but that list
  // field has been observed null in every real sample seen so far, so this
  // may still come up empty and need picking.
  const [currencyGuid, setCurrencyGuid] = useState('')

  // Programme Level's "auto-fills year/sem/credits" explanation used to sit
  // as plain parenthetical text right in the field label — moved into a
  // click-to-open info popover (matching the ⓘ icon convention Step 2's
  // Syllabus/Outline/Taught By button already uses) so the label itself
  // reads cleanly and the explanation only shows up when actually asked for.
  const [levelInfoOpen, setLevelInfoOpen] = useState(false)
  const levelInfoRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!levelInfoOpen) return
    function onDoc(e: MouseEvent) {
      if (!levelInfoRef.current?.contains(e.target as Node)) setLevelInfoOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [levelInfoOpen])

  useEffect(() => {
    if (isOpen && mode === 'edit') setCurrencyGuid(initialCurrencyGuid ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, initialCurrencyGuid])
  const [unitCount, setUnitCount] = useState('')
  const [dateAcc, setDateAcc] = useState('')
  // Multiple specializations can be offered by a programme (GetFullDetails
  // confirms this — it returns streamGuids as an array), but Create/Update's
  // top-level payload only accepts a single streamGuid (confirmed via the
  // .bru spec — see the ProgramMasterInput/ProgramMasterUpdateInput comments
  // in lib/api/academic/programMaster.ts). The per-course-unit streamGuid on
  // ProgramUnitInput/ProgramUnitUpdateInput has no such limit, though — each
  // unit's own Specialization picker in Step 2 (only enabled when that unit's
  // Unit Category is "Specialization") is what actually sends it — so the
  // multi-select here mainly exists to populate that picker's options; the
  // single top-level field just takes the first pick.
  const [streamGuids, setStreamGuids] = useState<string[]>([])
  const [intakeGuid, setIntakeGuid] = useState('')
  const [pgmStatus, setPgmStatus] = useState(true)
  const [noIa, setNoIa] = useState(false)
  const [accLetterFile, setAccLetterFile] = useState<File | null>(null)
  const [step1Errors, setStep1Errors] = useState<Record<string, string>>({})
  // Only relevant when Step 1's No. of Course Units was actually filled in —
  // see validateStep2 / Program_Master_Change_Requests_Final.md.
  const [step2Error, setStep2Error] = useState<string | null>(null)

  const { data: programLevels = [] } = useProgramLevels()
  const programLevelOptions = programLevels.map(p => ({ value: p.programLevelGuid, label: p.levelName }))
  const selectedProgramLevel = programLevels.find(p => p.programLevelGuid === programLevelGuid)

  const { data: programGroups = [] } = useProgramGroups()
  const programGroupOptions = programGroups.map(g => ({ value: g.programGroupGuid, label: `${g.groupCode} — ${g.groupName}` }))

  const { data: faculties = [] } = useFaculties()
  const facultyOptions = faculties.map(f => ({ value: f.facultyGuid, label: `${f.facultyCode} — ${f.facultyName}` }))
  const selectedFaculty = faculties.find(f => f.facultyGuid === facultyGuid)

  const { data: currencies = [] } = useCurrencies()
  // Lec/Cec/Acec (Lateral Entry/Credit Exemption/Aptech Credit Exemption Fee
  // Currency) still take Currency.intCurrency (a number) — those are NOT
  // confirmed to have switched to guids the way the top-level programme
  // Currency and FeeLines[].CurrencyGuid did (see the FeeStructureUpdateInput
  // comment in lib/api/academic/programMaster.ts), so this is only used for
  // those three fields now, not the top-level Step 1 Currency picker below.
  const currencyIntOptions = currencies.map(c => ({ value: String(c.intCurrency), label: `${c.currencyCode} — ${c.currencyName}` }))

  // Update wants a real currencyGuid, confirmed via the "three currency guid
  // spaces" gotcha elsewhere in this app — useFinanceCurrencies() carries the
  // real one, unlike useCurrencies() (Currency Master) above. Create was
  // confirmed to want the same real currencyGuid too (see the
  // ProgramMasterInput.currencyGuid note), so this now backs the top-level
  // Currency picker in both modes.
  const { data: financeCurrencies = [] } = useFinanceCurrencies()
  const financeCurrencyOptions = financeCurrencies.map(c => ({ value: c.currencyGuid, label: `${c.currencyCode} — ${c.currencyName}` }))

  const { data: streams = [] } = useStreams()
  const streamOptions = streams.map(s => ({ value: s.streamGuid, label: `${s.streamCode} — ${s.streamName}` }))
  // Step 2's per-semester picker only offers what was picked in Step 1.
  const semesterStreamOptions = streamOptions.filter(o => streamGuids.includes(o.value))

  const { data: courseUnits = [] } = useAllCourseUnits()
  const courseUnitOptions = courseUnits.map(u => ({
    value: u.courseUnitGuid,
    // "cr" read ambiguously as "crore" (Indian numbering, 10 million) rather
    // than "credit" — spelled out and pluralized, same convention as the
    // semester sidebar's own credit total below.
    label: `${u.courseUnitCode} — ${u.courseUnitName} (${u.maxCredits} credit${u.maxCredits !== 1 ? 's' : ''})`,
    code: u.courseUnitCode,
    name: u.courseUnitName,
    credits: u.maxCredits,
  }))

  // Syllabus/Outline/Taught By detail panel (Step 2's "Additional Feature")
  // — fetches the full CourseUnit (syllabus + outlines[], each topic
  // carrying an employeeGuid) only for whichever unit is expanded, via the
  // same GetByGuid endpoint course-units' own Edit modal uses.
  const expandedUnit = (semUnits[activeAcc] ?? []).find(u => u.id === expandedUnitId)
  const { data: expandedUnitDetail, isLoading: expandedUnitLoading } = useCourseUnit(expandedUnit?.guid ?? null, !!expandedUnit)
  const { data: employees = [] } = useEmployees()
  function employeeName(employeeGuid: string) {
    return employees.find(e => e.employeeGuid === employeeGuid)?.empName ?? `Employee #${employeeGuid}`
  }

  // Unit Type / Unit Category dropdowns in Course Unit Allocation — real
  // masters from src/app/config/unit-type & unit-category. ProgramUnitInput.
  // unitType/unitCat send the guid directly (unitTypeGuid/unitCatGuid), the
  // same guid-based convention used elsewhere in this backend (e.g.
  // programLevelGuid, courseUnitRepetitionGuid).
  const { data: unitTypes = [] } = useUnitTypes()
  const unitTypeOptions = unitTypes.map(t => ({ value: t.unitTypeGuid, label: t.unitTypeName }))

  const { data: unitCategories = [] } = useUnitCategories()
  const unitCategoryOptions = unitCategories.map(c => ({ value: c.unitCatGuid, label: c.unitCatName }))
  // The per-unit specialization picker only makes sense for a unit whose
  // category is literally named "Specialization" in the real master — there's
  // no dedicated flag for this on UnitCategory, so it's a name match.
  function isSpecializationCategory(unitCatGuid: string) {
    const cat = unitCategories.find(c => c.unitCatGuid === unitCatGuid)
    return !!cat && cat.unitCatName.trim().toLowerCase() === 'specialization'
  }

  const { data: ledgers = [] } = useLedgers()
  const ledgerOptions = ledgers.map(l => ({ value: l.ledgerGuid, label: l.ledgerName }))

  const { data: intakes = [] } = useIntakes()
  // Per-fee-structure Intake — a real intakeGuid in both modes now (see the
  // FeeStructure type comment on intakeGuid); the top-level programme Intake
  // (intakeGuid on ProgramMasterInput, Step 1) is a separate field entirely.
  const programIntakeOptions = intakes.map(i => ({ value: i.intakeGuid, label: `${i.intakeCode} — ${i.description}` }))
  // Per Fee_Structure_Change_Requests.md #3/#4 (mirrored from the standalone
  // /academic/fee-structure page) — Step 3's per-structure Intake is now
  // always read-only: in Edit mode it shows whatever intake the structure
  // already has, in Create mode it's forced onto the Current Academic
  // Intake instead of offering a picker at all.
  const { data: currentAcademicIntake } = useCurrentAcademicIntake()

  // Full course-unit/fee-structure breakdown for the programme being edited —
  // update-complete fully replaces both collections, so this is required to
  // prefill Steps 2/3 before saving, not just a nicety. See the note on
  // ProgramMasterFullDetails in lib/api/academic/programMaster.ts.
  const { data: fullDetails } = useProgramMasterFullDetails(programGuid ?? null, isOpen && mode === 'edit' && !!programGuid)

  // Real per-semester course-unit rows from program-course-units — kept only
  // as a fallback now (see the fullDetails effect below): fullDetails.semesters
  // is the primary, more complete source since it covers every semester the
  // programme has, including ones with zero units assigned yet, which this
  // endpoint silently omits (confirmed via a real programme: semCount=6 but
  // program-course-units only returned rows for 1 of them).
  const { data: programCourseUnitRows = [] } = useProgramCourseUnits(programGuid ?? null, isOpen && mode === 'edit' && !!programGuid)

  useEffect(() => {
    // isOpen has to gate this (not just be an input to it) — react-query
    // keeps the same `fullDetails`/`programCourseUnitRows` object references
    // across a close+reopen of the SAME programme when the cached data is
    // still around (structural sharing means even a background refetch
    // returning identical data won't produce a new reference). Without
    // isOpen in the guard+deps, that meant this effect simply never re-ran
    // on a second open — but handleClose() unconditionally wipes every
    // field back to blank on close, so the form was left permanently empty
    // until the query happened to return a genuinely different object
    // (e.g. editing a different programme first). This is the "sometimes
    // fields aren't populated after closing and reopening Edit" bug.
    if (!isOpen || mode !== 'edit' || !fullDetails) return
    // Prefill exactly once per (open session, programme) — a later
    // reference change on fullDetails/programCourseUnitRows (a background
    // refetch on window focus, since neither query overrides the default
    // staleTime/refetchOnWindowFocus) must NOT re-run this and stomp on
    // Step 2/3 edits the user has made since the initial prefill. See the
    // prefilledForRef comment above.
    if (prefilledForRef.current === programGuid) return
    prefilledForRef.current = programGuid ?? null

    setProgramCode(fullDetails.programCode)
    setProgramName(fullDetails.programName)
    setProgramGroupGuid(fullDetails.programGroupGuid)
    setProgramLevelGuid(fullDetails.programLevelGuid)
    setFacultyGuid(fullDetails.facultyGuid)
    setAppFee(String(fullDetails.appFee))
    setLateFee(String(fullDetails.lateFee))
    setUnitCount(String(fullDetails.unitCount))
    setDateAcc(fullDetails.dateAcc ? fullDetails.dateAcc.slice(0, 10) : '')
    // full-details returns streamGuids (plural) — Create/Update's top-level
    // field only accepts one (see the streamGuids state comment above), but
    // that's just the top-level field's limit, not this multi-select's.
    setStreamGuids(fullDetails.streamGuids ?? [])
    setIntakeGuid(fullDetails.intakeGuid ?? '')
    setPgmStatus(fullDetails.pgmStatus)
    setNoIa(fullDetails.noIa)

    // Semester list for this programme, three-tier fallback, best source first:
    //
    // 1. fullDetails.semesters — confirmed real, covers every semester the
    //    programme has (semCount total) including empty ones. Primary source.
    // 2. program-course-units' real semesterGuid/semName grouping — only
    //    used if #1 comes back empty; still an incomplete picture since it
    //    only lists semesters that already have a course unit on them.
    // 3. Highest semCode seen on programUnits, generic "Semester N" labels —
    //    last resort if both real sources are empty.
    const realSemesters = [...fullDetails.semesters].sort((a, b) => a.semCode - b.semCode)

    let semCount: number
    let labels: string[]
    let units: SemUnits

    if (realSemesters.length > 0) {
      semCount = realSemesters.length
      labels = realSemesters.map(s => s.semName)
      units = Array.from({ length: semCount }, () => [])
      // programUnits' own semCode already lines up 1:1 with these semesters
      // (both are position-based against the same programme), so no need to
      // merge against program-course-units at all here.
      fullDetails.programUnits.forEach(u => {
        const si = u.semCode - 1
        if (si < 0 || si >= semCount) return
        const cu = courseUnits.find(c => c.courseUnitGuid === u.courseUnitGuid)
        units[si].push({
          id: nextCUId++,
          guid: u.courseUnitGuid,
          code: u.courseUnitCode,
          name: u.courseUnitName,
          credits: cu?.maxCredits ?? 0,
          unitType: u.unitTypeGuid ?? '',
          unitCat: u.unitCatGuid ?? '',
          // Only carry a specialization through for a unit whose category is
          // actually "Specialization" — the backend can still return a stale
          // streamGuid on a Core/Elective row (e.g. left over from before the
          // category was last changed), and showing that in a field the user
          // never picked it from (even disabled) is misleading. A unit that
          // isn't a Specialization unit always opens with this field blank.
          streamGuid: isSpecializationCategory(u.unitCatGuid ?? '') ? (u.streamGuid ?? '') : '',
        })
      })
    } else {
      const fallbackSemesters: { semesterGuid: string; semName: string }[] = []
      programCourseUnitRows.forEach(r => {
        if (!fallbackSemesters.some(s => s.semesterGuid === r.semesterGuid)) fallbackSemesters.push({ semesterGuid: r.semesterGuid, semName: r.semName })
      })

      if (fallbackSemesters.length > 0) {
        semCount = fallbackSemesters.length
        labels = fallbackSemesters.map(s => s.semName)
        units = Array.from({ length: semCount }, () => [])
        // program-course-units doesn't carry unitType/unitCat/streamGuid —
        // pull those in from fullDetails.programUnits by courseUnitGuid.
        programCourseUnitRows.forEach(r => {
          const si = fallbackSemesters.findIndex(s => s.semesterGuid === r.semesterGuid)
          if (si < 0) return
          const cu = courseUnits.find(c => c.courseUnitGuid === r.courseUnitGuid)
          const detail = fullDetails.programUnits.find(u => u.courseUnitGuid === r.courseUnitGuid)
          units[si].push({
            id: nextCUId++,
            guid: r.courseUnitGuid,
            code: r.courseUnitCode,
            name: r.courseUnitName,
            credits: cu?.maxCredits ?? 0,
            unitType: detail?.unitTypeGuid ?? '',
            unitCat: detail?.unitCatGuid ?? '',
            // Same "only for a real Specialization category" guard as the primary path above.
            streamGuid: isSpecializationCategory(detail?.unitCatGuid ?? '') ? (detail?.streamGuid ?? '') : '',
          })
        })
      } else {
        const fallbackSemCount = fullDetails.programUnits.reduce((max, u) => Math.max(max, u.semCode), 0)
        semCount = Math.max(fallbackSemCount, 1)
        labels = Array.from({ length: semCount }, (_, i) => `Semester ${i + 1}`)
        units = Array.from({ length: semCount }, () => [])
        fullDetails.programUnits.forEach(u => {
          const si = u.semCode - 1
          if (si < 0 || si >= semCount) return
          const cu = courseUnits.find(c => c.courseUnitGuid === u.courseUnitGuid)
          units[si].push({
            id: nextCUId++,
            guid: u.courseUnitGuid,
            code: u.courseUnitCode,
            name: u.courseUnitName,
            credits: cu?.maxCredits ?? 0,
            unitType: u.unitTypeGuid ?? '',
            unitCat: u.unitCatGuid ?? '',
            // Same "only for a real Specialization category" guard as the primary path above.
            streamGuid: isSpecializationCategory(u.unitCatGuid ?? '') ? (u.streamGuid ?? '') : '',
          })
        })
      }
    }
    setSemUnits(units)
    setSemLabels(labels)
    setPendingSel(Array(semCount).fill(''))

    const structures: FeeStructure[] = fullDetails.feeStructures.length > 0
      ? fullDetails.feeStructures.map(s => {
          const semFees: SemFees = Array.from({ length: semCount }, () => [])
          s.feeLines.forEach(l => {
            const si = l.semCode - 1
            if (si < 0 || si >= semCount) return
            semFees[si].push({
              id: nextId++,
              amount: String(l.amount),
              currency: '',
              currencyGuid: l.currencyGuid,
              ledger: l.ledgerGuid,
            })
          })
          return {
            id: nextFeeStructId++,
            feeCode: s.feeCode,
            description: s.feeDesc,
            localOrForeign: String(s.localOrForeign),
            intakeGuid: s.intakeGuid ?? '',
            discountType: String(s.calcType),
            discountAmount: s.amtPer != null ? String(s.amtPer) : '',
            lateralEntryFee: s.lef != null ? String(s.lef) : '',
            lateralEntryFeeCurrency: s.lec != null ? String(s.lec) : '',
            creditExemptionFee: s.cef != null ? String(s.cef) : '',
            creditExemptionFeeCurrency: s.cec != null ? String(s.cec) : '',
            aptechCreditExemptionFee: s.ace != null ? String(s.ace) : '',
            aptechCreditExemptionFeeCurrency: s.acec != null ? String(s.acec) : '',
            semFees,
          }
        })
      : makeDefaultFeeStructures(semCount)
    setFeeStructures(structures)
    setActiveFeeIdx(0)
    setActiveAcc(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fullDetails, programCourseUnitRows, mode])

  // Create mode has no per-structure Intake picker any more (#4) — every
  // fee structure is forced onto whatever intake is currently flagged
  // current. Applies to every structure, not just the active one. Stores
  // the real intakeGuid now (see the FeeStructure.intakeGuid comment) —
  // used to send FeeStructures[n].IntakeGuid instead of the old integer
  // IntakeCode per program_master_frontend_fixes.md.
  useEffect(() => {
    if (isOpen && mode !== 'edit' && currentAcademicIntake) {
      const guid = currentAcademicIntake.intakeGuid
      setFeeStructures(prev => prev.map(s => s.intakeGuid === guid ? s : { ...s, intakeGuid: guid }))
    }
  }, [isOpen, mode, currentAcademicIntake])

  // Step 1's own top-level Intake dropdown was removed entirely per
  // Program_Master_Change_Requests_Final.md — in Create mode intakeGuid is
  // silently auto-filled from the Current Academic Intake instead of being
  // picked; Edit mode already carries it through from fullDetails.intakeGuid
  // (see the effect above), so it needs no equivalent auto-fill here.
  useEffect(() => {
    if (isOpen && mode !== 'edit' && currentAcademicIntake) {
      setIntakeGuid(currentAcademicIntake.intakeGuid)
    }
  }, [isOpen, mode, currentAcademicIntake])

  function selectProgramGroup(guid: string) {
    setProgramGroupGuid(guid)
    if (step1Errors.programGroupGuid) setStep1Errors(p => ({ ...p, programGroupGuid: '' }))
    // Every ProgramGroup carries its own programLevelGuid (a group belongs to
    // exactly one level) — auto-fill Level from the picked group instead of
    // making the user look up and re-pick the same level a second time.
    // Routed through selectProgramLevel so App/Late Fee and the Step 2/3
    // semester-count resize all follow the same auto-fill this level would
    // get from being picked directly. Guarded on the level actually being in
    // the loaded programLevels list — otherwise programLevelGuid would point
    // at a level programLevelOptions has no entry for, and the dropdown
    // would silently show its placeholder instead of the real selection.
    const group = programGroups.find(g => g.programGroupGuid === guid)
    if (group?.programLevelGuid && programLevels.some(l => l.programLevelGuid === group.programLevelGuid)) {
      selectProgramLevel(group.programLevelGuid)
    }
  }

  function selectProgramLevel(guid: string) {
    setProgramLevelGuid(guid)
    if (step1Errors.programLevelGuid) setStep1Errors(p => ({ ...p, programLevelGuid: '' }))
    const level = programLevels.find(p => p.programLevelGuid === guid)
    if (level) {
      setAppFee(String(level.appFee))
      setLateFee(String(level.lateFee))
      // Level.currencyGuid itself is unconfirmed on GET (see the comment on
      // ProgramLevel.currencyGuid in programLevel.ts) — resolve the level's
      // own currencyCode against useFinanceCurrencies() instead, same
      // code→real-guid matching selectFeeItemCurrency() already uses below.
      // Only auto-fills when a match is found, so an unmatched/blank level
      // currency leaves whatever Currency the user already picked alone.
      const fc = financeCurrencies.find(c => c.currencyCode === level.currencyCode)
      if (fc) setCurrencyGuid(fc.currencyGuid)
      // Size Step 2/3 to the level's own semester count for a new programme
      // (Edit mode instead sizes off the real program-course-units data —
      // see the fullDetails effect above). resizeSemesters keeps whatever's
      // already in each surviving slot, so this never discards Step 2 work
      // already done under a previously-picked level — it only grows/shrinks.
      if (mode !== 'edit' && level.semCount > 0) resizeSemesters(level.semCount)
    }
  }

  function validateStep1() {
    const e: Record<string, string> = {}
    if (!programCode.trim()) e.programCode = 'Programme Code is required'
    if (!programName.trim()) e.programName = 'Programme Name is required'
    if (!programGroupGuid) e.programGroupGuid = 'Please select a Programme Group'
    if (!programLevelGuid) e.programLevelGuid = 'Please select a Programme Level'
    if (!facultyGuid) e.facultyGuid = 'Please select a Faculty'
    if (!appFee) e.appFee = 'Application Fee is required'
    if (!lateFee) e.lateFee = 'Late Fee is required'
    if (!currencyGuid) e.currencyCode = 'Please select a Currency'
    // No. of Course Units, Accreditation Date, and Specialization are all
    // optional per Program_Master_Change_Requests_Final.md — unitCount is
    // still validated against Step 2's actual course-unit count (but only
    // when the user did fill it in — see the Step 2 validation below).
    // Intake no longer has a dropdown to validate at all — it's auto-filled
    // from the Current Academic Intake (see the effect below).
    setStep1Errors(e)
    return Object.keys(e).length === 0
  }

  // No. of Course Units (Step 1) is optional — when left blank, Course Unit
  // Allocation has nothing to enforce. When filled in, the actual number of
  // units added across every semester must match it exactly, neither more
  // nor fewer, per Program_Master_Change_Requests_Final.md.
  // TEMPORARILY DISABLED for testing the rest of the flow — re-enable by
  // restoring the commented-out body below (kept here rather than deleted).
  function validateStep2() {
    setStep2Error(null)
    return true
    // if (!unitCount.trim()) { setStep2Error(null); return true }
    // const target = +unitCount || 0
    // const total = semUnits.reduce((sum, units) => sum + units.length, 0)
    // if (total !== target) {
    //   setStep2Error(
    //     total < target
    //       ? `${total} of ${target} course units added — add ${target - total} more to match No. of Course Units from Programme Details.`
    //       : `${total} of ${target} course units added — remove ${total - target} to match No. of Course Units from Programme Details.`
    //   )
    //   return false
    // }
    // setStep2Error(null)
    // return true
  }

  // Step 1's Save & Continue in Add mode — see post-program-master.md.
  // Edit mode never calls this; its Save & Continue stays pure local
  // validation (see the footer button below).
  async function handleStep1Continue() {
    if (!validateStep1()) return
    // Already created this session — never re-POST (see the
    // createdProgramGuid comment above). Fields are locked in the UI too,
    // so this only fires if the user clicks Continue again without having
    // been able to change anything.
    if (createdProgramGuid) { setStep(2); return }

    const input: ProgramMasterCreateInput = {
      programCode, programName, programLevelGuid, pgmStatus, noIa, programGroupGuid,
      unitCount: +unitCount || 0, appFee: +appFee || 0, lateFee: +lateFee || 0,
      facultyGuid, currencyGuid, dateAcc: dateAcc ? `${dateAcc}T00:00:00` : null,
      streamGuid: streamGuids[0] || '', intakeGuid, accLetterFile,
    }
    try {
      const created = await createProgramStep1.mutateAsync(input)
      setCreatedProgramGuid(created.programGuid)
      setCreatedSemesters(created.semesters)
      showToast('Programme details saved')
      setStep(2)
    } catch (err) {
      const code = err instanceof AuthError ? err.code : undefined
      setFailure(err instanceof Error ? (err.message || `Failed to save programme details${code ? ` (${code})` : ''}. Please try again.`) : 'Failed to save programme details. Please try again.')
    }
  }

  // Step 2's Save & Continue in Add mode — see post-program-course-units.md.
  // Skips the API call entirely when no units were added (same "nothing to
  // submit" precedent as Step 3's blank fee structures), and never re-POSTs
  // once this session's units already saved (see unitsSubmitted above).
  async function handleStep2Continue() {
    if (!validateStep2()) return
    if (unitsSubmitted) { setStep(3); return }
    if (!createdProgramGuid) { setFailure('Programme details have not been saved yet — go back to Step 1.'); return }

    const units: ProgramCourseUnitBulkItem[] = semUnits.flatMap((us, si) =>
      us.map(u => ({
        semesterGuid: semesterGuidForIndex(si),
        courseUnitGuid: u.guid,
        streamGuid: u.streamGuid || streamGuids[0] || null,
        unitTypeGuid: u.unitType || null,
        unitCatGuid: u.unitCat || null,
        flag: 1,
      }))
    )

    if (units.length === 0) { setUnitsSubmitted(true); setStep(3); return }

    // See the CONFIRMED GAP note on semesterGuidForIndex above — refuse to
    // submit rather than send a unit with semesterGuid: '' and get back a
    // not_found that doesn't explain why.
    if (units.some(u => !u.semesterGuid)) {
      setFailure('Course units can\'t be saved yet — the server hasn\'t provided a semester ID for this programme. This is a known backend gap, not something fixable from this form.')
      return
    }

    try {
      await addProgramCourseUnits.mutateAsync({ programGuid: createdProgramGuid, programName, units })
      setUnitsSubmitted(true)
      showToast('Course units saved')
      setStep(3)
    } catch (err) {
      const code = err instanceof AuthError ? err.code : undefined
      setFailure(err instanceof Error ? (err.message || `Failed to save course units${code ? ` (${code})` : ''}. Please try again.`) : 'Failed to save course units. Please try again.')
    }
  }

  if (!isOpen) return null

  const activeFeeStruct = feeStructures[activeFeeIdx]

  // Semester-wise Fee Structure is optional — a structure nobody has touched
  // (no code, no description, no fee items in any semester) shouldn't block
  // Save, and shouldn't be sent at all (see the filter in handleFinalSubmit
  // below). Only a structure the user actually started filling in has to be
  // completed properly.
  function feeStructureIsBlank(s: FeeStructure) {
    return !s.feeCode.trim() && !s.description.trim() && s.semFees.every(items => items.length === 0)
  }
  function feeStructComplete(s: FeeStructure) {
    if (feeStructureIsBlank(s)) return true
    return !!(s.feeCode.trim() && s.description.trim())
  }
  // Every fee item needs a currency and ledger selected; otherwise the payload sends 0/empty and the backend rejects it.
  // Both modes require a real currencyGuid now (see FeeLineInput.currencyGuid note).
  function feeStructHasCurrencyGaps(s: FeeStructure) {
    if (feeStructureIsBlank(s)) return false
    return s.semFees.some(items => items.some(item => !item.currencyGuid))
  }
  function feeStructHasLedgerGaps(s: FeeStructure) {
    if (feeStructureIsBlank(s)) return false
    return s.semFees.some(items => items.some(item => !item.ledger))
  }
  const activeFeeComplete = feeStructComplete(activeFeeStruct)
  const anyCurrencyGaps   = feeStructures.some(feeStructHasCurrencyGaps)
  const anyLedgerGaps     = feeStructures.some(feeStructHasLedgerGaps)
  const allFeeComplete    = feeStructures.every(feeStructComplete) && !anyCurrencyGaps && !anyLedgerGaps
  const isSaving = mode === 'edit'
    ? !!updateProgramMasterComplete?.isPending
    : createProgramStep1.isPending || addProgramCourseUnits.isPending || saveFeeStructureComplete.isPending

  function handleClose() {
    prefilledForRef.current = null
    setStep(1); setSaved(false); setFailure(null)
    setFeeStructures(makeDefaultFeeStructures(1))
    setActiveFeeIdx(0); setFeeAccordion(0); setActiveAcc(0); setCopySourceId('')
    setSemUnits([[]])
    setPendingSel([''])
    setSemLabels(['Semester 1'])
    setProgramCode(''); setProgramName(''); setProgramGroupGuid(''); setProgramLevelGuid('')
    setFacultyGuid(''); setAppFee(''); setLateFee(''); setCurrencyGuid(''); setUnitCount('')
    setDateAcc(''); setStreamGuids([])
    setIntakeGuid(''); setPgmStatus(true); setNoIa(false); setAccLetterFile(null); setStep1Errors({})
    setCreatedProgramGuid(null); setCreatedSemesters([]); setUnitsSubmitted(false)
    onClose()
  }

  function handleFinalSubmit() {
    if (mode === 'edit') {
      if (!programGuid || !updateProgramMasterComplete) return
      if (!validateStep1()) { setStep(1); return }
      if (!validateStep2()) { setStep(2); return }

      const programUnits: ProgramUnitUpdateInput[] = semUnits.flatMap((units, si) =>
        units.map(u => ({
          semCode: si + 1,
          courseUnitGuid: u.guid,
          // Prefer this unit's own specialization pick (only settable when
          // its Unit Category is "Specialization"), falling back to the
          // first Step 1 pick otherwise.
          streamGuid: u.streamGuid || streamGuids[0] || '',
          unitTypeGuid: u.unitType,
          unitCatGuid: u.unitCat,
          // Confirmed via UpdateComplete.bru's real example payload — was
          // hardcoded 0 with no documented rationale before (an unconfirmed
          // guess); the spec's own sample sends 1. Plausible root cause for
          // programUnits coming back empty on GetFullDetails after a save if
          // the backend uses this to decide whether to actually persist/
          // include the row.
          flag: 1,
        }))
      )

      // Fee Structure is optional — an untouched structure is never sent,
      // not even as an empty shell (see feeStructureIsBlank above).
      const feeStructuresPayload: FeeStructureUpdateInput[] = feeStructures.filter(s => !feeStructureIsBlank(s)).map(s => ({
        feeCode: s.feeCode,
        feeDesc: s.description,
        status: true,
        localOrForeign: s.localOrForeign === 'true',
        lef: s.lateralEntryFee ? +s.lateralEntryFee : null,
        cef: s.creditExemptionFee ? +s.creditExemptionFee : null,
        ace: s.aptechCreditExemptionFee ? +s.aptechCreditExemptionFee : null,
        lec: s.lateralEntryFeeCurrency ? +s.lateralEntryFeeCurrency : null,
        cec: s.creditExemptionFeeCurrency ? +s.creditExemptionFeeCurrency : null,
        acec: s.aptechCreditExemptionFeeCurrency ? +s.aptechCreditExemptionFeeCurrency : null,
        calcType: +s.discountType || 1,
        amtPer: s.discountAmount ? +s.discountAmount : null,
        intakeGuid: s.intakeGuid || null,
        // LedgerNum is the fee line's own priority/sequence within this
        // structure — confirmed per program_master_frontend_fixes.md that
        // this was always coming out 0 because it was being read off the
        // Ledger master's own ledgerNum field instead (a per-ledger id,
        // unrelated to this fee structure's ordering). Auto-generated here
        // from each item's 1-based position, same "position IS the
        // sequence" convention as Course Unit's Study Sequence — the
        // existing Pri. up/down reorder controls double as how a user
        // changes it.
        feeLines: s.semFees.flatMap((items, si) =>
          items.map((item, idx) => ({
            semCode: si + 1,
            ledgerGuid: item.ledger,
            currencyGuid: item.currencyGuid,
            ledgerNum: idx + 1,
            amount: +item.amount || 0,
          }))
        ),
      }))

      const updateInput: ProgramMasterUpdateInput = {
        programCode, programName, programLevelGuid, pgmStatus, noIa, programGroupGuid,
        unitCount: +unitCount || 0, appFee: +appFee || 0, lateFee: +lateFee || 0,
        facultyGuid, currencyGuid, dateAcc: dateAcc ? `${dateAcc}T00:00:00` : null,
        // Top-level field only accepts one specialization — see the
        // streamGuids state comment above.
        streamGuid: streamGuids[0] || '',
        intakeGuid,
        programUnits, feeStructures: feeStructuresPayload, accLetterFile,
      }

      updateProgramMasterComplete.mutate(
        { programGuid, input: updateInput },
        {
          onSuccess: () => { setSaved(true); showToast('Programme updated successfully') },
          onError: (error: Error) => {
            const code = error instanceof AuthError ? error.code : undefined
            setFailure(error.message || `Failed to update programme${code ? ` (${code})` : ''}. Please try again.`)
          },
        },
      )
      return
    }

    // Step 3 of the Add-mode wizard — see post-fee-hd-save-complete.md.
    // Steps 1/2 (programme + course units) are already saved by this point
    // (handleStep1Continue/handleStep2Continue below), so all that's left
    // here is the fee structure(s). Async now (was createProgramMaster.mutate
    // with callbacks) since it may need to POST more than one structure —
    // the endpoint only ever creates ONE header per call, unlike the old
    // combined save-complete payload's FeeStructures[] array, so a
    // programme with multiple fee structures needs one call per structure.
    if (!validateStep1()) { setStep(1); return }
    if (!validateStep2()) { setStep(2); return }
    if (!createdProgramGuid) { setFailure('Programme details have not been saved yet — go back to Step 1.'); return }

    // Fee Structure is optional — an untouched structure is never sent, not
    // even as an empty shell (see feeStructureIsBlank above).
    const feeStructuresPayload: ProgramFeeStructureSaveCompleteInput[] = feeStructures.filter(s => !feeStructureIsBlank(s)).map(s => ({
      programGuid: createdProgramGuid,
      feeCode: s.feeCode,
      feeDesc: s.description,
      // No UI toggle for this yet — every structure created here defaults
      // to active.
      status: true,
      localOrForeign: s.localOrForeign === 'true',
      lef: s.lateralEntryFee ? +s.lateralEntryFee : null,
      cef: s.creditExemptionFee ? +s.creditExemptionFee : null,
      ace: s.aptechCreditExemptionFee ? +s.aptechCreditExemptionFee : null,
      lec: s.lateralEntryFeeCurrency ? +s.lateralEntryFeeCurrency : null,
      cec: s.creditExemptionFeeCurrency ? +s.creditExemptionFeeCurrency : null,
      acec: s.aptechCreditExemptionFeeCurrency ? +s.aptechCreditExemptionFeeCurrency : null,
      calcType: +s.discountType || 1,
      amtPer: s.discountAmount ? +s.discountAmount : null,
      intakeGuid: s.intakeGuid || null,
      // Real semesterGuid from Step 1's response, not the semCode-keyed
      // convention the old combined endpoint used — see semesterGuidForIndex.
      // LedgerNum is still auto-generated from each item's 1-based position,
      // same "position IS the sequence" convention as before.
      feeLines: s.semFees.flatMap((items, si) =>
        items.map((item, idx) => ({
          semesterGuid: semesterGuidForIndex(si),
          ledgerGuid: item.ledger,
          currencyGuid: item.currencyGuid,
          ledgerNum: idx + 1,
          amount: +item.amount || 0,
        }))
      ),
    }))

    // See the CONFIRMED GAP note on semesterGuidForIndex above — refuse to
    // submit rather than send a fee line with semesterGuid: '' and get back
    // a not_found that doesn't explain why.
    if (feeStructuresPayload.some(s => s.feeLines.some(l => !l.semesterGuid))) {
      setFailure('Fee structure can\'t be saved yet — the server hasn\'t provided a semester ID for this programme. This is a known backend gap, not something fixable from this form.')
      return
    }

    ;(async () => {
      try {
        for (const payload of feeStructuresPayload) {
          await saveFeeStructureComplete.mutateAsync(payload)
        }
        setSaved(true)
        showToast('Programme saved successfully')
      } catch (err) {
        const code = err instanceof AuthError ? err.code : undefined
        setFailure(err instanceof Error ? (err.message || `Failed to save fee structure${code ? ` (${code})` : ''}. Please try again.`) : 'Failed to save fee structure. Please try again.')
      }
    })()
  }

  // Old repeatable multi-specialization helpers — superseded by the single
  // streamGuid SearchSelect (see selectProgramLevel/streamGuid state above).
  // function addSpec()                           { setSpecs(p => [...p, { id: nextSpecId++, value: '' }]) }
  // function removeSpec(id: number)              { setSpecs(p => p.filter(s => s.id !== id)) }
  // function updateSpec(id: number, val: string) { setSpecs(p => p.map(s => s.id === id ? { ...s, value: val } : s)) }

  /* ── fee structure helpers ── */
  function addFeeStructure() {
    const newStruct: FeeStructure = {
      ...blankFeeStructure(nextFeeStructId++, semUnits.length),
      semFees: makeEmptySemFees(semUnits.length),
      intakeGuid: mode !== 'edit' && currentAcademicIntake ? currentAcademicIntake.intakeGuid : '',
    }
    setFeeStructures(prev => [...prev, newStruct])
    setActiveFeeIdx(feeStructures.length)
    setFeeAccordion(0); setCopySourceId('')
  }

  function removeFeeStructure(idx: number) {
    if (feeStructures.length <= 1) return
    setFeeStructures(prev => prev.filter((_, i) => i !== idx))
    setActiveFeeIdx(prev => (prev >= idx && prev > 0 ? prev - 1 : prev))
  }

  // Copies another structure's fees/discounts/fee lines onto the active one
  // — Fee Code/Description are deliberately left untouched so the copy
  // never collides with the source's own code. Fee lines are deep-cloned
  // with fresh local ids so editing the copy never mutates the source.
  function copyFeeStructure(sourceId: string) {
    setCopySourceId(sourceId)
    const source = feeStructures.find(s => String(s.id) === sourceId)
    if (!source) return
    setFeeStructures(prev => prev.map((s, i) => i !== activeFeeIdx ? s : {
      ...s,
      localOrForeign: source.localOrForeign,
      discountType: source.discountType,
      discountAmount: source.discountAmount,
      lateralEntryFee: source.lateralEntryFee,
      lateralEntryFeeCurrency: source.lateralEntryFeeCurrency,
      creditExemptionFee: source.creditExemptionFee,
      creditExemptionFeeCurrency: source.creditExemptionFeeCurrency,
      aptechCreditExemptionFee: source.aptechCreditExemptionFee,
      aptechCreditExemptionFeeCurrency: source.aptechCreditExemptionFeeCurrency,
      semFees: source.semFees.map(items => items.map(item => ({ ...item, id: nextId++ }))),
    }))
    showToast(`Copied fees from ${source.feeCode || 'New Fee Structure'}`)
  }

  function updateFeeStructureMeta(field: Exclude<keyof FeeStructure, 'id' | 'semFees'>, val: string) {
    setFeeStructures(prev => prev.map((s, i) => i === activeFeeIdx ? { ...s, [field]: val } : s))
  }

  // Lateral Entry/Credit Exemption/Aptech Credit Exemption Fee each kept
  // their own Currency dropdown, even though in practice a programme's
  // Lateral Entry Fee, Credit Exemption Fee, and Aptech Credit Exemption Fee
  // are always meant to share one currency — three separate pickers just
  // meant picking (and re-checking) the same value three times. FeeStructure
  // still carries all three underlying fields (FeeStructureInput's
  // lec/cec/acec are genuinely separate wire fields — see handleFinalSubmit),
  // this only collapses the UI down to one control that drives all three at
  // once, in a single state update so they can never drift apart from here.
  function updateSharedFeeCurrency(val: string) {
    setFeeStructures(prev => prev.map((s, i) => i === activeFeeIdx
      ? { ...s, lateralEntryFeeCurrency: val, creditExemptionFeeCurrency: val, aptechCreditExemptionFeeCurrency: val }
      : s
    ))
  }

  // Fee Currency default (program_master_frontend_fixes.md, "Programme
  // Details - Fee Section Bugs" #1) — a new fee item is never left with no
  // currency picked; pre-fill it from the structure's own Local/Foreign
  // toggle (UGX for Local, USD for Foreign) via the same real currencyGuid
  // source the picker itself uses, falling back to whichever currency
  // happens to load first if neither code is found.
  function defaultFeeItemCurrency(localOrForeign: string): { guid: string; legacy: string } {
    const code = localOrForeign === 'true' ? 'USD' : 'UGX'
    const fc = financeCurrencies.find(c => c.currencyCode === code) ?? financeCurrencies[0]
    const legacy = fc ? currencies.find(c => c.currencyCode === fc.currencyCode) : undefined
    return { guid: fc?.currencyGuid ?? '', legacy: legacy ? String(legacy.intCurrency) : '' }
  }

  /* ── fee item helpers ── */
  function addItem(si: number) {
    const { guid, legacy } = defaultFeeItemCurrency(feeStructures[activeFeeIdx].localOrForeign)
    setFeeStructures(prev => prev.map((s, i) =>
      i === activeFeeIdx
        ? { ...s, semFees: s.semFees.map((items, j) => j === si ? [...items, blankItem(nextId++, guid, legacy)] : items) }
        : s
    ))
  }
  function removeItem(si: number, id: number) {
    setFeeStructures(prev => prev.map((s, i) =>
      i === activeFeeIdx
        ? { ...s, semFees: s.semFees.map((items, j) => j === si ? items.filter(f => f.id !== id) : items) }
        : s
    ))
  }
  function updateItem(si: number, id: number, field: keyof FeeItem, val: string) {
    setFeeStructures(prev => prev.map((s, i) =>
      i === activeFeeIdx
        ? { ...s, semFees: s.semFees.map((items, j) => j === si ? items.map(f => f.id === id ? { ...f, [field]: val } : f) : items) }
        : s
    ))
  }
  // Fee-item Currency picker is sourced from useFinanceCurrencies() (real
  // currencyGuid) in both modes now — see the FeeLineInput.currencyGuid note
  // in lib/api/academic/programMaster.ts for why Create needs a real guid
  // too, not just intCurrency. Also derives the legacy intCurrency string
  // (by matching currencyCode against useCurrencies()) so Create's payload
  // can keep sending both.
  function selectFeeItemCurrency(si: number, id: number, currencyGuid: string) {
    const fc = financeCurrencies.find(c => c.currencyGuid === currencyGuid)
    const legacy = fc ? currencies.find(c => c.currencyCode === fc.currencyCode) : undefined
    setFeeStructures(prev => prev.map((s, i) =>
      i === activeFeeIdx
        ? { ...s, semFees: s.semFees.map((items, j) => j === si ? items.map(f => f.id === id ? { ...f, currencyGuid, currency: legacy ? String(legacy.intCurrency) : f.currency } : f) : items) }
        : s
    ))
  }
  function moveItem(si: number, idx: number, dir: -1 | 1) {
    const to = idx + dir
    setFeeStructures(prev => prev.map((s, i) => {
      if (i !== activeFeeIdx) return s
      return {
        ...s,
        semFees: s.semFees.map((items, j) => {
          if (j !== si || to < 0 || to >= items.length) return items
          const next = [...items];
          [next[idx], next[to]] = [next[to], next[idx]]
          return next
        }),
      }
    }))
  }
  // Drag-and-drop counterpart to moveItem above — moves an item to any
  // arbitrary position in one go (a drag can skip several rows at once),
  // rather than moveItem's single-step swap with its immediate neighbor.
  // Reuses the same "position IS the LedgerNum sequence" convention, so a
  // drag reorders Ledger Priority exactly the way the Pri. arrows do.
  function moveItemTo(si: number, from: number, to: number) {
    if (from === to) return
    setFeeStructures(prev => prev.map((s, i) => {
      if (i !== activeFeeIdx) return s
      return {
        ...s,
        semFees: s.semFees.map((items, j) => {
          if (j !== si || to < 0 || to >= items.length) return items
          const next = [...items]
          const [moved] = next.splice(from, 1)
          next.splice(to, 0, moved)
          return next
        }),
      }
    }))
  }

  /* ── semester count helpers — no fixed count any more; Course Unit
     Allocation and Fee Structure share one dynamic list of slots so a
     semester added/removed here stays in sync across both steps. ── */
  function resizeSemesters(count: number) {
    const n = Math.max(count, 1)
    setSemUnits(prev => Array.from({ length: n }, (_, i) => prev[i] ?? []))
    setPendingSel(prev => Array.from({ length: n }, (_, i) => prev[i] ?? ''))
    setSemLabels(prev => Array.from({ length: n }, (_, i) => prev[i] ?? `Semester ${i + 1}`))
    setFeeStructures(prev => prev.map(s => ({ ...s, semFees: Array.from({ length: n }, (_, i) => s.semFees[i] ?? []) })))
    setActiveAcc(a => Math.min(a, n - 1))
    setFeeAccordion(a => Math.min(a, n - 1))
  }
  function addSemester() {
    setSemUnits(prev => [...prev, []])
    setPendingSel(prev => [...prev, ''])
    setSemLabels(prev => [...prev, `Semester ${prev.length + 1}`])
    setFeeStructures(prev => prev.map(s => ({ ...s, semFees: [...s.semFees, []] })))
    setActiveAcc(semUnits.length)
  }
  function removeSemester(index: number) {
    if (semUnits.length <= 1) return
    setSemUnits(prev => prev.filter((_, i) => i !== index))
    setPendingSel(prev => prev.filter((_, i) => i !== index))
    setSemLabels(prev => prev.filter((_, i) => i !== index))
    setFeeStructures(prev => prev.map(s => ({ ...s, semFees: s.semFees.filter((_, i) => i !== index) })))
    setActiveAcc(a => (a >= index && a > 0 ? a - 1 : a))
    setFeeAccordion(a => (a >= index && a > 0 ? a - 1 : a))
  }

  /* ── course unit helpers ── */
  function addUnit(si: number, val: string) {
    const opt = courseUnitOptions.find(u => u.value === val)
    if (!opt) return
    setSemUnits(prev => prev.map((units, i) =>
      i === si ? [...units, { id: nextCUId++, guid: opt.value, code: opt.code, name: opt.name, credits: opt.credits, unitType: '', unitCat: '', streamGuid: '' }] : units
    ))
    setPendingSel(prev => prev.map((s, i) => i === si ? '' : s))
  }
  function removeUnit(si: number, id: number) {
    setSemUnits(prev => prev.map((units, i) =>
      i === si ? units.filter(u => u.id !== id) : units
    ))
  }
  function setUnitField(si: number, id: number, field: 'unitType' | 'unitCat' | 'streamGuid', val: string) {
    setSemUnits(prev => prev.map((units, i) =>
      i === si ? units.map(u => {
        if (u.id !== id) return u
        // Switching away from the "Specialization" category makes the
        // per-unit specialization pick moot — clear it so a stale value
        // never silently rides along on submit for a Core/Elective unit.
        if (field === 'unitCat' && !isSpecializationCategory(val)) return { ...u, unitCat: val, streamGuid: '' }
        return { ...u, [field]: val }
      }) : units
    ))
  }

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup title={mode === 'edit' ? 'Programme Updated!' : 'Programme Saved!'} subtitle="The programme version has been saved successfully." onClose={handleClose} />
        </div>
      </div>
    )
  }

  if (failure) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup title="Couldn't Save Programme" subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="new-prog-modal">
      <div className="modal modal-80 modal-flex" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-graduation"></i> {mode === 'edit' ? 'Edit' : 'Add'} Programme Version</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="prog-steps">
          <div className={`prog-step${step === 1 ? ' active' : ''}`}><span className="prog-step-num">1</span><span>Programme Details</span></div>
          <div className="prog-step-line"></div>
          <div className={`prog-step${step === 2 ? ' active' : ''}`}><span className="prog-step-num">2</span><span>Course Unit Allocation</span></div>
          <div className="prog-step-line"></div>
          <div className={`prog-step${step === 3 ? ' active' : ''}`}><span className="prog-step-num">3</span><span>Semester-wise Fee Structure</span></div>
        </div>

        {step !== 2 && (
        <div className="modal-scroll">

          {/* ── Step 1: Programme Details ──────────────────────── */}
          {step === 1 && (
            <div>
              {programAlreadyCreated && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 14px', background: 'var(--green-bg)', border: '1.5px solid var(--green-bd)', borderRadius: 'var(--rsm)', fontSize: 12.5, color: 'var(--g700)' }}>
                  <i className="lni lni-checkmark-circle" style={{ color: 'var(--green)', fontSize: 16 }}></i>
                  Programme details already saved — locked to avoid creating a duplicate. Continue below to Course Unit Allocation.
                </div>
              )}
              <div style={programAlreadyCreated ? { opacity: .55, pointerEvents: 'none' } : undefined}>
              <div className="g3">
                <div className="fg">
                  <div className="lbl">Programme Code <span className="req">*</span></div>
                  <input
                    className="ctrl"
                    placeholder="e.g. BCA-2031"
                    value={programCode}
                    onChange={e => { setProgramCode(e.target.value); if (step1Errors.programCode) setStep1Errors(p => ({ ...p, programCode: '' })) }}
                    style={step1Errors.programCode ? { borderColor: 'var(--red)' } : undefined}
                  />
                  {step1Errors.programCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{step1Errors.programCode}</p>}
                </div>
                <div className="fg span2">
                  <div className="lbl">Programme Name <span className="req">*</span></div>
                  <input
                    className="ctrl"
                    placeholder="e.g. Bachelor of Computer Applications 2031"
                    value={programName}
                    onChange={e => { setProgramName(e.target.value); if (step1Errors.programName) setStep1Errors(p => ({ ...p, programName: '' })) }}
                    style={step1Errors.programName ? { borderColor: 'var(--red)' } : undefined}
                  />
                  {step1Errors.programName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{step1Errors.programName}</p>}
                </div>
                {/* Group and Level moved directly under Code/Name (was previously split
                    apart by No. of Course Units sitting between them) so the two
                    required pickers that most affect the rest of the form read as one
                    connected block instead of getting broken up by an unrelated field. */}
                <div className="fg">
                  <div className="lbl">Programme Group <span className="req">*</span></div>
                  <SearchSelect
                    placeholder="— Select group —"
                    value={programGroupGuid}
                    onChange={selectProgramGroup}
                    options={programGroupOptions}
                  />
                  {step1Errors.programGroupGuid && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{step1Errors.programGroupGuid}</p>}
                </div>
                <div className="fg span2">
                  {/* Inline style, not the `flex` utility class — .lbl's own
                      `display: block` (globals.css) loads after Tailwind's
                      utility layer in this stylesheet, so a `flex` class here
                      would lose that cascade tie; an inline style always wins
                      regardless of source order. */}
                  <div className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    Programme Level <span className="req">*</span>
                    <span ref={levelInfoRef} style={{ position: 'relative', display: 'inline-flex' }}>
                      <button
                        type="button"
                        className="btn btn-neu btn-sm"
                        style={{ width: 18, height: 18, padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Automatically fills Years, Semesters, Min. Credits, Application/Late Fee, and Currency"
                        onClick={() => setLevelInfoOpen(v => !v)}
                      ><i className="lni lni-information" style={{ fontSize: 10 }}></i></button>
                      {levelInfoOpen && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 20, width: 230, background: 'var(--white)', border: '1px solid var(--g200)', borderRadius: 'var(--rsm)', boxShadow: '0 6px 18px rgba(0,0,0,.12)', padding: '8px 10px', fontSize: 12, fontWeight: 400, color: 'var(--g700)' }}>
                          Automatically fills No. of Years, No. of Semesters, Min. Credits, Application/Late Fee, and Currency from the picked level.
                        </div>
                      )}
                    </span>
                  </div>
                  <SearchSelect placeholder="— Select level —" value={programLevelGuid} onChange={selectProgramLevel} options={programLevelOptions} />
                  {step1Errors.programLevelGuid && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{step1Errors.programLevelGuid}</p>}
                  <div className="flex gap-2 flex-wrap mt-2">
                    <span className="lvl-chip"><span className="lvl-chip-lbl">No. of Years</span><span className="lvl-chip-val">{selectedProgramLevel?.yearCount ?? '—'}</span></span>
                    <span className="lvl-chip"><span className="lvl-chip-lbl">No. of Semesters</span><span className="lvl-chip-val">{selectedProgramLevel?.semCount ?? '—'}</span></span>
                    <span className="lvl-chip"><span className="lvl-chip-lbl">Min. Credits</span><span className="lvl-chip-val">{selectedProgramLevel?.minCreditLoad ?? '—'}</span></span>
                  </div>
                </div>
                {/* Not mandatory per Program_Master_Change_Requests_Final.md — when
                    left blank, Course Unit Allocation has no count to enforce;
                    when filled in, it's validated there against the actual
                    number of course units added (see the Step 2 count check). */}
                <div className="fg">
                  <div className="lbl">No. of Course Units</div>
                  <input
                    className="ctrl"
                    type="number"
                    min={0}
                    placeholder="e.g. 24"
                    value={unitCount}
                    onChange={e => setUnitCount(e.target.value)}
                  />
                </div>
                <div className="fg">
                  <div className="lbl">Faculty <span className="req">*</span></div>
                  <SearchSelect
                    placeholder="— Select faculty —"
                    value={facultyGuid}
                    onChange={v => { setFacultyGuid(v); if (step1Errors.facultyGuid) setStep1Errors(p => ({ ...p, facultyGuid: '' })) }}
                    options={facultyOptions}
                  />
                  {step1Errors.facultyGuid && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{step1Errors.facultyGuid}</p>}
                </div>
                <div className="fg">
                  <div className="lbl">Campus</div>
                  <input className="ctrl" type="text" value={selectedFaculty?.campusName ?? ''} placeholder="Derived from Faculty" disabled />
                </div>
                <div className="fg span2">
                  <div className="lbl">Application Fee &amp; Late Fee <span className="req">*</span></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: 6 }}>
                    <input
                      className="ctrl font-bold"
                      type="number"
                      min={0}
                      placeholder="Application Fee"
                      value={appFee}
                      onChange={e => { setAppFee(e.target.value); if (step1Errors.appFee) setStep1Errors(p => ({ ...p, appFee: '' })) }}
                      style={step1Errors.appFee ? { borderColor: 'var(--red)' } : undefined}
                    />
                    <input
                      className="ctrl font-bold"
                      type="number"
                      min={0}
                      placeholder="Late Fee"
                      value={lateFee}
                      onChange={e => { setLateFee(e.target.value); if (step1Errors.lateFee) setStep1Errors(p => ({ ...p, lateFee: '' })) }}
                      style={step1Errors.lateFee ? { borderColor: 'var(--red)' } : undefined}
                    />
                    <SearchSelect
                      placeholder="Currency"
                      value={currencyGuid}
                      onChange={v => { setCurrencyGuid(v); if (step1Errors.currencyCode) setStep1Errors(p => ({ ...p, currencyCode: '' })) }}
                      options={financeCurrencyOptions}
                    />
                  </div>
                  <div className="text-g500 mt-[5px]" style={{ fontSize: 'var(--fs-xs)' }}>
                    {mode === 'edit'
                      ? (currencyGuid ? 'Pre-filled from the existing programme — override if needed.' : 'Not available on the existing programme record — please select it.')
                      : 'Please select the programme\'s base currency.'}
                  </div>
                  {(step1Errors.appFee || step1Errors.lateFee || step1Errors.currencyCode) && (
                    <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{step1Errors.appFee || step1Errors.lateFee || step1Errors.currencyCode}</p>
                  )}
                </div>
                {/* Not mandatory per Program_Master_Change_Requests_Final.md — no
                    required marker, no validation. */}
                <div className="fg">
                  <div className="lbl">Accreditation Date</div>
                  <DatePicker
                    value={dateAcc}
                    onChange={setDateAcc}
                  />
                </div>
                {/* Accreditation Expiry Date — commented out per request.
                <div className="fg m-0"><div className="lbl">Accreditation Expiry Date</div><input className="ctrl" type="date" /></div>
                */}
                {/* Not mandatory per Program_Master_Change_Requests_Final.md — no
                    required marker, no validation. Still feeds Course Unit
                    Allocation's per-unit Specialization picker options. */}
                <div className="fg">
                  <div className="lbl">Specialization(s)</div>
                  <MultiSelect
                    placeholder="— Select specialization(s) —"
                    value={streamGuids}
                    onChange={vals => {
                      setStreamGuids(vals)
                      // Drop any per-unit pick (Step 2) that's no longer part of this selection.
                      setSemUnits(prev => prev.map(units => units.map(u => (u.streamGuid && vals.includes(u.streamGuid)) ? u : { ...u, streamGuid: '' })))
                    }}
                    options={streamOptions}
                  />
                  <div style={{ fontSize: 11, color: 'var(--g400)', marginTop: 4 }}>Every specialization this programme offers — picked per course unit in Course Unit Allocation.</div>
                </div>
                {/* Intake dropdown removed per Program_Master_Change_Requests_Final.md
                    — intakeGuid is auto-filled from the Current Academic Intake
                    instead (see the effect below), same pattern as the standalone
                    Fee Structure page's Create mode. CONFIRMED broken as originally
                    shipped: with no picker at all, a live environment where no intake
                    is flagged currentIntake left intakeGuid permanently empty with no
                    way to fix it — Create was silently blocked. Falls back to an
                    editable picker in exactly that case (Edit mode is unaffected —
                    it already carries intakeGuid through from fullDetails). */}
                {mode !== 'edit' && !currentAcademicIntake && (
                  <div className="fg">
                    <div className="lbl">Intake</div>
                    <SearchSelect
                      placeholder="— Select intake —"
                      value={intakeGuid}
                      options={programIntakeOptions}
                      onChange={setIntakeGuid}
                    />
                  </div>
                )}
                <div className="fg span3">
                  <div className="lbl">Accreditation Letter</div>
                  <div className="file-zone p-[14px]">
                    <input type="file" accept=".pdf" onChange={e => setAccLetterFile(e.target.files?.[0] ?? null)} />
                    <div className="file-zone-icon"><i className="lni lni-files"></i></div>
                    <p>{accLetterFile ? accLetterFile.name : 'Upload NCHE / UVTOP accreditation letter (PDF)'}</p>
                  </div>
                </div>
              </div>

              {/* Old repeatable multi-specialization list — the confirmed create
                  payload only supports one streamGuid, not an array (see the
                  single Specialization SearchSelect above).
              <div className="sec-divider">
                Programme Specializations
                <span className="font-medium text-g400 normal-case tracking-normal ml-2" style={{ fontSize: 'var(--fs-2xs)' }}>
                  Optional · A student can pick one specialization which dictates their specialization course units
                </span>
              </div>
              <div className="bg-[#fafbfd] border-[1.5px] border-g200 rounded-[var(--rsm)] p-[14px_16px] mb-[14px]">
                {specs.length === 0 && (
                  <div className="text-g500 italic mb-2" style={{ fontSize: 'var(--fs-sm)' }}>No specializations added — this programme will run as a single track.</div>
                )}
                {specs.length > 0 && (
                  <div className="flex flex-col gap-2 mb-3">
                    {specs.map((s, idx) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--b600)', background: 'var(--b100)', padding: '4px 8px', borderRadius: 'var(--rxs)', minWidth: 32, textAlign: 'center', flexShrink: 0 }}>#{idx + 1}</span>
                        <div style={{ flex: 1 }}>
                          <SearchSelect
                            placeholder="— Select a specialization —"
                            value={s.value}
                            onChange={val => updateSpec(s.id, val)}
                            options={SPEC_OPTS}
                          />
                        </div>
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                          onClick={() => removeSpec(s.id)}
                        ><i className="lni lni-trash-can"></i></button>
                      </div>
                    ))}
                  </div>
                )}
                <button className="btn btn-neu btn-sm" onClick={addSpec}><i className="lni lni-plus"></i> Add Specialization</button>
              </div>
              */}

              <div className="sec-divider">Status &amp; Flags</div>
              <div className="g3">
                <div className="fg">
                  <div className="lbl">Admission Status <span className="req">*</span></div>
                  {/* Just "Active"/"Inactive" — no "(New admissions)"/"(Existing
                      students only)" qualifier, per the Program Master
                      requirements doc (req. 3). pgmStatus itself is unchanged. */}
                  <div className="tgl-group">
                    <button type="button" className={`tgl-btn${pgmStatus ? ' tgl-active' : ''}`} onClick={() => setPgmStatus(true)}><i className="lni lni-checkmark"></i> Active</button>
                    <button type="button" className={`tgl-btn${!pgmStatus ? ' tgl-active' : ''}`} onClick={() => setPgmStatus(false)}>Inactive</button>
                  </div>
                </div>
                <div className="fg">
                  <div className="lbl">No Internal Assessment?</div>
                  <div className="tgl-group">
                    <button type="button" className={`tgl-btn${!noIa ? ' tgl-active' : ''}`} onClick={() => setNoIa(false)}>No (Standard)</button>
                    <button type="button" className={`tgl-btn${noIa ? ' tgl-active' : ''}`} onClick={() => setNoIa(true)}>Yes (e.g. PhD)</button>
                  </div>
                </div>
              </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Semester-wise Fee Structure ────────────── */}
          {step === 3 && (
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

              {/* Left fee structure list */}
              <div style={{ width: 210, flexShrink: 0, background: 'var(--surface)', border: '1.5px solid var(--g200)', borderRadius: 'var(--rsm)', overflow: 'hidden', position: 'sticky', top: 0, display: 'flex', flexDirection: 'column', maxHeight: 480 }}>
                <div style={{ padding: '14px 14px 6px', fontSize: 10.5, fontWeight: 700, color: 'var(--g400)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                  Fee Structures <span style={{ color: 'var(--b500)' }}>({feeStructures.length})</span>
                  <span style={{ float: 'right', fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--g400)' }}>optional</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
                  {feeStructures.map((s, i) => (
                    <div
                      key={s.id}
                      onClick={() => { setActiveFeeIdx(i); setFeeAccordion(0); setCopySourceId('') }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '9px 10px', borderRadius: 'var(--rsm)', marginBottom: 2,
                        background: activeFeeIdx === i ? 'var(--b500)' : 'transparent',
                        color: activeFeeIdx === i ? '#fff' : 'var(--g700)',
                        cursor: 'pointer', transition: 'background .15s',
                      }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: activeFeeIdx === i ? 'rgba(255,255,255,.2)' : 'var(--b100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <i className="lni lni-coin" style={{ fontSize: 12, color: activeFeeIdx === i ? '#fff' : 'var(--b600)' }}></i>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 12.5, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Structure {i + 1}</div>
                        <div style={{ fontSize: 11, opacity: .65, lineHeight: 1.3 }}>{s.localOrForeign === 'true' ? 'Foreign' : 'Local'}</div>
                      </div>
                      {feeStructures.length > 1 && (
                        <button
                          onClick={e => { e.stopPropagation(); removeFeeStructure(i) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: activeFeeIdx === i ? 'rgba(255,255,255,.65)' : 'var(--g300)', display: 'flex', alignItems: 'center', borderRadius: 'var(--rxs)', flexShrink: 0 }}
                        ><i className="lni lni-trash-can" style={{ fontSize: 12 }}></i></button>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1.5px solid var(--g200)', padding: '6px 8px 10px' }}>
                  <button className="btn btn-neu btn-sm" style={{ width: '100%' }} onClick={addFeeStructure} disabled={!activeFeeComplete}>
                    <i className="lni lni-plus"></i> Add Fee Structure
                  </button>
                </div>
              </div>

              {/* Right configuration panel */}
              <div style={{ flex: 1, minWidth: 0 }}>

                {/* Active structure banner */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 14px', background: 'var(--b50)', borderRadius: 'var(--rsm)', border: '1.5px solid var(--b100)' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--b100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className="lni lni-coin" style={{ color: 'var(--b600)', fontSize: 15 }}></i>
                  </div>
                  <div style={{ flex: 1 }}>
                    {/* Real Programme Fee Header (e.g. "FCS-001 — Local"), not a generic
                        "Structure N" label, per the Program Master requirements doc
                        (req. 4) — "New Fee Structure" only shows before a header code
                        has been typed in for a not-yet-saved structure. */}
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--b800)' }}>{activeFeeStruct.feeCode || 'New Fee Structure'} — {activeFeeStruct.localOrForeign === 'true' ? 'Foreign' : 'Local'}</div>
                    <div style={{ fontSize: 11, color: 'var(--g400)' }}>Structure {activeFeeIdx + 1} of {feeStructures.length}</div>
                  </div>
                </div>

                {/* Fee structure controls */}
                <div className="g3 mb-[14px]">
                  <div className="fg m-0">
                    <div className="lbl">Fee Code</div>
                    <input className="ctrl font-mono uppercase" type="text" value={activeFeeStruct.feeCode} onChange={e => updateFeeStructureMeta('feeCode', e.target.value)} />
                  </div>
                  <div className="fg m-0">
                    <div className="lbl">Fee Description</div>
                    <input className="ctrl" type="text" placeholder="e.g. Local undergraduate fee structure" value={activeFeeStruct.description} onChange={e => updateFeeStructureMeta('description', e.target.value)} />
                  </div>
                  <div className="fg m-0">
                    <div className="lbl">Copy Fee Code</div>
                    <SearchSelect
                      placeholder="— Select source structure —"
                      value={copySourceId}
                      onChange={copyFeeStructure}
                      options={feeStructures.map((s, i) => ({
                        value: String(s.id),
                        label: (s.feeCode || 'New Fee Structure') + (i === activeFeeIdx ? ' (Current)' : ''),
                      }))}
                    />
                  </div>
                  <div className="fg m-0">
                    <div className="lbl">Base Currency</div>
                    <SearchSelect options={LOCAL_OR_FOREIGN_OPTS} value={activeFeeStruct.localOrForeign} onChange={val => updateFeeStructureMeta('localOrForeign', val)} />
                  </div>
                  {/* Read-only in Edit (existing intake, unchangeable) and in Create once
                      auto-filled from the Current Academic Intake (Fee_Structure_Change_
                      Requests.md #3/#4). CONFIRMED broken as originally shipped, though:
                      when no intake is flagged currentIntake in the live data, the
                      auto-fill effect never runs and this was `disabled` with nothing to
                      select and no way to fix it — Create was permanently blocked. Falls
                      back to an editable picker in exactly that case. */}
                  <div className="fg m-0">
                    <div className="lbl">Intake</div>
                    <SearchSelect
                      placeholder={mode === 'edit' ? '— Select intake —' : (currentAcademicIntake ? undefined : '— Select intake —')}
                      value={activeFeeStruct.intakeGuid}
                      options={programIntakeOptions}
                      onChange={val => updateFeeStructureMeta('intakeGuid', val)}
                      disabled={mode === 'edit' || !!currentAcademicIntake}
                    />
                  </div>
                </div>

                {/* Programme-level fees & discounts — maps onto
                    FeeStructureInput's lef/cef/ace/lec/cec/acec/calcType/
                    amtPer (see handleFinalSubmit). */}
                <div className="bg-[linear-gradient(135deg,#f0f5ff_0%,var(--white)_70%)] border-[1.5px] border-dashed border-[var(--b200)] rounded-[var(--rsm)] p-[14px_16px] mb-[18px]">
                  <div className="flex items-center gap-2 font-bold uppercase mb-3" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '.08em', color: '#2d448f' }}>
                    <i className="lni lni-tag" style={{ fontSize: 'var(--fs-md)' }}></i>
                    <span>Programme-level Fees &amp; Discounts</span>
                    <span className="badge badge-blue normal-case tracking-normal font-semibold ml-auto">Applied across all semesters</span>
                  </div>
                  <div className="g3">
                    <div className="fg m-0">
                      <div className="lbl">Lumpsum Discount Type</div>
                      <SearchSelect options={CALC_TYPES} value={activeFeeStruct.discountType} onChange={val => updateFeeStructureMeta('discountType', val)} />
                    </div>
                    <div className="fg m-0">
                      <div className="lbl">{activeFeeStruct.discountType === '2' ? 'Lumpsum Discount Percentage' : 'Lumpsum Discount Amount'}</div>
                      <div className="flex items-center gap-2">
                        {/* Percentage indicator is unambiguous, kept as-is. The
                            Amount-mode badge is commented out for now, not just
                            re-labeled — unlike Lateral Entry/Credit Exemption/Aptech
                            Credit Exemption Fee (each paired with its own Currency
                            dropdown), a Lumpsum Discount Amount has no currency field
                            of its own on FeeStructureInput; showing UGX/USD here would
                            be inferring that it silently follows this structure's own
                            Local/Foreign designation (defaultFeeItemCurrency()'s
                            mapping), which is unconfirmed against a real spec/backend
                            response for this specific field. The original bare
                            "Local"/"Foreign" text at least wasn't a wrong guess, just
                            an unexplained one — better to show nothing until the real
                            currency behavior is confirmed, then restore this with the
                            confirmed value. */}
                        {activeFeeStruct.discountType === '2' && (
                          <span className="text-g500 font-bold min-w-[28px] text-center" style={{ fontSize: 'var(--fs-sm)' }}>%</span>
                        )}
                        <input className="ctrl flex-1" type="number" placeholder="0" min={0} max={activeFeeStruct.discountType === '2' ? 100 : undefined} value={activeFeeStruct.discountAmount} onChange={e => updateFeeStructureMeta('discountAmount', e.target.value)} />
                      </div>
                    </div>
                    <div className="fg m-0">
                      <div className="lbl">Lateral Entry Fee</div>
                      <input className="ctrl" type="number" placeholder="0" min={0} value={activeFeeStruct.lateralEntryFee} onChange={e => updateFeeStructureMeta('lateralEntryFee', e.target.value)} />
                    </div>
                    <div className="fg m-0">
                      <div className="lbl">Credit Exemption Fee</div>
                      <input className="ctrl" type="number" placeholder="0" min={0} value={activeFeeStruct.creditExemptionFee} onChange={e => updateFeeStructureMeta('creditExemptionFee', e.target.value)} />
                    </div>
                    <div className="fg m-0">
                      <div className="lbl">Aptech Credit Exemption Fee</div>
                      <input className="ctrl" type="number" placeholder="0" min={0} value={activeFeeStruct.aptechCreditExemptionFee} onChange={e => updateFeeStructureMeta('aptechCreditExemptionFee', e.target.value)} />
                    </div>
                    {/* One shared Currency picker for all three fees above (Lateral
                        Entry/Credit Exemption/Aptech Credit Exemption Fee), replacing
                        the three separate-but-identical dropdowns each used to have —
                        see updateSharedFeeCurrency() above. Displays whichever of the
                        three is currently set on Lateral Entry Fee; if an existing
                        programme somehow has them saved as different currencies
                        (Edit-mode prefill, pre-dating this change), picking a value
                        here still normalizes all three to match, same as any other
                        edit. */}
                    <div className="fg m-0">
                      <div className="lbl">Currency <span className="text-g400 font-normal normal-case">(Lateral Entry / Credit Exemption / Aptech Credit Exemption)</span></div>
                      <SearchSelect placeholder="Currency" options={currencyIntOptions} value={activeFeeStruct.lateralEntryFeeCurrency} onChange={updateSharedFeeCurrency} />
                    </div>
                  </div>
                </div>

                {/* Per-semester accordion */}
                <div className="flex flex-col gap-2">
                  {activeFeeStruct.semFees.map((items, si) => {
                    const isOpen = feeAccordion === si
                    const total  = items.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0)
                    // items[0].currencyGuid is the real currencyGuid in both modes now.
                    const totalCurrencyCode = financeCurrencies.find(c => c.currencyGuid === items[0]?.currencyGuid)?.currencyCode ?? ''
                    return (
                      <div key={si} style={{ border: '1.5px solid var(--b100)', borderRadius: 'var(--rsm)', overflow: 'hidden' }}>
                        <button
                          type="button"
                          onClick={() => setFeeAccordion(isOpen ? -1 : si)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', width: '100%', background: isOpen ? 'var(--b50)' : 'var(--white)', border: 'none', borderBottom: isOpen ? '1px solid var(--b100)' : 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
                        >
                          <span className="badge badge-blue" style={{ flexShrink: 0 }}>Sem {si + 1}</span>
                          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--b700)' }}>Semester {si + 1}</span>
                          {items.length > 0
                            ? <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--g400)', marginRight: 8 }}>{items.length} item{items.length !== 1 ? 's' : ''} · {total.toLocaleString()} {totalCurrencyCode}</span>
                            : <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--g400)', fontStyle: 'italic', marginRight: 8 }}>No items</span>
                          }
                          <i className="lni lni-chevron-down" style={{ fontSize: 11, color: 'var(--g400)', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }} />
                        </button>
                        <div style={{ overflow: 'hidden', maxHeight: isOpen ? 800 : 0, transition: 'max-height 0.3s ease' }}>
                          <div style={{ padding: '10px 14px' }}>
                            {/* Pri. | Ledger | Ledger Priority | Amount | Currency | remove —
                                reordered per Fee_Structure_Change_Requests.md #1/#2
                                (Fee Title dropped, Ledger moved first, Ledger Priority added).
                                Ledger Priority is read-only now — it's this item's 1-based
                                position within the semester (the LedgerNum sent on save), not
                                a manually-typed number; use the Pri. arrows to reorder it — see
                                program_master_frontend_fixes.md's "not auto-incrementing" fix. */}
                            {items.length > 0 && (
                              <div style={{ display: 'grid', gridTemplateColumns: '18px 32px 1fr 90px 110px 150px 32px', gap: 6, padding: '0 0 4px', fontSize: 10.5, fontWeight: 700, color: 'var(--g400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <span></span><span style={{ textAlign: 'center' }}>Pri.</span><span>Ledger</span><span>Ledger Priority</span><span>Amount</span><span>Currency</span><span></span>
                              </div>
                            )}
                            <div className="flex flex-col gap-1">
                              {items.length === 0 && (
                                <div className="text-g400 italic" style={{ fontSize: 12.5, marginBottom: 8 }}>No fee items — click &ldquo;Add Fee Item&rdquo; to begin.</div>
                              )}
                              {items.map((f, idx) => (
                                <div
                                  key={f.id}
                                  onDragOver={e => { if (draggedItem?.si === si) { e.preventDefault(); setDragOverIdx(idx) } }}
                                  onDragLeave={() => setDragOverIdx(prev => (prev === idx ? null : prev))}
                                  onDrop={e => {
                                    e.preventDefault()
                                    if (draggedItem && draggedItem.si === si) moveItemTo(si, draggedItem.idx, idx)
                                    setDraggedItem(null); setDragOverIdx(null)
                                  }}
                                  style={{
                                    display: 'grid', gridTemplateColumns: '18px 32px 1fr 90px 110px 150px 32px', gap: 6, alignItems: 'center',
                                    borderRadius: 'var(--rxs)', transition: 'background .12s',
                                    background: dragOverIdx === idx && draggedItem?.si === si && draggedItem.idx !== idx ? 'var(--b50)' : undefined,
                                  }}
                                >
                                  {/* Drag handle — the row itself is the drop target (onDragOver/
                                      onDrop above), but only this handle is draggable, so grabbing
                                      the Ledger/Amount/Currency controls to type or pick a value
                                      never accidentally starts a drag. */}
                                  <div
                                    draggable
                                    onDragStart={() => setDraggedItem({ si, idx })}
                                    onDragEnd={() => { setDraggedItem(null); setDragOverIdx(null) }}
                                    title="Drag to reorder"
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', cursor: 'grab', color: 'var(--g300)', fontSize: 13 }}
                                  >
                                    <i className="lni lni-menu"></i>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                                    <button className="btn btn-neu" style={{ width: 26, height: 14, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }} onClick={() => moveItem(si, idx, -1)} disabled={idx === 0}><i className="lni lni-chevron-up"></i></button>
                                    <button className="btn btn-neu" style={{ width: 26, height: 14, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }} onClick={() => moveItem(si, idx, 1)} disabled={idx === items.length - 1}><i className="lni lni-chevron-down"></i></button>
                                  </div>
                                  <SearchSelect placeholder="— Select Ledger —" options={ledgerOptions} value={f.ledger} onChange={val => updateItem(si, f.id, 'ledger', val)} />
                                  <input className="ctrl" value={idx + 1} readOnly disabled title="Auto-assigned from this item's position — drag the handle or use the Pri. arrows to reorder" />
                                  <input className="ctrl" value={f.amount} onChange={e => updateItem(si, f.id, 'amount', e.target.value)} type="number" min={0} placeholder="0" />
                                  <SearchSelect placeholder="— Currency —" options={financeCurrencyOptions} value={f.currencyGuid} onChange={val => selectFeeItemCurrency(si, f.id, val)} />
                                  <button className="btn btn-danger btn-sm" style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} onClick={() => removeItem(si, f.id)}><i className="lni lni-trash-can"></i></button>
                                </div>
                              ))}
                              <button className="btn btn-neu btn-sm mt-2" style={{ alignSelf: 'flex-start', fontSize: 11 }} onClick={() => addItem(si)}>
                                <i className="lni lni-plus"></i> Add Fee Item
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* ── Step 2: Course Unit Allocation — two-panel layout (semesters left, active semester's allocation right) ────────────────────────── */}
        {step === 2 && (() => {
          const si            = activeAcc
          const units         = semUnits[si]
          // A course unit already allocated to ANY semester shouldn't be
          // pickable again in another one — this used to only exclude
          // duplicates within the active semester itself (assignedCodes
          // scoped to `units` alone), so the same unit could silently end up
          // assigned to two or more semesters with nothing to stop it.
          const assignedCodes = semUnits.flatMap(semUnitsForSem => semUnitsForSem.map(u => u.code))
          const availableOpts = courseUnitOptions.filter(o => !assignedCodes.includes(o.code))
          return (
            <>
            {mode !== 'edit' && unitsSubmitted && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 14px', background: 'var(--green-bg)', border: '1.5px solid var(--green-bd)', borderRadius: 'var(--rsm)', fontSize: 12.5, color: 'var(--g700)' }}>
                <i className="lni lni-checkmark-circle" style={{ color: 'var(--green)', fontSize: 16 }}></i>
                Course units already saved for this programme — further changes here won&apos;t be re-submitted. Continue below to Fee Structure.
              </div>
            )}
            <div className="fsm-layout">

              {/* Left sidebar — one entry per semester. No fixed count any
                  more (see resizeSemesters/addSemester/removeSemester) — Add
                  mode sizes off the picked Programme Level's semCount, Edit
                  mode sizes off the real program-course-units semesters, and
                  either can still be adjusted by hand here. */}
              <div className="fsm-sidebar">
                <div style={{ padding: '14px 14px 6px', fontSize: 10.5, fontWeight: 700, color: 'var(--g400)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                  Semesters <span style={{ color: 'var(--b500)' }}>({semUnits.length})</span>
                  {/* Only shown once No. of Course Units (Step 1, optional) has
                      an actual value to check against — see validateStep2. */}
                  {unitCount.trim() && (
                    <span style={{ float: 'right', color: semUnits.reduce((s, u) => s + u.length, 0) === (+unitCount || 0) ? 'var(--green)' : 'var(--red)' }}>
                      {semUnits.reduce((s, u) => s + u.length, 0)}/{unitCount} units
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
                  {semUnits.map((semUnitsForSem, i) => {
                    const totalCredits = semUnitsForSem.reduce((s, u) => s + u.credits, 0)
                    return (
                      <div
                        key={i}
                        onClick={() => { setActiveAcc(i); setExpandedUnitId(null) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '9px 10px', borderRadius: 'var(--rsm)', marginBottom: 2,
                          background: activeAcc === i ? 'var(--b500)' : 'transparent',
                          color: activeAcc === i ? '#fff' : 'var(--g700)',
                          cursor: 'pointer', transition: 'background .15s',
                        }}
                      >
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: activeAcc === i ? 'rgba(255,255,255,.2)' : 'var(--b100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <i className="lni lni-book" style={{ fontSize: 13, color: activeAcc === i ? '#fff' : 'var(--b600)' }}></i>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>{semLabels[i] ?? `Semester ${i + 1}`}</div>
                          <div style={{ fontSize: 11, opacity: .65, lineHeight: 1.3 }}>{semUnitsForSem.length} unit{semUnitsForSem.length !== 1 ? 's' : ''} · {totalCredits} credit{totalCredits !== 1 ? 's' : ''}</div>
                        </div>
                        {semUnits.length > 1 && (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); removeSemester(i) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: activeAcc === i ? 'rgba(255,255,255,.65)' : 'var(--g300)', display: 'flex', alignItems: 'center', borderRadius: 'var(--rxs)', flexShrink: 0 }}
                            title="Remove semester"
                          ><i className="lni lni-trash-can" style={{ fontSize: 12 }}></i></button>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div style={{ borderTop: '1.5px solid var(--g200)', padding: '6px 8px 10px' }}>
                  <button type="button" className="btn btn-neu btn-sm" style={{ width: '100%' }} onClick={addSemester}>
                    <i className="lni lni-plus"></i> Add Semester
                  </button>
                </div>
              </div>

              {/* Right panel — active semester's course units. Specialization is
                  now picked per-unit below (only enabled for units whose Unit
                  Category is "Specialization"), so there's no semester-wide
                  picker here any more. */}
              <div className="fsm-main">
                {step2Error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 14, background: 'var(--red-bg)', border: '1.5px solid var(--red-bd)', borderRadius: 'var(--rsm)', color: 'var(--red)', fontSize: 12.5 }}>
                    <i className="lni lni-warning"></i> {step2Error}
                  </div>
                )}
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--b700)', marginBottom: 10 }}>{semLabels[si] ?? `Semester ${si + 1}`}</div>
                {units.length === 0 && (
                  <div style={{ fontSize: 12.5, color: 'var(--g400)', fontStyle: 'italic', marginBottom: 8 }}>
                    No course units assigned yet
                  </div>
                )}
                {units.length > 0 && (
                  <div className="flex flex-col gap-2" style={{ marginBottom: 10 }}>
                    {units.map((u, ui) => {
                      const isSpecUnit = isSpecializationCategory(u.unitCat)
                      return (
                      <div key={u.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', background: 'var(--white)', border: '1.5px solid var(--g200)', borderRadius: 'var(--rsm)', boxShadow: 'var(--neu-sm)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="badge badge-blue" style={{ flexShrink: 0 }}>Unit {ui + 1}</span>
                          <span className="font-mono font-bold text-b700" style={{ fontSize: 12, minWidth: 50 }}>{u.code}</span>
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--g900)' }}>{u.name}</span>
                          <span className="badge badge-grey">{u.credits} credit{u.credits !== 1 ? 's' : ''}</span>
                          {/* Syllabus/Outline/Taught By — Step 2's "Additional Feature", opened
                              in a popup (see the fixed overlay near the end of this component)
                              rather than expanded inline, so browsing several units' details in a
                              row doesn't keep growing this semester's scroll height. */}
                          <button
                            className="btn btn-neu btn-sm"
                            style={{ width: 26, height: 26, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                            title="Syllabus, outline &amp; taught by"
                            onClick={() => setExpandedUnitId(u.id)}
                          ><i className="lni lni-information" style={{ fontSize: 12 }}></i></button>
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ width: 26, height: 26, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                            onClick={() => removeUnit(si, u.id)}
                          ><i className="lni lni-close" style={{ fontSize: 11 }}></i></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                          <div>
                            <div className="lbl" style={{ fontSize: 11 }}>Unit Type</div>
                            <SearchSelect placeholder="— Unit Type —" value={u.unitType} onChange={val => setUnitField(si, u.id, 'unitType', val)} options={unitTypeOptions} />
                          </div>
                          <div>
                            <div className="lbl" style={{ fontSize: 11 }}>Unit Category</div>
                            <SearchSelect placeholder="— Unit Category —" value={u.unitCat} onChange={val => setUnitField(si, u.id, 'unitCat', val)} options={unitCategoryOptions} />
                          </div>
                          <div>
                            <div className="lbl" style={{ fontSize: 11 }}>Specialization</div>
                            <SearchSelect
                              placeholder={isSpecUnit ? '— Select specialization —' : 'Only for Specialization units'}
                              value={u.streamGuid}
                              onChange={val => setUnitField(si, u.id, 'streamGuid', val)}
                              options={semesterStreamOptions}
                              disabled={!isSpecUnit}
                            />
                          </div>
                        </div>
                      </div>
                      )
                    })}
                  </div>
                )}
                <SearchSelect
                  placeholder="— Select course unit —"
                  value={pendingSel[si]}
                  onChange={val => addUnit(si, val)}
                  options={availableOpts}
                />
              </div>
            </div>
            </>
          )
        })()}

        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <span className="flex-1"></span>
          {step > 1 && (
            <button className="btn btn-neu" onClick={() => setStep(s => s - 1)}>
              <i className="lni lni-arrow-left"></i> Back
            </button>
          )}
          {step < 3 && (
            <button
              className="btn btn-primary"
              disabled={isSaving}
              onClick={() => {
                // Edit mode: pure local validation + advance, same as
                // before — the whole programme is still saved in one shot
                // at Step 3 via updateProgramMasterComplete.
                if (mode === 'edit') {
                  if (step === 1 && !validateStep1()) return
                  if (step === 2 && !validateStep2()) return
                  setStep(s => s + 1)
                  return
                }
                // Add mode: each step's own API call per
                // post-program-master.md / post-program-course-units.md.
                if (step === 1) handleStep1Continue()
                else handleStep2Continue()
              }}
            >
              {isSaving ? 'Saving…' : <>Save &amp; Continue <i className="lni lni-arrow-right"></i></>}
            </button>
          )}
          {step === 3 && (anyCurrencyGaps || anyLedgerGaps) && (
            <span style={{ color: 'var(--red)', fontSize: 12 }}>Select a currency and ledger for every fee item before saving</span>
          )}
          {step === 3 && (
            <button className="btn btn-primary" onClick={handleFinalSubmit} disabled={!allFeeComplete || isSaving}>
              <i className="lni lni-checkmark"></i> {isSaving ? 'Saving…' : `${mode === 'edit' ? 'Update' : 'Save'} Programme`}
            </button>
          )}
        </div>
      </div>

      {/* Syllabus/Outline/Taught By popup — a separate overlay (not an inline
          expand inside the unit card) so paging through several units'
          details in a row doesn't keep growing Step 2's scroll height. Sits
          above .modal-overlay's own z-index (500). */}
      {expandedUnit && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 700, padding: 20 }}
          onClick={() => setExpandedUnitId(null)}
        >
          <div
            style={{ background: 'var(--white)', borderRadius: 'var(--radius)', boxShadow: '0 20px 60px rgba(15, 30, 61, .25)', width: '100%', maxWidth: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1.5px solid var(--g200)', flexShrink: 0 }}>
              <span className="font-mono font-bold text-b700" style={{ fontSize: 12.5 }}>{expandedUnit.code}</span>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--g900)' }}>{expandedUnit.name}</span>
              <button className="modal-close" onClick={() => setExpandedUnitId(null)}><i className="lni lni-close"></i></button>
            </div>
            <div style={{ padding: '16px 18px', overflowY: 'auto' }}>
              {expandedUnitLoading && <div className="text-g400 italic" style={{ fontSize: 12 }}>Loading details…</div>}
              {!expandedUnitLoading && expandedUnitDetail && (() => {
                const taughtBy = Array.from(new Set(
                  expandedUnitDetail.outlines.flatMap(o => o.topics.map(t => t.employeeGuid)).filter(Boolean)
                )).map(employeeName)
                return (
                  <div className="flex flex-col gap-3">
                    <div>
                      <div className="lbl" style={{ fontSize: 11 }}>Syllabus</div>
                      {expandedUnitDetail.syllabus
                        ? <a href={expandedUnitDetail.syllabus} target="_blank" rel="noopener noreferrer" className="btn btn-neu btn-sm" style={{ display: 'inline-flex', fontSize: 11.5 }}><i className="lni lni-download"></i> View Syllabus</a>
                        : <span className="text-g400 italic" style={{ fontSize: 12 }}>No syllabus uploaded</span>
                      }
                    </div>
                    <div>
                      <div className="lbl" style={{ fontSize: 11 }}>Taught By</div>
                      {taughtBy.length > 0
                        ? <div className="flex flex-wrap gap-1">{taughtBy.map((name, i) => <span key={i} className="badge badge-blue">{name}</span>)}</div>
                        : <span className="text-g400 italic" style={{ fontSize: 12 }}>Not assigned yet</span>
                      }
                    </div>
                    <div>
                      <div className="lbl" style={{ fontSize: 11 }}>Outline</div>
                      {expandedUnitDetail.outlines.length === 0
                        ? <span className="text-g400 italic" style={{ fontSize: 12 }}>No chapters added yet</span>
                        : (
                          <div className="flex flex-col gap-2" style={{ marginTop: 4 }}>
                            {expandedUnitDetail.outlines.map(o => (
                              <div key={o.courseUnitOutlineGuid} style={{ background: 'var(--g100)', border: '1px solid var(--g200)', borderRadius: 'var(--rxs)', padding: '8px 10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span className="badge badge-grey" style={{ fontSize: 10.5, padding: '1px 7px', flexShrink: 0 }}>Ch. {o.chapter}</span>
                                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--g900)' }}>{o.chapterName}</span>
                                </div>
                                {o.topics.length > 0 && (
                                  <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {o.topics.map(t => (
                                      <li key={t.courseUnitTopicGuid} style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12, color: 'var(--g500)', lineHeight: 1.4 }}>
                                        <span style={{ color: 'var(--g300)', flexShrink: 0 }}>•</span>
                                        <span>{t.courseUnitTopicDetails}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        )
                      }
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
