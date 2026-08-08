import { Module } from '@nestjs/common';
import { WallController } from './wall.controller';
import { WallService } from './wall.service';
import { WallRepository } from './wall.repository';

/**
 * WallModule - posts, comments, and reactions.
 *
 * Depends on CloudinaryService (global, from CloudinaryModule) and
 * PrismaService (global, from PrismaModule). No explicit imports needed.
 */
@Module({
  controllers: [WallController],
  providers: [WallService, WallRepository],
  exports: [WallService],
})
export class WallModule {}
// \\src/app.module.ts
