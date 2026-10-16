export interface PaginatedItems<T> {
  items: T[]
  totalCount: number
  pageNumber?: number
  pageSize?: number
}

export function getNextPageParam<T extends PaginatedItems<unknown>>(
  lastPage: T,
  allPages: T[],
): number | undefined {
  const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0)
  if (lastPage.items.length === 0) return undefined

  // Some endpoints return totalCount for the current response rather than
  // the complete filtered dataset. A full page is therefore the reliable
  // signal that another page may exist; an extra empty request is preferable
  // to hiding every result after the first page.
  const pageSize = lastPage.pageSize ?? lastPage.items.length
  if (lastPage.items.length < pageSize) return undefined
  if (lastPage.totalCount > loaded && lastPage.items.length > 0) return allPages.length + 1
  if (lastPage.totalCount <= loaded && lastPage.totalCount !== lastPage.items.length) return undefined
  return allPages.length + 1
}

export function flattenUniquePages<T>(
  pages: Array<{ items: T[] }>,
  getKey: (item: T) => string,
): T[] {
  const unique = new Map<string, T>()
  pages.forEach(page => page.items.forEach(item => unique.set(getKey(item), item)))
  return [...unique.values()]
}