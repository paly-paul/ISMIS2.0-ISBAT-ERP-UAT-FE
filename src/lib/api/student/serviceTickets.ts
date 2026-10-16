import { apiGet, apiPut } from '../client'
import { getServiceCategories } from './serviceCategories'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Staff service-ticket triage (service-ticket-staff-page.md). Backs the
// Assessment module's Service Tickets page. The APIs are not deployed yet, so
// every call has a mock branch; the shapes follow the fields the page doc
// names — confirm against get-ticket-queue.md / get-ticket-detail-staff.md /
// put-update-ticket-staff.md / get-enum-values.md once they're available.

// GET /students/enums/ticket-statuses — `value` is the request param,
// `name` the enum name (Open, InProgress, Closed, Pending).
export interface TicketStatusOption {
  value: number
  name: string
}

export type TicketStatusName = 'Open' | 'InProgress' | 'Closed' | 'Pending' | string

// GET /students/service-tickets — one queue row.
export interface ServiceTicketListItem {
  ticketGuid: string
  ticketCode: string
  studentGuid: string
  studentName: string | null
  studentRegNo: string | null
  serviceCategoryGuid: string
  categoryName: string | null
  ticketDate: string
  status: number
  statusName: TicketStatusName
}

// GET /students/service-tickets/{ticketGuid} — the triage panel.
export interface ServiceTicketDetail extends ServiceTicketListItem {
  serviceText: string
  responseText: string | null
  // Set once the ticket has been closed; cleared server-side on reopen.
  closedDate: string | null
}

export interface ServiceTicketQueueParams {
  status?: number
  categoryGuid?: string
  page?: number
  pageSize?: number
}

export interface PagedServiceTickets {
  items: ServiceTicketListItem[]
  totalCount: number
  page: number
  pageSize: number
}

// PUT /students/service-tickets/{ticketGuid} — `status` accepts the enum name
// or its numeric value; the page sends the name.
export interface UpdateServiceTicketRequest {
  serviceCategoryGuid: string
  status: string | number
  responseText: string
}

// ── Mock store (NEXT_PUBLIC_AUTH_MOCK) ─────────────────────────────────────
// Mutable so a save round-trips through the same data the GETs read.
// Category guids match serviceCategories.ts's mock categories.

const MOCK_STATUSES: TicketStatusOption[] = [
  { value: 1, name: 'Open' },
  { value: 2, name: 'InProgress' },
  { value: 3, name: 'Closed' },
  { value: 4, name: 'Pending' },
]

const CAT = {
  finance: { serviceCategoryGuid: 'svc-mock-1', categoryName: 'Finance' },
  assessment: { serviceCategoryGuid: 'svc-mock-2', categoryName: 'Assessment' },
  academic: { serviceCategoryGuid: 'svc-mock-3', categoryName: 'Academic' },
  infra: { serviceCategoryGuid: 'svc-mock-4', categoryName: 'Infrastructure' },
}

function mockTicket(
  n: number, student: [string, string], cat: { serviceCategoryGuid: string; categoryName: string },
  status: TicketStatusName, ticketDate: string, serviceText: string,
  responseText: string | null = null, closedDate: string | null = null,
): ServiceTicketDetail {
  const s = MOCK_STATUSES.find(x => x.name === status)!
  return {
    ticketGuid: `tkt-mock-${n}`,
    ticketCode: `TKT-${String(n).padStart(4, '0')}`,
    studentGuid: `stu-mock-${n}`,
    studentName: student[0],
    studentRegNo: student[1],
    ...cat,
    ticketDate,
    status: s.value,
    statusName: s.name,
    serviceText,
    responseText,
    closedDate,
  }
}

const mockTickets: ServiceTicketDetail[] = [
  mockTicket(1, ['LOJUM NATHANAEL JOSHUA', '011240294'], CAT.finance, 'Open', '2026-10-02T09:14:00Z',
    'I paid the tuition balance of UGX 1,250,000 by bank transfer on 29 Sep (ref ABSA-2609-4421) but my portal still shows the full balance and no receipt was generated.'),
  mockTicket(2, ['AARYAN', '012240747'], CAT.assessment, 'InProgress', '2026-10-01T11:42:00Z',
    'My CW1 mark for BAI2113 Advanced Artificial Intelligence is not showing on the portal, although the lecturer confirmed it was submitted.',
    'We have asked the lecturer to re-publish the CW1 marks for BAI2113. You will be notified once they appear on the portal.'),
  mockTicket(3, ['NAKIBUUKA HAJARAH', '012230213'], CAT.academic, 'Open', '2026-10-01T08:05:00Z',
    'Two of my Semester 3 units (BBAIB2221 and BBAIB2224) are timetabled at the same time on Wednesday 10:00–12:00.'),
  mockTicket(4, ['BAGUMA STEPHEN', '011240168'], CAT.infra, 'Closed', '2026-09-28T14:30:00Z',
    'Workstation 14 in Block C Lab 2 does not power on, so I cannot complete my practical sessions.',
    'The workstation power supply was replaced on 29 Sep. Workstation 14 is working again.', '2026-09-29T16:10:00Z'),
  mockTicket(5, ['ALFRED EKANYA', '012221590'], CAT.assessment, 'Pending', '2026-09-30T10:20:00Z',
    'I would like a recheck of my UE script for BIT2116 Data Communication & Networking. I believe one question was not marked.',
    'Please pay the recheck fee at the finance office and share the receipt number here so we can raise the recheck.'),
  mockTicket(6, ['KATO JOSEPH', '012220626'], CAT.finance, 'Closed', '2026-09-24T09:00:00Z',
    'My scholarship discount for this semester has not been applied to my fee statement.',
    'The 50% merit scholarship has been applied to your Semester 2 invoice. Your statement now reflects the correct balance.', '2026-09-26T12:45:00Z'),
  mockTicket(7, ['AMONG GRACE', '012230118'], CAT.academic, 'InProgress', '2026-09-29T15:55:00Z',
    'I need an official transcript for a scholarship application abroad, due on 15 October.',
    'Your transcript request has been forwarded to the Academic Registrar. It will be ready for collection within 5 working days.'),
  mockTicket(8, ['OKELLO JAMES', '012230541'], CAT.infra, 'Open', '2026-10-02T13:20:00Z',
    'The Wi-Fi in the library second floor has been disconnecting every few minutes since Monday.'),
  mockTicket(9, ['NANTUME BRIDGET', '012240133'], CAT.academic, 'Open', '2026-10-02T07:48:00Z',
    'I lost my student ID card and need a replacement before the UE exams start.'),
  mockTicket(10, ['ISAAC GIIR AKOL GIIR', '011250077'], CAT.finance, 'Pending', '2026-09-27T12:10:00Z',
    'Please confirm whether my sponsor has paid the second instalment for this semester.',
    'We have written to your sponsor for confirmation and are awaiting their reply.'),
  mockTicket(11, ['TIBALIRA MARK JONATHAN', '011240512'], CAT.assessment, 'Closed', '2026-09-22T10:00:00Z',
    'The exam card did not include BAI2118 even though I am registered for the unit.',
    'Your unit registration has been corrected. Please download the updated exam card from the portal.', '2026-09-23T09:30:00Z'),
  mockTicket(12, ['NAKATO SARAH', '012240901'], CAT.academic, 'InProgress', '2026-09-30T16:40:00Z',
    'I would like to change my elective from Cloud Computing to Mobile Application Development.',
    'Your request is with the Head of Department for approval.'),
  mockTicket(13, ['RUHINDA DAUDI KIRENZI', '012230649'], CAT.infra, 'Open', '2026-10-03T06:55:00Z',
    'The projector in Room B204 is not working, and lectures have been held without slides for a week.'),
  mockTicket(14, ['CHAN ABRAHAM KUOL CHAN', '011230465'], CAT.finance, 'Open', '2026-10-03T08:30:00Z',
    'I was charged the late registration fee twice on my statement.'),
]

function toListItem(t: ServiceTicketDetail): ServiceTicketListItem {
  const { serviceText: _s, responseText: _r, closedDate: _c, ...item } = t
  return item
}

function mockError(message: string, code: string) {
  return Object.assign(new Error(message), { code })
}

const delay = <T,>(v: T) => new Promise<T>(r => setTimeout(() => r(v), 250))

// ── API ────────────────────────────────────────────────────────────────────

export function getTicketStatuses(): Promise<TicketStatusOption[]> {
  if (MOCK_AUTH) return delay(MOCK_STATUSES.map(s => ({ ...s })))
  return apiGet<TicketStatusOption[] | null>('/api/v1/students/enums/ticket-statuses').then(data => data ?? [])
}

export function getServiceTicketQueue(params: ServiceTicketQueueParams): Promise<PagedServiceTickets> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 10
  if (MOCK_AUTH) {
    // Newest first.
    const items = mockTickets
      .filter(t => params.status === undefined || t.status === params.status)
      .filter(t => !params.categoryGuid || t.serviceCategoryGuid === params.categoryGuid)
      .sort((a, b) => b.ticketDate.localeCompare(a.ticketDate))
    return delay({
      items: items.slice((page - 1) * pageSize, page * pageSize).map(toListItem),
      totalCount: items.length,
      page,
      pageSize,
    })
  }
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (params.status !== undefined) qs.set('status', String(params.status))
  if (params.categoryGuid) qs.set('categoryGuid', params.categoryGuid)
  return apiGet<PagedServiceTickets | null>(`/api/v1/students/service-tickets?${qs}`)
    .then(data => data ?? { items: [], totalCount: 0, page, pageSize })
}

export function getServiceTicket(ticketGuid: string): Promise<ServiceTicketDetail> {
  if (MOCK_AUTH) {
    const t = mockTickets.find(x => x.ticketGuid === ticketGuid)
    return t ? delay({ ...t }) : Promise.reject(mockError('Service ticket not found.', 'not_found'))
  }
  return apiGet<ServiceTicketDetail>(`/api/v1/students/service-tickets/${ticketGuid}`)
}

export async function updateServiceTicket(ticketGuid: string, payload: UpdateServiceTicketRequest): Promise<ServiceTicketDetail> {
  if (MOCK_AUTH) {
    const t = mockTickets.find(x => x.ticketGuid === ticketGuid)
    if (!t) throw mockError('Service ticket not found.', 'not_found')
    const status = MOCK_STATUSES.find(s => s.name === payload.status || s.value === payload.status)
    if (!status) throw mockError('Invalid ticket status.', 'validation_error')
    const { items: categories } = await getServiceCategories(1, 100)
    const category = categories.find(c => c.serviceCategoryGuid === payload.serviceCategoryGuid)
    if (!category) throw mockError('Service category not found.', 'not_found')
    const wasClosed = t.statusName === 'Closed'
    Object.assign(t, {
      serviceCategoryGuid: category.serviceCategoryGuid,
      categoryName: category.categoryName,
      status: status.value,
      statusName: status.name,
      responseText: payload.responseText,
      // Closing stamps the date (kept on a re-save); reopening clears it.
      closedDate: status.name === 'Closed' ? (wasClosed ? t.closedDate : new Date().toISOString()) : null,
    })
    return delay({ ...t })
  }
  return apiPut<ServiceTicketDetail>(`/api/v1/students/service-tickets/${ticketGuid}`, payload)
}
