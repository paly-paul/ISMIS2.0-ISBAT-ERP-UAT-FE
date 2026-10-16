import { apiDelete, apiGet, apiPost, apiPut, AuthError } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Feedback Master (students/feedback-master/*.md, 2026-10-06) — feedback
// forms per academic intake, each with a list of questions, consumed by the
// student portal's course feedback. Page: /student/feedback-master
// (pages/students/feedback-master-admin-page.md).

export interface FeedbackTypeOption {
  assessmentTypeGuid: string
  assessmentName: string | null
}

export interface FeedbackListItem {
  feedbackGuid: string
  // Normalised server-side (trimmed, uppercased).
  code: string
  description: string | null
  assessmentTypeGuid: string | null
  // null when the assessment type was removed.
  assessmentTypeName: string | null
}

export interface FeedbackDetail extends FeedbackListItem {
  // Immutable after creation, like `code`.
  intakeGuid: string | null
}

export interface CreateFeedbackInput {
  code: string
  description: string
  assessmentTypeGuid: string
  intakeGuid: string
}

// Code and intake are never updated. The type can't change once students
// have responded — send the existing guid unchanged to edit only the
// description.
export interface UpdateFeedbackInput {
  description: string
  assessmentTypeGuid: string
}

// 1 Rating, 2 Descriptive, 3 Yes/No.
export type FeedbackQuestionType = 1 | 2 | 3
export const FEEDBACK_QUESTION_TYPES: { value: FeedbackQuestionType; label: string }[] = [
  { value: 1, label: 'Rating' },
  { value: 2, label: 'Descriptive' },
  { value: 3, label: 'Yes/No' },
]

export interface FeedbackQuestion {
  questionGuid: string
  questionText: string | null
  questionType: FeedbackQuestionType
  questionTypeLabel: string
  sortOrder: number
  // Text and type are locked once true; sortOrder stays editable.
  hasAnswers: boolean
}

export interface AddQuestionInput {
  questionText: string
  questionType: FeedbackQuestionType
  sortOrder: number
}

// null/omitted fields keep their current value. On an answered question,
// send null for text and type and change only sortOrder.
export interface UpdateQuestionInput {
  questionText: string | null
  questionType: FeedbackQuestionType | null
  sortOrder: number | null
}

const BASE = '/api/v1/students/feedback-master'

// ---- Mock store (NEXT_PUBLIC_AUTH_MOCK=true) --------------------------------
// In-memory, per page load. Seeded on the current mock intake (2024 Semester
// 1, see academic/intake.ts) with one form whose second question already has
// answers, so the lock behaviour can be tried. Mirrors the server rules in
// the API docs: unique code + one type per intake, no delete while questions
// remain or answers exist, text/type locked on answered questions, unique
// (text, type) per form.
const mockTypes: FeedbackTypeOption[] = [
  { assessmentTypeGuid: 'at-mock-cw', assessmentName: 'Course Work' },
  { assessmentTypeGuid: 'at-mock-ia', assessmentName: 'Internal Assessment' },
  { assessmentTypeGuid: 'at-mock-ue', assessmentName: 'University Exam' },
]
const mockFeedbacks: FeedbackDetail[] = [
  { feedbackGuid: 'fb-mock-1', code: 'CW2024', description: 'Course Work 2024 Feedback', assessmentTypeGuid: 'at-mock-cw', assessmentTypeName: 'Course Work', intakeGuid: 'a1b2c3d4-0000-4000-8000-000000000001' },
]
const mockQuestions: Record<string, FeedbackQuestion[]> = {
  'fb-mock-1': [
    { questionGuid: 'fq-mock-1', questionText: "How would you rate the lecturer's delivery?", questionType: 1, questionTypeLabel: 'Rating', sortOrder: 10, hasAnswers: false },
    { questionGuid: 'fq-mock-2', questionText: 'Was course material provided on time?', questionType: 3, questionTypeLabel: 'Yes/No', sortOrder: 20, hasAnswers: true },
  ],
}
const typeLabel = (t: FeedbackQuestionType) => FEEDBACK_QUESTION_TYPES.find(x => x.value === t)?.label ?? ''
const typeName = (guid: string) => mockTypes.find(t => t.assessmentTypeGuid === guid)?.assessmentName ?? null
const fail = (message: string, code = 'failure') => Promise.reject(new AuthError(code, message))
const findQuestion = (questionGuid: string) => {
  for (const [feedbackGuid, qs] of Object.entries(mockQuestions)) {
    const q = qs.find(x => x.questionGuid === questionGuid)
    if (q) return { feedbackGuid, q }
  }
  return null
}

export function getFeedbackTypes(): Promise<FeedbackTypeOption[]> {
  if (MOCK_AUTH) return Promise.resolve([...mockTypes])
  return apiGet<FeedbackTypeOption[] | null>(`${BASE}/assessment-types/dropdown`).then(d => d ?? [])
}

// Ordered by code server-side.
export function getFeedbacksByIntake(intakeGuid: string): Promise<FeedbackListItem[]> {
  if (MOCK_AUTH) {
    return Promise.resolve(mockFeedbacks.filter(f => f.intakeGuid === intakeGuid).sort((a, b) => a.code.localeCompare(b.code)).map(f => ({ ...f })))
  }
  return apiGet<FeedbackListItem[] | null>(`${BASE}?intakeGuid=${encodeURIComponent(intakeGuid)}`).then(d => d ?? [])
}

export function getFeedback(feedbackGuid: string): Promise<FeedbackDetail> {
  if (MOCK_AUTH) {
    const f = mockFeedbacks.find(x => x.feedbackGuid === feedbackGuid)
    return f ? Promise.resolve({ ...f }) : fail('Feedback not found.', 'not_found')
  }
  return apiGet<FeedbackDetail>(`${BASE}/${feedbackGuid}`)
}

export function getFeedbackQuestions(feedbackGuid: string): Promise<FeedbackQuestion[]> {
  if (MOCK_AUTH) return Promise.resolve((mockQuestions[feedbackGuid] ?? []).map(q => ({ ...q })))
  return apiGet<FeedbackQuestion[] | null>(`${BASE}/${feedbackGuid}/questions`).then(d => d ?? [])
}

// 400 `failure` when the code or the assessment type is already used in this
// intake (one of each per intake).
export function createFeedback(input: CreateFeedbackInput): Promise<FeedbackDetail> {
  if (MOCK_AUTH) {
    const code = input.code.trim().toUpperCase()
    const sameIntake = mockFeedbacks.filter(f => f.intakeGuid === input.intakeGuid)
    if (sameIntake.some(f => f.code === code)) return fail(`Feedback code '${code}' already exists for this intake.`)
    if (sameIntake.some(f => f.assessmentTypeGuid === input.assessmentTypeGuid)) return fail('A feedback for this assessment type already exists in this intake.')
    const created: FeedbackDetail = {
      feedbackGuid: `fb-mock-${Date.now()}`, code, description: input.description.trim(),
      assessmentTypeGuid: input.assessmentTypeGuid, assessmentTypeName: typeName(input.assessmentTypeGuid), intakeGuid: input.intakeGuid,
    }
    mockFeedbacks.push(created)
    mockQuestions[created.feedbackGuid] = []
    return Promise.resolve({ ...created })
  }
  return apiPost<FeedbackDetail>(BASE, input)
}

export function updateFeedback(feedbackGuid: string, input: UpdateFeedbackInput): Promise<FeedbackDetail> {
  if (MOCK_AUTH) {
    const f = mockFeedbacks.find(x => x.feedbackGuid === feedbackGuid)
    if (!f) return fail('Feedback not found.', 'not_found')
    if (input.assessmentTypeGuid !== f.assessmentTypeGuid) {
      if ((mockQuestions[feedbackGuid] ?? []).some(q => q.hasAnswers)) return fail('Students have submitted responses for this feedback; the type cannot be changed.')
      if (mockFeedbacks.some(x => x !== f && x.intakeGuid === f.intakeGuid && x.assessmentTypeGuid === input.assessmentTypeGuid)) return fail('A feedback for this assessment type already exists in this intake.')
    }
    Object.assign(f, { description: input.description.trim(), assessmentTypeGuid: input.assessmentTypeGuid, assessmentTypeName: typeName(input.assessmentTypeGuid) })
    return Promise.resolve({ ...f })
  }
  return apiPut<FeedbackDetail>(`${BASE}/${feedbackGuid}`, input)
}

// Soft delete. 400 while questions remain or once students have responded.
export function deleteFeedback(feedbackGuid: string): Promise<void> {
  if (MOCK_AUTH) {
    const idx = mockFeedbacks.findIndex(x => x.feedbackGuid === feedbackGuid)
    if (idx === -1) return fail('Feedback not found.', 'not_found')
    const qs = mockQuestions[feedbackGuid] ?? []
    if (qs.some(q => q.hasAnswers)) return fail('Students have submitted responses for this feedback.')
    if (qs.length > 0) return fail('Delete all questions before deleting this feedback form.')
    mockFeedbacks.splice(idx, 1)
    delete mockQuestions[feedbackGuid]
    return Promise.resolve()
  }
  return apiDelete<void>(`${BASE}/${feedbackGuid}`)
}

// 400 `failure` when the same text + type already exists on this feedback.
export function addFeedbackQuestion(feedbackGuid: string, input: AddQuestionInput): Promise<FeedbackQuestion> {
  if (MOCK_AUTH) {
    const qs = mockQuestions[feedbackGuid]
    if (!qs) return fail('Feedback not found.', 'not_found')
    const text = input.questionText.trim()
    if (qs.some(q => q.questionText === text && q.questionType === input.questionType)) return fail('A question with the same text and type already exists in this feedback.')
    const created: FeedbackQuestion = {
      questionGuid: `fq-mock-${Date.now()}`, questionText: text, questionType: input.questionType,
      questionTypeLabel: typeLabel(input.questionType), sortOrder: input.sortOrder, hasAnswers: false,
    }
    qs.push(created)
    return Promise.resolve({ ...created })
  }
  return apiPost<FeedbackQuestion>(`${BASE}/${feedbackGuid}/questions`, input)
}

export function updateFeedbackQuestion(questionGuid: string, input: UpdateQuestionInput): Promise<FeedbackQuestion> {
  if (MOCK_AUTH) {
    const found = findQuestion(questionGuid)
    if (!found) return fail('Question not found.', 'not_found')
    const { feedbackGuid, q } = found
    const text = input.questionText?.trim() ?? q.questionText
    const type = input.questionType ?? q.questionType
    if (q.hasAnswers && (text !== q.questionText || type !== q.questionType)) return fail('Students have already answered this question; its text and type cannot be changed.')
    if ((text !== q.questionText || type !== q.questionType) && mockQuestions[feedbackGuid].some(x => x !== q && x.questionText === text && x.questionType === type)) {
      return fail('A question with the same text and type already exists in this feedback.')
    }
    Object.assign(q, { questionText: text, questionType: type, questionTypeLabel: typeLabel(type), sortOrder: input.sortOrder ?? q.sortOrder })
    return Promise.resolve({ ...q })
  }
  return apiPut<FeedbackQuestion>(`${BASE}/questions/${questionGuid}`, input)
}

// Soft delete. 400 once a student has answered it.
export function deleteFeedbackQuestion(questionGuid: string): Promise<void> {
  if (MOCK_AUTH) {
    const found = findQuestion(questionGuid)
    if (!found) return fail('Question not found.', 'not_found')
    if (found.q.hasAnswers) return fail('Students have already answered this question.')
    mockQuestions[found.feedbackGuid] = mockQuestions[found.feedbackGuid].filter(x => x.questionGuid !== questionGuid)
    return Promise.resolve()
  }
  return apiDelete<void>(`${BASE}/questions/${questionGuid}`)
}
