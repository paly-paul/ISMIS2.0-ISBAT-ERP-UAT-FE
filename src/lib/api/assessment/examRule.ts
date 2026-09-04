import { apiGet, apiPost, apiPut, apiDelete } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export interface ExamRuleSectionDto {
  maxQuestions: number | null
  attemptQuestions: number | null
  mark: number | null
  type: number | null // 1 = MCQ, 2 = Descriptive
}

export interface ExamRuleDto {
  examRuleGuid: string
  ruleCode: string | null
  ruleName: string | null
  sections: ExamRuleSectionDto[]
  totalMark: number
  status: number | null // 2 = Active, 3 = NotActive
}

export interface PagedExamRuleResult {
  items: ExamRuleDto[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

export interface SaveExamRuleRequest {
  ruleName: string
  sections: ExamRuleSectionDto[]
  sectionA?: ExamRuleSectionDto | null
  sectionB?: ExamRuleSectionDto | null
  sectionC?: ExamRuleSectionDto | null
}

let mockSeq = 1
const mockData: ExamRuleDto[] = [
  {
    examRuleGuid: 'f7739fed-421b-48ca-9c02-7f5fa1e514ce',
    ruleCode: 'R101',
    ruleName: 'Standard MCQ Test',
    sections: [
      { maxQuestions: 10, attemptQuestions: 10, mark: 2, type: 1 }
    ],
    totalMark: 20,
    status: 2
  }
]

function calculateTotal(sections: ExamRuleSectionDto[]): number {
  return sections.reduce((acc, sec) => {
    if (!sec || !sec.mark || !sec.attemptQuestions) return acc
    return acc + (sec.mark * sec.attemptQuestions)
  }, 0)
}

export function getExamRules(page = 1, pageSize = 10, search = ''): Promise<PagedExamRuleResult> {
  if (MOCK_AUTH) {
    let filtered = mockData.filter(d => d.status !== 3)
    if (search.trim()) {
      const s = search.toLowerCase()
      filtered = filtered.filter(d => 
        (d.ruleCode?.toLowerCase().includes(s)) ||
        (d.ruleName?.toLowerCase().includes(s))
      )
    }
    return Promise.resolve({
      items: filtered,
      totalCount: filtered.length,
      pageNumber: page,
      pageSize,
    })
  }
  const query = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString() })
  if (search) query.append('search', search)
  return apiGet<PagedExamRuleResult | null>(`/api/v1/assessment/exam-rules?${query.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

export function getExamRuleById(guid: string): Promise<ExamRuleDto> {
  if (MOCK_AUTH) {
    const found = mockData.find(d => d.examRuleGuid === guid && d.status !== 3)
    if (!found) return Promise.reject(new Error('Not found'))
    return Promise.resolve(found)
  }
  return apiGet<ExamRuleDto>(`/api/v1/assessment/exam-rules/${guid}`)
}

export function createExamRule(input: SaveExamRuleRequest): Promise<ExamRuleDto> {
  if (MOCK_AUTH) {
    const newItem: ExamRuleDto = {
      examRuleGuid: `mock-rule-${mockSeq++}`,
      ruleCode: `R10${mockSeq}`,
      ruleName: input.ruleName,
      sections: input.sections,
      totalMark: calculateTotal(input.sections),
      status: 2
    }
    mockData.push(newItem)
    return Promise.resolve(newItem)
  }
  return apiPost<ExamRuleDto>('/api/v1/assessment/exam-rules', input)
}

export function updateExamRule(guid: string, input: SaveExamRuleRequest): Promise<ExamRuleDto> {
  if (MOCK_AUTH) {
    const found = mockData.find(d => d.examRuleGuid === guid && d.status !== 3)
    if (!found) return Promise.reject(new Error('Not found'))
    found.ruleName = input.ruleName
    found.sections = input.sections
    found.totalMark = calculateTotal(input.sections)
    return Promise.resolve(found)
  }
  return apiPut<ExamRuleDto>(`/api/v1/assessment/exam-rules/${guid}`, input)
}

export function deleteExamRule(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const found = mockData.find(d => d.examRuleGuid === guid)
    if (found) {
      found.status = 3 // soft delete
    }
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/assessment/exam-rules/${guid}`)
}
