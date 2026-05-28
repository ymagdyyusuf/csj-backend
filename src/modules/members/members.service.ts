import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { MembersRepository, UpdateMemberData } from './members.repository';
import {
  MemberListFilter,
  PaginatedResult,
  PAGINATION_DEFAULTS,
} from './members.types';
import { AuthenticatedUser as AuthUser } from '../auth/auth.types';

/**
 * Public-safe view of a member (no passwordHash, no qrCode).
 */
export interface MemberView {
  id: string;
  uniqueId: string;
  username: string;
  phone: string;
  role: Role;
  isActive: boolean;
  avatarUrl: string | null;
  language: string;
  createdAt: Date;
}

/**
 * MembersService - business logic + authorization for member management.
 *
 * Authorization rules:
 *  - getById: members can only get their own; admins/devs get any
 *  - list: admins/devs only
 *  - update: members edit own (language/avatar only); admins edit any
 *            (username/phone/language/avatar/isActive); only devs change role
 */
@Injectable()
export class MembersService {
  constructor(private readonly repository: MembersRepository) {}

  // ============================================================
  // getById
  // ============================================================
  async getById(id: string, currentUser: AuthUser): Promise<MemberView> {
    const isPrivileged = this.isAdminOrDev(currentUser);
    const isSelf = currentUser.id === id;

    // Members can only access their own profile
    if (!isPrivileged && !isSelf) {
      throw new ForbiddenException('You can only access your own profile');
    }

    const member = await this.repository.findById(id);
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return this.toMemberView(member);
  }

  // ============================================================
  // list
  // ============================================================
  async list(
    filter: MemberListFilter,
    currentUser: AuthUser,
  ): Promise<PaginatedResult<MemberView>> {
    // Only admins/devs can list all members
    if (!this.isAdminOrDev(currentUser)) {
      throw new ForbiddenException('Only admins can list members');
    }

    const page = filter.page ?? PAGINATION_DEFAULTS.PAGE;
    const pageSize = Math.min(
      filter.pageSize ?? PAGINATION_DEFAULTS.PAGE_SIZE,
      PAGINATION_DEFAULTS.MAX_PAGE_SIZE,
    );
    const skip = (page - 1) * pageSize;

    const [members, total] = await Promise.all([
      this.repository.list(filter, { skip, take: pageSize }),
      this.repository.count(filter),
    ]);

    return {
      items: members.map((m) => this.toMemberView(m)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ============================================================
  // update
  // ============================================================
  async update(
    id: string,
    dto: UpdateMemberData,
    currentUser: AuthUser,
  ): Promise<MemberView> {
    const isPrivileged = this.isAdminOrDev(currentUser);
    const isSelf = currentUser.id === id;

    // Must be self or privileged
    if (!isPrivileged && !isSelf) {
      throw new ForbiddenException('You can only update your own profile');
    }

    // Role changes: only developers
    if (dto.role !== undefined && currentUser.role !== Role.DEVELOPER) {
      throw new ForbiddenException('Only developers can change roles');
    }

    // isActive changes: only admins/devs
    if (dto.isActive !== undefined && !isPrivileged) {
      throw new ForbiddenException('Only admins can change account status');
    }

    // Username/phone changes: only admins/devs
    if (
      (dto.username !== undefined || dto.phone !== undefined) &&
      !isPrivileged
    ) {
      throw new ForbiddenException('Only admins can change username or phone');
    }

    const member = await this.repository.findById(id);
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Build the allowed update payload
    const updateData: UpdateMemberData = {};
    if (dto.language !== undefined) updateData.language = dto.language;
    if (dto.avatarUrl !== undefined) updateData.avatarUrl = dto.avatarUrl;
    if (dto.username !== undefined) updateData.username = dto.username;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.role !== undefined) updateData.role = dto.role;

    const updated = await this.repository.update(id, updateData);
    return this.toMemberView(updated);
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private isAdminOrDev(user: AuthUser): boolean {
    return user.role === Role.ADMIN || user.role === Role.DEVELOPER;
  }

  private toMemberView(member: User): MemberView {
    return {
      id: member.id,
      uniqueId: member.uniqueId,
      username: member.username,
      phone: member.phone,
      role: member.role,
      isActive: member.isActive,
      avatarUrl: member.avatarUrl,
      language: member.language,
      createdAt: member.createdAt,
    };
  }
}
