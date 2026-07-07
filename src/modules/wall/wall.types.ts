import { PostType } from '@prisma/client';

/**
 * Public-safe view of a wall post returned to clients.
 * The "enriched" feed view includes author summary + counts.
 */
export interface PostAuthorSummary {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export interface PostView {
  id: string;
  type: PostType;
  content: string | null;
  mediaUrls: string[];
  linkUrl: string | null;
  pollOptions: unknown | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: PostAuthorSummary;
  reactionCount: number;
  commentCount: number;
}

export interface CommentView {
  id: string;
  postId: string;
  body: string;
  createdAt: Date;
  author: PostAuthorSummary;
}

export interface ReactionView {
  id: string;
  postId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
}

/**
 * Filters / pagination shapes.
 */
export interface PostListFilter {
  authorId?: string;
  type?: PostType;
  page?: number;
  pageSize?: number;
}

export interface CommentListFilter {
  postId: string;
  page?: number;
  pageSize?: number;
}

/**
 * Data passed to the repository when creating resources.
 * authorId / userId are set from the auth user, never the client.
 */
export interface CreatePostData {
  authorId: string;
  type: PostType;
  content?: string;
  mediaUrls?: string[];
  linkUrl?: string;
  pollOptions?: unknown;
}

export interface CreateCommentData {
  postId: string;
  authorId: string;
  body: string;
}

export interface CreateReactionData {
  postId: string;
  userId: string;
  emoji: string;
}

/**
 * Paginated wrapper.
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
 * Maximum file sizes for image / video uploads.
 */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Internal interface for what Multer hands us.
 */
export interface UploadedMediaFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}
