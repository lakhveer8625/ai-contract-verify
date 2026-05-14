import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.enableCors({
    origin: config.get('WEB_ORIGIN') ?? 'http://localhost:3000',
    credentials: true
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  mkdirSync(config.get('UPLOAD_DIR') ?? './uploads', { recursive: true });
  mkdirSync(config.get('REPORT_DIR') ?? './reports', { recursive: true });

  await app.listen(config.get('PORT') ?? 4000);
}

bootstrap();
