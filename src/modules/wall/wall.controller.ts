import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WallService } from './wall.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { ListCommentsQueryDto } from './dto/list-comments-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { PostListFilter, UploadedMediaFile } from './wall.types';

/**
 * WallController - HTTP layer for posts, comments, and reactions.
 *
 * All endpoints require authentication. Delete endpoints enforce
 * author-or-admin inside the service (no @Roles guard needed - the
 * check depends on WHO owns the resource, not a fixed role).
 *
 * POST /wall/posts accepts multipart for IMAGE/VIDEO/DOCUMENT types.
 * The "file" field is optional - TEXT/LINK/POLL posts send none.
 */
@Controller('wall')
export class WallController {
  constructor(private readonly wallService: WallService) {}

  // ============================================================
  // POSTS
  // ============================================================

  /**
   * POST /api/v1/wall/posts (multipart/form-data)
   * Form fields: type, content?, linkUrl?, pollOptions? (JSON), file?
   */
  @Post('posts')
  @UseInterceptors(FileInterceptor('file'))
  async createPost(
    @Body() dto: CreatePostDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const adapted: UploadedMediaFile | undefined = file
      ? {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        }
      : undefined;

    const post = await this.wallService.createPost(dto, adapted, currentUser);
    return { post };
  }

  /**
   * GET /api/v1/wall/posts
   * The feed - paginated, enriched with author + counts.
   */
  @Get('posts')
  async listPosts(
    @Query() query: ListPostsQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const filter: PostListFilter = {
      authorId: query.authorId,
      type: query.type,
      page: query.page,
      pageSize: query.pageSize,
    };
    return this.wallService.listPosts(filter, currentUser);
  }

  /**
   * GET /api/v1/wall/posts/:id
   */
  @Get('posts/:id')
  async findPostById(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const post = await this.wallService.findPostById(id, currentUser);
    return { post };
  }

  /**
   * DELETE /api/v1/wall/posts/:id
   * Author or admin/dev only (enforced in service). Soft delete. 204.
   */
  @Delete('posts/:id')
  @HttpCode(204)
  async deletePost(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    await this.wallService.deletePost(id, currentUser);
  }

  // ============================================================
  // COMMENTS
  // ============================================================

  /**
   * POST /api/v1/wall/posts/:id/comments
   */
  @Post('posts/:id/comments')
  async createComment(
    @Param('id') postId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const comment = await this.wallService.createComment(
      postId,
      dto,
      currentUser,
    );
    return { comment };
  }

  /**
   * GET /api/v1/wall/posts/:id/comments
   */
  @Get('posts/:id/comments')
  async listComments(
    @Param('id') postId: string,
    @Query() query: ListCommentsQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.wallService.listComments(postId, query, currentUser);
  }

  /**
   * DELETE /api/v1/wall/comments/:id
   * Author or admin/dev only (enforced in service). Hard delete. 204.
   */
  @Delete('comments/:id')
  @HttpCode(204)
  async deleteComment(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    await this.wallService.deleteComment(id, currentUser);
  }

  // ============================================================
  // REACTIONS
  // ============================================================

  /**
   * POST /api/v1/wall/posts/:id/reactions
   * Toggle: same user + same emoji removes it, otherwise adds it.
   */
  @Post('posts/:id/reactions')
  async toggleReaction(
    @Param('id') postId: string,
    @Body() dto: CreateReactionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.wallService.toggleReaction(postId, dto, currentUser);
  }

  /**
   * GET /api/v1/wall/posts/:id/reactions
   */
  @Get('posts/:id/reactions')
  async listReactions(
    @Param('id') postId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const reactions = await this.wallService.listReactions(postId, currentUser);
    return { reactions };
  }
}
