import { Injectable } from '@nestjs/common';
import { Comment, Prisma, Reaction, WallPost } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  CreateCommentData,
  CreatePostData,
  CreateReactionData,
  PostListFilter,
} from './wall.types';

export interface PaginationArgs {
  skip: number;
  take: number;
}

/**
 * Standard include for a post: author summary + counts.
 * Used for the enriched feed response.
 */
const POST_INCLUDE = {
  author: {
    select: { id: true, username: true, avatarUrl: true },
  },
  _count: {
    select: { reactions: true, comments: true },
  },
} as const;

/**
 * Standard include for a comment: just the author summary.
 */
const COMMENT_INCLUDE = {
  author: {
    select: { id: true, username: true, avatarUrl: true },
  },
} as const;

/**
 * WallRepository - the ONLY place Prisma touches WallPost, Comment,
 * and Reaction records. All three sub-domains share this repository
 * because they always operate together (a comment always has a post).
 *
 * Feed queries use `include` to fetch author + counts in one round-trip.
 */
@Injectable()
export class WallRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // POSTS
  // ============================================================

  async findPostById(id: string): Promise<WallPost | null> {
    return this.prisma.wallPost.findUnique({
      where: { id },
      include: POST_INCLUDE,
    });
  }

  async listPosts(
    filter: PostListFilter,
    pagination: PaginationArgs,
  ): Promise<WallPost[]> {
    return this.prisma.wallPost.findMany({
      where: this.buildPostWhere(filter),
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
      include: POST_INCLUDE,
    });
  }

  async countPosts(filter: PostListFilter): Promise<number> {
    return this.prisma.wallPost.count({
      where: this.buildPostWhere(filter),
    });
  }

  async createPost(data: CreatePostData): Promise<WallPost> {
    return this.prisma.wallPost.create({
      data: {
        authorId: data.authorId,
        type: data.type,
        content: data.content,
        mediaUrls: data.mediaUrls ?? [],
        linkUrl: data.linkUrl,
        pollOptions: data.pollOptions as Prisma.InputJsonValue | undefined,
      },
    });
  }

  /**
   * Soft delete: sets isActive: false. The row stays for comment/reaction
   * history. Feed queries filter out inactive posts automatically.
   */
  async softDeletePost(id: string): Promise<WallPost> {
    return this.prisma.wallPost.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ============================================================
  // COMMENTS
  // ============================================================

  async findCommentById(id: string): Promise<Comment | null> {
    return this.prisma.comment.findUnique({
      where: { id },
    });
  }

  async listComments(
    postId: string,
    pagination: PaginationArgs,
  ): Promise<Comment[]> {
    return this.prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      skip: pagination.skip,
      take: pagination.take,
      include: COMMENT_INCLUDE,
    });
  }

  async countComments(postId: string): Promise<number> {
    return this.prisma.comment.count({
      where: { postId },
    });
  }

  async createComment(data: CreateCommentData): Promise<Comment> {
    return this.prisma.comment.create({
      data: {
        postId: data.postId,
        authorId: data.authorId,
        body: data.body,
      },
    });
  }

  async deleteComment(id: string): Promise<Comment> {
    return this.prisma.comment.delete({
      where: { id },
    });
  }

  // ============================================================
  // REACTIONS
  // ============================================================

  /**
   * Check for an existing reaction. Used by the toggle logic:
   * if this returns non-null, delete it; otherwise, create a new one.
   */
  async findReaction(
    postId: string,
    userId: string,
    emoji: string,
  ): Promise<Reaction | null> {
    return this.prisma.reaction.findFirst({
      where: { postId, userId, emoji },
    });
  }

  async listReactions(postId: string): Promise<Reaction[]> {
    return this.prisma.reaction.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createReaction(data: CreateReactionData): Promise<Reaction> {
    return this.prisma.reaction.create({
      data: {
        postId: data.postId,
        userId: data.userId,
        emoji: data.emoji,
      },
    });
  }

  async deleteReaction(id: string): Promise<Reaction> {
    return this.prisma.reaction.delete({
      where: { id },
    });
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private buildPostWhere(filter: PostListFilter): Prisma.WallPostWhereInput {
    const where: Prisma.WallPostWhereInput = { isActive: true };
    if (filter.authorId !== undefined) where.authorId = filter.authorId;
    if (filter.type !== undefined) where.type = filter.type;
    return where;
  }
}
