import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PostType, Role, WallPost } from '@prisma/client';
import { WallRepository } from './wall.repository';
import { CloudinaryService } from '../../shared/cloudinary/cloudinary.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateReactionDto } from './dto/create-reaction.dto';
import {
  CommentView,
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  PaginatedResult,
  PAGINATION_DEFAULTS,
  PostAuthorSummary,
  PostListFilter,
  PostView,
  ReactionView,
  UploadedMediaFile,
} from './wall.types';

/**
 * WallService - orchestrates posts, comments, reactions and Cloudinary uploads.
 *
 * Authorization:
 *  - anyone authenticated can create posts, comments, reactions and read the feed
 *  - deletePost / deleteComment: author OR admin/dev
 *  - reactions are per-user (toggle: same user + same emoji removes it)
 *
 * Per-type validation on create:
 *  - TEXT     needs content
 *  - LINK     needs linkUrl
 *  - POLL     needs pollOptions (>=2)
 *  - IMAGE    needs image file (<=10MB)
 *  - VIDEO    needs video file (<=50MB)
 *  - DOCUMENT needs a file (any mimetype, <=10MB)
 */
@Injectable()
export class WallService {
  constructor(
    private readonly repository: WallRepository,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // ============================================================
  // POSTS - create
  // ============================================================
  async createPost(
    dto: CreatePostDto,
    file: UploadedMediaFile | undefined,
    currentUser: AuthenticatedUser,
  ): Promise<PostView> {
    this.assertPerTypeRules(dto, file);

    let mediaUrls: string[] = [];

    if (dto.type === PostType.IMAGE && file) {
      const uploaded = await this.cloudinary.uploadImage(
        file.buffer,
        file.originalname,
      );
      mediaUrls = [uploaded.url];
    } else if (dto.type === PostType.VIDEO && file) {
      const uploaded = await this.cloudinary.uploadVideo(
        file.buffer,
        file.originalname,
      );
      mediaUrls = [uploaded.url];
    } else if (dto.type === PostType.DOCUMENT && file) {
      // Documents use image resource-type in Cloudinary for now (Stage 1)
      const uploaded = await this.cloudinary.uploadImage(
        file.buffer,
        file.originalname,
      );
      mediaUrls = [uploaded.url];
    }

    const created = await this.repository.createPost({
      authorId: currentUser.id,
      type: dto.type,
      content: dto.content,
      linkUrl: dto.linkUrl,
      pollOptions: dto.pollOptions,
      mediaUrls,
    });

    // Re-fetch with enriched includes for the response shape
    const enriched = await this.repository.findPostById(created.id);
    if (!enriched) {
      // Should never happen - we just created it
      throw new NotFoundException('Post created but not found for enrichment');
    }
    return this.toPostView(enriched);
  }

  // ============================================================
  // POSTS - list, findById
  // ============================================================
  async listPosts(
    filter: PostListFilter,
    _currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<PostView>> {
    const page = filter.page ?? PAGINATION_DEFAULTS.PAGE;
    const pageSize = Math.min(
      filter.pageSize ?? PAGINATION_DEFAULTS.PAGE_SIZE,
      PAGINATION_DEFAULTS.MAX_PAGE_SIZE,
    );
    const skip = (page - 1) * pageSize;

    const [posts, total] = await Promise.all([
      this.repository.listPosts(filter, { skip, take: pageSize }),
      this.repository.countPosts(filter),
    ]);

    return {
      items: posts.map((p) => this.toPostView(p)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findPostById(
    id: string,
    _currentUser: AuthenticatedUser,
  ): Promise<PostView> {
    const post = await this.repository.findPostById(id);
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return this.toPostView(post);
  }

  // ============================================================
  // POSTS - delete (author OR admin)
  // ============================================================
  async deletePost(id: string, currentUser: AuthenticatedUser): Promise<void> {
    const post = await this.repository.findPostById(id);
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    this.assertOwnerOrPrivileged(post.authorId, currentUser);
    await this.repository.softDeletePost(id);
  }

  // ============================================================
  // COMMENTS
  // ============================================================
  async createComment(
    postId: string,
    dto: CreateCommentDto,
    currentUser: AuthenticatedUser,
  ): Promise<CommentView> {
    const post = await this.repository.findPostById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const created = await this.repository.createComment({
      postId,
      authorId: currentUser.id,
      body: dto.body,
    });

    return this.toCommentView(created, currentUser);
  }

  async listComments(
    postId: string,
    query: { page?: number; pageSize?: number },
    _currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<CommentView>> {
    const post = await this.repository.findPostById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const page = query.page ?? PAGINATION_DEFAULTS.PAGE;
    const pageSize = Math.min(
      query.pageSize ?? PAGINATION_DEFAULTS.PAGE_SIZE,
      PAGINATION_DEFAULTS.MAX_PAGE_SIZE,
    );
    const skip = (page - 1) * pageSize;

    const [comments, total] = await Promise.all([
      this.repository.listComments(postId, { skip, take: pageSize }),
      this.repository.countComments(postId),
    ]);

    return {
      items: comments.map((c) => this.toCommentView(c)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async deleteComment(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    const comment = await this.repository.findCommentById(id);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    this.assertOwnerOrPrivileged(comment.authorId, currentUser);
    await this.repository.deleteComment(id);
  }

  // ============================================================
  // REACTIONS - toggle + list
  // ============================================================
  async toggleReaction(
    postId: string,
    dto: CreateReactionDto,
    currentUser: AuthenticatedUser,
  ): Promise<{ action: 'added' | 'removed'; reaction: ReactionView | null }> {
    const post = await this.repository.findPostById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const existing = await this.repository.findReaction(
      postId,
      currentUser.id,
      dto.emoji,
    );

    if (existing) {
      await this.repository.deleteReaction(existing.id);
      return { action: 'removed', reaction: null };
    }

    const created = await this.repository.createReaction({
      postId,
      userId: currentUser.id,
      emoji: dto.emoji,
    });
    return { action: 'added', reaction: this.toReactionView(created) };
  }

  async listReactions(
    postId: string,
    _currentUser: AuthenticatedUser,
  ): Promise<ReactionView[]> {
    const post = await this.repository.findPostById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    const reactions = await this.repository.listReactions(postId);
    return reactions.map((r) => this.toReactionView(r));
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private assertOwnerOrPrivileged(
    authorId: string,
    user: AuthenticatedUser,
  ): void {
    const isOwner = user.id === authorId;
    const isPrivileged =
      user.role === Role.ADMIN || user.role === Role.DEVELOPER;
    if (!isOwner && !isPrivileged) {
      throw new ForbiddenException('You can only modify your own content');
    }
  }

  private assertPerTypeRules(
    dto: CreatePostDto,
    file: UploadedMediaFile | undefined,
  ): void {
    switch (dto.type) {
      case PostType.TEXT:
        if (!dto.content || dto.content.trim().length === 0) {
          throw new BadRequestException('TEXT post requires content');
        }
        return;

      case PostType.LINK:
        if (!dto.linkUrl) {
          throw new BadRequestException('LINK post requires linkUrl');
        }
        return;

      case PostType.POLL:
        if (!dto.pollOptions || dto.pollOptions.length < 2) {
          throw new BadRequestException(
            'POLL post requires at least 2 options',
          );
        }
        return;

      case PostType.IMAGE:
        this.assertMediaFile(file, ['image/'], MAX_IMAGE_SIZE_BYTES, 'image');
        return;

      case PostType.VIDEO:
        this.assertMediaFile(file, ['video/'], MAX_VIDEO_SIZE_BYTES, 'video');
        return;

      case PostType.DOCUMENT:
        if (!file) {
          throw new BadRequestException('DOCUMENT post requires a file');
        }
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          throw new BadRequestException('Document must not exceed 10 MB');
        }
        return;

      default:
        throw new BadRequestException(`Unsupported post type`);
    }
  }

  private assertMediaFile(
    file: UploadedMediaFile | undefined,
    allowedMimePrefixes: string[],
    maxSize: number,
    label: string,
  ): void {
    if (!file) {
      throw new BadRequestException(`${label} post requires a file`);
    }
    const mimeOk = allowedMimePrefixes.some((p) => file.mimetype.startsWith(p));
    if (!mimeOk) {
      throw new BadRequestException(`File must be a ${label} type`);
    }
    if (file.size > maxSize) {
      const mb = Math.round(maxSize / (1024 * 1024));
      throw new BadRequestException(`${label} must not exceed ${mb} MB`);
    }
  }

  private toPostView(
    post: WallPost & {
      author?: PostAuthorSummary;
      _count?: { reactions: number; comments: number };
    },
  ): PostView {
    return {
      id: post.id,
      type: post.type,
      content: post.content,
      mediaUrls: post.mediaUrls,
      linkUrl: post.linkUrl,
      pollOptions: post.pollOptions,
      isActive: post.isActive,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: post.author ?? {
        id: post.authorId,
        username: '(unknown)',
        avatarUrl: null,
      },
      reactionCount: post._count?.reactions ?? 0,
      commentCount: post._count?.comments ?? 0,
    };
  }

  private toCommentView(
    comment: {
      id: string;
      postId: string;
      authorId: string;
      body: string;
      createdAt: Date;
      author?: PostAuthorSummary;
    },
    fallbackUser?: AuthenticatedUser,
  ): CommentView {
    return {
      id: comment.id,
      postId: comment.postId,
      body: comment.body,
      createdAt: comment.createdAt,
      author: comment.author ?? {
        id: comment.authorId,
        username: fallbackUser?.username ?? '(unknown)',
        avatarUrl: null,
      },
    };
  }

  private toReactionView(reaction: {
    id: string;
    postId: string;
    userId: string;
    emoji: string;
    createdAt: Date;
  }): ReactionView {
    return {
      id: reaction.id,
      postId: reaction.postId,
      userId: reaction.userId,
      emoji: reaction.emoji,
      createdAt: reaction.createdAt,
    };
  }
}
