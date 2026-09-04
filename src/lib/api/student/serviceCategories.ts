import { apiGet, apiPost, apiPut, apiDelete } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Backs the Config module's Service Category Master page (see
// config/service-category-master/page.tsx). CRUD confirmed against
// students/service-categories/*.md (2026-08-28). The real record is just
// { serviceCategoryGuid, categoryName } — there's no "Routes To" free-text
// field on the backend, so that mock-only column was dropped rather than
// faked.
export interface ServiceCategoryDto {
  serviceCategoryGuid: string
  categoryName: string | null
}

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
}

export interface ServiceCategoryRequest {
  categoryName: string
}

const mockCategories: ServiceCategoryDto[] = [
  { serviceCategoryGuid: 'svc-mock-1', categoryName: 'Finance' },
  { serviceCategoryGuid: 'svc-mock-2', categoryName: 'Assessment' },
  { serviceCategoryGuid: 'svc-mock-3', categoryName: 'Academic' },
  { serviceCategoryGuid: 'svc-mock-4', categoryName: 'Infrastructure' },
]

export function getServiceCategories(page = 1, pageSize = 25): Promise<PagedResult<ServiceCategoryDto>> {
  if (MOCK_AUTH) return Promise.resolve({ items: mockCategories, totalCount: mockCategories.length, page, pageSize })
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  return apiGet<PagedResult<ServiceCategoryDto> | null>(`/api/v1/students/service-categories?${params.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, page, pageSize })
}

export function createServiceCategory(payload: ServiceCategoryRequest): Promise<ServiceCategoryDto> {
  if (MOCK_AUTH) {
    const row: ServiceCategoryDto = { serviceCategoryGuid: `svc-mock-${Date.now()}`, categoryName: payload.categoryName }
    mockCategories.push(row)
    return Promise.resolve(row)
  }
  return apiPost<ServiceCategoryDto>('/api/v1/students/service-categories', payload)
}

export function updateServiceCategory(guid: string, payload: ServiceCategoryRequest): Promise<ServiceCategoryDto> {
  if (MOCK_AUTH) {
    const idx = mockCategories.findIndex(c => c.serviceCategoryGuid === guid)
    if (idx !== -1) mockCategories[idx] = { ...mockCategories[idx], categoryName: payload.categoryName }
    return Promise.resolve(mockCategories[idx])
  }
  return apiPut<ServiceCategoryDto>(`/api/v1/students/service-categories/${guid}`, payload)
}

// Soft-delete server-side (IsDeleted=true) — a repeat delete on an
// already-deleted guid comes back as a 400 `failure`, not idempotent, per
// the docs. Nothing client-side needs to special-case that; the row is just
// gone from the list either way once the query refetches.
export function deleteServiceCategory(guid: string): Promise<void> {
  if (MOCK_AUTH) {
    const idx = mockCategories.findIndex(c => c.serviceCategoryGuid === guid)
    if (idx !== -1) mockCategories.splice(idx, 1)
    return Promise.resolve()
  }
  return apiDelete<void>(`/api/v1/students/service-categories/${guid}`)
}
