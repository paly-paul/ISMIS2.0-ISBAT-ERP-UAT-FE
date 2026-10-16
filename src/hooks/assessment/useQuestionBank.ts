import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteQuestionBank,
  getQuestionBankCategories,
  getQuestionBankCourseUnits,
  getQuestionBankTemplate,
  postQuestionBankImport,
  postQuestionBankPreview,
  postQuestionBankSheets,
  QuestionBankCategory,
  QuestionBankCourseUnit,
  QuestionBankFileParams,
  QuestionBankImportResult,
  QuestionBankTemplateResponse,
  QuestionPreviewItem,
} from '@/lib/api/assessment/questionBank'

export const QUESTION_BANK_KEYS = {
  categories: ['question-bank', 'categories'] as const,
  courseUnits: (intakeGuid: string, lecturerGuid: string) =>
    ['question-bank', 'course-units', intakeGuid, lecturerGuid] as const,
  template: ['question-bank', 'template'] as const,
}

/**
 * Fetch fixed Category options (CBT, Course Work, University Exam).
 */
export function useQuestionBankCategories(enabled = true) {
  return useQuery<QuestionBankCategory[]>({
    queryKey: QUESTION_BANK_KEYS.categories,
    queryFn: () => getQuestionBankCategories(),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  })
}

/**
 * Fetch planned course units filtered by intakeGuid and lecturerGuid.
 */
export function useQuestionBankCourseUnits(
  intakeGuid: string,
  lecturerGuid: string,
  enabled = true,
) {
  return useQuery<QuestionBankCourseUnit[]>({
    queryKey: QUESTION_BANK_KEYS.courseUnits(intakeGuid, lecturerGuid),
    queryFn: () => getQuestionBankCourseUnits(intakeGuid, lecturerGuid),
    enabled: enabled && Boolean(intakeGuid) && Boolean(lecturerGuid),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Trigger presigned template URL fetch and browser download.
 */
export function useDownloadQuestionBankTemplate() {
  return useMutation<QuestionBankTemplateResponse>({
    mutationFn: () => getQuestionBankTemplate(),
    onSuccess: (data) => {
      if (data?.url) {
        const link = document.createElement('a')
        link.href = data.url
        link.setAttribute('download', 'QuestionBankImportTemplate.xlsx')
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    },
  })
}

/**
 * Inspect uploaded workbook to get sheet names.
 */
export function useQuestionBankSheets() {
  return useMutation<string[], Error, File>({
    mutationFn: (file: File) => postQuestionBankSheets(file),
  })
}

/**
 * Validate and parse questions for preview table.
 */
export function useQuestionBankPreview() {
  return useMutation<QuestionPreviewItem[], Error, QuestionBankFileParams>({
    mutationFn: (params: QuestionBankFileParams) => postQuestionBankPreview(params),
  })
}

/**
 * Commit validated questions to database and archive file to S3.
 */
export function useQuestionBankImport() {
  const queryClient = useQueryClient()
  return useMutation<QuestionBankImportResult, Error, QuestionBankFileParams>({
    mutationFn: (params: QuestionBankFileParams) => postQuestionBankImport(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] })
    },
  })
}

/**
 * Soft-delete existing questions for the given course unit, category, and intake.
 */
export function useDeleteQuestionBank() {
  const queryClient = useQueryClient()
  return useMutation<
    QuestionBankImportResult,
    Error,
    { courseUnitGuid: string; category: number; intakeGuid: string }
  >({
    mutationFn: ({ courseUnitGuid, category, intakeGuid }) =>
      deleteQuestionBank(courseUnitGuid, category, intakeGuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] })
    },
  })
}

export type {
  QuestionBankCategory,
  QuestionBankCourseUnit,
  QuestionBankTemplateResponse,
  QuestionPreviewItem,
  QuestionBankFileParams,
  QuestionBankImportResult,
}
