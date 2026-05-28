import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AttendanceStatus, AttendanceType, Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/shared/prisma/prisma.service';

/**
 * E2E test for the attendance module.
 *
 * Seeds an ADMIN + a SCHEDULE directly via Prisma, registers a MEMBER
 * via the endpoint, then verifies real attendance marking + RBAC over HTTP.
 */
describe('AttendanceModule (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication<App>;
  let prisma: PrismaService;

  const stamp = Date.now();
  const adminUsername = `e2e_attadmin_${stamp}`;
  const adminPhone = `+201444${stamp.toString().slice(-7)}`;
  const memberUsername = `e2e_attmember_${stamp}`;
  const memberPhone = `+201333${stamp.toString().slice(-7)}`;
  const password = 'E2EpassWord123';

  let adminToken: string;
  let memberToken: string;
  let memberId: string;
  let scheduleId: string;
  let createdAttendanceId: string;

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

    // Seed admin
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        uniqueId: `CSJ-AT${stamp.toString().slice(-5)}`,
        username: adminUsername,
        phone: adminPhone,
        passwordHash,
        qrCode: nanoid(),
        role: Role.ADMIN,
        language: 'ar',
      },
    });

    // Seed a schedule to attach attendance to
    const schedule = await prisma.schedule.create({
      data: {
        title: `E2E Schedule ${stamp}`,
        dayOfWeek: [1, 3],
        startTime: '16:00',
        endTime: '18:00',
      },
    });
    scheduleId = schedule.id;

    // Register a member via endpoint
    const memberRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ username: memberUsername, phone: memberPhone, password });
    memberId = memberRes.body.user.id;

    // Login both
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
      await prisma.attendance.deleteMany({ where: { memberId } });
      await prisma.schedule.deleteMany({ where: { id: scheduleId } });
      await prisma.user.deleteMany({
        where: { username: { in: [adminUsername, memberUsername] } },
      });
    }
    if (app) {
      await app.close();
    }
  });

  // ============================================================
  // create / bulk
  // ============================================================

  it('allows an admin to mark a single attendance', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/attendance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        memberId,
        scheduleId,
        type: AttendanceType.SCHEDULE,
        status: AttendanceStatus.PRESENT,
        date: '2026-01-15T00:00:00.000Z',
      })
      .expect(201);

    expect(res.body.attendance.memberId).toBe(memberId);
    expect(res.body.attendance.markedById).toBeDefined();
    createdAttendanceId = res.body.attendance.id;
  });

  it('allows an admin to bulk-mark attendance', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/attendance/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        records: [
          {
            memberId,
            scheduleId,
            type: AttendanceType.SCHEDULE,
            status: AttendanceStatus.LATE,
            date: '2026-01-16T00:00:00.000Z',
          },
          {
            memberId,
            scheduleId,
            type: AttendanceType.SCHEDULE,
            status: AttendanceStatus.PRESENT,
            date: '2026-01-17T00:00:00.000Z',
          },
        ],
      })
      .expect(201);

    expect(res.body.count).toBe(2);
  });

  it('forbids a member from marking attendance (403)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/attendance')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        memberId,
        type: AttendanceType.SCHEDULE,
        status: AttendanceStatus.PRESENT,
        date: '2026-01-15T00:00:00.000Z',
      })
      .expect(403);
  });

  it('returns 404 when marking for a non-existent member', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/attendance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        memberId: 'nonexistent_member_id',
        type: AttendanceType.SCHEDULE,
        status: AttendanceStatus.PRESENT,
        date: '2026-01-15T00:00:00.000Z',
      })
      .expect(404);
  });

  // ============================================================
  // list / get
  // ============================================================

  it('allows an admin to list attendance', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/attendance')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.items).toBeDefined();
    expect(res.body.total).toBeGreaterThanOrEqual(3);
  });

  it('clamps a member to only their own records', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/attendance')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    // Every returned record must belong to the requesting member
    for (const item of res.body.items) {
      expect(item.memberId).toBe(memberId);
    }
  });

  it('allows a member to get their own record', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/attendance/${createdAttendanceId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(res.body.attendance.id).toBe(createdAttendanceId);
  });

  // ============================================================
  // update / delete
  // ============================================================

  it('allows an admin to update a record', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/attendance/${createdAttendanceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: AttendanceStatus.EXCUSED })
      .expect(200);

    expect(res.body.attendance.status).toBe(AttendanceStatus.EXCUSED);
  });

  it('forbids a member from updating a record (403)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/attendance/${createdAttendanceId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: AttendanceStatus.PRESENT })
      .expect(403);
  });

  it('allows an admin to delete a record (204)', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/attendance/${createdAttendanceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });
});
