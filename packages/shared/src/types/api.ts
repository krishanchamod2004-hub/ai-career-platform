/**
 * Generic API envelope types shared across API and clients.
 */

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp?: string;
  path?: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  /** Opaque cursor for infinite-scroll clients; null when the list is exhausted. */
  nextCursor: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}
