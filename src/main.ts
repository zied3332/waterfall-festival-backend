import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(
    AppModule,
  );

  const configService =
    app.get(ConfigService);

app.enableCors({
  origin: [
    "http://localhost:5173",
    "http://192.168.1.147:5173",
  ],
  credentials: true,
});

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port =
    configService.get<number>('PORT') ??
    3000;

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

  await app.listen(port);

  console.log(
    `Waterfall Festival API running on http://localhost:${port}`,
  );

  console.log(
    `Swagger documentation available at http://localhost:${port}/api/docs`,
  );
}

void bootstrap();