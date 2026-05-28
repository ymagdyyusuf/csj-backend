/**
 * Public-safe view of a Boqs broadcast returned to clients.
 */
export interface BoqsView {
  id: string;
  audioUrl: string;
  text: string;
  duration: number;
  sentById: string;
  sentAt: Date;
  deviceCount: number;
}

/**
 * Filter parameters for listing broadcasts.
 */
export interface BoqsListFilter {
  sentById?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

/**
 * Data passed to the repository when creating a broadcast.
 * audioUrl + duration come from Cloudinary; sentById from the auth user.
 */
export interface CreateBoqsData {
  audioUrl: string;
  text: string;
  duration: number;
  sentById: string;
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
 * Internal interface for what Multer hands us.
 * (Avoids depending on the global Express.Multer.File type everywhere.)
 */
export interface UploadedAudioFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}
