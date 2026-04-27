import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

/**
 * Application bootstrap.
 *
 * Configures global behavior:
 * - Validation pipe: every DTO is validated automatically
 * - Whitelist: extra fields in request bodies are stripped (security)
 * - ForbidNonWhitelisted: bad fields throw 400 instead of being silently ignored
 * - Transform: incoming JSON is converted to DTO class instances
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Apply DTO validation globally to every endpoint
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip fields not declared in DTO
      forbidNonWhitelisted: true, // reject requests with unknown fields
      transform: true, // auto-cast strings to numbers/dates per DTO types
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}
void bootstrap();
