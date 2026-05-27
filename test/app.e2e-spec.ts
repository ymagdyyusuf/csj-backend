import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/shared/prisma/prisma.service';

describe('AuthModule (e2e)', () => {
  jest.setTimeout(60000);
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const testUsername = `e2e_user_${Date.now()}`;
  const testPhone = `+201999${Date.now().toString().slice(-7)}`;
  const testPassword = 'E2EpassWord123';

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
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({
        where: { username: testUsername },
      });
    }
    if (app) {
      await app.close();
    }
  });

  it('registers a new user (POST /api/v1/auth/register)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        username: testUsername,
        phone: testPhone,
        password: testPassword,
      })
      .expect(201);

    expect(response.body.user).toBeDefined();
    expect(response.body.user.username).toBe(testUsername);
    expect(response.body.user.role).toBe('MEMBER');
    expect(response.body.user.isActive).toBe(true);
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.body.user.qrCode).toBeUndefined();
  });

  it('rejects duplicate registration', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        username: testUsername,
        phone: testPhone,
        password: testPassword,
      })
      .expect(409);
  });

  it('rejects registration with missing fields', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ username: 'only_username' })
      .expect(400);
  });

  let accessToken: string;

  it('logs in successfully (POST /api/v1/auth/login)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: testUsername,
        password: testPassword,
      })
      .expect(200);

    expect(response.body.accessToken).toBeDefined();
    expect(typeof response.body.accessToken).toBe('string');
    expect(response.body.user.username).toBe(testUsername);
    expect(response.body.refreshToken).toBeUndefined();

    const cookies = response.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieStr = Array.isArray(cookies) ? cookies[0] : cookies;
    expect(cookieStr).toContain('refresh_token=');
    expect(cookieStr).toContain('HttpOnly');

    accessToken = response.body.accessToken;
  });

  it('rejects login with wrong password', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: testUsername,
        password: 'WRONG_PASSWORD',
      })
      .expect(401);
  });

  it('rejects login with non-existent user', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: 'ghost_user_xyz',
        password: 'anyPassword',
      })
      .expect(401);
  });

  it('accesses /me with valid token (GET /api/v1/auth/me)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.user.username).toBe(testUsername);
    expect(response.body.user.role).toBe('MEMBER');
  });

  it('rejects /me without token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('rejects /me with invalid token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not.a.valid.token')
      .expect(401);
  });
});
