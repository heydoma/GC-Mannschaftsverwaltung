import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PAGE_SIZE_OPTIONS } from '@/lib/usePagination'
import type { PageSize } from '@/lib/usePagination'

interface TableToolbarProps {
  page: number
  pageSize: PageSize
  totalItems: number
  totalPages: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: PageSize) => void
}

export function TableToolbar({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: TableToolbarProps) {
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2 border-t bg-muted/30 shrink-0 text-xs text-muted-foreground">
      {/* Rows per page */}
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline">Zeilen:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
          className="h-7 rounded-md border bg-background px-1.5 text-xs font-medium text-foreground"
        >
          {PAGE_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Range + navigation */}
      <div className="flex items-center gap-3">
        <span>{from}–{to} von {totalItems}</span>
        <div className="flex items-center gap-1">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="flex h-7 w-7 items-center justify-center rounded-md border bg-background transition-colors hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Vorherige Seite"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[3rem] text-center font-medium text-foreground">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="flex h-7 w-7 items-center justify-center rounded-md border bg-background transition-colors hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Nächste Seite"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
