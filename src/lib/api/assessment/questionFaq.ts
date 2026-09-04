import { apiGet, apiPost, apiPut, apiDelete } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export interface QuestionFaqDto {
  questionFaqGuid: string
  questionText: string | null
  answerText: string | null
  status: number | null // 2 = Approved
}

export interface PagedQuestionFaqResult {
  items: QuestionFaqDto[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

export interface SaveQuestionFaqRequest {
  questionText: string
  answerText: string
}

export interface UpdateQuestionFaqRequest {
  answerText: string
}

let mockSeq = 1
let mockData: QuestionFaqDto[] = [
  {
    questionFaqGuid: 'f7739fed-421b-48ca-9c02-7f5fa1e514ce',
    questionText: 'Can I get some extra support for clearing my doubts?',
    answerText: 'The University offers additional labs and learning resources...',
    status: 2
  }
]

export function getQuestionFaqs(page = 1, pageSize = 10): Promise<PagedQuestionFaqResult> {
  if (MOCK_AUTH) {
    const validData = mockData.filter(d => d.status === 2)
    return Promise.resolve({
      items: validData,
      totalCount: validData.length,
      pageNumber: page,
      pageSize,
    })
  }
  const query = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString() })
  return apiGet<PagedQuestionFaqResult | null>(`/api/v1/assessment/question-faqs?${query.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

export function getQuestionFaqById(guid: string): Promise<QuestionFaqDto> {
  if (MOCK_AUTH) {
    const found = mockData.find(d => d.questionFaqGuid === guid)
    if (!found) return Promise.reject(new Error('Not found'))
    return Promise.resolve(found)
  }
  return apiGet<QuestionFaqDto>(`/api/v1/assessment/question-faqs/${guid}`)
}

export function createQuestionFaq(input: SaveQuestionFaqRequest): Promise<QuestionFaqDto> {
  if (MOCK_AUTH) {
    // Check for duplicate questions
    const exists = mockData.find(d => d.questionText?.toLowerCase() === input.questionText.toLowerCase())
    if (exists) return Promise.reject(new Error('This question already exists.'))

    const newItem: QuestionFaqDto = {
      questionFaqGuid: `mock-faq-${mockSeq++}`,
      questionText: input.questionText.trim(),
      answerText: input.answerText.trim(),
      status: 2
    }
    mockData.push(newItem)
    return Promise.resolve(newItem)
  }
  return apiPost<QuestionFaqDto>('/api/v1/assessment/question-faqs', input)
}

export function updateQuestionFaq(guid: string, input: UpdateQuestionFaqRequest): Promise<QuestionFaqDto> {
  if (MOCK_AUTH) {
    const found = mockData.find(d => d.questionFaqGuid === guid)
    if (!found) return Promise.reject(new Error('Not found'))
    found.answerText = input.answerText.trim()
    return Promise.resolve(found)
  }
  return apiPut<QuestionFaqDto>(`/api/v1/assessment/question-faqs/${guid}`, input)
}

export function deleteQuestionFaq(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    mockData = mockData.filter(d => d.questionFaqGuid !== guid)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/assessment/question-faqs/${guid}`)
}
