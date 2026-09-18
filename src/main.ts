import {
  ValidationPipe,
} from "@nestjs/common";

import {
  ConfigService,
} from "@nestjs/config";

import {
  NestFactory,
} from "@nestjs/core";

import {
  DocumentBuilder,
  SwaggerModule,
} from "@nestjs/swagger";

import type {
  CorsOptions,
} from "@nestjs/common/interfaces/external/cors-options.interface.js";

import type {
  NestExpressApplication,
} from "@nestjs/platform-express";

import {
  join,
} from "node:path";

import {
  AppModule,
} from "./app.module.js";

function isLocalDevelopmentOrigin(
  origin: string,
): boolean {
  try {
    const url =
      new URL(origin);

    const isVitePort =
      url.port === "5173";

    const isHttp =
      url.protocol ===
      "http:";

    const isLocalhost =
      url.hostname ===
        "localhost" ||
      url.hostname ===
        "127.0.0.1";

    const isPrivateLan =
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(
        url.hostname,
      );

    return (
      isHttp &&
      isVitePort &&
      (
        isLocalhost ||
        isPrivateLan
      )
    );
  } catch {
    return false;
  }
}

async function bootstrap():
  Promise<void> {
  const app =
    await NestFactory.create<NestExpressApplication>(
      AppModule,
    );

  const configService =
    app.get(
      ConfigService,
    );

  /*
   * ============================================================
   * LOCAL UPLOADS
   * ============================================================
   *
   * Files stored inside:
   *
   * uploads/events/
   *
   * become publicly available from:
   *
   * /uploads/events/filename.jpg
   * ============================================================
   */

  app.useStaticAssets(
    join(
      process.cwd(),
      "uploads",
    ),
    {
      prefix:
        "/uploads/",
    },
  );

  /*
   * ============================================================
   * CORS
   * ============================================================
   *
   * Production/staging origins should be
   * configured through CORS_ORIGINS.
   *
   * Example:
   *
   * CORS_ORIGINS=https://waterfallpartykohphangan.com,https://www.waterfallpartykohphangan.com
   * ============================================================
   */

  const configuredOrigins =
    configService
      .get<string>(
        "CORS_ORIGINS",
      )
      ?.split(",")
      .map(
        (origin) =>
          origin.trim(),
      )
      .filter(Boolean) ??
    [];

  const nodeEnvironment =
    configService.get<string>(
      "NODE_ENV",
    ) ??
    "development";

  const isDevelopment =
    nodeEnvironment !==
    "production";

  const corsOptions:
    CorsOptions = {
    origin: (
      origin:
        | string
        | undefined,

      callback: (
        error:
          | Error
          | null,
        allow?: boolean,
      ) => void,
    ) => {
      /*
       * Requests without an Origin header
       * include Postman, curl,
       * server-to-server requests and
       * direct browser navigation.
       */
      if (!origin) {
        callback(
          null,
          true,
        );

        return;
      }

      /*
       * Explicitly configured origins are
       * always allowed.
       */
      if (
        configuredOrigins.includes(
          origin,
        )
      ) {
        callback(
          null,
          true,
        );

        return;
      }

      /*
       * During development allow Vite
       * from localhost and private LAN.
       */
      if (
        isDevelopment &&
        isLocalDevelopmentOrigin(
          origin,
        )
      ) {
        callback(
          null,
          true,
        );

        return;
      }

      callback(
        new Error(
          `Origin ${origin} is not allowed by CORS`,
        ),
        false,
      );
    },

    credentials:
      true,
  };

  app.enableCors(
    corsOptions,
  );

  /*
   * ============================================================
   * VALIDATION
   * ============================================================
   */

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:
        true,

      forbidNonWhitelisted:
        true,

      transform:
        true,
    }),
  );

  const port =
    Number(
      configService.get<string>(
        "PORT",
      ) ??
        3000,
    );

  /*
   * ============================================================
   * SWAGGER
   * ============================================================
   */

  const swaggerConfig =
    new DocumentBuilder()
      .setTitle(
        "Waterfall Festival API",
      )
      .setDescription(
        "Interactive API documentation for the Waterfall Festival public website and administration dashboard.",
      )
      .setVersion(
        "1.0.0",
      )
      .addBearerAuth(
        {
          type:
            "http",

          scheme:
            "bearer",

          bearerFormat:
            "JWT",

          description:
            "Enter the JWT access token returned by the login endpoint.",
        },
        "access-token",
      )
      .build();

  const swaggerDocument =
    SwaggerModule.createDocument(
      app,
      swaggerConfig,
    );

  SwaggerModule.setup(
    "api/docs",
    app,
    swaggerDocument,
    {
      customSiteTitle:
        "Waterfall Festival API Documentation",

      swaggerOptions: {
        persistAuthorization:
          true,

        displayRequestDuration:
          true,

        filter:
          true,

        tagsSorter:
          "alpha",

        operationsSorter:
          "method",
      },
    },
  );

  /*
   * ============================================================
   * START SERVER
   * ============================================================
   */

  await app.listen(
    port,
    "0.0.0.0",
  );

  console.log(
    `Waterfall Festival API running on port ${port}`,
  );

  console.log(
    "Swagger documentation available at /api/docs",
  );

  console.log(
    "Local uploads available at /uploads",
  );

  console.log(
    `Environment: ${nodeEnvironment}`,
  );

  if (
    configuredOrigins.length >
    0
  ) {
    console.log(
      `Configured CORS origins: ${configuredOrigins.join(", ")}`,
    );
  }

  if (isDevelopment) {
    console.log(
      "Local development CORS enabled for localhost and 192.168.x.x:5173",
    );
  }
}

void bootstrap();