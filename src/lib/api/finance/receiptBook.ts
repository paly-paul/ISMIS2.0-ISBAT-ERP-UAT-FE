import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// UI-facing labels for the backend's ReceiptBookStatus/ReceiptCategory/
// ReceiptBookCategory enums — values confirmed against
// Finance/Receipt-Books/Create.bru + Update.bru docs.
export type ReceiptBookStatus = 'Inactive' | 'Active'
export const STATUS_VALUES: Record<ReceiptBookStatus, number> = { Inactive: 0, Active: 1 }
export const STATUS_LABELS: Record<number, ReceiptBookStatus> = { 0: 'Inactive', 1: 'Active' }

export type ReceiptCategory = 'Cash' | 'Bank' | 'Online'
export const CATEGORY_VALUES: Record<ReceiptCategory, number> = { Cash: 0, Bank: 1, Online: 2 }
export const CATEGORY_LABELS: Record<number, ReceiptCategory> = { 0: 'Cash', 1: 'Bank', 2: 'Online' }

export type ReceiptBookCategory = 'A' | 'B'
export const BOOK_CATEGORY_VALUES: Record<ReceiptBookCategory, number> = { A: 1, B: 2 }
export const BOOK_CATEGORY_LABELS: Record<number, ReceiptBookCategory> = { 1: 'A', 2: 'B' }

export interface ReceiptBook {
  receiptBookGuid: string
  bookCode: string
  startNo: number
  // Server-computed from startNo + count — never sent, only read.
  endNo: number | null
  prefix: string
  // Current receipt counter position within the book — server-managed.
  receipt: number | null
  status: number
  category: number
  copy: number | null
  count: number | null
  bookCategory: number | null
}

// POST payload — bookCode/startNo/prefix/count are only settable at creation.
export interface CreateReceiptBookInput {
  bookCode: string
  startNo: number
  prefix: string
  count: number
  status: number
  category: number
  copy: number | null
  bookCategory: number | null
}

// PUT payload — per Update.bru, bookCode/startNo/prefix/count cannot be
// changed after creation; only these four fields are editable.
export interface UpdateReceiptBookInput {
  status: number
  category: number
  copy: number | null
  bookCategory: number | null
}

interface ReceiptBookListResponse {
  items: ReceiptBook[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// Backing store used only when NEXT_PUBLIC_AUTH_MOCK is on — GET, POST, PUT,
// and DELETE are all wired to the real endpoints otherwise.
const mockReceiptBooks: ReceiptBook[] = [
  { receiptBookGuid: '3efea79b-60a6-4b02-9826-679340ef5e67', bookCode: 'CASH01', startNo: 1, endNo: null, prefix: 'CR', receipt: 1, status: 1, category: 0, copy: null, count: null, bookCategory: null },
]

// pageSize was previously hardcoded to 10 — harmless-looking, but a real
// response confirmed totalCount can be 230+, so that silently hid all but
// the first page everywhere this is used (the /finance/receipt-books master
// table itself, and the Payment/Payment Console dropdowns, which lost most
// of their Active options as a result). Same "load it all in one request,
// filter/paginate client-side" convention as Intakes/Program Fee Structures/
// Batches elsewhere in this app.
const RECEIPT_BOOKS_LOAD_SIZE = 1000

export function getReceiptBooks(): Promise<ReceiptBook[]> {
  if (MOCK_AUTH) return Promise.resolve(mockReceiptBooks)
  return apiGet<ReceiptBookListResponse | null>(`/api/v1/finance/receipt-books?page=1&pageSize=${RECEIPT_BOOKS_LOAD_SIZE}`).then(data => data?.items ?? [])
}

export function createReceiptBook(input: CreateReceiptBookInput): Promise<ReceiptBook> {
  if (MOCK_AUTH) {
    const book: ReceiptBook = {
      receiptBookGuid: crypto.randomUUID(),
      bookCode: input.bookCode,
      startNo: input.startNo,
      endNo: input.startNo + input.count - 1,
      prefix: input.prefix,
      receipt: input.startNo,
      status: input.status,
      category: input.category,
      copy: input.copy,
      count: input.count,
      bookCategory: input.bookCategory,
    }
    mockReceiptBooks.push(book)
    return Promise.resolve(book)
  }
  return apiPost<ReceiptBook>('/api/v1/finance/receipt-books', input)
}

// No GetByGuid endpoint exists for receipt books — the Edit modal is seeded
// from the row already loaded in the list, not fetched by guid.
export function updateReceiptBook(guid: string, input: UpdateReceiptBookInput): Promise<ReceiptBook> {
  if (MOCK_AUTH) {
    const existing = mockReceiptBooks.find(b => b.receiptBookGuid === guid)
    if (!existing) return Promise.reject(new Error('Receipt book not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<ReceiptBook>(`/api/v1/finance/receipt-books/${guid}`, input)
}

export function deleteReceiptBook(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockReceiptBooks.findIndex(b => b.receiptBookGuid === guid)
    if (index === -1) return Promise.reject(new Error('Receipt book not found'))
    mockReceiptBooks.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/finance/receipt-books/${guid}`)
}
