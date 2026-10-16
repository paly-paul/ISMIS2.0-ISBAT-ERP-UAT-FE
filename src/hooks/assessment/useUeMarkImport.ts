import { useQuery, useMutation } from '@tanstack/react-query'
import {
  getUeMarkImportUnits,
  getUeMarkImportExam,
  getUeMarkImportTemplate,
  postUeMarkImportSheets,
  postUeMarkImportPreview,
  postUeMarkImportImport,
  UeMarkImportFileParams
} from '@/lib/api/assessment/ueMarkImport'

export function useUeMarkImportUnits(programGuid: string, semesterGuid: string, enabled: boolean) {
  return useQuery({
    queryKey: ['ue-mark-import-units', programGuid, semesterGuid],
    queryFn: () => getUeMarkImportUnits(programGuid, semesterGuid),
    enabled: enabled && !!programGuid && !!semesterGuid,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useUeMarkImportExam(
  programGuid: string,
  semesterGuid: string,
  courseUnitGuid: string,
  intakeGuid: string,
  ueType: number,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['ue-mark-import-exam', programGuid, semesterGuid, courseUnitGuid, intakeGuid, ueType],
    queryFn: () => getUeMarkImportExam(programGuid, semesterGuid, courseUnitGuid, intakeGuid, ueType),
    enabled: enabled && !!programGuid && !!semesterGuid && !!courseUnitGuid && !!intakeGuid,
  })
}

export function useDownloadUeMarkImportTemplate() {
  return useMutation({
    mutationFn: (universityExamGuid: string) => getUeMarkImportTemplate(universityExamGuid),
    onSuccess: (data) => {
      if (data?.url) {
        window.open(data.url, '_blank')
      } else if (data?.blob) {
        const objectUrl = window.URL.createObjectURL(data.blob)
        const a = document.createElement('a')
        a.href = objectUrl
        a.download = data.filename || 'UE_Mark_Import_Template.xlsx'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(objectUrl)
      }
    }
  })
}

export function useUeMarkImportSheets() {
  return useMutation({
    mutationFn: (file: File) => postUeMarkImportSheets(file),
  })
}

export function useUeMarkImportPreview() {
  return useMutation({
    mutationFn: (params: UeMarkImportFileParams) => postUeMarkImportPreview(params),
  })
}

export function useUeMarkImportImport() {
  return useMutation({
    mutationFn: (params: UeMarkImportFileParams) => postUeMarkImportImport(params),
  })
}
