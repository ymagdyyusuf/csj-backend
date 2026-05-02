import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { AuthRepository } from './auth.repository';
import { EventBusService } from '../../shared/events/event-bus.service';
import {
  AuthenticatedUser,
  AuthTokens,
  BCRYPT_COST_FACTOR,
  TOKEN_EXPIRY,
} from './auth.types';
import {
  AuthEventNames,
  LoginFailedEvent,
  TokenRefreshedEvent,
  UserLoggedInEvent,
  UserRegisteredEvent,
} from './auth.events';
import {
  JwtPayload,
  JwtRefreshPayload,
} from './interfaces/jwt-payload.interface';

export interface RegisterInput {
  username: string;
  phone: string;
  password: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface LoginContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}

/**
 * AuthService — the brain of authentication.
 *
 * Layers:
 *  - hashPassword / verifyPassword: cryptographic primitives
 *  - register / validateUser: identity operations
 *  - login / refresh: token operations
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Pre-computed dummy hash for timing-attack defense in login()
  // Generated with bcrypt cost 12 of "dummy-password"
  private static readonly DUMMY_HASH =
    '$2b$12$3aH3yQXIBgKlb7tIMflgJOLMhAg4hM5z0cNtbg1V3WUH1F7nbgIZS';

  constructor(
    private readonly repository: AuthRepository,
    private readonly eventBus: EventBusService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ============================================================
  // BATCH 1: PASSWORD HELPERS
  // ============================================================

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_COST_FACTOR);
  }

  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(plain, hash);
    } catch (error) {
      this.logger.warn(
        'Password verification failed: ' + (error as Error).message,
      );
      return false;
    }
  }

  // ============================================================
  // BATCH 2: REGISTRATION
  // ============================================================

  async register(input: RegisterInput): Promise<AuthenticatedUser> {
    const existingByUsername = await this.repository.findByUsername(
      input.username,
    );
    if (existingByUsername) {
      throw new ConflictException('Username is already taken');
    }
    const existingByPhone = await this.repository.findByPhone(input.phone);
    if (existingByPhone) {
      throw new ConflictException('Phone number is already taken');
    }

    const passwordHash = await this.hashPassword(input.password);
    const uniqueId = this.generateUniqueId();
    const qrCode = nanoid();

    const user = await this.repository.create({
      uniqueId,
      username: input.username,
      phone: input.phone,
      passwordHash,
      qrCode,
      role: Role.MEMBER,
      language: 'ar',
    });

    const event: UserRegisteredEvent = {
      userId: user.id,
      username: user.username,
      role: user.role,
      createdById: null,
      occurredAt: new Date(),
    };
    this.eventBus.emit(AuthEventNames.USER_REGISTERED, event);

    return this.toAuthenticatedUser(user);
  }

  // ============================================================
  // BATCH 2: USER VALIDATION
  // ============================================================

  async validateUser(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.repository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }
    return this.toAuthenticatedUser(user);
  }

  // ============================================================
  // BATCH 3: LOGIN
  // ============================================================

  /**
   * Authenticate a user and issue a JWT pair.
   *
   * Security features:
   * - Timing-attack defense: bcrypt is run even when user not found
   * - Failed login emits LoginFailedEvent (for rate limiting / monitoring)
   * - Successful login emits UserLoggedInEvent (for activity log)
   * - Disabled accounts are rejected
   *
   * @param input    identifier (username or phone) + password
   * @param context  optional ipAddress + userAgent for event payload
   */
  async login(
    input: LoginInput,
    context: LoginContext = {},
  ): Promise<LoginResult> {
    const user = await this.repository.findByIdentifier(input.identifier);

    // Timing-attack defense: always perform a bcrypt compare even when user is null
    const hashToCompare = user ? user.passwordHash : AuthService.DUMMY_HASH;
    const passwordMatches = await this.verifyPassword(
      input.password,
      hashToCompare,
    );

    if (!user || !passwordMatches) {
      const failedEvent: LoginFailedEvent = {
        username: input.identifier,
        reason: !user ? 'USER_NOT_FOUND' : 'WRONG_PASSWORD',
        ipAddress: context.ipAddress ?? null,
        occurredAt: new Date(),
      };
      this.eventBus.emit(AuthEventNames.LOGIN_FAILED, failedEvent);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      const failedEvent: LoginFailedEvent = {
        username: input.identifier,
        reason: 'ACCOUNT_DISABLED',
        ipAddress: context.ipAddress ?? null,
        occurredAt: new Date(),
      };
      this.eventBus.emit(AuthEventNames.LOGIN_FAILED, failedEvent);
      throw new UnauthorizedException('Account is disabled');
    }

    const tokens = await this.generateTokenPair({
      sub: user.id,
      role: user.role,
      username: user.username,
    });

    const loggedInEvent: UserLoggedInEvent = {
      userId: user.id,
      username: user.username,
      role: user.role,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
      occurredAt: new Date(),
    };
    this.eventBus.emit(AuthEventNames.USER_LOGGED_IN, loggedInEvent);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.toAuthenticatedUser(user),
    };
  }

  // ============================================================
  // BATCH 3: REFRESH
  // ============================================================

  /**
   * Issue new tokens from a valid refresh token.
   *
   * Verifies the refresh token signature, looks up the user,
   * and issues a fresh access + refresh token pair.
   */
  async refresh(refreshToken: string): Promise<LoginResult> {
    let payload: JwtRefreshPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        refreshToken,
        {
          secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.repository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    const tokens = await this.generateTokenPair({
      sub: user.id,
      role: user.role,
      username: user.username,
    });

    const refreshedEvent: TokenRefreshedEvent = {
      userId: user.id,
      occurredAt: new Date(),
    };
    this.eventBus.emit(AuthEventNames.TOKEN_REFRESHED, refreshedEvent);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.toAuthenticatedUser(user),
    };
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  /**
   * Sign a fresh access + refresh token pair for a user.
   */
  private async generateTokenPair(accessPayload: {
    sub: string;
    role: Role;
    username: string;
  }): Promise<AuthTokens> {
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: TOKEN_EXPIRY.ACCESS_TOKEN_SECONDS,
    });

    const refreshPayload: { sub: string; tokenVersion: number } = {
      sub: accessPayload.sub,
      tokenVersion: 0,
    };

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: TOKEN_EXPIRY.REFRESH_TOKEN_SECONDS,
    });

    return { accessToken, refreshToken };
  }

  private generateUniqueId(): string {
    const random = Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, '0');
    return 'CSJ-' + random;
  }

  private toAuthenticatedUser(user: {
    id: string;
    uniqueId: string;
    username: string;
    phone: string;
    role: Role;
    isActive: boolean;
    language: string;
  }): AuthenticatedUser {
    return {
      id: user.id,
      uniqueId: user.uniqueId,
      username: user.username,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      language: user.language,
    };
  }
}
