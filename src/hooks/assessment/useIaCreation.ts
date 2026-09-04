import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CreateIaStructureRequest,
  createIaStructure,
  getIaCreationInit,
  getIaCreationSemesters,
  getIaCreationStructure,
} from '@/lib/api/assessment/iaCreation'

const IA_INIT_KEY = ['ia-creation-init']
const IA_SEMESTERS_KEY = ['ia-creation-semesters']
const IA_STRUCTURE_KEY = ['ia-creation-structure']

/** Fetches Programme + Intake dropdowns on page load */
export function useIaCreationInit() {
  return useQuery({
    queryKey: IA_INIT_KEY,
    queryFn: () => getIaCreationInit(),
  })
}

/** Fetches Semester dropdown when Programme changes */
export function useIaCreationSemesters(programGuid: string | null) {
  return useQuery({
    queryKey: [...IA_SEMESTERS_KEY, programGuid],
    queryFn: () => getIaCreationSemesters(programGuid as string),
    enabled: !!programGuid,
  })
}

/** Fetches the IA structure grid (triggered by Refresh button or auto-fetch) */
export function useIaCreationStructure(
  programGuid: string | null,
  semesterGuid: string | null,
  intakeGuid: string | null
) {
  return useQuery({
    queryKey: [...IA_STRUCTURE_KEY, programGuid, semesterGuid, intakeGuid],
    queryFn: () =>
      getIaCreationStructure(
        programGuid as string,
        semesterGuid as string,
        intakeGuid as string
      ),
    enabled: !!programGuid && !!semesterGuid && !!intakeGuid,
  })
}

/** Creates the IA skeleton — triggered by Create button */
export function useCreateIaStructure() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateIaStructureRequest) => createIaStructure(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IA_STRUCTURE_KEY })
    },
  })
}
