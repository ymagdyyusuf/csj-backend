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
import { CloudinaryService } from './../src/shared/cloudinary/cloudinary.service';

/**
 * E2E test for the boqs module.
 *
 * Cloudinary is MOCKED via .overrideProvider so no real uploads happen.
 */
describe('BoqsModule (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication<App>;
  let prisma: PrismaService;

  const stamp = Date.now();
  const adminUsername = `e2e_boqsadmin_${stamp}`;
  const adminPhone = `+201222${stamp.toString().slice(-7)}`;
  const memberUsername = `e2e_boqsmember_${stamp}`;
  const memberPhone = `+201111${stamp.toString().slice(-7)}`;
  const password = 'E2EpassWord123';

  let adminToken: string;
  let memberToken: string;
  let createdBoqsId: string;

  const uploadAudioMock = jest.fn();
  const deleteFileMock = jest.fn();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CloudinaryService)
      .useValue({
        uploadAudio: uploadAudioMock,
        deleteFile: deleteFileMock,
      })
      .compile();

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
        uniqueId: `CSJ-BQ${stamp.toString().slice(-5)}`,
        username: adminUsername,
        phone: adminPhone,
        passwordHash,
        qrCode: nanoid(),
        role: Role.ADMIN,
        language: 'ar',
      },
    });

    // Register a member via the endpoint
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ username: memberUsername, phone: memberPhone, password });

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
      const admin = await prisma.user.findUnique({
        where: { username: adminUsername },
      });
      if (admin) {
        await prisma.boqs.deleteMany({ where: { sentById: admin.id } });
      }
      await prisma.user.deleteMany({
        where: { username: { in: [adminUsername, memberUsername] } },
      });
    }
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    uploadAudioMock.mockReset();
    deleteFileMock.mockReset();
  });

  // ============================================================
  // create (multipart upload)
  // ============================================================

  it('allows an admin to upload and create a broadcast', async () => {
    uploadAudioMock.mockResolvedValue({
      url: 'https://res.cloudinary.com/csj/video/upload/boqs/e2e_test.mp3',
      duration: 8,
      publicId: 'boqs/e2e_test',
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/boqs')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('text', 'E2E test broadcast')
      .attach('audio', Buffer.from('fake audio bytes'), {
        filename: 'test.mp3',
        contentType: 'audio/mpeg',
      })
      .expect(201);

    expect(res.body.boqs.text).toBe('E2E test broadcast');
    expect(res.body.boqs.duration).toBe(8);
    expect(uploadAudioMock).toHaveBeenCalledTimes(1);
    createdBoqsId = res.body.boqs.id;
  });

  it('forbids a member from creating a broadcast (403)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/boqs')
      .set('Authorization', `Bearer ${memberToken}`)
      .field('text', 'should fail')
      .attach('audio', Buffer.from('fake'), {
        filename: 'x.mp3',
        contentType: 'audio/mpeg',
      })
      .expect(403);

    expect(uploadAudioMock).not.toHaveBeenCalled();
  });

  it('rejects a non-audio mimetype (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/boqs')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('text', 'wrong file type')
      .attach('audio', Buffer.from('not audio'), {
        filename: 'pic.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);

    expect(uploadAudioMock).not.toHaveBeenCalled();
  });

  it('rejects when no file is attached (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/boqs')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('text', 'no file here')
      .expect(400);
  });

  // ============================================================
  // list / get / device-count
  // ============================================================

  it('allows any authenticated user to list broadcasts', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/boqs')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(res.body.items).toBeDefined();
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it('allows getting a broadcast by id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/boqs/${createdBoqsId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(res.body.boqs.id).toBe(createdBoqsId);
  });

  it('allows incrementing the device count', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/boqs/${createdBoqsId}/device-count`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(res.body.boqs.deviceCount).toBeGreaterThanOrEqual(1);
  });

  // ============================================================
  // delete
  // ============================================================

  it('forbids a member from deleting a broadcast (403)', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/boqs/${createdBoqsId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('allows an admin to delete a broadcast (204) and calls Cloudinary cleanup', async () => {
    deleteFileMock.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete(`/api/v1/boqs/${createdBoqsId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    expect(deleteFileMock).toHaveBeenCalled();
  });
});
