import { Role } from '@prisma/client';

/**
 * Filter parameters for listing/searching members.
 * All fields optional - missing means "no filter".
 */
export interface MemberListFilter {
  role?: Role;
  isActive?: boolean;
  search?: string; // matches username or phone (partial)
  page?: number;
  pageSize?: number;
}

/**
 * Paginated result wrapper used by list endpoints.
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Default pagination values.
 */
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

/**
 * Fields a non-admin member is ALLOWED to change on their own profile.
 * Anything outside this list requires admin/developer role.
 */
export type SelfEditableFields = 'language' | 'avatarUrl';

/**
 * Fields admins/developers can change on any member.
 * Note: role and isActive require Developer role (handled in service).
 */
export type AdminEditableFields =
  | 'username'
  | 'phone'
  | 'language'
  | 'avatarUrl'
  | 'isActive'
  | 'role';
