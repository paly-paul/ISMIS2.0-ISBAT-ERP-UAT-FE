import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Represents a repetition tag record returned by the API.
export interface RepetitionTag {
  courseUnitRepetitionGuid: string
  tagCode: string
  tagName: string
  intLevel: number
  levelCode: string
  levelName: string
}

// In-memory list used only when mock auth is enabled.
const mockRepetitionTags: RepetitionTag[] = [
  { courseUnitRepetitionGuid: '1', tagCode: 'RT-CU-001', tagName: 'Standard repeat for failed course units',     intLevel: 3, levelCode: 'BACH', levelName: "Bachelor's Degree" },
  { courseUnitRepetitionGuid: '2', tagCode: 'RT-CU-002', tagName: 'Supplementary exam carry-forward repeat',      intLevel: 2, levelCode: 'DIP',  levelName: 'Diploma' },
  { courseUnitRepetitionGuid: '3', tagCode: 'RT-CU-003', tagName: 'Medical or special consideration repeat',      intLevel: 5, levelCode: 'MAST', levelName: "Master's Degree" },
  { courseUnitRepetitionGuid: '4', tagCode: 'RT-CU-004', tagName: 'Retake after academic probation',              intLevel: 3, levelCode: 'BACH', levelName: "Bachelor's Degree" },
  { courseUnitRepetitionGuid: '5', tagCode: 'RT-CU-005', tagName: 'Credit exemption repeat for lateral entrants', intLevel: 4, levelCode: 'PGD',  levelName: 'Postgraduate Diploma' },
]

// Fetch all repetition tags. The real endpoint is paginated
// ({ items, totalCount, pageNumber, pageSize } — confirmed via a live
// sample), so ask for a page large enough to cover the whole list in one
// request, same "load it all, search/paginate client-side" convention as
// useIntakes/useEmployees. Still tolerates a plain array or the older
// { courseUnitRepetitions } shape in case an earlier build of the endpoint
// is what's actually deployed.
const REPETITION_TAGS_LOAD_SIZE = 1000

// search is forwarded to the endpoint's own ?search= param (same convention
// as getIntakes/getSkills) rather than filtered client-side — not confirmed
// against a spec, so it's paired with a client-side re-filter wherever it's
// used, keeping results correct even if the backend silently ignores an
// unrecognized param.
export function getRepetitionTags(search = ''): Promise<RepetitionTag[]> {
  const q = search.trim()
  if (MOCK_AUTH) {
    if (!q) return Promise.resolve(mockRepetitionTags)
    const needle = q.toLowerCase()
    return Promise.resolve(mockRepetitionTags.filter(t => t.tagCode.toLowerCase().includes(needle) || t.tagName.toLowerCase().includes(needle)))
  }
  const params = new URLSearchParams({ page: '1', pageSize: String(REPETITION_TAGS_LOAD_SIZE) })
  if (q) params.set('search', q)
  return apiGet<any>(`/api/v1/academic/course-unit-repetitions?${params.toString()}`).then(data =>
    Array.isArray(data) ? data
      : Array.isArray(data?.items) ? data.items
      : Array.isArray(data?.courseUnitRepetitions) ? data.courseUnitRepetitions
      : []
  )
}

// Payload used when creating or updating a repetition tag.
export interface RepetitionTagInput {
  tagCode: string
  tagName: string
  programLevelGuid: string
}

let mockRepetitionTagSeq = mockRepetitionTags.length + 1

// Create a new repetition tag and return the saved record.
export function createRepetitionTag(input: RepetitionTagInput): Promise<RepetitionTag> {
  if (MOCK_AUTH) {
    const tag: RepetitionTag = {
      courseUnitRepetitionGuid: String(mockRepetitionTagSeq++),
      tagCode: input.tagCode,
      tagName: input.tagName,
      // intLevel/levelCode/levelName are server-resolved from
      // programLevelGuid on the real GET response — no local programme-level
      // lookup to cross-reference against here.
      intLevel: 0,
      levelCode: '',
      levelName: '',
    }
    mockRepetitionTags.push(tag)
    return Promise.resolve(tag)
  }
  return apiPost<RepetitionTag>('/api/v1/academic/course-unit-repetitions', input)
}

// Fetch one repetition tag by its GUID.
export function getRepetitionTagById(guid: string): Promise<RepetitionTag> {
  if (MOCK_AUTH) {
    const existing = mockRepetitionTags.find(t => t.courseUnitRepetitionGuid === guid)
    if (!existing) return Promise.reject(new Error('Repetition tag not found'))
    return Promise.resolve(existing)
  }
  return apiGet<RepetitionTag>(`/api/v1/academic/course-unit-repetitions/${guid}`)
}

// Update a repetition tag by GUID and return the updated record.
export function updateRepetitionTag(guid: string, input: RepetitionTagInput): Promise<RepetitionTag> {
  if (MOCK_AUTH) {
    const existing = mockRepetitionTags.find(t => t.courseUnitRepetitionGuid === guid)
    if (!existing) return Promise.reject(new Error('Repetition tag not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<RepetitionTag>(`/api/v1/academic/course-unit-repetitions/${guid}`, input)
}

// Delete a repetition tag and return true when the API confirms success.
export function deleteRepetitionTag(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockRepetitionTags.findIndex(t => t.courseUnitRepetitionGuid === guid)
    if (index === -1) return Promise.reject(new Error('Repetition tag not found'))
    mockRepetitionTags.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/academic/course-unit-repetitions/${guid}`)
}
