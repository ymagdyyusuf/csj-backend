import { Module } from '@nestjs/common';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';
import { LocationRepository } from './location.repository';

/**
 * LocationModule - GPS log management with throttling and role-based access.
 *
 * No cross-module dependencies - all logic stays within location/.
 */
@Module({
  controllers: [LocationController],
  providers: [LocationService, LocationRepository],
  exports: [LocationService],
})
export class LocationModule {}
