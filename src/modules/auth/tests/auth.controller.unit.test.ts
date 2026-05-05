import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockUserView = {
    id: 'cuid_test_001',
    uniqueId: 'CSJ-001',
    username: 'ahmed_scout',
    phone: '+201234567890',
    role: Role.MEMBER,
    isActive: true,
    language: 'ar',
  };

  const mockTokens = {
    accessToken: 'mock.access.token',
    refreshToken: 'mock.refresh.token',
    user: mockUserView,
  };

  const createMockResponse = (): Partial<Response> => ({
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  });

  beforeEach(async () => {
    const authServiceMock = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      validateUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService) as unknown as jest.Mocked<AuthService>;
  });

  describe('register', () => {
    it('returns the created user', async () => {
      authService.register.mockResolvedValue(mockUserView);
      const result = await controller.register({
        username: 'new_scout',
        phone: '+201111111111',
        password: 'validPass123',
      });
      expect(result.user).toEqual(mockUserView);
      expect(authService.register).toHaveBeenCalledTimes(1);
    });

    it('passes the dto fields to the service', async () => {
      authService.register.mockResolvedValue(mockUserView);
      await controller.register({
        username: 'new_scout',
        phone: '+201111111111',
        password: 'validPass123',
      });
      expect(authService.register).toHaveBeenCalledWith({
        username: 'new_scout',
        phone: '+201111111111',
        password: 'validPass123',
      });
    });
  });

  describe('login', () => {
    it('returns access token and user, sets refresh cookie', async () => {
      authService.login.mockResolvedValue(mockTokens);
      const res = createMockResponse() as Response;
      const result = await controller.login(
        { identifier: 'ahmed_scout', password: 'validPass123' },
        res,
      );
      expect(result.accessToken).toBe('mock.access.token');
      expect(result.user).toEqual(mockUserView);
      expect(result).not.toHaveProperty('refreshToken');
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'mock.refresh.token',
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('passes identifier and password to the service', async () => {
      authService.login.mockResolvedValue(mockTokens);
      const res = createMockResponse() as Response;
      await controller.login({ identifier: 'ahmed_scout', password: 'pass' }, res);
      expect(authService.login).toHaveBeenCalledWith(
        { identifier: 'ahmed_scout', password: 'pass' },
        expect.anything(),
      );
    });
  });

  describe('refresh', () => {
    it('returns new access token and user', async () => {
      authService.refresh.mockResolvedValue(mockTokens);
      const res = createMockResponse() as Response;
      const result = await controller.refresh(
        { refresh_token: 'old.refresh.token' },
        res,
      );
      expect(result.accessToken).toBe('mock.access.token');
      expect(result.user).toEqual(mockUserView);
      expect(authService.refresh).toHaveBeenCalledWith('old.refresh.token');
    });

    it('rotates the refresh cookie', async () => {
      authService.refresh.mockResolvedValue(mockTokens);
      const res = createMockResponse() as Response;
      await controller.refresh({ refresh_token: 'old.refresh.token' }, res);
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'mock.refresh.token',
        expect.objectContaining({ httpOnly: true }),
      );
    });
  });

  describe('logout', () => {
    it('clears the refresh cookie', () => {
      const res = createMockResponse() as Response;
      const result = controller.logout(res);
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');
      expect(result.message).toBe('Logged out successfully');
    });
  });

  describe('me', () => {
    it('returns the current authenticated user', () => {
      const result = controller.me(mockUserView);
      expect(result.user).toEqual(mockUserView);
    });
  });
});
