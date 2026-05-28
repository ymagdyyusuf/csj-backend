import { Module } from '@nestjs/common';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsRepository } from './feature-flags.repository';

/**
 * FeatureFlagsModule - feature flag management.
 *
 * Reads open to any authenticated user; writes gated to DEVELOPER.
 * PrismaService is available globally (PrismaModule is @Global).
 */
@Module({
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsService, FeatureFlagsRepository],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
