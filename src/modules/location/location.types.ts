/**
 * Public-safe view of a location log returned to clients.
 */
export interface LocationView {
  id: string;
  memberId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: Date;
}

/**
 * Filter parameters for listing location logs.
 */
export interface LocationListFilter {
  memberId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

/**
 * Data passed to the repository when creating a log.
 * memberId is set from the authenticated user, never the client.
 */
export interface CreateLocationData {
  memberId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/**
 * Paginated result wrapper.
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

/**
 * Minimum seconds between consecutive pings from the same member.
 * Anything closer is rejected with 429.
 */
export const MIN_PING_INTERVAL_SECONDS = 60;
