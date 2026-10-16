import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Represents a programme group record returned by the API.
export interface ProgramGroup {
  programGroupGuid: string
  groupCode: string
  groupName: string
  programLevelGuid: string
  programLevelName: string
}

// Previous hardcoded rows (pre GET /api/v1/academic/program-groups
// integration) — activeVersions/inactiveVersions/students aren't part of
// the confirmed real response, kept here for reference until/unless the
// backend adds them.
// const mockRows = [
//   { code: 'BCA', name: "Bachelor of Computer Applications",    level: "Bachelor's", activeVersions: '1 Active', inactiveVersions: '1 Inactive', students: 234 },
//   { code: 'BBA', name: "Bachelor of Business Administration",  level: "Bachelor's", activeVersions: '1 Active', inactiveVersions: '2 Inactive', students: 412 },
//   { code: 'MBA', name: "Master of Business Administration",    level: "Master's",   activeVersions: '1 Active', inactiveVersions: '1 Inactive', students: 186 },
//   { code: 'BEng', name: "Bachelor of Engineering (Civil)",     level: 'Engineering', activeVersions: '1 Active', inactiveVersions: '—',          students: 124 },
// ]

const mockProgramGroups: ProgramGroup[] = [
  { programGroupGuid: '1', groupCode: 'BCA',  groupName: 'Bachelor of Computer Applications',   programLevelGuid: '3', programLevelName: "Bachelor's Degree" },
  { programGroupGuid: '2', groupCode: 'BBA',  groupName: 'Bachelor of Business Administration', programLevelGuid: '3', programLevelName: "Bachelor's Degree" },
  { programGroupGuid: '3', groupCode: 'MBA',  groupName: 'Master of Business Administration',   programLevelGuid: '5', programLevelName: "Master's Degree" },
  { programGroupGuid: '4', groupCode: 'BEng', groupName: 'Bachelor of Engineering (Civil)',      programLevelGuid: '4', programLevelName: 'Bachelor of Engineering' },
]

// Response wrapper for the paginated programme group list endpoint.
export interface ProgramGroupListResponse {
  items: ProgramGroup[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// GET /program-groups takes only page/pageSize; it has NO ?search= param
// (per erp-docs). Searching therefore fetches every group in one large page
// and filters by code/name here. pageSize has no server-side upper bound.
const SEARCH_FETCH_SIZE = 1000

function matchesSearch(g: ProgramGroup, q: string) {
  const needle = q.toLowerCase()
  return g.groupCode.toLowerCase().includes(needle) || g.groupName.toLowerCase().includes(needle)
}

// Fetch the programme group list, using mock data when the mock auth flag is
// enabled. A non-empty search filters client-side (see above).
export function getProgramGroups(page = 1, pageSize = 10, search = ''): Promise<ProgramGroup[]> {
  const q = search.trim()
  if (MOCK_AUTH) return Promise.resolve(q ? mockProgramGroups.filter(g => matchesSearch(g, q)) : mockProgramGroups)
  const params = q
    ? new URLSearchParams({ page: '1', pageSize: String(SEARCH_FETCH_SIZE) })
    : new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  return apiGet<ProgramGroupListResponse | null>(`/api/v1/academic/program-groups?${params.toString()}`)
    .then(data => {
      const items = data?.items ?? []
      return q ? items.filter(g => matchesSearch(g, q)) : items
    })
}

// Real server-side pagination variant (2026-09-09) — for Programme Group's
// own table, which used to call getProgramGroups() above at
// PROGRAM_GROUPS_PAGE_SIZE (1000) and paginate/search client-side. The plain
// function above stays as-is for programme-master/ProgrammeModal/
// ViewProgrammeModal, which genuinely need the full unpaginated list to
// resolve group names for their own tables/dropdowns. This one keeps the
// real totalCount/pageNumber/pageSize the endpoint already returns
// (ProgramGroupListResponse) instead of discarding it down to just items.
// Without a search this is real server paging. With one, the backend can't
// filter, so it searches the full list and pages the matches here.
export function getProgramGroupsPaged(page = 1, pageSize = 10, search = ''): Promise<ProgramGroupListResponse> {
  const q = search.trim()
  if (MOCK_AUTH || q) {
    return getProgramGroups(1, SEARCH_FETCH_SIZE, q).then(matches => {
      const start = (page - 1) * pageSize
      return { items: matches.slice(start, start + pageSize), totalCount: matches.length, pageNumber: page, pageSize }
    })
  }
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  return apiGet<ProgramGroupListResponse | null>(`/api/v1/academic/program-groups?${params.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

// Payload used when creating or updating a programme group.
export interface ProgramGroupInput {
  groupCode: string
  groupName: string
  programLevelGuid: string
}

let mockProgramGroupSeq = mockProgramGroups.length + 1

// Create a new programme group and return the saved record.
export function createProgramGroup(input: ProgramGroupInput): Promise<ProgramGroup> {
  if (MOCK_AUTH) {
    const group: ProgramGroup = {
      programGroupGuid: String(mockProgramGroupSeq++),
      groupCode: input.groupCode,
      groupName: input.groupName,
      programLevelGuid: input.programLevelGuid,
      // Server-resolved from programLevelGuid on the real GET response — no
      // local programme-level list to cross-reference against here.
      programLevelName: '',
    }
    mockProgramGroups.push(group)
    return Promise.resolve(group)
  }
  return apiPost<ProgramGroup>('/api/v1/academic/program-groups', input)
}

// Fetch one programme group by its GUID.
export function getProgramGroupById(guid: string): Promise<ProgramGroup> {
  if (MOCK_AUTH) {
    const existing = mockProgramGroups.find(g => g.programGroupGuid === guid)
    if (!existing) return Promise.reject(new Error('Programme group not found'))
    return Promise.resolve(existing)
  }
  return apiGet<ProgramGroup>(`/api/v1/academic/program-groups/${guid}`)
}

// Update a programme group by GUID and return the updated record.
export function updateProgramGroup(guid: string, input: ProgramGroupInput): Promise<ProgramGroup> {
  if (MOCK_AUTH) {
    const existing = mockProgramGroups.find(g => g.programGroupGuid === guid)
    if (!existing) return Promise.reject(new Error('Programme group not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<ProgramGroup>(`/api/v1/academic/program-groups/${guid}`, input)
}

// Delete a programme group and return true when the API confirms success.
export function deleteProgramGroup(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockProgramGroups.findIndex(g => g.programGroupGuid === guid)
    if (index === -1) return Promise.reject(new Error('Programme group not found'))
    mockProgramGroups.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/academic/program-groups/${guid}`)
}
