import { useState } from 'react';

interface UsePaginationResult<T> {
  /** Effective 1-based current page (clamped to the valid range). */
  page: number;
  setPage: (page: number) => void;
  /** The slice of `items` belonging to the current page. */
  pageItems: T[];
  /** Total number of pages (minimum 1, even when `items` is empty). */
  totalPages: number;
  /** Total number of items across all pages. */
  total: number;
  /** 1-based index of the first item on the current page (0 when `total` is 0). */
  startIndex: number;
  /** 1-based index of the last item on the current page (0 when `total` is 0). */
  endIndex: number;
}

/**
 * Client-side pagination over an already-loaded array. Data stays fully
 * loaded (so search/filter/counts remain instant over the complete set) —
 * only the rendered slice is paginated.
 *
 * The current page is clamped at derive time (`Math.min(page, totalPages)`),
 * so shrinking the input array (e.g. via search/filter) never strands the
 * caller on a page that no longer exists — no effect needed to reset it.
 */
export function usePagination<T>(items: T[], pageSize = 25): UsePaginationResult<T> {
  const [page, setPage] = useState(1);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const effectivePage = Math.min(page, totalPages);

  const startIndex = total === 0 ? 0 : (effectivePage - 1) * pageSize + 1;
  const endIndex = total === 0 ? 0 : Math.min(effectivePage * pageSize, total);

  const pageItems = items.slice((effectivePage - 1) * pageSize, effectivePage * pageSize);

  return {
    page: effectivePage,
    setPage,
    pageItems,
    totalPages,
    total,
    startIndex,
    endIndex,
  };
}
