import { apiDelete, apiGet, apiPost, apiPostForm, apiPutForm } from '../client'
import { getProgramDropdown } from '../academic/programMaster'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed via announcements/get-admin-announcements.md,
// get-admin-announcement-by-guid.md, post-create-announcement.md,
// put-update-announcement.md, delete-announcement.md — same shape on every
// admin endpoint. GET /api/v1/students/announcements returns every
// announcement (no date filter, unlike the student portal endpoint), newest
// announceDate first, unpaginated, wrapped in `{ announcements: [...] }`.
export interface AnnouncementItem {
  announcementGuid: string
  subject: string | null // immutable after creation
  announceDate: string // DateOnly, yyyy-MM-dd — the "Visible Upto" date on screen
  announcementBody: string | null // rich HTML, see RichTextEditor
  isGlobal: boolean
  programGuid: string | null // null when isGlobal
  programName: string | null // null when isGlobal, deactivated, or on create/update responses
  // Short-lived presigned S3 URL — never cache it, re-fetch via GET instead.
  // Always null on an update response that didn't send a new attachment,
  // even when one still exists.
  attachmentUrl: string | null
}

// Scope is modelled as a single programGuid (null = All Programmes) —
// isGlobal is derived from it when building the request so the two can't
// disagree.
export interface AnnouncementCreateInput {
  subject: string
  body: string
  announceDate: string // yyyy-MM-dd
  programGuid: string | null
  attachment: File | null
}

// subject is not accepted on PUT. Omitting attachment leaves the existing
// one untouched — there's no way to remove an attachment, only replace it.
export type AnnouncementUpdateInput = Omit<AnnouncementCreateInput, 'subject'>

// Confirmed via get-student-announcements.md — portal view, only
// announcements with announceDate >= today visible to that student.
export interface StudentAnnouncementItem {
  announcementGuid: string
  subject: string | null
  announceDate: string
  announcementBody: string | null
  isRead: boolean
}

function buildForm(input: AnnouncementUpdateInput, subject?: string): FormData {
  const formData = new FormData()
  if (subject !== undefined) formData.append('subject', subject)
  formData.append('body', input.body)
  formData.append('announceDate', input.announceDate)
  formData.append('isGlobal', String(!input.programGuid))
  // Only sent when scoped — an empty string on a Guid? field fails ASP.NET
  // model binding before validation runs (see extractErrorInfo in client.ts).
  if (input.programGuid) formData.append('programGuid', input.programGuid)
  if (input.attachment) formData.append('attachment', input.attachment)
  return formData
}

let mockAnnouncementSeq = 1

// Seeded from the legacy "Announcement Management" screen's sample rows.
const mockAnnouncements: AnnouncementItem[] = [
  {
    announcementGuid: 'mock-announcement-1',
    subject: "Board Chairman's Message",
    announceDate: '2026-12-31',
    announcementBody: "<p><strong>BOARD CHAIRMAN'S MESSAGE</strong></p><p>Dear Students,</p><p>Greetings from ISBAT University!</p><p>As we begin the continuing students, I extend a warm welcome to the new session Spring 2026! We are pleased and feel happy to have you back, and to embark on a new and exciting academic journey at ISBAT. As we start this new semester, we encourage you to set your goals, stay focused, and make the most of your journey with us and the dreams you hold towards the world of the highest education.</p>",
    isGlobal: true,
    programGuid: null,
    programName: null,
    attachmentUrl: 'https://picsum.photos/seed/isbat-announcement/900/600.jpg',
  },
  {
    announcementGuid: 'mock-announcement-2',
    subject: 'Hybrid Blended Learning Platform',
    announceDate: '2026-10-15',
    announcementBody: '<p>ISBAT University’s Hybrid Blended Learning platform brings every student to a experimental learning, spanning at outcome-based learning as designed by its academic delivery.</p>',
    isGlobal: true,
    programGuid: null,
    programName: null,
    attachmentUrl: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
  },
]

const mockReadGuids = new Set<string>()

// Mirrors the backend resolving programName via the Academic service on GET.
async function withMockProgramNames(items: AnnouncementItem[]): Promise<AnnouncementItem[]> {
  const programs = await getProgramDropdown()
  return items.map(a => ({ ...a, programName: a.programGuid ? programs.find(p => p.programGuid === a.programGuid)?.programName ?? null : null }))
}

function applyMockInput(target: AnnouncementItem, input: AnnouncementUpdateInput) {
  target.announcementBody = input.body
  target.announceDate = input.announceDate
  target.isGlobal = !input.programGuid
  target.programGuid = input.programGuid
  if (input.attachment) {
    if (target.attachmentUrl?.startsWith('blob:')) URL.revokeObjectURL(target.attachmentUrl)
    target.attachmentUrl = URL.createObjectURL(input.attachment)
  }
}

export function getAnnouncements(): Promise<AnnouncementItem[]> {
  if (MOCK_AUTH) {
    const sorted = [...mockAnnouncements].sort((a, b) => b.announceDate.localeCompare(a.announceDate))
    return withMockProgramNames(sorted)
  }
  return apiGet<{ announcements: AnnouncementItem[] } | null>('/api/v1/students/announcements')
    .then(data => data?.announcements ?? [])
}

export function getAnnouncementById(guid: string): Promise<AnnouncementItem> {
  if (MOCK_AUTH) {
    const existing = mockAnnouncements.find(a => a.announcementGuid === guid)
    if (!existing) return Promise.reject(new Error('Announcement not found'))
    return withMockProgramNames([existing]).then(([a]) => a)
  }
  return apiGet<AnnouncementItem>(`/api/v1/students/announcements/${guid}`)
}

export function createAnnouncement(input: AnnouncementCreateInput): Promise<AnnouncementItem> {
  if (MOCK_AUTH) {
    const announcement: AnnouncementItem = {
      announcementGuid: `mock-announcement-new-${mockAnnouncementSeq++}`,
      subject: input.subject,
      announceDate: '',
      announcementBody: null,
      isGlobal: true,
      programGuid: null,
      programName: null,
      attachmentUrl: null,
    }
    applyMockInput(announcement, input)
    mockAnnouncements.push(announcement)
    return Promise.resolve({ ...announcement })
  }
  return apiPostForm<AnnouncementItem>('/api/v1/students/announcements', buildForm(input, input.subject))
}

export function updateAnnouncement(guid: string, input: AnnouncementUpdateInput): Promise<AnnouncementItem> {
  if (MOCK_AUTH) {
    const existing = mockAnnouncements.find(a => a.announcementGuid === guid)
    if (!existing) return Promise.reject(new Error('Announcement not found'))
    applyMockInput(existing, input)
    return Promise.resolve({ ...existing })
  }
  return apiPutForm<AnnouncementItem>(`/api/v1/students/announcements/${guid}`, buildForm(input))
}

// Hard delete — the backend also removes the S3 attachment. `data` is null
// on success, so there's nothing meaningful to return.
export function deleteAnnouncement(guid: string): Promise<void> {
  if (MOCK_AUTH) {
    const index = mockAnnouncements.findIndex(a => a.announcementGuid === guid)
    if (index === -1) return Promise.reject(new Error('Announcement not found'))
    const [removed] = mockAnnouncements.splice(index, 1)
    if (removed.attachmentUrl?.startsWith('blob:')) URL.revokeObjectURL(removed.attachmentUrl)
    return Promise.resolve()
  }
  return apiDelete<null>(`/api/v1/students/announcements/${guid}`).then(() => undefined)
}

// Student portal endpoints — no portal page exists in this app yet, but the
// client is ready for one. An unknown studentGuid returns an empty list, not
// an error.
export function getStudentAnnouncements(studentGuid: string): Promise<StudentAnnouncementItem[]> {
  if (MOCK_AUTH) {
    const today = new Date().toISOString().slice(0, 10)
    const visible = mockAnnouncements
      .filter(a => a.announceDate >= today)
      .sort((a, b) => b.announceDate.localeCompare(a.announceDate))
      .map(({ announcementGuid, subject, announceDate, announcementBody }) => ({
        announcementGuid, subject, announceDate, announcementBody, isRead: mockReadGuids.has(announcementGuid),
      }))
    return Promise.resolve(visible)
  }
  return apiGet<{ announcements: StudentAnnouncementItem[] } | null>(`/api/v1/portal/students/${studentGuid}/announcements`)
    .then(data => data?.announcements ?? [])
}

// Idempotent — safe to call every time an announcement is opened.
export function markAnnouncementRead(studentGuid: string, announcementGuid: string): Promise<void> {
  if (MOCK_AUTH) {
    mockReadGuids.add(announcementGuid)
    return Promise.resolve()
  }
  return apiPost<Record<string, never>>(`/api/v1/portal/students/${studentGuid}/announcements/${announcementGuid}/mark-read`, {})
    .then(() => undefined)
}
