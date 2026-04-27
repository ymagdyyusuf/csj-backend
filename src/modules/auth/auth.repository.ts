import { Injectable } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

/**
 * Input shape for creating a new user.
 */
export interface CreateUserInput {
  uniqueId: string;
  username: string;
  phone: string;
  passwordHash: string;
  role?: Role;
  qrCode: string;
  language?: string;
  avatarUrl?: string;
}

/**
 * AuthRepository - the ONLY place Prisma touches User records for auth.
 */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { phone },
    });
  }

  async findByIdentifier(identifier: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { phone: identifier }],
      },
    });
  }

  async create(input: CreateUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        ...input,
        role: input.role ?? Role.MEMBER,
      },
    });
  }

  async updatePasswordHash(id: string, hash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash: hash },
    });
  }

  async setActive(id: string, isActive: boolean): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
    });
  }
}
