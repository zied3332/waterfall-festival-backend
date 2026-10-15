import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Server } from 'node:http';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LocalUploadService } from '../uploads/local-upload.service.js';
import { LocalImageStorageService } from './local-image-storage.service.js';
import { STORAGE_FILESYSTEM, storageFilesystem } from './storage-filesystem.js';
import { StorageController } from './storage.controller.js';
import { StorageService } from './storage.service.js';
import { StorageModule } from './storage.module.js';
import type { StorageStatsDto } from './storage-stats.dto.js';

describe('Admin storage statistics HTTP API', () => {
  let app: INestApplication;
  let server: Server;
  let root: string;
  let service: StorageService;
  const jwt = new JwtService({ secret: 'isolated-storage-test-secret' });
  const admin = jwt.sign({ sub: 1, role: 'ADMIN', email: 'admin@example.test' });
  const member = jwt.sign({ sub: 2, role: 'USER', email: 'user@example.test' });
  const expired = jwt.sign({ sub: 1, role: 'ADMIN', exp: 1 });

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'storage-api-'));
    const cwd = jest.spyOn(process, 'cwd').mockReturnValue(root);
    const gallery = new LocalUploadService(); const posters = new LocalImageStorageService();
    cwd.mockRestore();
    const images = join(root, 'uploads/gallery/images');
    const videos = join(root, 'uploads/gallery/videos');
    const events = join(root, 'uploads/events');
    await Promise.all([images, videos, events].map(path => mkdir(path, { recursive: true })));
    await writeFile(join(images, 'one.jpg'), Buffer.alloc(100));
    await writeFile(join(images, 'two.webp'), Buffer.alloc(300));
    await writeFile(join(videos, 'clip.mp4'), Buffer.alloc(600));
    await writeFile(join(events, 'poster.avif'), Buffer.alloc(1000));
    const module = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [StorageService, JwtAuthGuard, RolesGuard,
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: 'isolated-storage-test-secret' }) },
        { provide: LocalUploadService, useValue: gallery },
        { provide: LocalImageStorageService, useValue: posters },
        { provide: STORAGE_FILESYSTEM, useValue: storageFilesystem },
      ],
    }).compile();
    service = module.get(StorageService);
    app = module.createNestApplication();
    await app.init(); server = app.getHttpServer() as Server;
  });

  beforeEach(() => { jest.restoreAllMocks(); });
  afterAll(async () => { await app.close(); await rm(root, { recursive: true, force: true }); });

  it.each([{ label: 'missing', token: undefined }, { label: 'invalid', token: 'invalid' }, { label: 'expired', token: expired }])('rejects $label JWT before scanning', async ({ token }) => {
    const scan = jest.spyOn(service, 'getStats');
    const call = request(server).get('/admin/storage/stats');
    if (token) call.set('Authorization', `Bearer ${token}`);
    await call.expect(401);
    expect(scan).not.toHaveBeenCalled();
  });

  it('rejects non-admin users before scanning', async () => {
    const scan = jest.spyOn(service, 'getStats');
    await request(server).get('/admin/storage/stats').set('Authorization', `Bearer ${member}`).expect(403);
    expect(scan).not.toHaveBeenCalled();
  });

  it('returns real fixture measurements for admins without leaking filesystem details', async () => {
    const response = await request(server).get('/admin/storage/stats').set('Authorization', `Bearer ${admin}`).expect(200);
    const body = response.body as StorageStatsDto;
    expect(response.headers['cache-control']).toBe('no-store');
    expect(body).toMatchObject({ status: 'ok', total: { files: 4, bytes: 2000 }, percentages: { images: 20, videos: 30, posters: 50 } });
    expect(body.gallery.images).toEqual({ status: 'ok', count: 2, totalBytes: 400, averageBytes: 200, largestBytes: 300 });
    expect(body.gallery.videos).toMatchObject({ count: 1, totalBytes: 600, averageBytes: 600, largestBytes: 600 });
    expect(body.events.posters).toMatchObject({ count: 1, totalBytes: 1000 });
    expect(JSON.stringify(body)).not.toContain(root);
    expect(JSON.stringify(body)).not.toContain('one.jpg');
  });

  it('does not accept a request path override or expose a public storage route', async () => {
    const response = await request(server).get('/admin/storage/stats?path=/etc&directory=node_modules').set('Authorization', `Bearer ${admin}`).expect(200);
    expect((response.body as StorageStatsDto).total).toEqual({ files: 4, bytes: 2000 });
    await request(server).get('/storage/stats').expect(404);
  });

  it('wires the real storage module through the existing uploader and auth modules', async () => {
    const uploadsRoot = join(root, 'uploads');
    const module = await Test.createTestingModule({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, ignoreEnvVars: true }), StorageModule] })
      .overrideProvider(PrismaService).useValue({})
      .overrideProvider(ConfigService).useValue(new ConfigService({ JWT_SECRET: 'isolated-storage-test-secret' }))
      .overrideProvider(LocalUploadService).useValue({ getUploadsRoot: () => uploadsRoot })
      .overrideProvider(LocalImageStorageService).useValue({ getUploadsRoot: () => uploadsRoot })
      .compile();
    try {
      expect((await module.get(StorageService).getStats()).total).toEqual({ files: 4, bytes: 2000 });
      expect(module.get(StorageController)).toBeDefined();
    } finally { await module.close(); }
  });
});
