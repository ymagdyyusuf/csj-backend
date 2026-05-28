import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { MembersService } from './members.service';
import { UpdateMemberDto } from './dto/update-member.dto';
import { ListMembersQueryDto } from './dto/list-members-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

/**
 * MembersController - HTTP layer for member management.
 *
 * All endpoints require authentication (JwtAuthGuard is global).
 * Fine-grained authorization is enforced in MembersService.
 *
 * @Roles() on list() restricts at the HTTP layer (admins/devs only).
 * getById and update allow any authenticated user; the service
 * enforces self-vs-others rules.
 */
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  /**
   * GET /api/v1/members
   * List members with optional filtering + pagination.
   * Admins and developers only (enforced by @Roles + service).
   */
  @Get()
  @Roles(Role.ADMIN, Role.DEVELOPER)
  async list(
    @Query() query: ListMembersQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.membersService.list(query, currentUser);
  }

  /**
   * GET /api/v1/members/:id
   * Get a single member. Members can only get their own;
   * admins/devs get any (enforced by service).
   */
  @Get(':id')
  async getById(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const member = await this.membersService.getById(id, currentUser);
    return { member };
  }

  /**
   * PATCH /api/v1/members/:id
   * Update a member. Permission logic enforced in service:
   *  - members edit own (language/avatar)
   *  - admins edit any (username/phone/language/avatar/isActive)
   *  - only devs change role
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const member = await this.membersService.update(id, dto, currentUser);
    return { member };
  }
}
