import { apiGet, apiPost, apiPostForm, apiDelete } from '@/lib/api/client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export interface CourseUnitOption {
  courseUnitGuid: string
  courseUnitCode: string | null
  courseUnitName: string | null
}

// 1. Fetch Course Units for Practical Question Bank
export function getPracticalCourseUnits(): Promise<CourseUnitOption[]> {
  if (MOCK_AUTH) {
    return Promise.resolve([
      { courseUnitGuid: 'CU-101', courseUnitCode: 'CS101', courseUnitName: 'Introduction to Programming (Practical)' },
      { courseUnitGuid: 'CU-102', courseUnitCode: 'CS102', courseUnitName: 'Data Structures and Algorithms (Practical)' },
      { courseUnitGuid: 'CU-103', courseUnitCode: 'CS103', courseUnitName: 'Database Management Systems (Practical)' },
    ])
  }
  return apiGet<CourseUnitOption[]>('/api/v1/assessment/question-bank/practical/course-units')
    .then(res => res ?? [])
}

export interface PreviewQuestion {
  slNo: string
  questionType: string
  question: string
  option1: string
  option2: string
  option3: string
  option4: string
  answer: string
  level: string
}

// 2. Preview Question Bank File
export function previewPracticalQuestionBank(courseUnitGuid: string, file: File, sheetName: string, intakeGuid: string): Promise<PreviewQuestion[]> {
  if (MOCK_AUTH) {
    return new Promise(resolve => setTimeout(() => {
      resolve([{
        slNo: "1", questionType: "MCQ", question: "Sample question?",
        option1: "A", option2: "B", option3: "C", option4: "D", answer: "A", level: "1"
      }])
    }, 1000))
  }
  
  const formData = new FormData()
  formData.append('CourseUnitGuid', courseUnitGuid)
  formData.append('IntakeGuid', intakeGuid) 
  formData.append('file', file)
  formData.append('SheetName', sheetName)

  return apiPostForm<PreviewQuestion[]>('/api/v1/assessment/question-bank/practical/preview', formData)
}

// 3. Upload/Import Question Bank File
export function importPracticalQuestionBank(courseUnitGuid: string, file: File, sheetName: string, intakeGuid: string): Promise<void> {
  if (MOCK_AUTH) {
    return new Promise(resolve => setTimeout(() => {
      resolve()
    }, 1000))
  }
  
  const formData = new FormData()
  formData.append('CourseUnitGuid', courseUnitGuid)
  formData.append('IntakeGuid', intakeGuid)
  formData.append('file', file)
  formData.append('SheetName', sheetName)

  return apiPostForm<void>('/api/v1/assessment/question-bank/practical/import', formData)
}
  
// 4. Delete Question Bank Data for a specific course unit & intake
export function deletePracticalQuestionBank(courseUnitGuid: string, intakeGuid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    return new Promise(resolve => setTimeout(() => {
      resolve(true)
    }, 800))
  }
  
  return apiDelete<boolean>(`/api/v1/assessment/question-bank/practical?courseUnitGuid=${courseUnitGuid}&intakeGuid=${intakeGuid}`)
}

// End of file
