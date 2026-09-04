import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Backs /config/skill — a flat skill-name catalog (e.g. "Python", "SQL")
// used to populate lecturer profiles. Confirmed via the real skills/ Bruno
// collection: keyed by a real skillGuid (no more legacy intSkill — that was
// this endpoint's shape before it moved), soft-delete (IsDeleted flag, row
// retained) full CRUD via /api/v1/users/skill-catalog (+ /:guid for
// Update/Delete). Despite the /users/ path, this stays a plain name catalog
// with no employee/proficiency/approval concept of its own.
//
// This skillGuid is what lib/api/users/skills.ts's CreateLecturerSkillInput
// now sends in skillGuids — previously that field had no confirmed guid
// source and used String(intSkill) as a stand-in; that workaround is gone
// now that this catalog actually returns one.
//
// Genuinely distinct from lib/api/users/skills.ts (LecturerSkill — the
// /academic/skill-master approval workflow, keyed by
// lecturerSkillGuid/employeeGuid, with proficiency/approvalStatus fields).
// Kept in its own file rather than folded into either that one or the old
// mock-only academic/skill.ts, so the two "skill" resources can't get
// confused at the import site — see the note above the directory tree in
// PROJECT_STRUCTURE.md for the same distinction.
export interface SkillMaster {
  skillGuid: string
  skillName: string
}

export interface SkillMasterInput {
  skillName: string
}

interface SkillMasterListResponse {
  items: SkillMaster[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

const mockSkills: SkillMaster[] = [
  { skillGuid: '11111111-1111-4111-8111-111111111111', skillName: 'C#' },
  { skillGuid: '22222222-2222-4222-8222-222222222222', skillName: 'Python' },
  { skillGuid: '33333333-3333-4333-8333-333333333333', skillName: 'Java' },
  { skillGuid: '44444444-4444-4444-8444-444444444444', skillName: 'SQL' },
  { skillGuid: '55555555-5555-4555-8555-555555555555', skillName: 'JavaScript' },
  { skillGuid: '66666666-6666-4666-8666-666666666666', skillName: 'Data Structures' },
  { skillGuid: '77777777-7777-4777-8777-777777777777', skillName: 'Computer Networks' },
  { skillGuid: '88888888-8888-4888-8888-888888888888', skillName: 'Operating Systems' },
]

// Real pagination — a live sample returned totalCount: 12 against only 10
// items in a pageSize=10 page, so this is a genuinely server-paginated
// endpoint despite the master being small. Fetched at a large pageSize (see
// useSkillMaster.ts) and paginated/searched client-side instead, same "load
// it all" convention as every other small Config master in this app
// (useStreams/useFaculties/etc.).
export function getSkillMasters(pageNumber = 1, pageSize = 1000): Promise<SkillMasterListResponse> {
  if (MOCK_AUTH) {
    return Promise.resolve({ items: mockSkills, totalCount: mockSkills.length, pageNumber, pageSize })
  }
  return apiGet<SkillMasterListResponse | null>(`/api/v1/users/skill-catalog?page=${pageNumber}&pageSize=${pageSize}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber, pageSize })
}

export function createSkillMaster(input: SkillMasterInput): Promise<SkillMaster> {
  if (MOCK_AUTH) {
    const skill: SkillMaster = { skillGuid: crypto.randomUUID(), ...input }
    mockSkills.push(skill)
    return Promise.resolve(skill)
  }
  return apiPost<SkillMaster>('/api/v1/users/skill-catalog', input)
}

// Same payload shape as create — confirmed via the shared API sample.
export function updateSkillMaster(skillGuid: string, input: SkillMasterInput): Promise<SkillMaster> {
  if (MOCK_AUTH) {
    const existing = mockSkills.find(s => s.skillGuid === skillGuid)
    if (!existing) return Promise.reject(new Error('Skill not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<SkillMaster>(`/api/v1/users/skill-catalog/${skillGuid}`, input)
}

// Soft-delete on the server (IsDeleted flag, row retained) — the client just
// stops seeing it in the list either way.
export function deleteSkillMaster(skillGuid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockSkills.findIndex(s => s.skillGuid === skillGuid)
    if (index === -1) return Promise.reject(new Error('Skill not found'))
    mockSkills.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/users/skill-catalog/${skillGuid}`)
}
