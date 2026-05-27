import { Injectable } from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { MemberListFilter } from './members.types';

export interface PaginationArgs {
  skip: number;
  take: number;
}

export interface UpdateMemberData {
  username?: string;
  phone?: string;
  language?: string;
  avatarUrl?: string;
  isActive?: boolean;
  role?: Role;
}

@Injectable()
export class MembersRepository {
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

  async list(
    filter: MemberListFilter,
    pagination: PaginationArgs,
  ): Promise<User[]> {
    return this.prisma.user.findMany({
      where: this.buildWhereClause(filter),
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    });
  }

  async count(filter: MemberListFilter): Promise<number> {
    return this.prisma.user.count({
      where: this.buildWhereClause(filter),
    });
  }

  async update(id: string, data: UpdateMemberData): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  private buildWhereClause(filter: MemberListFilter): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};

    if (filter.role !== undefined) {
      where.role = filter.role;
    }

    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter.search !== undefined && filter.search.length > 0) {
      where.OR = [
        { username: { contains: filter.search, mode: 'insensitive' } },
        { phone: { contains: filter.search } },
      ];
    }

    return where;
  }
}
