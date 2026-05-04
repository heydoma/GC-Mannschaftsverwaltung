import { useState, useMemo, useEffect } from 'react'

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

export interface PaginationState<T> {
  page: number
  pageSize: PageSize
  totalItems: number
  totalPages: number
  pageItems: T[]
  setPage: (p: number) => void
  setPageSize: (s: PageSize) => void
}

export function usePagination<T>(items: T[], defaultPageSize: PageSize = 25): PaginationState<T> {
  const [page, setPageRaw] = useState(1)
  const [pageSize, setPageSizeRaw] = useState<PageSize>(defaultPageSize)

  // Reset to page 1 when data or page size changes
  useEffect(() => {
    setPageRaw(1)
  }, [items.length, pageSize])

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  const setPage = (p: number) => setPageRaw(Math.min(Math.max(1, p), totalPages))
  const setPageSize = (s: PageSize) => setPageSizeRaw(s)

  return {
    page,
    pageSize,
    totalItems: items.length,
    totalPages,
    pageItems,
    setPage,
    setPageSize,
  }
}
