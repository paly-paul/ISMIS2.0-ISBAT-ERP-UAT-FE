import { apiPut } from '../client'
import { CourseUnitOutline } from './courseUnit'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// See put-courseunit-outlines-by-courseunit.md — courseUnitOutlineGuid/
// courseUnitTopicGuid are the diff key: null (or a guid that doesn't match
// an existing row) creates a new chapter/topic, a matching guid updates it
// in place. Whatever's NOT included in the request is soft-deleted, so this
// always has to carry the full desired state, not just what changed.
export interface UpsertCourseUnitOutlineTopicInput {
  courseUnitTopicGuid: string | null
  courseUnitTopicDetails: string
  studySequence: number
  employeeGuid: string
}

export interface UpsertCourseUnitOutlineInput {
  courseUnitOutlineGuid: string | null
  chapter: number
  chapterName: string
  topics: UpsertCourseUnitOutlineTopicInput[]
}

// PUT /api/v1/academic/courseunit-outlines/by-courseunit/{courseUnitGuid} —
// now the only way to write a course unit's chapters/topics. POST
// /courseunits and PUT /courseunits/:guid both explicitly exclude Outlines
// from their own payloads (see post-courseunit.md / put-courseunit.md) —
// createCourseUnit/updateCourseUnit in courseUnit.ts call this right after,
// using the course unit's real guid.
//
// Body is a raw JSON array, not wrapped in an object — apiPut just
// JSON.stringifies whatever's passed as the body, so passing the array
// directly is correct here (no extra wrapping needed).
export function upsertCourseUnitOutlines(courseUnitGuid: string, outlines: UpsertCourseUnitOutlineInput[]): Promise<CourseUnitOutline[]> {
  if (MOCK_AUTH) {
    return Promise.resolve(outlines.map((o, oi) => ({
      courseUnitOutlineGuid: o.courseUnitOutlineGuid ?? `${courseUnitGuid}-${oi}`,
      courseUnitGuid,
      chapter: o.chapter,
      chapterName: o.chapterName,
      topics: o.topics.map((t, ti) => ({
        courseUnitTopicGuid: t.courseUnitTopicGuid ?? `${courseUnitGuid}-${oi}-${ti}`,
        courseUnitTopicCode: `MOCK_${oi + 1}_${ti + 1}`,
        courseUnitTopicDetails: t.courseUnitTopicDetails,
        studySequence: t.studySequence,
        employeeGuid: t.employeeGuid,
      })),
    })))
  }
  return apiPut<CourseUnitOutline[]>(`/api/v1/academic/courseunit-outlines/by-courseunit/${courseUnitGuid}`, outlines)
}
