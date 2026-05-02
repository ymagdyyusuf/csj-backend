import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { AuthRepository } from './auth.repository';
import { EventBusService } from '../../shared/events/event-bus.service';
import { AuthenticatedUser, BCRYPT_COST_FACTOR } from './auth.types';
import { AuthEventNames, UserRegisteredEvent } from './auth.events';
import { JwtPayload } from './interfaces/jwt-payload.interface';

export interface RegisterInput {
  username: string;
  phone: string;
  password: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly repository: AuthRepository,
    private readonly eventBus: EventBusService,
  ) {}

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
