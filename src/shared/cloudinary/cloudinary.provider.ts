import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Injection token for the configured Cloudinary SDK instance.
 */
export const CLOUDINARY = 'CLOUDINARY';

/**
 * Provider that configures the Cloudinary SDK from environment variables
 * and exposes the configured `cloudinary` object under the CLOUDINARY token.
 *
 * CloudinaryService injects this token, so in tests we can swap it for a mock.
 */
export const CloudinaryProvider: Provider = {
  provide: CLOUDINARY,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    cloudinary.config({
      cloud_name: config.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: config.get<string>('CLOUDINARY_API_SECRET'),
    });
    return cloudinary;
  },
};
