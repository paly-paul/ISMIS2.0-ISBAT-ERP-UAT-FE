import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AnnouncementCreateInput, AnnouncementItem, AnnouncementUpdateInput, StudentAnnouncementItem,
  createAnnouncement, deleteAnnouncement, getAnnouncementById, getAnnouncements,
  getStudentAnnouncements, markAnnouncementRead, updateAnnouncement,
} from '@/lib/api/student/announcementManagement'

const ANNOUNCEMENTS_KEY = ['student-announcements']
const PORTAL_ANNOUNCEMENTS_KEY = ['portal-student-announcements']

// The endpoint returns the full unpaginated list (see
// get-admin-announcements.md) — search/pagination are handled client-side.
// Default staleTime (0) on purpose: attachment URLs are short-lived presigns.
export function useAnnouncements() {
  return useQuery({
    queryKey: ANNOUNCEMENTS_KEY,
    queryFn: () => getAnnouncements(),
  })
}

export function useAnnouncement(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...ANNOUNCEMENTS_KEY, guid],
    queryFn: () => getAnnouncementById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AnnouncementCreateInput) => createAnnouncement(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY }),
  })
}

// Invalidates rather than merging the response — it always carries a null
// programName (and a null attachmentUrl when no new file was sent).
export function useUpdateAnnouncement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: AnnouncementUpdateInput }) => updateAnnouncement(guid, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY }),
  })
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteAnnouncement(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY }),
  })
}

export function useStudentAnnouncements(studentGuid: string | null) {
  return useQuery({
    queryKey: [...PORTAL_ANNOUNCEMENTS_KEY, studentGuid],
    queryFn: () => getStudentAnnouncements(studentGuid as string),
    enabled: !!studentGuid,
  })
}

export function useMarkAnnouncementRead(studentGuid: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (announcementGuid: string) => markAnnouncementRead(studentGuid as string, announcementGuid),
    onSuccess: (_data, announcementGuid) => {
      queryClient.setQueryData<StudentAnnouncementItem[]>([...PORTAL_ANNOUNCEMENTS_KEY, studentGuid], prev =>
        prev?.map(a => (a.announcementGuid === announcementGuid ? { ...a, isRead: true } : a)),
      )
    },
  })
}

export type { AnnouncementItem, AnnouncementCreateInput, AnnouncementUpdateInput, StudentAnnouncementItem }
