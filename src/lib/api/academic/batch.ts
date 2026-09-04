import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed via a real GET /api/v1/academic/batches response — the legacy
// intProgram/intSem/intStream/batchTime int FKs (with no confirmed guid
// counterpart) have been replaced with real guids on the read side too, not
// just Create/Update. A batch is students enrolled in a specific
// program-semester combination for a given intake.
export interface Batch {
  batchGuid: string
  batchCode: string
  programGuid: string
  semesterGuid: string
  streamGuid: string
  batchTimeGuid: string
  bStartDate: string | null
  bEndDate: string | null
  // 0/1 flag, not a multi-value enum — same convention as country.ts's
  // defaultCountry.
  active: number
}

interface BatchListResult {
  items: Batch[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// Confirmed via a real GET /api/v1/academic/batches/:guid response — this
// endpoint DOES return intakeGuid and bInCharge after all (superseding the
// BatchUpdateInput note below claiming neither could be prefilled); it's
// just a richer shape than the list endpoint's own Batch, not a plain
// re-fetch of the same fields. bInCharge comes back as the all-zero sentinel
// guid ("00000000-0000-0000-0000-000000000000") when unset — .NET's default
// Guid value, not a real employee reference — so treat that value as "no
// in-charge assigned" (null) the same way an empty string is treated
// elsewhere in this app, rather than trying to resolve it against the
// Employee master. intakeCode/intakeDescription/batchTimeName/
// batchTimeCode/yearCode are resolved display strings the create/update
// payload doesn't need (intakeGuid/batchTimeGuid already cover those), and
// pHead is still of unconfirmed purpose with no UI control.
export interface BatchDetail extends Batch {
  bInCharge: string
  intakeGuid: string
  intakeCode: number
  intakeDescription: string
  yearCode: number
  pHead: string | null
  batchTimeName: string
  batchTimeCode: string
}

// .NET's default/unset Guid value — never a real employee/intake reference.
export const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

// Confirmed via the updated Create/Update schema — programGuid/semesterGuid/
// streamGuid/batchTimeGuid are real guids, and bInCharge is now CONFIRMED to
// be a real employeeGuid too (a live sample payload showed a genuine guid,
// not a list-position int) — this resolves the last "int FK with no guid
// source" gap noted for this domain; the 1-based-list-position workaround is
// gone, both here and in NewBatchModal/EditBatchModal. intakeGuid replaces
// the old intakeCode int field (no more Intake lookup-by-code needed to
// submit). pHead is a new field of unconfirmed purpose (possibly "Programme
// Head") — no UI control exists for it yet, always sent null.
export interface BatchCreateInput {
  programGuid: string
  semesterGuid: string
  streamGuid: string
  batchTimeGuid: string
  bStartDate: string | null
  bEndDate: string | null
  bInCharge: string
  intakeGuid: string
  pHead: string | null
}

// Confirmed: Update takes the identical shape as Create — a full replace,
// not a narrower partial body. GET /batches/:guid returns real guid fields
// for all of Programme/Semester/Stream/Batch Time/Intake — see BatchDetail
// above — so EditBatchModal can now prefill every field, including Intake
// and Batch In-Charge (previously believed unrecoverable from GetByGuid;
// corrected by a real sample response — see BatchDetail's own note).
export type BatchUpdateInput = BatchCreateInput

let mockBatchSeq = 1

const mockBatches: Batch[] = [
  { batchGuid: 'd7b04278-21ef-4cfa-8bee-ff336f08e344', batchCode: 'CSF26MRNA', programGuid: 'mock-program-1', semesterGuid: 'mock-semester-1', streamGuid: 'mock-stream-1', batchTimeGuid: 'mock-batchtime-1', bStartDate: '2024-02-12T00:00:00', bEndDate: '2024-06-07T00:00:00', active: 1 },
]

// Lists batches (paginated). search is forwarded to the endpoint's own
// ?search= param (same convention as getIntakes/getSkills) rather than
// filtered client-side — not confirmed against a spec, so callers pair it
// with a client-side re-filter of whatever comes back, keeping results
// correct even if the backend doesn't actually recognize the param.
export function getBatches(pageNumber = 1, pageSize = 20, search = ''): Promise<BatchListResult> {
  const q = search.trim()
  if (MOCK_AUTH) {
    const filtered = q ? mockBatches.filter(b => b.batchCode.toLowerCase().includes(q.toLowerCase())) : mockBatches
    return Promise.resolve({ items: filtered, totalCount: filtered.length, pageNumber, pageSize })
  }
  const params = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) })
  if (q) params.set('search', q)
  return apiGet<BatchListResult | null>(`/api/v1/academic/batches?${params.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber, pageSize })
}

// Create a new batch and return the saved record. batchCode is
// system-generated by the backend — never sent by the client.
export function createBatch(input: BatchCreateInput): Promise<Batch> {
  if (MOCK_AUTH) {
    const batch: Batch = {
      batchGuid: crypto.randomUUID(),
      batchCode: `MOCK-${mockBatchSeq++}`,
      programGuid: input.programGuid,
      semesterGuid: input.semesterGuid,
      streamGuid: input.streamGuid,
      batchTimeGuid: input.batchTimeGuid,
      bStartDate: input.bStartDate,
      bEndDate: input.bEndDate,
      active: 1,
    }
    mockBatches.push(batch)
    return Promise.resolve(batch)
  }
  return apiPost<Batch>('/api/v1/academic/batches', input)
}

// Fetch one batch by its GUID.
export function getBatchById(guid: string): Promise<BatchDetail> {
  if (MOCK_AUTH) {
    const existing = mockBatches.find(b => b.batchGuid === guid)
    if (!existing) return Promise.reject(new Error('Batch not found'))
    return Promise.resolve({
      ...existing,
      bInCharge: EMPTY_GUID,
      intakeGuid: '',
      intakeCode: 0,
      intakeDescription: '',
      yearCode: 0,
      pHead: null,
      batchTimeName: '',
      batchTimeCode: '',
    })
  }
  return apiGet<BatchDetail>(`/api/v1/academic/batches/${guid}`)
}

// Update a batch by GUID and return the updated record.
export function updateBatch(guid: string, input: BatchUpdateInput): Promise<Batch> {
  if (MOCK_AUTH) {
    const existing = mockBatches.find(b => b.batchGuid === guid)
    if (!existing) return Promise.reject(new Error('Batch not found'))
    existing.programGuid = input.programGuid
    existing.semesterGuid = input.semesterGuid
    existing.streamGuid = input.streamGuid
    existing.batchTimeGuid = input.batchTimeGuid
    existing.bStartDate = input.bStartDate
    existing.bEndDate = input.bEndDate
    return Promise.resolve(existing)
  }
  return apiPut<Batch>(`/api/v1/academic/batches/${guid}`, input)
}

// Delete a batch and return true when the API confirms success.
export function deleteBatch(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockBatches.findIndex(b => b.batchGuid === guid)
    if (index === -1) return Promise.reject(new Error('Batch not found'))
    mockBatches.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/academic/batches/${guid}`)
}
