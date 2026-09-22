import {
  type INestApplication,
} from "@nestjs/common";

import {
  Test,
  type TestingModule,
} from "@nestjs/testing";

import type {
  Server,
} from "node:http";

import request from "supertest";

import {
  AppModule,
} from "./../src/app.module.js";

describe("AppController (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app =
      moduleFixture.createNestApplication();

    await app.init();
  });

  it("/ (GET)", async () => {
    const httpServer =
      app.getHttpServer() as Server;

    await request(httpServer)
      .get("/")
      .expect(200);
  });

  afterEach(async () => {
    await app.close();
  });
});