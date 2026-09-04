// Mock-only skill helpers for now.

export interface Skill {
  id: string
  skillName: string
}

export type SkillInput = Omit<Skill, 'id'>

const mockSkills: Skill[] = [
  { id: '1', skillName: 'C#' },
  { id: '2', skillName: 'Python' },
  { id: '3', skillName: 'Java' },
  { id: '4', skillName: 'SQL' },
  { id: '5', skillName: 'JavaScript' },
  { id: '6', skillName: 'Data Structures' },
  { id: '7', skillName: 'Computer Networks' },
  { id: '8', skillName: 'Operating Systems' },
]

// Return the mock skill list.
export function getSkills(): Promise<Skill[]> {
  return Promise.resolve(mockSkills)
}

// Create a new skill entry and return it.
export function createSkill(input: SkillInput): Promise<Skill> {
  const skill: Skill = { id: String(mockSkills.length + 1), ...input }
  mockSkills.push(skill)
  return Promise.resolve(skill)
}

// Update an existing skill entry and return it.
export function updateSkill(id: string, input: SkillInput): Promise<Skill> {
  const existing = mockSkills.find(s => s.id === id)
  if (!existing) return Promise.reject(new Error('Skill not found'))
  Object.assign(existing, input)
  return Promise.resolve(existing)
}
