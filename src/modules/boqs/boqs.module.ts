import { Module } from '@nestjs/common';
import { BoqsController } from './boqs.controller';
import { BoqsService } from './boqs.service';
import { BoqsRepository } from './boqs.repository';

/**
 * BoqsModule - audio broadcast feature.
 *
 * Depends on CloudinaryService (global, from CloudinaryModule)
 * and PrismaService (global, from PrismaModule). No explicit imports needed.
 */
@Module({
  controllers: [BoqsController],
  providers: [BoqsService, BoqsRepository],
  exports: [BoqsService],
})
export class BoqsModule {}
