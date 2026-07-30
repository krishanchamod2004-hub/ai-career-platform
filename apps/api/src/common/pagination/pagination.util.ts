import { BadRequestException } from '@nestjs/common';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, type PaginatedResponse } from '@ai-career/shared';

export interface CursorPayload {
  /** Sort key value of the last returned row (ISO date or numeric string). */
  value: string;
  /** Tie-breaker so rows sharing a sort value are never skipped or repeated. */
  id: string;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as CursorPayload;
    if (!parsed?.value || !parsed?.id) {
      throw new Error('missing fields');
    }
    return parsed;
  } catch {
    throw new BadRequestException('Invalid pagination cursor');
  }
}

export function normalizePagination(page?: number, pageSize?: number): {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
} {
  const safePage = Math.max(1, Math.trunc(page ?? 1));
  const safeSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(pageSize ?? DEFAULT_PAGE_SIZE)));
  return { page: safePage, pageSize: safeSize, skip: (safePage - 1) * safeSize, take: safeSize };
}

export function buildPaginatedResponse<T>(
  items: T[],
  totalItems: number,
  page: number,
  pageSize: number,
  nextCursor: string | null = null,
): PaginatedResponse<T> {
  const totalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) : 0;
  return {
    items,
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: nextCursor !== null || page < totalPages,
      nextCursor,
    },
  };
}
