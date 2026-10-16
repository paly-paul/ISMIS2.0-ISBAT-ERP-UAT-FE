import { useMutation } from '@tanstack/react-query'
import {
  downloadExamMarkTemplate,
  getExamMarkSheets,
  importExamMarks,
  previewExamMarks,
} from '@/lib/api/assessment/examMarkImport'

// Exam Mark Import (exam-mark-import-page.md). Every step re-sends the
// picked File, so these are mutations rather than cached queries.

export function useDownloadExamMarkTemplate() {
  return useMutation({ mutationFn: downloadExamMarkTemplate })
}

export function useExamMarkSheets() {
  return useMutation({ mutationFn: (file: File) => getExamMarkSheets(file) })
}

export function useExamMarkPreview() {
  return useMutation({ mutationFn: ({ file, sheetName }: { file: File; sheetName: string }) => previewExamMarks(file, sheetName) })
}

export function useImportExamMarks() {
  return useMutation({ mutationFn: ({ file, sheetName }: { file: File; sheetName: string }) => importExamMarks(file, sheetName) })
}
