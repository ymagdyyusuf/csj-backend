import { Global, Module } from '@nestjs/common';
import { CloudinaryProvider } from './cloudinary.provider';
import { CloudinaryService } from './cloudinary.service';

/**
 * CloudinaryModule - global, so any feature module can inject
 * CloudinaryService without importing this module explicitly
 * (same pattern as PrismaModule).
 */
@Global()
@Module({
  providers: [CloudinaryProvider, CloudinaryService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
