import { Module } from '@nestjs/common';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { MembersRepository } from './members.repository';

/**
 * MembersModule - member management feature.
 *
 * Provides member listing, viewing, and updating with role-based
 * authorization. Depends on the global JwtAuthGuard (from AuthModule)
 * for authentication, and uses @Roles + service logic for authorization.
 *
 * PrismaService is available globally (PrismaModule is @Global).
 */
@Module({
  controllers: [MembersController],
  providers: [MembersService, MembersRepository],
  exports: [MembersService],
})
export class MembersModule {}
