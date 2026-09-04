import { apiDelete, apiGet, apiPostForm, apiPutForm } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export interface CourseUnitTopic {
  courseUnitTopicGuid: string
  courseUnitTopicCode: string
  courseUnitTopicDetails: string
  studySequence: number
  // The API uses different names for this field in different requests.
  employeeGuid: string
}

export interface CourseUnitOutline {
  courseUnitOutlineGuid: string
  courseUnitGuid: string
  chapter: number
  chapterName: string
  topics: CourseUnitTopic[]
}

// This matches the real API shape for course units.
export interface CourseUnit {
  courseUnitGuid: string
  courseUnitCode: string
  courseUnitName: string
  maxCredits: number
  chapterCount: number
  courseUnitRepetitionGuid: string | null
  mid: number
  cw: number
  ca: number
  syllabus: string | null
  outlines: CourseUnitOutline[]
}

export interface CourseUnitListResponse {
  items: CourseUnit[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// Backing store used only when NEXT_PUBLIC_AUTH_MOCK is on — reuses the two
// confirmed real sample records from the GET response.
const mockCourseUnits: CourseUnit[] = [
  {
    courseUnitGuid: '8ff9b8a2-144e-41c1-b4c4-002b954ef0d8',
    courseUnitCode: 'CS1012',
    courseUnitName: 'Introduction to Programming',
    maxCredits: 3,
    chapterCount: 3,
    courseUnitRepetitionGuid: '1',
    mid: 1,
    cw: 1,
    ca: 0,
    syllabus: 'http://host.docker.internal:5200/api/v1/local-files/academic/courseunit/2026/07/0a11b425447b4d57a91c50f24840439c.md',
    outlines: [
      {
        courseUnitOutlineGuid: '9ae7f67a-932a-4edf-9f26-2e2b52b80227',
        courseUnitGuid: '8ff9b8a2-144e-41c1-b4c4-002b954ef0d8',
        chapter: 1,
        chapterName: 'Basics of Programming',
        topics: [
          { courseUnitTopicGuid: '282f843c-4f55-43fd-811d-ef1ce58552b4', courseUnitTopicCode: 'CS1012_1', courseUnitTopicDetails: 'Variables and Data Types', studySequence: 1, employeeGuid: '5' },
          { courseUnitTopicGuid: '0a5a1d5f-42bc-4fe2-ad62-f4597d8b548f', courseUnitTopicCode: 'CS1012_2', courseUnitTopicDetails: 'Operators and Expressions', studySequence: 2, employeeGuid: '5' },
        ],
      },
      {
        courseUnitOutlineGuid: '7d0aa3a4-a801-47db-baee-771219db3001',
        courseUnitGuid: '8ff9b8a2-144e-41c1-b4c4-002b954ef0d8',
        chapter: 2,
        chapterName: 'Control Structures',
        topics: [
          { courseUnitTopicGuid: '32955c9f-e3b1-4f15-a27d-b1c2ffd3be8f', courseUnitTopicCode: 'CS1012_3', courseUnitTopicDetails: 'Loops and Conditionals', studySequence: 1, employeeGuid: '5' },
        ],
      },
      {
        courseUnitOutlineGuid: 'f4db9dbc-5597-44c1-a1a2-1f46042087ef',
        courseUnitGuid: '8ff9b8a2-144e-41c1-b4c4-002b954ef0d8',
        chapter: 3,
        chapterName: 'Functions and Modularity',
        topics: [
          { courseUnitTopicGuid: 'b7569cb1-669e-4738-b156-bf6fbfa88ec3', courseUnitTopicCode: 'CS1012_4', courseUnitTopicDetails: 'Function Declaration and Scope', studySequence: 1, employeeGuid: '6' },
        ],
      },
    ],
  },
  {
    courseUnitGuid: '4d74c802-679f-48bc-8c64-3e427017da76',
    courseUnitCode: 'CS101',
    courseUnitName: 'Introduction to Programming',
    maxCredits: 3,
    chapterCount: 3,
    courseUnitRepetitionGuid: '1',
    mid: 1,
    cw: 1,
    ca: 0,
    syllabus: null,
    outlines: [
      {
        courseUnitOutlineGuid: '8d7c89ab-8451-46cc-90a9-8fa0d9bb0f1c',
        courseUnitGuid: '4d74c802-679f-48bc-8c64-3e427017da76',
        chapter: 1,
        chapterName: 'Basics of Programming',
        topics: [
          { courseUnitTopicGuid: '87df8261-5528-43ac-9de3-615372ee0c7d', courseUnitTopicCode: 'CS101_1', courseUnitTopicDetails: 'Variables and Data Types', studySequence: 1, employeeGuid: '5' },
          { courseUnitTopicGuid: 'c586134e-1f49-4539-a296-37b726e28e90', courseUnitTopicCode: 'CS101_2', courseUnitTopicDetails: 'Operators and Expressions', studySequence: 2, employeeGuid: '5' },
        ],
      },
      {
        courseUnitOutlineGuid: '724ec531-1cf7-44b1-8062-283c8c71a8b5',
        courseUnitGuid: '4d74c802-679f-48bc-8c64-3e427017da76',
        chapter: 2,
        chapterName: 'Control Structures',
        topics: [
          { courseUnitTopicGuid: '748bab9e-9071-4d65-a719-27f0e7372d4c', courseUnitTopicCode: 'CS101_3', courseUnitTopicDetails: 'Loops and Conditionals', studySequence: 1, employeeGuid: '5' },
        ],
      },
      {
        courseUnitOutlineGuid: '4a724ff1-89e4-487c-9815-493e941cb3ca',
        courseUnitGuid: '4d74c802-679f-48bc-8c64-3e427017da76',
        chapter: 3,
        chapterName: 'Functions and Modularity',
        topics: [
          { courseUnitTopicGuid: '725c313f-0bf5-4d33-9353-804dc0674d97', courseUnitTopicCode: 'CS101_4', courseUnitTopicDetails: 'Function Declaration and Scope', studySequence: 1, employeeGuid: '6' },
        ],
      },
    ],
  },
]

// Real server-side pagination — returns the full envelope (items + totalCount)
// instead of just items, so callers can page 10-at-a-time instead of eagerly
// fetching everything up front (the old default here was pageSize=1000,
// fetched once; that made the initial page load noticeably slower than it
// needs to be for a table that only ever shows 10 rows at a time).
// search is a real server-side filter (see get-courseunits.md: "optionally
// filtered by a free-text search term", "No max page size or bound enforced
// server-side") — NOT just a client-side convenience. Searching should
// always go through this, not a capped "fetch everything, filter locally"
// list — a real dataset can run into the thousands of rows, well past any
// reasonable client-side page-size cap.
export function getCourseUnits(pageNumber = 1, pageSize = 10, search = ''): Promise<CourseUnitListResponse> {
  if (MOCK_AUTH) {
    const items = search.trim()
      ? mockCourseUnits.filter(u => `${u.courseUnitCode} ${u.courseUnitName}`.toLowerCase().includes(search.trim().toLowerCase()))
      : mockCourseUnits
    return Promise.resolve({ items, totalCount: items.length, pageNumber, pageSize })
  }
  const params = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) })
  if (search.trim()) params.set('search', search.trim())
  return apiGet<CourseUnitListResponse | null>(`/api/v1/academic/courseunits?${params.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber, pageSize })
}

// CONFIRMED per post-courseunit.md / put-courseunit.md: outlines are NOT
// part of either the create or update request at all — they're written
// separately via PUT /courseunit-outlines/by-courseunit/{courseUnitGuid}
// (see courseUnitOutlines.ts / useUpsertCourseUnitOutlines). createCourseUnit/
// updateCourseUnit below are deliberately unit-details-only now, with no
// internal chaining to that endpoint — CourseUnitModal/EditCourseUnitModal
// call useUpsertCourseUnitOutlines themselves, from Step 2's own save,
// building UpsertCourseUnitOutlineInput[] directly.
//
// This used to be chained internally (create skipped the call when
// outlines was empty; update never did, since an empty array is
// legitimately "the user cleared every chapter" there) — but that made it
// unsafe to call updateCourseUnit from Step 1's Save & Continue: at that
// point Step 2 hasn't been visited yet, so firing the chain there risked
// wiping real chapters depending on exactly what was passed. Splitting the
// two calls apart removes that hazard entirely — Step 1 can never touch
// outlines, no matter when it's called.
//
// Confirmed create/update payload — sent as multipart/form-data since
// syllabus is an optional file. courseUnitRepetitionGuid (RepetitionTag.
// courseUnitRepetitionGuid) is optional — omitted/null when no tag is
// picked. cwWeightage/cbtWeightage/ueWeightage are the "Final Wt." marks
// from the Assessment Weightage section.
export interface CourseUnitInput {
  courseUnitCode: string
  courseUnitName: string
  maxCredits: number
  chapterCount: number
  courseUnitRepetitionGuid: string | null
  mid: number
  cw: number
  ca: number
  // Nullable per put-courseunit.md's own request table ("Approved | enum?
  // (Disabled=0, Enabled=1)") — a course unit that's never had this
  // explicitly set comes back null. Omitted from the wire entirely when
  // null (see the formData.append below) rather than sent as the literal
  // string "null", which is what String(null) produces and what a .NET
  // enum?/int? binder can't parse — confirmed the cause of a real 400 with
  // no response body.
  approved: number | null
  cbtWeightage: number
  cwWeightage: number
  ueWeightage: number
  syllabus?: File | null
}

let mockCourseUnitSeq = mockCourseUnits.length + 1

export async function createCourseUnit(input: CourseUnitInput): Promise<CourseUnit> {
  if (MOCK_AUTH) {
    const guid = String(mockCourseUnitSeq++)
    const unit: CourseUnit = {
      courseUnitGuid: guid,
      courseUnitCode: input.courseUnitCode,
      courseUnitName: input.courseUnitName,
      maxCredits: input.maxCredits,
      chapterCount: input.chapterCount,
      courseUnitRepetitionGuid: input.courseUnitRepetitionGuid,
      mid: input.mid,
      cw: input.cw,
      ca: input.ca,
      // Real syllabus value is a server-hosted URL once uploaded — no local
      // file host to resolve one against in mock mode.
      syllabus: input.syllabus ? input.syllabus.name : null,
      // Outlines are created empty — same as the real endpoint, they're
      // written separately via the outlines upsert call.
      outlines: [],
    }
    mockCourseUnits.push(unit)
    return Promise.resolve(unit)
  }

  const formData = new FormData()
  formData.append('courseUnitCode', input.courseUnitCode)
  formData.append('courseUnitName', input.courseUnitName)
  formData.append('maxCredits', String(input.maxCredits))
  formData.append('chapterCount', String(input.chapterCount))
  if (input.courseUnitRepetitionGuid) formData.append('courseUnitRepetitionGuid', input.courseUnitRepetitionGuid)
  formData.append('mid', String(input.mid))
  formData.append('cw', String(input.cw))
  formData.append('ca', String(input.ca))
  // Omit rather than send the literal string "null" — see the
  // CourseUnitInput.approved comment above.
  if (input.approved != null) formData.append('approved', String(input.approved))
  formData.append('cbtWeightage', String(input.cbtWeightage))
  formData.append('cwWeightage', String(input.cwWeightage))
  formData.append('ueWeightage', String(input.ueWeightage))
  if (input.syllabus) formData.append('syllabus', input.syllabus)
  return apiPostForm<CourseUnit>('/api/v1/academic/courseunits', formData)
}

// CONFIRMED per get-courseunit-by-guid.md: this plain endpoint does NOT
// include outlines ("Does not include outlines — use GET
// /courseunits/{guid}/details for that") — despite the old comment here
// claiming otherwise. Kept only for the one caller that genuinely needs
// nothing but a fresh syllabus URL (page.tsx's/EditCourseUnitModal's
// handleSyllabus — see their own comments on why a fresh fetch matters
// there); View/Edit and anything wanting the outline should use
// getCourseUnitWithDetails below instead.
export function getCourseUnitById(guid: string): Promise<CourseUnit> {
  if (MOCK_AUTH) {
    const existing = mockCourseUnits.find(u => u.courseUnitGuid === guid)
    if (!existing) return Promise.reject(new Error('Course unit not found'))
    return Promise.resolve(existing)
  }
  return apiGet<CourseUnit>(`/api/v1/academic/courseunits/${guid}`)
}

// --- Full details (course unit + real outlines) ---------------------------
// See get-courseunit-details-by-guid.md — composes GET /courseunits/{guid}
// and GET /courseunit-outlines/by-courseunit/{guid} server-side into one
// call. This is the only endpoint that actually returns a course unit's
// outlines for real (see the note on getCourseUnitById above) — View/Edit
// modals and ProgrammeModal's Syllabus/Outline/Taught By popup all rely on
// useCourseUnit(), which now fetches through here instead.
export interface CourseUnitTopicDetail extends CourseUnitTopic {
  employeeName: string
}

export interface CourseUnitOutlineDetail extends Omit<CourseUnitOutline, 'topics'> {
  topics: CourseUnitTopicDetail[]
}

// Same fields as CourseUnitDto (get-courseunit-by-guid.md / get-courseunits.md)
// but genuinely confirmed complete this time — courseUnitRepetitionName,
// approved, and the three weightage fields exist on the real DTO and were
// simply missing from the plain CourseUnit type above (that type having
// gone unverified against a real full response until now).
export interface CourseUnitDetailFields {
  courseUnitGuid: string
  courseUnitCode: string
  courseUnitName: string
  maxCredits: number
  chapterCount: number
  courseUnitRepetitionGuid: string | null
  courseUnitRepetitionName: string | null
  mid: number
  cw: number
  ca: number
  // Nullable — see the identical note on CourseUnitInput.approved above.
  // Confirmed by a real response: a course unit that's never been
  // explicitly approved/rejected comes back with this null, not 0/1.
  approved: number | null
  cbtWeightage: number
  cwWeightage: number
  ueWeightage: number
  syllabus: string | null
}

export interface CourseUnitFullDto {
  courseUnit: CourseUnitDetailFields
  outlines: CourseUnitOutlineDetail[]
}

export function getCourseUnitDetailsByGuid(guid: string): Promise<CourseUnitFullDto> {
  if (MOCK_AUTH) {
    const existing = mockCourseUnits.find(u => u.courseUnitGuid === guid)
    if (!existing) return Promise.reject(new Error('Course unit not found'))
    return Promise.resolve({
      courseUnit: {
        courseUnitGuid: existing.courseUnitGuid,
        courseUnitCode: existing.courseUnitCode,
        courseUnitName: existing.courseUnitName,
        maxCredits: existing.maxCredits,
        chapterCount: existing.chapterCount,
        courseUnitRepetitionGuid: existing.courseUnitRepetitionGuid,
        courseUnitRepetitionName: null,
        mid: existing.mid,
        cw: existing.cw,
        ca: existing.ca,
        approved: 1,
        cbtWeightage: 0,
        cwWeightage: 0,
        ueWeightage: 0,
        syllabus: existing.syllabus,
      },
      outlines: existing.outlines.map(o => ({
        ...o,
        topics: o.topics.map(t => ({ ...t, employeeName: `Employee #${t.employeeGuid}` })),
      })),
    })
  }
  return apiGet<CourseUnitFullDto>(`/api/v1/academic/courseunits/${guid}/details`)
}

// Merged shape (CourseUnitDetailFields + real outlines) — structurally a
// superset of CourseUnit (same fields, plus the extra detail ones, plus
// richer outlines), so every existing consumer of the old useCourseUnit()
// shape (ViewCourseUnitModal, EditCourseUnitModal, ProgrammeModal's
// Syllabus/Outline/Taught By popup) keeps working unchanged, just with real
// data where it used to silently get none.
export interface CourseUnitWithDetails extends CourseUnitDetailFields {
  outlines: CourseUnitOutlineDetail[]
}

export function getCourseUnitWithDetails(guid: string): Promise<CourseUnitWithDetails> {
  return getCourseUnitDetailsByGuid(guid).then(full => ({ ...full.courseUnit, outlines: full.outlines }))
}

// Same payload shape as create (see CourseUnitInput above), sent as
// multipart/form-data to the same .../courseunits/:guid endpoint used for
// GET. syllabus is only appended when the user picks a new file — omitting
// it leaves the existing attachment untouched rather than clearing it.
// Details-only, same as createCourseUnit — see the note above on why the
// outlines chaining this used to do was removed. Callers that need the
// merged shape (details + real outlines) should re-fetch via
// getCourseUnitWithDetails / useCourseUnit after both calls settle, rather
// than trusting this response's outlines (always [] here now).
export async function updateCourseUnit(guid: string, input: CourseUnitInput): Promise<CourseUnit> {
  if (MOCK_AUTH) {
    const existing = mockCourseUnits.find(u => u.courseUnitGuid === guid)
    if (!existing) return Promise.reject(new Error('Course unit not found'))
    existing.courseUnitCode = input.courseUnitCode
    existing.courseUnitName = input.courseUnitName
    existing.maxCredits = input.maxCredits
    existing.chapterCount = input.chapterCount
    existing.courseUnitRepetitionGuid = input.courseUnitRepetitionGuid
    existing.mid = input.mid
    existing.cw = input.cw
    existing.ca = input.ca
    if (input.syllabus) existing.syllabus = input.syllabus.name
    return Promise.resolve(existing)
  }

  const formData = new FormData()
  formData.append('courseUnitCode', input.courseUnitCode)
  formData.append('courseUnitName', input.courseUnitName)
  formData.append('maxCredits', String(input.maxCredits))
  formData.append('chapterCount', String(input.chapterCount))
  if (input.courseUnitRepetitionGuid) formData.append('courseUnitRepetitionGuid', input.courseUnitRepetitionGuid)
  formData.append('mid', String(input.mid))
  formData.append('cw', String(input.cw))
  formData.append('ca', String(input.ca))
  // Omit rather than send the literal string "null" — see the
  // CourseUnitInput.approved comment above.
  if (input.approved != null) formData.append('approved', String(input.approved))
  formData.append('cbtWeightage', String(input.cbtWeightage))
  formData.append('cwWeightage', String(input.cwWeightage))
  formData.append('ueWeightage', String(input.ueWeightage))
  if (input.syllabus) formData.append('syllabus', input.syllabus)
  return apiPutForm<CourseUnit>(`/api/v1/academic/courseunits/${guid}`, formData)
}

export function deleteCourseUnit(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockCourseUnits.findIndex(u => u.courseUnitGuid === guid)
    if (index === -1) return Promise.reject(new Error('Course unit not found'))
    mockCourseUnits.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/academic/courseunits/${guid}`)
}
