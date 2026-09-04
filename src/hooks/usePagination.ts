'use client'
import { useMemo, useState } from 'react'

/** Client-side pagination over an already-fetched/filtered array. */
export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1)
  const totalCount = items.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const safePage = Math.min(page, totalPages)

  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  )

  return { page: safePage, setPage, totalPages, totalCount, pageItems }
}
