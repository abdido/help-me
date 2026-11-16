export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export function parsePagination(query: { page?: string; limit?: string }): PaginationParams {
  const requestedPage = Number.parseInt(query.page || '1', 10);
  const requestedLimit = Number.parseInt(query.limit || '10', 10);
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, requestedLimit))
    : 10;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
