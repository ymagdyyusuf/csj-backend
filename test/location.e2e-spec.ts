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
 * E2E test for the location module.
 *
 * Seeds an ADMIN, registers a MEMBER, then verifies:
 *  - real GPS logging with memberId clamped from auth
 *  - 60-second throttle (consecutive pings -> 429)
 *  - member-clamp on list (can't see another member's logs)
 *  - admin "current locations" roster
 *  - admin-only delete
 */
describe('LocationModule (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication<App>;
  let prisma: PrismaService;

  const stamp = Date.now();
  const adminUsername = `e2e_locadmin_${stamp}`;
  const adminPhone = `+201888${stamp.toString().slice(-7)}`;
  const memberUsername = `e2e_locmember_${stamp}`;
  const memberPhone = `+201777${stamp.toString().slice(-7)}`;
  // A second member just to test the throttle - first ping is "fresh"
  const secondMemberUsername = `e2e_locmember2_${stamp}`;
  const secondMemberPhone = `+201666${stamp.toString().slice(-7)}`;
  const password = 'E2EpassWord123';

  let adminToken: string;
  let memberToken: string;
  let secondMemberToken: string;
  let memberId: string;
  let secondMemberId: string;
  let createdLogId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.use(cookieParser());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Seed admin
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        uniqueId: `CSJ-LC${stamp.toString().slice(-5)}`,
        username: adminUsername,
        phone: adminPhone,
        passwordHash,
        qrCode: nanoid(),
        role: Role.ADMIN,
        language: 'ar',
      },
    });

    // Register members
    const m1 = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ username: memberUsername, phone: memberPhone, password });
    memberId = m1.body.user.id;

    const m2 = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ username: secondMemberUsername, phone: secondMemberPhone, password });
    secondMemberId = m2.body.user.id;

    // Login all
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: adminUsername, password });
    adminToken = adminLogin.body.accessToken;

    const memberLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: memberUsername, password });
    memberToken = memberLogin.body.accessToken;

    const secondLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: secondMemberUsername, password });
    secondMemberToken = secondLogin.body.accessToken;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.locationLog.deleteMany({
        where: { memberId: { in: [memberId, secondMemberId] } },
      });
      await prisma.user.deleteMany({
        where: {
          username: { in: [adminUsername, memberUsername, secondMemberUsername] },
        },
      });
    }
    if (app) {
      await app.close();
    }
  });

  // ============================================================
  // create + throttle
  // ============================================================

  it('allows a member to log their own location', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/location')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ latitude: 30.0444, longitude: 31.2357, accuracy: 8.5 })
      .expect(201);

    expect(res.body.location.memberId).toBe(memberId);
    expect(res.body.location.latitude).toBe(30.0444);
    createdLogId = res.body.location.id;
  });

  it('rejects a second ping within 60s (429)', async () => {
    // The previous test just logged for this member - immediate second
    // ping must be throttled.
    await request(app.getHttpServer())
      .post('/api/v1/location')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ latitude: 30.05, longitude: 31.25 })
      .expect(429);
  });

  it('rejects an unauthenticated request (401)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/location')
      .send({ latitude: 30.0444, longitude: 31.2357 })
      .expect(401);
  });

  it('rejects invalid coordinates (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/location')
      .set('Authorization', `Bearer ${secondMemberToken}`)
      .send({ latitude: 999, longitude: 31.2357 })
      .expect(400);
  });

  // ============================================================
  // list + clamp
  // ============================================================

  it('clamps a member to only their own logs', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/location')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    // Every returned record must belong to the requesting member
    for (const item of res.body.items) {
      expect(item.memberId).toBe(memberId);
    }
  });

  it('ignores a forged memberId filter for non-admins', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/location?memberId=${secondMemberId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    // Service clamps - the member only sees their own
    for (const item of res.body.items) {
      expect(item.memberId).toBe(memberId);
    }
  });

  it('allows admin to list all', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/location')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.items).toBeDefined();
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  // ============================================================
  // /current
  // ============================================================

  it('forbids a member from calling /current (403)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/location/current')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('allows admin to fetch the live roster', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/location/current')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.locations).toBeDefined();
    expect(Array.isArray(res.body.locations)).toBe(true);
  });

  // ============================================================
  // get one + delete
  // ============================================================

  it('allows a member to get their own log', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/location/${createdLogId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(res.body.location.id).toBe(createdLogId);
  });

  it('forbids a member from deleting a log (403)', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/location/${createdLogId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('allows an admin to delete a log (204)', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/location/${createdLogId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });
});