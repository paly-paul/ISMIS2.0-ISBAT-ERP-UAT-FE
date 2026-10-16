'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getUeCourseUnits,
  getUeQuestionSummary,
  getUeQuestions,
  getUeQuestionByGuid,
  createUeQuestion,
  updateUeQuestion,
  verifyUeQuestions,
  SaveUeQuestionRequest,
  UeCourseUnitDto,
  UeQuestionSummaryDto,
  UeQuestionDto,
} from '@/lib/api/assessment/ueQuestions'

/**
 * Hook to fetch course units for UE QP Upload & Vetting
 */
export function useUeCourseUnits() {
  return useQuery<UeCourseUnitDto[]>({
    queryKey: ['ueCourseUnits'],
    queryFn: getUeCourseUnits,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Hook to fetch summary counts and verification status for a course unit
 */
export function useUeQuestionSummary(
  courseUnitGuid: string,
  category = 5,
  ueType = 0
) {
  return useQuery<UeQuestionSummaryDto>({
    queryKey: ['ueQuestionSummary', courseUnitGuid, category, ueType],
    queryFn: () => getUeQuestionSummary(courseUnitGuid, category, ueType),
    enabled: Boolean(courseUnitGuid),
    staleTime: 60 * 1000,
  })
}

/**
 * Hook to fetch question rows for a specific level (Section A/B/C)
 */
export function useUeQuestions(
  courseUnitGuid: string,
  category = 5,
  level: number,
  ueType = 0
) {
  return useQuery<UeQuestionDto[]>({
    queryKey: ['ueQuestions', courseUnitGuid, category, level, ueType],
    queryFn: () => getUeQuestions(courseUnitGuid, category, level, ueType),
    enabled: Boolean(courseUnitGuid) && Boolean(level),
    staleTime: 60 * 1000,
  })
}

/**
 * Hook to fetch a single question by GUID for editing
 */
export function useUeQuestionByGuid(guid: string, enabled = true) {
  return useQuery<UeQuestionDto>({
    queryKey: ['ueQuestion', guid],
    queryFn: () => getUeQuestionByGuid(guid),
    enabled: Boolean(guid) && enabled,
    staleTime: 30 * 1000,
  })
}

/**
 * Mutation to create a new UE question
 */
export function useCreateUeQuestion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: SaveUeQuestionRequest) => createUeQuestion(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['ueQuestionSummary', variables.courseUnitGuid, variables.category, variables.universityExamType],
      })
      queryClient.invalidateQueries({
        queryKey: ['ueQuestions', variables.courseUnitGuid, variables.category, variables.level, variables.universityExamType],
      })
    },
  })
}

/**
 * Mutation to update an existing UE question
 */
export function useUpdateUeQuestion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ guid, payload }: { guid: string; payload: SaveUeQuestionRequest }) =>
      updateUeQuestion(guid, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['ueQuestionSummary', variables.payload.courseUnitGuid, variables.payload.category, variables.payload.universityExamType],
      })
      queryClient.invalidateQueries({
        queryKey: ['ueQuestions', variables.payload.courseUnitGuid, variables.payload.category, variables.payload.level, variables.payload.universityExamType],
      })
      queryClient.invalidateQueries({
        queryKey: ['ueQuestion', variables.guid],
      })
    },
  })
}

/**
 * Mutation to verify/sign-off all questions for a course unit
 */
export function useVerifyUeQuestions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      courseUnitGuid,
      category = 5,
      ueType = 0,
    }: {
      courseUnitGuid: string
      category?: number
      ueType?: number
    }) => verifyUeQuestions(courseUnitGuid, category, ueType),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['ueQuestionSummary', variables.courseUnitGuid, variables.category ?? 5, variables.ueType ?? 0],
      })
      queryClient.invalidateQueries({
        queryKey: ['ueQuestions', variables.courseUnitGuid],
      })
    },
  })
}
