import { AttendanceStatus, AttendanceType, SyncStatus } from '@prisma/client';

/**
 * Public-safe view of an attendance record returned to clients.
 */
export interface AttendanceView {
  id: string;
  memberId: string;
  scheduleId: string | null;
  eventId: string | null;
  type: AttendanceType;
  status: AttendanceStatus;
  date: Date;
  markedById: string;
  isOffline: boolean;
  syncStatus: SyncStatus;
  syncedAt: Date | null;
  notes: string | null;
  createdAt: Date;
}

/**
 * Filter parameters for listing attendance records.
 */
export interface AttendanceListFilter {
  memberId?: string;
  scheduleId?: string;
  eventId?: string;
  type?: AttendanceType;
  status?: AttendanceStatus;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

/**
 * Data for creating one attendance record.
 * markedById is set from the authenticated user, never from the client.
 */
export interface CreateAttendanceData {
  memberId: string;
  scheduleId?: string;
  eventId?: string;
  type: AttendanceType;
  status: AttendanceStatus;
  date: Date;
  markedById: string;
  isOffline?: boolean;
  syncStatus?: SyncStatus;
  syncedAt?: Date;
  notes?: string;
}

/**
 * Data for updating an attendance record.
 */
export interface UpdateAttendanceData {
  status?: AttendanceStatus;
  notes?: string;
}

/**
 * Paginated result wrapper (mirrors members.types).
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
