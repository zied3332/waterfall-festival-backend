import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';

import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(
    AppModule,
  );

  const configService =
    app.get(ConfigService);

  const configuredOrigins =
    configService
      .get<string>('CORS_ORIGINS')
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  const allowedOrigins = [
    'http://localhost:5173',
    'http://192.168.1.147:5173',
    ...configuredOrigins,
  ];

  const corsOptions: CorsOptions = {
    origin: (
      origin: string | undefined,
      callback: (
        error: Error | null,
        allow?: boolean,
      ) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (
        allowedOrigins.includes(
          origin,
        )
      ) {
        callback(null, true);
        return;
      }

      callback(
        new Error(
          `Origin ${origin} is not allowed by CORS`,
        ),
        false,
      );
    },
    credentials: true,
  };

  app.enableCors(corsOptions);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(
    configService.get<string>(
      'PORT',
    ) ?? 3000,
  );

  const swaggerConfig =
    new DocumentBuilder()
      .setTitle(
        'Waterfall Festival API',
      )
      .setDescription(
        'Interactive API documentation for the Waterfall Festival public website and administration dashboard.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Enter the JWT access token returned by the login endpoint.',
        },
        'access-token',
      )
      .build();

  const swaggerDocument =
    SwaggerModule.createDocument(
      app,
      swaggerConfig,
    );

  SwaggerModule.setup(
    'api/docs',
    app,
    swaggerDocument,
    {
      customSiteTitle:
        'Waterfall Festival API Documentation',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tagsSorter: 'alpha',
        operationsSorter: 'method',
      },
    },
  );

  await app.listen(
    port,
    '0.0.0.0',
  );

  console.log(
    `Waterfall Festival API running on port ${port}`,
  );

  console.log(
    'Swagger documentation available at /api/docs',
  );

  console.log(
    `Allowed CORS origins: ${allowedOrigins.join(', ')}`,
  );
}

void bootstrap();