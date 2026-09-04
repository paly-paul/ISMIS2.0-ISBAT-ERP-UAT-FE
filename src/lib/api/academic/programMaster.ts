import { apiDelete, apiGet, apiPostForm, apiPutForm } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// One course unit assigned to a semester.
export interface ProgramUnitInput {
  semCode: number
  courseUnitGuid: string
  streamGuid: string
  unitType: string
  unitCat: string
  flag: number
}

// One fee row inside a fee structure. intLedger/intCurrency are kept here
// purely as internal bookkeeping (ProgrammeModal derives them from the
// selected Ledger/Currency for its own display logic) — CONFIRMED via
// SaveComplete.bru that the wire payload itself only ever needs
// ledgerGuid/currencyGuid/semCode/ledgerNum/amount, so appendFeeStructures()
// no longer sends these two at all (they were previously an unconfirmed
// "harmless extra field" guess, now known to not be part of the real
// schema).
export interface FeeLineInput {
  intLedger: number
  ledgerGuid: string
  intCurrency: number
  currencyGuid: string
  semCode: number
  ledgerNum: number
  amount: number
}

// One fee structure sent with the programme payload.
export interface FeeStructureInput {
  feeCode: string
  feeDesc: string
  status: boolean
  localOrForeign: boolean
  lef: number | null
  cef: number | null
  ace: number | null
  lec: number | null
  cec: number | null
  acec: number | null
  calcType: number
  amtPer: number | null
  // Confirmed per program_master_frontend_fixes.md: the create payload was
  // sending an integer IntakeCode (e.g. 20261) — the backend wants the real
  // IntakeGuid instead, same as Update's FeeStructureUpdateInput.intakeGuid
  // already does. Omit the key when there's nothing to send (see the
  // Guid?-must-be-omitted-not-blank convention used elsewhere on this DTO).
  intakeGuid: string | null
  feeLines: FeeLineInput[]
}

// This is the confirmed create payload for the programme form.
export interface ProgramMasterInput {
  programCode: string
  programName: string
  programLevelGuid: string
  pgmStatus: boolean
  noIa: boolean
  programGroupGuid: string
  unitCount: number
  appFee: number
  lateFee: number
  facultyGuid: string
  // Was `currencyCode: number` (Currency.intCurrency) — confirmed per
  // program_master_frontend_fixes.md the backend actually wants the real
  // currencyGuid here too, same "wants the guid, not the int" symptom
  // already confirmed on programLevel.ts's Currency field and Update's own
  // currencyGuid. FeeLines[].IntCurrency is unaffected — that one's a
  // different, still-int-keyed field per FeeLineInput's own comment.
  currencyGuid: string
  // Optional — Accreditation Date has no required marker in Step 1. Omit
  // the key entirely when unset rather than sending "T00:00:00" with no
  // actual date, which the backend was silently accepting as a bogus date.
  dateAcc: string | null
  streamGuid: string
  intakeGuid: string
  programUnits: ProgramUnitInput[]
  feeStructures: FeeStructureInput[]
  accLetterFile?: File | null
}

// Confirmed shape via GET /api/v1/academic/program-master?search= — differs
// from ProgramMasterInput in a few notable ways: streamGuids comes back as an
// array (create only accepts one streamGuid), currency is currencyGuid here
// (nullable — was null in every sample so far, despite create using an
// intCurrency-based currencyCode), and yearCount/semCount are echoed back
// directly rather than needing a programLevel lookup. accLetter/semesters
// shapes aren't confirmed beyond "null" and "[]" respectively.
export interface ProgramMaster {
  programGuid: string
  programCode: string
  programName: string
  pgmStatus: boolean
  noIa: boolean
  programGroupGuid: string
  unitCount: number
  programLevelGuid: string
  yearCount: number
  semCount: number
  facultyGuid: string
  dateAcc: string
  accLetter: string | null
  appFee: number
  lateFee: number
  currencyGuid: string | null
  intakeGuid: string
  streamGuids: string[]
  semesters: unknown[]
}

// Same indexed flat-key convention courseUnit.ts's create/update payloads
// used to send Outlines with, before that moved to a separate endpoint.
// CONFIRMED via the real Save Program Complete backend doc (SaveComplete.bru,
// "Nested arrays use bracket notation: ProgramUnits[n][Field] and
// FeeStructures[n][FeeLines][m][Field]"): Create uses the exact same bracket
// notation as Update, not the dot notation (`ProgramUnits[i].Field`) this
// function used to send. That mismatch is the confirmed root cause of a real
// validation_error ("'Sem Code' must be greater than '0'.", "'Course Unit
// Guid' must not be empty.") on a payload whose SemCode/CourseUnitGuid values
// were genuinely valid — sent under a key shape ASP.NET's model binder
// couldn't match, so both fields silently landed on their zero/empty
// defaults. The doc's field names are also UnitTypeGuid/UnitCatGuid (not
// UnitType/UnitCat as this used to send) — matches what Update's own
// appendProgramUnitsForUpdate already used, so Create was simply out of sync
// with Update on both notation and naming, not a genuinely different
// contract as previously assumed.
function appendProgramUnits(formData: FormData, units: ProgramUnitInput[]) {
  units.forEach((u, i) => {
    formData.append(`ProgramUnits[${i}][SemCode]`, String(u.semCode))
    formData.append(`ProgramUnits[${i}][CourseUnitGuid]`, u.courseUnitGuid)
    // Specialization is optional now (Program_Master_Change_Requests_Final.md),
    // so streamGuid can legitimately be empty for a non-Specialization unit
    // with no top-level pick to fall back to either. Confirmed with the
    // backend team: the form binder tries to parse whatever's in this key as
    // a Guid, so both an empty string AND the literal string "null" fail to
    // bind — omitting the key entirely is the only way a Guid? property ends
    // up bound to null the way it's meant to. The .bru example showing a
    // blank-but-present key was misleading here, not a confirmed contract.
    if (u.streamGuid) formData.append(`ProgramUnits[${i}][StreamGuid]`, u.streamGuid)
    // Unit Type/Category are optional in Step 2's UI (no required marker) and
    // GetFullDetails confirms a real unit can come back with both null, so
    // the write side has to tolerate the same — same "empty string AND the
    // literal 'null' both fail the Guid? binder, omit the key entirely"
    // finding as StreamGuid just above.
    if (u.unitType) formData.append(`ProgramUnits[${i}][UnitTypeGuid]`, u.unitType)
    if (u.unitCat) formData.append(`ProgramUnits[${i}][UnitCatGuid]`, u.unitCat)
    // Confirmed via SaveComplete.bru's docs: "Flag (1=Core, 2=Elective)" —
    // NOT the constant 1 this used to send regardless of the unit's actual
    // category. The doc doesn't say what a "Specialization"-category unit
    // should send though (only Core/Elective are defined), so that case is
    // deliberately left as the same "1" default rather than guessing 2 —
    // flag this for confirmation with the backend team if Specialization
    // units need their own value.
    formData.append(`ProgramUnits[${i}][Flag]`, String(u.flag))
  })
}

function appendFeeStructures(formData: FormData, structures: FeeStructureInput[]) {
  structures.forEach((s, i) => {
    formData.append(`FeeStructures[${i}][FeeCode]`, s.feeCode)
    formData.append(`FeeStructures[${i}][FeeDesc]`, s.feeDesc)
    formData.append(`FeeStructures[${i}][Status]`, String(s.status))
    formData.append(`FeeStructures[${i}][LocalOrForeign]`, String(s.localOrForeign))
    if (s.lef !== null) formData.append(`FeeStructures[${i}][Lef]`, String(s.lef))
    if (s.cef !== null) formData.append(`FeeStructures[${i}][Cef]`, String(s.cef))
    if (s.ace !== null) formData.append(`FeeStructures[${i}][Ace]`, String(s.ace))
    if (s.lec !== null) formData.append(`FeeStructures[${i}][Lec]`, String(s.lec))
    if (s.cec !== null) formData.append(`FeeStructures[${i}][Cec]`, String(s.cec))
    if (s.acec !== null) formData.append(`FeeStructures[${i}][Acec]`, String(s.acec))
    formData.append(`FeeStructures[${i}][CalcType]`, String(s.calcType))
    if (s.amtPer !== null) formData.append(`FeeStructures[${i}][AmtPer]`, String(s.amtPer))
    if (s.intakeGuid) formData.append(`FeeStructures[${i}][IntakeGuid]`, s.intakeGuid)
    // Confirmed via the same doc: FeeLines only has SemCode/LedgerGuid/
    // CurrencyGuid/LedgerNum/Amount — no IntLedger/IntCurrency at all. Those
    // two were only ever a "harmless extra field, unconfirmed" guess (see
    // FeeLineInput's own comment) — dropped now that the real schema is
    // confirmed not to include them.
    s.feeLines.forEach((l, j) => {
      formData.append(`FeeStructures[${i}][FeeLines][${j}][SemCode]`, String(l.semCode))
      formData.append(`FeeStructures[${i}][FeeLines][${j}][LedgerGuid]`, l.ledgerGuid)
      formData.append(`FeeStructures[${i}][FeeLines][${j}][CurrencyGuid]`, l.currencyGuid)
      formData.append(`FeeStructures[${i}][FeeLines][${j}][LedgerNum]`, String(l.ledgerNum))
      formData.append(`FeeStructures[${i}][FeeLines][${j}][Amount]`, String(l.amount))
    })
  })
}

let mockProgramSeq = 1

// In-memory list used while mock auth is enabled, so the now-real list query
// (getProgramMasters) has something to show after a mock create.
const mockProgramMasters: ProgramMaster[] = []

export function createProgramMaster(input: ProgramMasterInput): Promise<ProgramMaster> {
  if (MOCK_AUTH) {
    const program: ProgramMaster = {
      programGuid: String(mockProgramSeq++),
      programCode: input.programCode,
      programName: input.programName,
      pgmStatus: input.pgmStatus,
      noIa: input.noIa,
      programGroupGuid: input.programGroupGuid,
      unitCount: input.unitCount,
      programLevelGuid: input.programLevelGuid,
      yearCount: 0,
      semCount: 0,
      facultyGuid: input.facultyGuid,
      dateAcc: input.dateAcc ?? '',
      accLetter: null,
      appFee: input.appFee,
      lateFee: input.lateFee,
      currencyGuid: input.currencyGuid || null,
      intakeGuid: input.intakeGuid,
      streamGuids: [input.streamGuid],
      semesters: [],
    }
    mockProgramMasters.push(program)
    return Promise.resolve(program)
  }

  const formData = new FormData()
  formData.append('programCode', input.programCode)
  formData.append('programName', input.programName)
  formData.append('programLevelGuid', input.programLevelGuid)
  formData.append('pgmStatus', String(input.pgmStatus))
  formData.append('noIa', String(input.noIa))
  formData.append('programGroupGuid', input.programGroupGuid)
  formData.append('unitCount', String(input.unitCount))
  formData.append('appFee', String(input.appFee))
  formData.append('lateFee', String(input.lateFee))
  formData.append('facultyGuid', input.facultyGuid)
  formData.append('currencyGuid', input.currencyGuid)
  // Accreditation Date is optional (no required marker in Step 1) —
  // confirmed per program_master_frontend_fixes.md that sending "T00:00:00"
  // with no actual date picked was a real bug, not a harmless placeholder.
  // DateAcc is nullable on the backend, so omitting the key entirely when
  // unset is safe — same "omit rather than send a bogus value" convention
  // as streamGuid/intakeGuid below.
  if (input.dateAcc) formData.append('dateAcc', input.dateAcc)
  // Specialization is optional now — this can legitimately be empty. Omit
  // the key rather than send an empty string (see the note on
  // ProgramUnits[].StreamGuid above — confirmed with the backend team).
  if (input.streamGuid) formData.append('streamGuid', input.streamGuid)
  // intakeGuid is meant to always be auto-filled from the Current Academic
  // Intake before this ever fires, but guard the same way in case that
  // hasn't resolved yet — an omitted key fails as a clear "required field
  // missing" rather than a Guid-parse exception on an empty string.
  if (input.intakeGuid) formData.append('intakeGuid', input.intakeGuid)
  appendProgramUnits(formData, input.programUnits)
  appendFeeStructures(formData, input.feeStructures)
  if (input.accLetterFile) formData.append('accLetterFile', input.accLetterFile)
  return apiPostForm<ProgramMaster>('/api/v1/academic/program-master/save-complete', formData)
}

// --- Plain create (Step 1 of the 3-call save-and-continue flow) ----------
// See post-program-master.md — a genuinely different endpoint from
// createProgramMaster/save-complete above, not a variant of it: this one
// creates ONLY the programme record (no ProgramUnits/FeeStructures in the
// payload at all) and hands back the server-generated semesters[], each
// carrying a real semesterGuid the caller then threads into
// POST /program-course-units (Step 2) and
// POST /Programfee-structure/hd/save-complete (Step 3). Used by
// ProgrammeModal's Add-mode wizard, one call per Save & Continue click,
// instead of the single combined save-complete call above (which is still
// what Edit mode's update-complete flow uses).
export type ProgramMasterCreateInput = Omit<ProgramMasterInput, 'programUnits' | 'feeStructures'>

// The doc's own example response for this endpoint only shows
// { semCode, semName } on each semester, but its prose is explicit that
// "semesterGuid values from the response are required for subsequent
// course-unit and fee-structure creation" — treated as a doc/example
// mismatch rather than semesterGuid genuinely being absent, since Step 2/3
// have no other way to know these guids. Flag this if a real response ever
// comes back without it.
export interface ProgramMasterSemester {
  semesterGuid: string
  semCode: number
  semName: string
}

export interface ProgramMasterCreated extends Omit<ProgramMaster, 'semesters'> {
  semesters: ProgramMasterSemester[]
}

export function createProgramMasterStep1(input: ProgramMasterCreateInput): Promise<ProgramMasterCreated> {
  if (MOCK_AUTH) {
    // Mock has no program-level lookup available at this layer to size
    // semesters realistically — two generically-named semesters is enough
    // to exercise Step 2/3's semesterGuid plumbing in local/offline work,
    // same "close enough for a UI prototype" convention as mockIntakes etc.
    const program: ProgramMasterCreated = {
      programGuid: String(mockProgramSeq++),
      programCode: input.programCode,
      programName: input.programName,
      pgmStatus: input.pgmStatus,
      noIa: input.noIa,
      programGroupGuid: input.programGroupGuid,
      unitCount: input.unitCount,
      programLevelGuid: input.programLevelGuid,
      yearCount: 0,
      semCount: 2,
      facultyGuid: input.facultyGuid,
      dateAcc: input.dateAcc ?? '',
      accLetter: null,
      appFee: input.appFee,
      lateFee: input.lateFee,
      currencyGuid: input.currencyGuid || null,
      intakeGuid: input.intakeGuid,
      streamGuids: [input.streamGuid],
      semesters: [
        { semesterGuid: `mock-sem-${mockProgramSeq}-1`, semCode: 1, semName: 'Year One - Semester One' },
        { semesterGuid: `mock-sem-${mockProgramSeq}-2`, semCode: 2, semName: 'Year One - Semester Two' },
      ],
    }
    mockProgramMasters.push({ ...program, semesters: [] })
    return Promise.resolve(program)
  }

  const formData = new FormData()
  formData.append('programCode', input.programCode)
  formData.append('programName', input.programName)
  formData.append('programLevelGuid', input.programLevelGuid)
  formData.append('pgmStatus', String(input.pgmStatus))
  formData.append('noIa', String(input.noIa))
  formData.append('programGroupGuid', input.programGroupGuid)
  formData.append('unitCount', String(input.unitCount))
  formData.append('appFee', String(input.appFee))
  formData.append('lateFee', String(input.lateFee))
  formData.append('facultyGuid', input.facultyGuid)
  formData.append('currencyGuid', input.currencyGuid)
  // Same "omit rather than send a bogus/empty value" conventions as
  // createProgramMaster above — see its comments on these same fields.
  if (input.dateAcc) formData.append('dateAcc', input.dateAcc)
  if (input.streamGuid) formData.append('streamGuid', input.streamGuid)
  if (input.intakeGuid) formData.append('intakeGuid', input.intakeGuid)
  if (input.accLetterFile) formData.append('accLetterFile', input.accLetterFile)
  return apiPostForm<ProgramMasterCreated>('/api/v1/academic/program-master', formData)
}

// List query for the programme-master table.
export function getProgramMasters(search = ''): Promise<ProgramMaster[]> {
  if (MOCK_AUTH) return Promise.resolve(mockProgramMasters)
  return apiGet<any>(`/api/v1/academic/program-master?search=${encodeURIComponent(search)}`)
    .then(data => {
      if (Array.isArray(data)) return data
      if (data && Array.isArray(data.items)) return data.items
      if (data && Array.isArray(data.data)) return data.data
      return []
    })
}

// GET /api/v1/academic/program-master/by-campus/:campusGuid — per
// Application_Payment_Change_Requests_Final_Updated.md #7, backs the
// Application Payment page's Interested Programme dropdown, scoped to the
// selected Campus instead of the full unfiltered programme list. Response
// shape assumed identical to the plain list (same ProgramMaster type, same
// controller family) — unconfirmed against a real sample, same "reasonable
// best-effort until seen live" convention as the rest of this app's
// not-yet-verified endpoints.
export function getProgramMastersByCampus(campusGuid: string): Promise<ProgramMaster[]> {
  if (MOCK_AUTH) return Promise.resolve(mockProgramMasters)
  return apiGet<ProgramMaster[] | null>(`/api/v1/academic/program-master/by-campus/${campusGuid}`)
    .then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

// --- Full details / Update / Delete ---------------------------------------
// Confirmed via Program-Master/GetFullDetails.bru — full course-unit and
// fee-structure breakdown for one programme, used to prefill the Edit
// modal's 3 steps before an update-complete call (which fully replaces
// both collections, so editing without this would silently wipe them).
export interface ProgramUnitDetail {
  semCode: number
  courseUnitGuid: string
  courseUnitCode: string
  courseUnitName: string
  streamGuid: string | null
  streamName: string | null
  // Confirmed nullable via a real response — a course unit that hasn't had
  // its Unit Type/Category picked yet (still possible post-save, since
  // Step 2's per-unit pickers aren't required) comes back with both null.
  unitTypeGuid: string | null
  unitTypeName: string | null
  unitCatGuid: string | null
  unitCatName: string | null
  flag: number
}

// One semester on the programme, confirmed via a real full-details response
// — covers EVERY semester the programme has (semCount total), including
// ones with zero course units assigned yet. This is what actually tells you
// how many semesters a programme has and what each is called; programUnits[]
// only ever lists semesters that already have at least one unit on them, so
// deriving the count from programUnits alone silently undercounts empty
// semesters (see the note on ProgrammeModal's fullDetails effect).
export interface ProgramSemesterDetail {
  semCode: number
  semName: string
}

export interface FeeLineDetail {
  semCode: number
  ledgerGuid: string
  currencyGuid: string
  ledgerNum: number
  amount: number
}

export interface FeeStructureDetail {
  feeHdGuid: string
  feeCode: string
  feeDesc: string
  status: boolean
  localOrForeign: boolean
  intakeGuid: string | null
  calcType: number
  amtPer: number | null
  lef: number | null
  cef: number | null
  lec: number | null
  cec: number | null
  ace: number | null
  acec: number | null
  feeLines: FeeLineDetail[]
}

export interface ProgramMasterFullDetails {
  programGuid: string
  programCode: string
  programName: string
  pgmStatus: boolean
  noIa: boolean
  programGroupGuid: string
  unitCount: number
  programLevelGuid: string
  yearCount: number
  semCount: number
  facultyGuid: string
  dateAcc: string
  accLetter: string | null
  appFee: number
  lateFee: number
  intakeGuid: string | null
  streamGuids: string[]
  semesters: ProgramSemesterDetail[]
  programUnits: ProgramUnitDetail[]
  feeStructures: FeeStructureDetail[]
}

export function getProgramMasterFullDetails(programGuid: string): Promise<ProgramMasterFullDetails> {
  if (MOCK_AUTH) {
    const existing = mockProgramMasters.find(p => p.programGuid === programGuid)
    if (!existing) return Promise.reject(new Error('Programme not found'))
    return Promise.resolve({ ...existing, streamGuids: existing.streamGuids, semesters: [], programUnits: [], feeStructures: [] })
  }
  return apiGet<ProgramMasterFullDetails>(`/api/v1/academic/program-master/${programGuid}/full-details`)
}

// One course unit assigned to a semester, for update-complete — same guids
// as ProgramUnitInput, just under UnitTypeGuid/UnitCatGuid keys instead of
// UnitType/UnitCat (see appendProgramUnitsForUpdate below).
export interface ProgramUnitUpdateInput {
  semCode: number
  courseUnitGuid: string
  streamGuid: string
  unitTypeGuid: string
  unitCatGuid: string
  flag: number
}

// Confirmed via UpdateComplete.bru: CurrencyGuid (a real guid) replaces
// Create's IntLedger+IntCurrency pair.
export interface FeeLineUpdateInput {
  semCode: number
  ledgerGuid: string
  currencyGuid: string
  ledgerNum: number
  amount: number
}

// Confirmed via UpdateComplete.bru: IntakeGuid (a real guid) replaces
// Create's IntakeCode (a number). Lec/Cec/Acec are NOT confirmed to have
// switched to guids the way CurrencyGuid/IntakeGuid did — the docs list
// them under the same short names with no "Guid" suffix, unlike the fields
// that did change — so they're treated as still intCurrency-based here,
// same as Create, until a real response proves otherwise.
export interface FeeStructureUpdateInput {
  feeCode: string
  feeDesc: string
  status: boolean
  localOrForeign: boolean
  lef: number | null
  cef: number | null
  ace: number | null
  lec: number | null
  cec: number | null
  acec: number | null
  calcType: number
  amtPer: number | null
  intakeGuid: string | null
  feeLines: FeeLineUpdateInput[]
}

// Confirmed via UpdateComplete.bru — deliberately a separate interface from
// ProgramMasterInput rather than a variant of it: several fields genuinely
// differ in kind (currencyGuid vs currencyCode), not just name.
export interface ProgramMasterUpdateInput {
  programCode: string
  programName: string
  programLevelGuid: string
  pgmStatus: boolean
  noIa: boolean
  programGroupGuid: string
  unitCount: number
  appFee: number
  lateFee: number
  facultyGuid: string
  currencyGuid: string
  // Optional, same as Create's — see the note on ProgramMasterInput.dateAcc.
  dateAcc: string | null
  streamGuid: string
  intakeGuid: string
  programUnits: ProgramUnitUpdateInput[]
  feeStructures: FeeStructureUpdateInput[]
  accLetterFile?: File | null
}

// Bracket notation (ProgramUnits[i][Field]) — confirmed via UpdateComplete.bru,
// genuinely different from Create's dot notation (appendProgramUnits above).
function appendProgramUnitsForUpdate(formData: FormData, units: ProgramUnitUpdateInput[]) {
  units.forEach((u, i) => {
    formData.append(`ProgramUnits[${i}][SemCode]`, String(u.semCode))
    formData.append(`ProgramUnits[${i}][CourseUnitGuid]`, u.courseUnitGuid)
    // Same reasoning as Create's appendProgramUnits above — Specialization is
    // optional now, so this can legitimately be empty. Confirmed with the
    // backend team: the form binder tries to parse whatever's in this key as
    // a Guid, so both an empty string and the literal string "null" fail to
    // bind — omit the key entirely so the Guid? property binds to null.
    if (u.streamGuid) formData.append(`ProgramUnits[${i}][StreamGuid]`, u.streamGuid)
    // Same fix as Create's appendProgramUnits above, and the actual root
    // cause of a real "400 with no usable error code" report: Unit Type/
    // Category have no required marker in Step 2's UI, so these can
    // legitimately be empty — sending them as "" hit the same Guid?-binder
    // failure StreamGuid was already fixed for, except this one produces a
    // raw framework validation response with no `code` field for
    // client.ts's envelope parsing to surface, so it fell back to "unknown"
    // instead of a real error.
    if (u.unitTypeGuid) formData.append(`ProgramUnits[${i}][UnitTypeGuid]`, u.unitTypeGuid)
    if (u.unitCatGuid) formData.append(`ProgramUnits[${i}][UnitCatGuid]`, u.unitCatGuid)
    formData.append(`ProgramUnits[${i}][Flag]`, String(u.flag))
  })
}

function appendFeeStructuresForUpdate(formData: FormData, structures: FeeStructureUpdateInput[]) {
  structures.forEach((s, i) => {
    formData.append(`FeeStructures[${i}][FeeCode]`, s.feeCode)
    formData.append(`FeeStructures[${i}][FeeDesc]`, s.feeDesc)
    formData.append(`FeeStructures[${i}][Status]`, String(s.status))
    formData.append(`FeeStructures[${i}][LocalOrForeign]`, String(s.localOrForeign))
    if (s.lef !== null) formData.append(`FeeStructures[${i}][Lef]`, String(s.lef))
    if (s.cef !== null) formData.append(`FeeStructures[${i}][Cef]`, String(s.cef))
    if (s.ace !== null) formData.append(`FeeStructures[${i}][Ace]`, String(s.ace))
    if (s.lec !== null) formData.append(`FeeStructures[${i}][Lec]`, String(s.lec))
    if (s.cec !== null) formData.append(`FeeStructures[${i}][Cec]`, String(s.cec))
    if (s.acec !== null) formData.append(`FeeStructures[${i}][Acec]`, String(s.acec))
    formData.append(`FeeStructures[${i}][CalcType]`, String(s.calcType))
    if (s.amtPer !== null) formData.append(`FeeStructures[${i}][AmtPer]`, String(s.amtPer))
    if (s.intakeGuid) formData.append(`FeeStructures[${i}][IntakeGuid]`, s.intakeGuid)
    s.feeLines.forEach((l, j) => {
      formData.append(`FeeStructures[${i}][FeeLines][${j}][SemCode]`, String(l.semCode))
      formData.append(`FeeStructures[${i}][FeeLines][${j}][LedgerGuid]`, l.ledgerGuid)
      formData.append(`FeeStructures[${i}][FeeLines][${j}][CurrencyGuid]`, l.currencyGuid)
      formData.append(`FeeStructures[${i}][FeeLines][${j}][LedgerNum]`, String(l.ledgerNum))
      formData.append(`FeeStructures[${i}][FeeLines][${j}][Amount]`, String(l.amount))
    })
  })
}

export function updateProgramMasterComplete(programGuid: string, input: ProgramMasterUpdateInput): Promise<ProgramMaster> {
  if (MOCK_AUTH) {
    const existing = mockProgramMasters.find(p => p.programGuid === programGuid)
    if (!existing) return Promise.reject(new Error('Programme not found'))
    Object.assign(existing, {
      programCode: input.programCode,
      programName: input.programName,
      pgmStatus: input.pgmStatus,
      noIa: input.noIa,
      programGroupGuid: input.programGroupGuid,
      unitCount: input.unitCount,
      appFee: input.appFee,
      lateFee: input.lateFee,
      programLevelGuid: input.programLevelGuid,
      facultyGuid: input.facultyGuid,
      currencyGuid: input.currencyGuid,
      dateAcc: input.dateAcc ?? existing.dateAcc,
      streamGuids: [input.streamGuid],
      intakeGuid: input.intakeGuid,
    })
    return Promise.resolve(existing)
  }

  const formData = new FormData()
  formData.append('programCode', input.programCode)
  formData.append('programName', input.programName)
  formData.append('pgmStatus', String(input.pgmStatus))
  formData.append('noIa', String(input.noIa))
  formData.append('programGroupGuid', input.programGroupGuid)
  formData.append('unitCount', String(input.unitCount))
  formData.append('appFee', String(input.appFee))
  formData.append('lateFee', String(input.lateFee))
  formData.append('programLevelGuid', input.programLevelGuid)
  formData.append('facultyGuid', input.facultyGuid)
  formData.append('currencyGuid', input.currencyGuid)
  // Same "omit rather than send a bogus date" fix as Create — see the note
  // on ProgramMasterInput.dateAcc.
  if (input.dateAcc) formData.append('dateAcc', input.dateAcc)
  // Specialization is optional now — this can legitimately be empty. Omit
  // the key rather than send an empty string (see the note on
  // ProgramUnits[].StreamGuid above — confirmed with the backend team).
  if (input.streamGuid) formData.append('streamGuid', input.streamGuid)
  // Same guard as Create — intakeGuid should always be auto-filled by this
  // point, but omit rather than send empty if it somehow isn't.
  if (input.intakeGuid) formData.append('intakeGuid', input.intakeGuid)
  appendProgramUnitsForUpdate(formData, input.programUnits)
  appendFeeStructuresForUpdate(formData, input.feeStructures)
  if (input.accLetterFile) formData.append('accLetterFile', input.accLetterFile)
  return apiPutForm<ProgramMaster>(`/api/v1/academic/program-master/${programGuid}/update-complete`, formData)
}

// Soft-deletes the programme plus all its course units/fee data in one call.
export function deleteProgramMasterComplete(programGuid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockProgramMasters.findIndex(p => p.programGuid === programGuid)
    if (index === -1) return Promise.reject(new Error('Programme not found'))
    mockProgramMasters.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/academic/program-master/${programGuid}/delete-complete`)
}
