import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/shared/prisma/prisma.service';

/**
 * E2E test for the feature-flags module.
 *
 * Seeds a DEVELOPER directly via Prisma, registers a MEMBER via the
 * endpoint, then verifies real read/write authorization over HTTP.
 */
describe('FeatureFlagsModule (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication<App>;
  let prisma: PrismaService;

  const stamp = Date.now();
  const devUsername = `e2e_dev_${stamp}`;
  const devPhone = `+201666${stamp.toString().slice(-7)}`;
  const memberUsername = `e2e_ffmember_${stamp}`;
  const memberPhone = `+201555${stamp.toString().slice(-7)}`;
  const password = 'E2EpassWord123';

  const testKey = `e2e_flag_${stamp}`;

  let devToken: string;
  let memberToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.use(cookieParser());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Seed a DEVELOPER directly
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        uniqueId: `CSJ-D${stamp.toString().slice(-5)}`,
        username: devUsername,
        phone: devPhone,
        passwordHash,
        qrCode: nanoid(),
        role: Role.DEVELOPER,
        language: 'ar',
      },
    });

    // Register a normal MEMBER via the real endpoint
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ username: memberUsername, phone: memberPhone, password });

    // Login both
    const devLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: devUsername, password });
    devToken = devLogin.body.accessToken;

    const memberLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: memberUsername, password });
    memberToken = memberLogin.body.accessToken;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.featureFlag.deleteMany({ where: { key: testKey } });
      await prisma.user.deleteMany({
        where: { username: { in: [devUsername, memberUsername] } },
      });
    }
    if (app) {
      await app.close();
    }
  });

  // ============================================================
  // Reads - any authenticated user
  // ============================================================

  it('allows a member to list flags', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/feature-flags')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(res.body.flags).toBeDefined();
    expect(Array.isArray(res.body.flags)).toBe(true);
  });

  it('rejects listing without a token (401)', async () => {
    await request(app.getHttpServer()).get('/api/v1/feature-flags').expect(401);
  });

  // ============================================================
  // Create - developer only
  // ============================================================

  it('allows a developer to create a flag', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/feature-flags')
      .set('Authorization', `Bearer ${devToken}`)
      .send({ key: testKey, isEnabled: true, description: 'E2E test flag' })
      .expect(201);

    expect(res.body.flag.key).toBe(testKey);
    expect(res.body.flag.isEnabled).toBe(true);
  });

  it('forbids a member from creating a flag (403)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/feature-flags')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ key: `${testKey}_x`, isEnabled: true })
      .expect(403);
  });

  it('rejects creating a duplicate key (409)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/feature-flags')
      .set('Authorization', `Bearer ${devToken}`)
      .send({ key: testKey, isEnabled: true })
      .expect(409);
  });

  // ============================================================
  // Read one
  // ============================================================

  it('allows getting a flag by key', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/feature-flags/${testKey}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(res.body.flag.key).toBe(testKey);
  });

  it('returns 404 for a missing flag', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/feature-flags/nonexistent_key_xyz')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(404);
  });

  // ============================================================
  // Update - developer only
  // ============================================================

  it('allows a developer to toggle a flag', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/feature-flags/${testKey}`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({ isEnabled: false })
      .expect(200);

    expect(res.body.flag.isEnabled).toBe(false);
  });

  it('forbids a member from toggling a flag (403)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/feature-flags/${testKey}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ isEnabled: true })
      .expect(403);
  });

  // ============================================================
  // Delete - developer only
  // ============================================================

  it('allows a developer to delete a flag (204)', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/feature-flags/${testKey}`)
      .set('Authorization', `Bearer ${devToken}`)
      .expect(204);
  });
});
