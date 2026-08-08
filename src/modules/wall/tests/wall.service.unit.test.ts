import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PostType, Role } from '@prisma/client';
import { WallService } from '../wall.service';
import { WallRepository } from '../wall.repository';
import { CloudinaryService } from '../../../shared/cloudinary/cloudinary.service';
import { AuthenticatedUser } from '../../auth/auth.types';

describe('WallService', () => {
  let service: WallService;
  let repository: jest.Mocked<WallRepository>;
  let cloudinary: jest.Mocked<CloudinaryService>;

  // ---- Fixtures --------------------------------------------------

  const authorSummary = {
    id: 'cuid_member_001',
    username: 'ahmed_scout',
    avatarUrl: null,
  };

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
    author: authorSummary,
    _count: { reactions: 3, comments: 2 },
  };

  const mockComment = {
    id: 'cuid_comment_001',
    postId: 'cuid_post_001',
    authorId: 'cuid_member_002',
    body: 'Great post!',
    createdAt: new Date('2026-01-15'),
    author: {
      id: 'cuid_member_002',
      username: 'sara_scout',
      avatarUrl: null,
    },
  };

  const mockReaction = {
    id: 'cuid_reaction_001',
    postId: 'cuid_post_001',
    userId: 'cuid_member_002',
    emoji: '👍',
    createdAt: new Date('2026-01-15'),
  };

  const memberUser: AuthenticatedUser = {
    id: 'cuid_member_001',
    uniqueId: 'CSJ-001',
    username: 'ahmed_scout',
    phone: '+201234567890',
    role: Role.MEMBER,
    isActive: true,
    language: 'ar',
  };

  const otherMember: AuthenticatedUser = {
    ...memberUser,
    id: 'cuid_member_002',
    username: 'sara_scout',
  };

  const adminUser: AuthenticatedUser = {
    ...memberUser,
    id: 'cuid_admin_001',
    username: 'admin_boss',
    role: Role.ADMIN,
  };

  const validImageFile = {
    buffer: Buffer.from('img bytes'),
    originalname: 'photo.jpg',
    mimetype: 'image/jpeg',
    size: 256 * 1024,
  };

  const validVideoFile = {
    buffer: Buffer.from('vid bytes'),
    originalname: 'clip.mp4',
    mimetype: 'video/mp4',
    size: 1024 * 1024,
  };

  // ---- Setup -----------------------------------------------------

  beforeEach(async () => {
    const repoMock = {
      findPostById: jest.fn(),
      listPosts: jest.fn(),
      countPosts: jest.fn(),
      createPost: jest.fn(),
      softDeletePost: jest.fn(),
      findCommentById: jest.fn(),
      listComments: jest.fn(),
      countComments: jest.fn(),
      createComment: jest.fn(),
      deleteComment: jest.fn(),
      findReaction: jest.fn(),
      listReactions: jest.fn(),
      createReaction: jest.fn(),
      deleteReaction: jest.fn(),
    };
    const cloudinaryMock = {
      uploadAudio: jest.fn(),
      uploadImage: jest.fn(),
      uploadVideo: jest.fn(),
      deleteFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WallService,
        { provide: WallRepository, useValue: repoMock },
        { provide: CloudinaryService, useValue: cloudinaryMock },
      ],
    }).compile();

    service = module.get<WallService>(WallService);
    repository = module.get(
      WallRepository,
    ) as unknown as jest.Mocked<WallRepository>;
    cloudinary = module.get(
      CloudinaryService,
    ) as unknown as jest.Mocked<CloudinaryService>;
  });

  // ============================================================
  // POSTS - create (per-type validation + upload)
  // ============================================================
  describe('createPost', () => {
    it('creates a TEXT post', async () => {
      repository.createPost.mockResolvedValue(mockPost);
      repository.findPostById.mockResolvedValue(mockPost);

      const result = await service.createPost(
        { type: PostType.TEXT, content: 'Hello scouts' },
        undefined,
        memberUser,
      );

      expect(result.id).toBe('cuid_post_001');
      expect(result.author.username).toBe('ahmed_scout');
      expect(result.reactionCount).toBe(3);
      expect(result.commentCount).toBe(2);
      expect(cloudinary.uploadImage).not.toHaveBeenCalled();
    });

    it('rejects TEXT post without content', async () => {
      await expect(
        service.createPost({ type: PostType.TEXT }, undefined, memberUser),
      ).rejects.toThrow(BadRequestException);
      expect(repository.createPost).not.toHaveBeenCalled();
    });

    it('creates a LINK post', async () => {
      repository.createPost.mockResolvedValue(mockPost);
      repository.findPostById.mockResolvedValue(mockPost);

      await service.createPost(
        { type: PostType.LINK, linkUrl: 'https://example.com' },
        undefined,
        memberUser,
      );

      expect(repository.createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PostType.LINK,
          linkUrl: 'https://example.com',
        }),
      );
    });

    it('rejects LINK post without linkUrl', async () => {
      await expect(
        service.createPost({ type: PostType.LINK }, undefined, memberUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a POLL post', async () => {
      repository.createPost.mockResolvedValue(mockPost);
      repository.findPostById.mockResolvedValue(mockPost);

      await service.createPost(
        {
          type: PostType.POLL,
          pollOptions: [{ label: 'Yes' }, { label: 'No' }],
        },
        undefined,
        memberUser,
      );

      expect(repository.createPost).toHaveBeenCalledWith(
        expect.objectContaining({ type: PostType.POLL }),
      );
    });

    it('rejects POLL post without options', async () => {
      await expect(
        service.createPost({ type: PostType.POLL }, undefined, memberUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates an IMAGE post, uploads to Cloudinary', async () => {
      cloudinary.uploadImage.mockResolvedValue({
        url: 'https://res.cloudinary.com/csj/image/upload/wall/x.jpg',
        duration: 0,
        publicId: 'wall/x',
      });
      repository.createPost.mockResolvedValue(mockPost);
      repository.findPostById.mockResolvedValue(mockPost);

      await service.createPost(
        { type: PostType.IMAGE },
        validImageFile,
        memberUser,
      );

      expect(cloudinary.uploadImage).toHaveBeenCalledTimes(1);
      expect(repository.createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PostType.IMAGE,
          mediaUrls: ['https://res.cloudinary.com/csj/image/upload/wall/x.jpg'],
        }),
      );
    });

    it('rejects IMAGE post without a file', async () => {
      await expect(
        service.createPost({ type: PostType.IMAGE }, undefined, memberUser),
      ).rejects.toThrow(BadRequestException);
      expect(cloudinary.uploadImage).not.toHaveBeenCalled();
    });

    it('rejects IMAGE post with a non-image mimetype', async () => {
      const wrong = { ...validImageFile, mimetype: 'audio/mpeg' };

      await expect(
        service.createPost({ type: PostType.IMAGE }, wrong, memberUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects IMAGE post over 10MB', async () => {
      const big = { ...validImageFile, size: 11 * 1024 * 1024 };

      await expect(
        service.createPost({ type: PostType.IMAGE }, big, memberUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a VIDEO post, uploads to Cloudinary', async () => {
      cloudinary.uploadVideo.mockResolvedValue({
        url: 'https://res.cloudinary.com/csj/video/upload/wall/y.mp4',
        duration: 12,
        publicId: 'wall/y',
      });
      repository.createPost.mockResolvedValue(mockPost);
      repository.findPostById.mockResolvedValue(mockPost);

      await service.createPost(
        { type: PostType.VIDEO },
        validVideoFile,
        memberUser,
      );

      expect(cloudinary.uploadVideo).toHaveBeenCalledTimes(1);
    });

    it('rejects VIDEO post over 50MB', async () => {
      const big = { ...validVideoFile, size: 51 * 1024 * 1024 };

      await expect(
        service.createPost({ type: PostType.VIDEO }, big, memberUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================================
  // POSTS - list, findById
  // ============================================================
  describe('listPosts', () => {
    it('returns enriched paginated posts for any authenticated user', async () => {
      repository.listPosts.mockResolvedValue([mockPost]);
      repository.countPosts.mockResolvedValue(1);

      const result = await service.listPosts({}, memberUser);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].author.username).toBe('ahmed_scout');
      expect(result.items[0].reactionCount).toBe(3);
    });

    it('computes pagination metadata', async () => {
      repository.listPosts.mockResolvedValue([mockPost]);
      repository.countPosts.mockResolvedValue(45);

      const result = await service.listPosts(
        { page: 2, pageSize: 20 },
        memberUser,
      );

      expect(result.totalPages).toBe(3);
      expect(result.page).toBe(2);
    });
  });

  describe('findPostById', () => {
    it('returns the enriched post', async () => {
      repository.findPostById.mockResolvedValue(mockPost);

      const result = await service.findPostById('cuid_post_001', memberUser);

      expect(result.id).toBe('cuid_post_001');
      expect(result.author.username).toBe('ahmed_scout');
    });

    it('throws NotFoundException when missing', async () => {
      repository.findPostById.mockResolvedValue(null);

      await expect(service.findPostById('ghost', memberUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // POSTS - deletePost (author OR admin)
  // ============================================================
  describe('deletePost', () => {
    it('allows the author to soft-delete their own post', async () => {
      repository.findPostById.mockResolvedValue(mockPost);
      repository.softDeletePost.mockResolvedValue({
        ...mockPost,
        isActive: false,
      });

      await expect(
        service.deletePost('cuid_post_001', memberUser),
      ).resolves.not.toThrow();
      expect(repository.softDeletePost).toHaveBeenCalledWith('cuid_post_001');
    });

    it('allows an admin to soft-delete any post', async () => {
      repository.findPostById.mockResolvedValue(mockPost);
      repository.softDeletePost.mockResolvedValue({
        ...mockPost,
        isActive: false,
      });

      await expect(
        service.deletePost('cuid_post_001', adminUser),
      ).resolves.not.toThrow();
    });

    it('forbids another member from deleting a post (403)', async () => {
      repository.findPostById.mockResolvedValue(mockPost);

      await expect(
        service.deletePost('cuid_post_001', otherMember),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.softDeletePost).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when deleting a missing post', async () => {
      repository.findPostById.mockResolvedValue(null);

      await expect(service.deletePost('ghost', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // COMMENTS
  // ============================================================
  describe('createComment', () => {
    it('creates a comment on an existing post', async () => {
      repository.findPostById.mockResolvedValue(mockPost);
      repository.createComment.mockResolvedValue(mockComment);

      const result = await service.createComment(
        'cuid_post_001',
        { body: 'Great post!' },
        otherMember,
      );

      expect(result.id).toBe('cuid_comment_001');
      expect(repository.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: 'cuid_post_001',
          authorId: 'cuid_member_002',
          body: 'Great post!',
        }),
      );
    });

    it('rejects a comment on a missing post (404)', async () => {
      repository.findPostById.mockResolvedValue(null);

      await expect(
        service.createComment('ghost', { body: 'hi' }, otherMember),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listComments', () => {
    it('lists paginated comments for a post', async () => {
      repository.findPostById.mockResolvedValue(mockPost);
      repository.listComments.mockResolvedValue([mockComment]);
      repository.countComments.mockResolvedValue(1);

      const result = await service.listComments(
        'cuid_post_001',
        {},
        memberUser,
      );

      expect(result.items).toHaveLength(1);
    });

    it('throws NotFoundException when post is missing', async () => {
      repository.findPostById.mockResolvedValue(null);

      await expect(
        service.listComments('ghost', {}, memberUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteComment', () => {
    it('allows the author to delete their own comment', async () => {
      repository.findCommentById.mockResolvedValue(mockComment);
      repository.deleteComment.mockResolvedValue(mockComment);

      await expect(
        service.deleteComment('cuid_comment_001', otherMember),
      ).resolves.not.toThrow();
    });

    it('allows an admin to delete any comment', async () => {
      repository.findCommentById.mockResolvedValue(mockComment);
      repository.deleteComment.mockResolvedValue(mockComment);

      await expect(
        service.deleteComment('cuid_comment_001', adminUser),
      ).resolves.not.toThrow();
    });

    it('forbids a different member from deleting a comment (403)', async () => {
      repository.findCommentById.mockResolvedValue(mockComment);

      await expect(
        service.deleteComment('cuid_comment_001', memberUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException on missing comment', async () => {
      repository.findCommentById.mockResolvedValue(null);

      await expect(service.deleteComment('ghost', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // REACTIONS (toggle)
  // ============================================================
  describe('toggleReaction', () => {
    it('creates a new reaction when none exists', async () => {
      repository.findPostById.mockResolvedValue(mockPost);
      repository.findReaction.mockResolvedValue(null);
      repository.createReaction.mockResolvedValue(mockReaction);

      const result = await service.toggleReaction(
        'cuid_post_001',
        { emoji: '👍' },
        otherMember,
      );

      expect(result.action).toBe('added');
      expect(result.reaction).toBeDefined();
      expect(repository.deleteReaction).not.toHaveBeenCalled();
    });

    it('removes an existing reaction when the same user + emoji is toggled', async () => {
      repository.findPostById.mockResolvedValue(mockPost);
      repository.findReaction.mockResolvedValue(mockReaction);
      repository.deleteReaction.mockResolvedValue(mockReaction);

      const result = await service.toggleReaction(
        'cuid_post_001',
        { emoji: '👍' },
        otherMember,
      );

      expect(result.action).toBe('removed');
      expect(result.reaction).toBeNull();
      expect(repository.createReaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException on missing post', async () => {
      repository.findPostById.mockResolvedValue(null);

      await expect(
        service.toggleReaction('ghost', { emoji: '👍' }, otherMember),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listReactions', () => {
    it('lists all reactions on a post', async () => {
      repository.findPostById.mockResolvedValue(mockPost);
      repository.listReactions.mockResolvedValue([mockReaction]);

      const result = await service.listReactions('cuid_post_001', memberUser);

      expect(result).toHaveLength(1);
    });

    it('throws NotFoundException on missing post', async () => {
      repository.findPostById.mockResolvedValue(null);

      await expect(service.listReactions('ghost', memberUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
