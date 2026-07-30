import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  // `rawBody: true` keeps the untouched request bytes on `req.rawBody`, which the
  // Lemon Squeezy webhook needs: its HMAC is computed over the exact payload, and
  // re-serializing the parsed JSON would change key order/escaping and never match.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: config.get<string>('WEB_URL', 'http://localhost:3000'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI Career Platform API')
    .setDescription('REST API for the AI Career Platform — auth, profiles, jobs, resumes, and more.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${globalPrefix}/docs`, app, swaggerDocument);

  const port = config.get<number>('PORT', 4000);
  await app.listen(port);

  logger.log(`API listening on http://localhost:${port}/${globalPrefix}`);
  logger.log(`Swagger docs available at http://localhost:${port}/${globalPrefix}/docs`);
}

bootstrap();
