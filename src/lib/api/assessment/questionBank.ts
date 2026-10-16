import { apiDelete, apiGet, apiPostForm } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export interface QuestionBankCategory {
  value: number
  name: string
}

export interface QuestionBankCourseUnit {
  courseUnitGuid: string
  courseUnitName: string | null
  courseUnitCode: string | null
}

export interface QuestionBankTemplateResponse {
  url: string
  expiresAtUtc: string
}

export interface QuestionPreviewItem {
  slNo: string
  questionType: 'MCQ' | 'DQ'
  question: string
  option1: string
  option2: string
  option3: string
  option4: string
  answer: string
  level: string
  questionGuid?: string // Added for DB questions
}

export interface QuestionBankFileParams {
  file: File
  sheetName?: string
  courseUnitGuid: string
  category: number
  intakeGuid: string
}

export interface QuestionBankImportResult {
  success: boolean
  message: string
}

// ── Mock data for fallback testing ──────────────────────────────────────────

const mockCategories: QuestionBankCategory[] = [
  { value: 1, name: 'CBT' },
  { value: 2, name: 'Course Work' },
  { value: 5, name: 'University Exam' },
]

const mockCourseUnits: QuestionBankCourseUnit[] = [
  { courseUnitGuid: '017749e8-a325-4560-b8db-2230721d838f', courseUnitCode: 'BCS3127', courseUnitName: 'Compiler Design' },
  { courseUnitGuid: '18bc91be-6665-411e-9b27-fba637d2e761', courseUnitCode: 'CSE1212', courseUnitName: 'Data Structures & Algorithms' },
  { courseUnitGuid: '29cd02cf-7776-522f-ac38-0cb748e3f872', courseUnitCode: 'BIT2104', courseUnitName: 'Database Management Systems' },
]

const mockPreviewQuestions: QuestionPreviewItem[] = [
  {
    slNo: '1',
    questionType: 'MCQ',
    question: 'Which of the following data structures operates on a Last In First Out (LIFO) basis?',
    option1: 'Queue',
    option2: 'Stack',
    option3: 'Linked List',
    option4: 'Tree',
    answer: 'Stack',
    level: '1',
  },
  {
    slNo: '2',
    questionType: 'MCQ',
    question: 'What is the worst-case time complexity of QuickSort?',
    option1: 'O(n log n)',
    option2: 'O(n)',
    option3: 'O(n^2)',
    option4: 'O(log n)',
    answer: 'O(n^2)',
    level: '2',
  },
  {
    slNo: '3',
    questionType: 'DQ',
    question: 'Explain the difference between an abstract class and an interface in modern object-oriented programming.',
    option1: '',
    option2: '',
    option3: '',
    option4: '',
    answer: 'An abstract class can hold implementation and state; an interface defines a contract.',
    level: '',
  },
  {
    slNo: '4',
    questionType: 'DQ',
    question: 'Describe Dijkstra’s shortest path algorithm and state its time complexity using an adjacency list representation.',
    option1: '',
    option2: '',
    option3: '',
    option4: '',
    answer: 'Finds single-source shortest path with non-negative edge weights in O((V + E) log V).',
    level: '',
  },
]

// ── API Functions ───────────────────────────────────────────────────────────

/**
 * Fetch fixed Category dropdown: CBT (1), Course Work (2), University Exam (5).
 */
export function getQuestionBankCategories(): Promise<QuestionBankCategory[]> {
  if (MOCK_AUTH) {
    return Promise.resolve(mockCategories)
  }
  return apiGet<QuestionBankCategory[]>('/api/v1/assessment/question-bank/categories')
    .then(data => data ?? mockCategories)
}

/**
 * Fetch course units planned for the given lecturer and intake.
 */
export function getQuestionBankCourseUnits(intakeGuid: string, lecturerGuid: string): Promise<QuestionBankCourseUnit[]> {
  if (MOCK_AUTH) {
    return Promise.resolve(mockCourseUnits)
  }
  const params = new URLSearchParams({ intakeGuid, lecturerGuid })
  return apiGet<any>(`/api/v1/assessment/question-bank/course-units?${params.toString()}`)
    .then(data => {
      const items = Array.isArray(data) ? data : data?.items ?? []
      return items
        .map((item: any) => ({
          courseUnitGuid: item.courseUnitGuid || item.guid || item.unitGuid || item.id || '',
          courseUnitCode: item.courseUnitCode || item.code || item.unitCode || '',
          courseUnitName: item.courseUnitName || item.name || item.unitName || item.title || 'Untitled Unit',
        }))
        .filter((u: QuestionBankCourseUnit) => Boolean(u.courseUnitGuid))
    })
}

/**
 * Fetch short-lived S3 presigned URL to download the blank 9-column Excel template.
 */
export function getQuestionBankTemplate(): Promise<QuestionBankTemplateResponse> {
  if (MOCK_AUTH) {
    return Promise.resolve({
      url: 'https://example.com/QuestionBankImportTemplate.xlsx',
      expiresAtUtc: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })
  }
  return apiGet<QuestionBankTemplateResponse>('/api/v1/assessment/question-bank/template')
}

/**
 * Read the worksheet names inside an uploaded .xlsx file.
 */
export function postQuestionBankSheets(file: File): Promise<string[]> {
  if (MOCK_AUTH) {
    return Promise.resolve(['Questions', 'Sheet1'])
  }
  const formData = new FormData()
  formData.append('file', file)
  return apiPostForm<string[]>('/api/v1/assessment/question-bank/sheets', formData)
    .then(data => data ?? [])
}

/**
 * Parse and validate uploaded sheet against 18 validation rules, returning preview rows.
 */
export function postQuestionBankPreview(params: QuestionBankFileParams): Promise<QuestionPreviewItem[]> {
  if (MOCK_AUTH) {
    return Promise.resolve(mockPreviewQuestions)
  }
  const formData = new FormData()
  formData.append('file', params.file)
  if (params.sheetName) formData.append('SheetName', params.sheetName)
  formData.append('CourseUnitGuid', params.courseUnitGuid)
  formData.append('Category', String(params.category))
  formData.append('IntakeGuid', params.intakeGuid)

  return apiPostForm<QuestionPreviewItem[]>('/api/v1/assessment/question-bank/preview', formData)
    .then(data => data ?? [])
}

/**
 * Commit questions from the uploaded sheet into T_QUESTIONS and archive the file to S3.
 */
export function postQuestionBankImport(params: QuestionBankFileParams): Promise<QuestionBankImportResult> {
  if (MOCK_AUTH) {
    return Promise.resolve({
      success: true,
      message: `${mockPreviewQuestions.length} question(s) imported successfully.`,
    })
  }
  const formData = new FormData()
  formData.append('file', params.file)
  if (params.sheetName) formData.append('SheetName', params.sheetName)
  formData.append('CourseUnitGuid', params.courseUnitGuid)
  formData.append('Category', String(params.category))
  formData.append('IntakeGuid', params.intakeGuid)

  return apiPostForm<boolean>('/api/v1/assessment/question-bank/import', formData)
    .then(data => ({
      success: Boolean(data),
      message: 'Questions imported successfully.',
    }))
}

/**
 * Soft-delete question bank for the given course unit, category, and intake.
 */
export function deleteQuestionBank(
  courseUnitGuid: string,
  category: number,
  intakeGuid: string,
): Promise<QuestionBankImportResult> {
  if (MOCK_AUTH) {
    return Promise.resolve({
      success: true,
      message: 'Questions deleted successfully.',
    })
  }
  const params = new URLSearchParams({
    courseUnitGuid,
    category: String(category),
    intakeGuid,
  })
  return apiDelete<boolean>(`/api/v1/assessment/question-bank?${params.toString()}`)
    .then(data => ({
      success: Boolean(data),
      message: 'Questions deleted successfully.',
    }))
}
