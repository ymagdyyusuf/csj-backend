import { Test, TestingModule } from '@nestjs/testing';
import { PostType, Role } from '@prisma/client';
import { WallController } from '../wall.controller';
import { WallService } from '../wall.service';
import { AuthenticatedUser } from '../../auth/auth.types';

describe('WallController', () => {
  let controller: WallController;
  let service: jest.Mocked<WallService>;

  const memberUser: AuthenticatedUser = {
    id: 'cuid_member_001',
    uniqueId: 'CSJ-001',
    username: 'ahmed_scout',
    phone: '+201234567890',
    role: Role.MEMBER,
    isActive: true,
    language: 'ar',
  };

  const mockPostView = {
    id: 'cuid_post_001',
    type: PostType.TEXT,
    content: 'Hello scouts',
    mediaUrls: [],
    linkUrl: null,
    pollOptions: null,
    isActive: true,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
    author: { id: 'cuid_member_001', username: 'ahmed_scout', avatarUrl: null },
    reactionCount: 3,
    commentCount: 2,
  };

  const mockCommentView = {
    id: 'cuid_comment_001',
    postId: 'cuid_post_001',
    body: 'Great post!',
    createdAt: new Date('2026-01-15'),
    author: { id: 'cuid_member_002', username: 'sara_scout', avatarUrl: null },
  };

  const mockReactionView = {
    id: 'cuid_reaction_001',
    postId: 'cuid_post_001',
    userId: 'cuid_member_002',
    emoji: '👍',
    createdAt: new Date('2026-01-15'),
  };

  const mockPaginatedPosts = {
    items: [mockPostView],
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };

  const mockPaginatedComments = {
    items: [mockCommentView],
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };

  const mockFile = {
    buffer: Buffer.from('img bytes'),
    originalname: 'photo.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
  } as Express.Multer.File;

  beforeEach(async () => {
    const serviceMock = {
      createPost: jest.fn(),
      listPosts: jest.fn(),
      findPostById: jest.fn(),
      deletePost: jest.fn(),
      createComment: jest.fn(),
      listComments: jest.fn(),
      deleteComment: jest.fn(),
      toggleReaction: jest.fn(),
      listReactions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WallController],
      providers: [{ provide: WallService, useValue: serviceMock }],
    }).compile();

    controller = module.get<WallController>(WallController);
    service = module.get(WallService) as unknown as jest.Mocked<WallService>;
  });

  // ============================================================
  // POSTS
  // ============================================================
  describe('createPost', () => {
    it('creates a post wrapped in { post }', async () => {
      service.createPost.mockResolvedValue(mockPostView);

      const result = await controller.createPost(
        { type: PostType.TEXT, content: 'Hello scouts' },
        mockFile,
        memberUser,
      );

      expect(result.post.id).toBe('cuid_post_001');
      expect(service.createPost).toHaveBeenCalled();
    });
  });

  describe('listPosts', () => {
    it('returns paginated posts', async () => {
      service.listPosts.mockResolvedValue(mockPaginatedPosts);

      const result = await controller.listPosts({}, memberUser);

      expect(result.items).toHaveLength(1);
    });
  });

  describe('findPostById', () => {
    it('returns one post wrapped in { post }', async () => {
      service.findPostById.mockResolvedValue(mockPostView);

      const result = await controller.findPostById('cuid_post_001', memberUser);

      expect(result.post.id).toBe('cuid_post_001');
      expect(service.findPostById).toHaveBeenCalledWith(
        'cuid_post_001',
        memberUser,
      );
    });
  });

  describe('deletePost', () => {
    it('deletes a post', async () => {
      service.deletePost.mockResolvedValue(undefined);

      await controller.deletePost('cuid_post_001', memberUser);

      expect(service.deletePost).toHaveBeenCalledWith(
        'cuid_post_001',
        memberUser,
      );
    });
  });

  // ============================================================
  // COMMENTS
  // ============================================================
  describe('createComment', () => {
    it('creates a comment wrapped in { comment }', async () => {
      service.createComment.mockResolvedValue(mockCommentView);

      const result = await controller.createComment(
        'cuid_post_001',
        { body: 'Great post!' },
        memberUser,
      );

      expect(result.comment.id).toBe('cuid_comment_001');
      expect(service.createComment).toHaveBeenCalledWith(
        'cuid_post_001',
        { body: 'Great post!' },
        memberUser,
      );
    });
  });

  describe('listComments', () => {
    it('returns paginated comments', async () => {
      service.listComments.mockResolvedValue(mockPaginatedComments);

      const result = await controller.listComments(
        'cuid_post_001',
        {},
        memberUser,
      );

      expect(result.items).toHaveLength(1);
      expect(service.listComments).toHaveBeenCalledWith(
        'cuid_post_001',
        {},
        memberUser,
      );
    });
  });

  describe('deleteComment', () => {
    it('deletes a comment', async () => {
      service.deleteComment.mockResolvedValue(undefined);

      await controller.deleteComment('cuid_comment_001', memberUser);

      expect(service.deleteComment).toHaveBeenCalledWith(
        'cuid_comment_001',
        memberUser,
      );
    });
  });

  // ============================================================
  // REACTIONS
  // ============================================================
  describe('toggleReaction', () => {
    it('returns the toggle result', async () => {
      service.toggleReaction.mockResolvedValue({
        action: 'added',
        reaction: mockReactionView,
      });

      const result = await controller.toggleReaction(
        'cuid_post_001',
        { emoji: '👍' },
        memberUser,
      );

      expect(result.action).toBe('added');
      expect(result.reaction).toEqual(mockReactionView);
    });
  });

  describe('listReactions', () => {
    it('returns reactions wrapped in { reactions }', async () => {
      service.listReactions.mockResolvedValue([mockReactionView]);

      const result = await controller.listReactions(
        'cuid_post_001',
        memberUser,
      );

      expect(result.reactions).toHaveLength(1);
    });
  });
});
