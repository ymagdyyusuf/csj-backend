import { Test, TestingModule } from '@nestjs/testing';
import { PostType } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { WallRepository } from '../wall.repository';

describe('WallRepository', () => {
  let repository: WallRepository;
  let prisma: jest.Mocked<PrismaService>;

  const mockPost = {
    id: 'cuid_post_001',
    authorId: 'cuid_member_001',
    type: PostType.TEXT,
    content: 'Hello scouts',
    mediaUrls: [],
    linkUrl: null,
    pollOptions: null,
    isActive: true,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
  };

  const mockComment = {
    id: 'cuid_comment_001',
    postId: 'cuid_post_001',
    authorId: 'cuid_member_002',
    body: 'Great post!',
    createdAt: new Date('2026-01-15'),
  };

  const mockReaction = {
    id: 'cuid_reaction_001',
    postId: 'cuid_post_001',
    userId: 'cuid_member_002',
    emoji: '👍',
    createdAt: new Date('2026-01-15'),
  };

  beforeEach(async () => {
    const prismaMock = {
      wallPost: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      comment: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      reaction: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WallRepository,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    repository = module.get<WallRepository>(WallRepository);
    prisma = module.get(PrismaService) as unknown as jest.Mocked<PrismaService>;
  });

  // ============================================================
  // POSTS
  // ============================================================
  describe('findPostById', () => {
    it('returns the post with author and counts', async () => {
      (prisma.wallPost.findUnique as jest.Mock).mockResolvedValue(mockPost);

      const result = await repository.findPostById('cuid_post_001');

      expect(result).toEqual(mockPost);
      expect(prisma.wallPost.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cuid_post_001' } }),
      );
    });

    it('returns null when not found', async () => {
      (prisma.wallPost.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findPostById('ghost');

      expect(result).toBeNull();
    });
  });

  describe('listPosts', () => {
    it('returns active posts newest first with author + counts', async () => {
      (prisma.wallPost.findMany as jest.Mock).mockResolvedValue([mockPost]);

      const result = await repository.listPosts({}, { skip: 0, take: 20 });

      expect(result).toEqual([mockPost]);
      const callArgs = (prisma.wallPost.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ createdAt: 'desc' });
      expect(callArgs.where.isActive).toBe(true);
    });

    it('applies authorId filter', async () => {
      (prisma.wallPost.findMany as jest.Mock).mockResolvedValue([mockPost]);

      await repository.listPosts(
        { authorId: 'cuid_member_001' },
        { skip: 0, take: 20 },
      );

      const callArgs = (prisma.wallPost.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.authorId).toBe('cuid_member_001');
    });

    it('applies type filter', async () => {
      (prisma.wallPost.findMany as jest.Mock).mockResolvedValue([mockPost]);

      await repository.listPosts(
        { type: PostType.IMAGE },
        { skip: 0, take: 20 },
      );

      const callArgs = (prisma.wallPost.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.type).toBe(PostType.IMAGE);
    });
  });

  describe('countPosts', () => {
    it('counts active posts', async () => {
      (prisma.wallPost.count as jest.Mock).mockResolvedValue(7);

      const result = await repository.countPosts({});

      expect(result).toBe(7);
      const callArgs = (prisma.wallPost.count as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.isActive).toBe(true);
    });
  });

  describe('createPost', () => {
    it('creates a post', async () => {
      (prisma.wallPost.create as jest.Mock).mockResolvedValue(mockPost);

      const result = await repository.createPost({
        authorId: 'cuid_member_001',
        type: PostType.TEXT,
        content: 'Hello scouts',
      });

      expect(result).toEqual(mockPost);
      expect(prisma.wallPost.create).toHaveBeenCalled();
    });
  });

  describe('softDeletePost', () => {
    it('sets isActive to false', async () => {
      const deleted = { ...mockPost, isActive: false };
      (prisma.wallPost.update as jest.Mock).mockResolvedValue(deleted);

      const result = await repository.softDeletePost('cuid_post_001');

      expect(result.isActive).toBe(false);
      expect(prisma.wallPost.update).toHaveBeenCalledWith({
        where: { id: 'cuid_post_001' },
        data: { isActive: false },
      });
    });
  });

  // ============================================================
  // COMMENTS
  // ============================================================
  describe('findCommentById', () => {
    it('returns the comment when found', async () => {
      (prisma.comment.findUnique as jest.Mock).mockResolvedValue(mockComment);

      const result = await repository.findCommentById('cuid_comment_001');

      expect(result).toEqual(mockComment);
    });

    it('returns null when not found', async () => {
      (prisma.comment.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findCommentById('ghost');

      expect(result).toBeNull();
    });
  });

  describe('listComments', () => {
    it('returns comments oldest first with author', async () => {
      (prisma.comment.findMany as jest.Mock).mockResolvedValue([mockComment]);

      const result = await repository.listComments('cuid_post_001', {
        skip: 0,
        take: 20,
      });

      expect(result).toEqual([mockComment]);
      const callArgs = (prisma.comment.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.postId).toBe('cuid_post_001');
      expect(callArgs.orderBy).toEqual({ createdAt: 'asc' });
    });
  });

  describe('countComments', () => {
    it('counts comments for a post', async () => {
      (prisma.comment.count as jest.Mock).mockResolvedValue(5);

      const result = await repository.countComments('cuid_post_001');

      expect(result).toBe(5);
    });
  });

  describe('createComment', () => {
    it('creates a comment', async () => {
      (prisma.comment.create as jest.Mock).mockResolvedValue(mockComment);

      const result = await repository.createComment({
        postId: 'cuid_post_001',
        authorId: 'cuid_member_002',
        body: 'Great post!',
      });

      expect(result).toEqual(mockComment);
    });
  });

  describe('deleteComment', () => {
    it('hard-deletes a comment', async () => {
      (prisma.comment.delete as jest.Mock).mockResolvedValue(mockComment);

      const result = await repository.deleteComment('cuid_comment_001');

      expect(result).toEqual(mockComment);
      expect(prisma.comment.delete).toHaveBeenCalledWith({
        where: { id: 'cuid_comment_001' },
      });
    });
  });

  // ============================================================
  // REACTIONS
  // ============================================================
  describe('findReaction', () => {
    it('finds an existing reaction by post + user + emoji', async () => {
      (prisma.reaction.findFirst as jest.Mock).mockResolvedValue(mockReaction);

      const result = await repository.findReaction(
        'cuid_post_001',
        'cuid_member_002',
        '👍',
      );

      expect(result).toEqual(mockReaction);
      expect(prisma.reaction.findFirst).toHaveBeenCalledWith({
        where: {
          postId: 'cuid_post_001',
          userId: 'cuid_member_002',
          emoji: '👍',
        },
      });
    });

    it('returns null when no matching reaction', async () => {
      (prisma.reaction.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await repository.findReaction(
        'cuid_post_001',
        'cuid_member_002',
        '❤️',
      );

      expect(result).toBeNull();
    });
  });

  describe('listReactions', () => {
    it('lists all reactions on a post', async () => {
      (prisma.reaction.findMany as jest.Mock).mockResolvedValue([mockReaction]);

      const result = await repository.listReactions('cuid_post_001');

      expect(result).toEqual([mockReaction]);
      expect(prisma.reaction.findMany).toHaveBeenCalledWith({
        where: { postId: 'cuid_post_001' },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('createReaction', () => {
    it('creates a reaction', async () => {
      (prisma.reaction.create as jest.Mock).mockResolvedValue(mockReaction);

      const result = await repository.createReaction({
        postId: 'cuid_post_001',
        userId: 'cuid_member_002',
        emoji: '👍',
      });

      expect(result).toEqual(mockReaction);
    });
  });

  describe('deleteReaction', () => {
    it('hard-deletes a reaction', async () => {
      (prisma.reaction.delete as jest.Mock).mockResolvedValue(mockReaction);

      const result = await repository.deleteReaction('cuid_reaction_001');

      expect(result).toEqual(mockReaction);
      expect(prisma.reaction.delete).toHaveBeenCalledWith({
        where: { id: 'cuid_reaction_001' },
      });
    });
  });
});
