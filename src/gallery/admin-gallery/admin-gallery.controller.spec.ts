import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Server } from 'node:http';
import request from 'supertest';
import { AdminGalleryController } from './admin-gallery.controller.js';
import { GalleryService } from '../gallery.service.js';
import { GalleryDeletionService } from '../gallery-deletion.service.js';
import { LocalUploadService } from '../../uploads/local-upload.service.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';

describe('Admin gallery deletion HTTP contract', () => {
  let app: INestApplication;
  let server: Server;
  const jwt = new JwtService({ secret: 'isolated-gallery-test-secret' });
  const admin = jwt.sign({ sub: 1, role: 'ADMIN', email: 'admin@example.test' });
  const member = jwt.sign({ sub: 2, role: 'USER', email: 'user@example.test' });
  const operationId = '7358c4c1-4ee7-4cdd-8a83-f10d602bcab8';
  const result = { operationId, status: 'completed', requestedCount: 3, deletedIds: [12, 18], notFoundIds: [27], preservedAssetIds: [], cleanup: { pending: 0, succeeded: 2, failed: 0 } };
  const gallery = { removeBatch: jest.fn<GalleryService['removeBatch']>(), remove: jest.fn<GalleryService['remove']>(), findOne: jest.fn<GalleryService['findOne']>() };
  const deletion = { status: jest.fn<GalleryDeletionService['status']>(), retry: jest.fn<GalleryDeletionService['retry']>() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminGalleryController],
      providers: [JwtAuthGuard, RolesGuard,
        { provide: GalleryService, useValue: gallery },
        { provide: GalleryDeletionService, useValue: deletion },
        { provide: LocalUploadService, useValue: {} },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: 'isolated-gallery-test-secret' }) },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init(); server = app.getHttpServer() as Server;
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    jest.clearAllMocks(); gallery.removeBatch.mockResolvedValue(result);
    deletion.status.mockResolvedValue(result); deletion.retry.mockResolvedValue(result);
  });
  it('routes batch deletion to the static endpoint and returns the result', async () => {
    const response = await request(server).delete('/admin/gallery/batch').set('Authorization', `Bearer ${admin}`).send({ ids: [12, 18, 27] }).expect(200);
    expect(response.body).toEqual(result);
    expect(gallery.removeBatch).toHaveBeenCalledWith([12, 18, 27]);
    expect(gallery.remove).not.toHaveBeenCalled();
  });
  it.each([[], [1, 1], [0], [-1], [1.5], ['1'], [2147483648], Array.from({ length: 101 }, (_, i) => i + 1)].map(ids => ({ ids })))('rejects invalid request IDs $ids before calling the service', async ({ ids }) => {
    await request(server).delete('/admin/gallery/batch').set('Authorization', `Bearer ${admin}`).send({ ids }).expect(400);
    expect(gallery.removeBatch).not.toHaveBeenCalled();
  });
  it('rejects client paths and media URLs', async () => {
    await request(server).delete('/admin/gallery/batch').set('Authorization', `Bearer ${admin}`).send({ ids: [1], publicId: 'gallery/images/secret.jpg', imageUrl: '/uploads/gallery/images/secret.jpg' }).expect(400);
    expect(gallery.removeBatch).not.toHaveBeenCalled();
  });
  it.each(['batch', `operations/${operationId}`, `operations/${operationId}/retry`, '12'])('requires JWT and ADMIN for %s', async path => {
    const endpoint = `/admin/gallery/${path}`;
    const invoke = () => path.endsWith('/retry') ? request(server).post(endpoint) : path.startsWith('operations/') ? request(server).get(endpoint) : request(server).delete(endpoint).send({ ids: [12] });
    await invoke().expect(401);
    await invoke().set('Authorization', 'Bearer invalid').expect(401);
    await invoke().set('Authorization', `Bearer ${member}`).expect(403);
    expect(gallery.removeBatch).not.toHaveBeenCalled(); expect(deletion.retry).not.toHaveBeenCalled();
  });
  it('returns operation status and accepts authenticated retries', async () => {
    await request(server).get(`/admin/gallery/operations/${operationId}`).set('Authorization', `Bearer ${admin}`).expect(200, result);
    await request(server).post(`/admin/gallery/operations/${operationId}/retry`).set('Authorization', `Bearer ${admin}`).expect(200, result);
    expect(deletion.retry).toHaveBeenCalledWith(operationId);
  });
  it('rejects malformed operation IDs', async () => {
    await request(server).get('/admin/gallery/operations/not-a-uuid').set('Authorization', `Bearer ${admin}`).expect(400);
    expect(deletion.status).not.toHaveBeenCalled();
  });
  it('keeps single deletion response fields and cleanup status', async () => {
    const body = { id: 12, title: 'Existing image', deletion: result };
    gallery.remove.mockResolvedValueOnce(body as Awaited<ReturnType<GalleryService['remove']>>);
    await request(server).delete('/admin/gallery/12').set('Authorization', `Bearer ${admin}`).expect(200, body);
    expect(gallery.remove).toHaveBeenCalledWith(12);
  });
});
