export const DEFAULT_PAGE_SIZE = 8;

export type PageSlice<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
};

function effectivePageSize(pageSize?: number): number {
  if (pageSize === undefined || pageSize <= 0) {
    return DEFAULT_PAGE_SIZE;
  }
  return pageSize;
}

export function clampPage(page: number, totalPages: number): number {
  const maxPage = Math.max(1, totalPages);
  if (page < 1) {
    return 1;
  }
  if (page > maxPage) {
    return maxPage;
  }
  return page;
}

export function totalPages(totalItems: number, pageSize?: number): number {
  const size = effectivePageSize(pageSize);
  return Math.max(1, Math.ceil(totalItems / size));
}

export function paginate<T>(
  items: T[],
  page: number,
  pageSize?: number,
): PageSlice<T> {
  const size = effectivePageSize(pageSize);
  const pages = totalPages(items.length, size);
  const clamped = clampPage(page, pages);
  const startIndex = items.length === 0 ? 0 : (clamped - 1) * size;
  const endIndex = Math.min(startIndex + size, items.length);

  return {
    items: items.slice(startIndex, endIndex),
    page: clamped,
    pageSize: size,
    totalItems: items.length,
    totalPages: pages,
    startIndex,
    endIndex,
  };
}
