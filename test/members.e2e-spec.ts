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
 * E2E test for the members module.
 *
 * Setup: creates an ADMIN user directly via Prisma (register endpoint
 * always makes MEMBER, so we seed the admin manually).
 *
 * Verifies real role-based authorization over HTTP.
 */
describe('MembersModule (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication<App>;
  let prisma: PrismaService;

  const stamp = Date.now();
  const adminUsername = `e2e_admin_${stamp}`;
  const adminPhone = `+201888${stamp.toString().slice(-7)}`;
  const memberUsername = `e2e_member_${stamp}`;
  const memberPhone = `+201777${stamp.toString().slice(-7)}`;
  const password = 'E2EpassWord123';

  let adminToken: string;
  let memberToken: string;
  let memberId: string;
  let adminId: string;

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

    // Seed an ADMIN directly (register endpoint only makes MEMBER)
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await prisma.user.create({
      data: {
        uniqueId: `CSJ-A${stamp.toString().slice(-5)}`,
        username: adminUsername,
        phone: adminPhone,
        passwordHash,
        qrCode: nanoid(),
        role: Role.ADMIN,
        language: 'ar',
      },
    });
    adminId = admin.id;

    // Register a normal MEMBER via the real endpoint
    const memberRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ username: memberUsername, phone: memberPhone, password });
    memberId = memberRes.body.user.id;

    // Login both to get tokens
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: adminUsername, password });
    adminToken = adminLogin.body.accessToken;

    const memberLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: memberUsername, password });
    memberToken = memberLogin.body.accessToken;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({
        where: { username: { in: [adminUsername, memberUsername] } },
      });
    }
    if (app) {
      await app.close();
    }
  });

  // ============================================================
  // GET /members (list) - admin only
  // ============================================================

  it('allows admin to list members', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.items).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
  });

  it('forbids a member from listing members (403)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/members')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('rejects listing without a token (401)', async () => {
    await request(app.getHttpServer()).get('/api/v1/members').expect(401);
  });

  // ============================================================
  // GET /members/:id - self or admin
  // ============================================================

  it('allows a member to get their OWN profile', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/members/${memberId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(res.body.member.id).toBe(memberId);
    expect(res.body.member.passwordHash).toBeUndefined();
  });

  it('forbids a member from getting ANOTHER profile (403)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/members/${adminId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('allows an admin to get ANY member profile', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/members/${memberId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.member.id).toBe(memberId);
  });

  // ============================================================
  // PATCH /members/:id - permission rules
  // ============================================================

  it('allows a member to update their OWN language', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/members/${memberId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ language: 'en' })
      .expect(200);

    expect(res.body.member.language).toBe('en');
  });

  it('forbids a member from changing their own role (403)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/members/${memberId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ role: 'DEVELOPER' })
      .expect(403);
  });

  it('allows an admin to update another member', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/members/${memberId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ language: 'fr' })
      .expect(200);

    expect(res.body.member.language).toBe('fr');
  });

  it('forbids an admin from changing role (only developer can) (403)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/members/${memberId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ADMIN' })
      .expect(403);
  });
});
