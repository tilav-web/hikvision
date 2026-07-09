import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { RoleSerializerInterceptor } from './common/role-serializer.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const config = app.get(ConfigService);
  const isProd = config.get<string>('NODE_ENV') === 'production';

  // Reverse-proxy (nginx/LB) ortida ishlansa — throttler va IP-log to'g'ri IP oladi
  app.set('trust proxy', 1);
  app.enableShutdownHooks();

  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ extended: true, limit: '20mb' }));
  app.use(compression());
  app.use(cookieParser());

  // CORS_ORIGIN — vergul bilan ajratilgan ro'yxat. '*' bilan credentials birga
  // ishlamaydi (CORS spec'ga zid), shuning uchun '*' bo'lsa origin echo qilinadi.
  // XAVFSIZLIK: '*' har qanday sayt'ni credential bilan aks ettiradi — bu faqat
  // dev uchun. Prod'da CORS_ORIGIN'ni aniq domen(lar)ga o'rnating.
  const corsOrigin = config.get<string>('CORS_ORIGIN', 'http://localhost:5173');
  if (isProd && corsOrigin === '*') {
    Logger.warn(
      'CORS_ORIGIN=* production\'da xavfli — aniq domen(lar)ga o\'rnating',
      'Bootstrap',
    );
  }
  const origins = corsOrigin === '*'
    ? true
    : corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: origins,
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Global serializer — `@Exclude()` maydonlarni (passwordHash, passwordEnc)
  // barcha javoblardan olib tashlaydi; apiToken'ni faqat super_admin ko'radi.
  app.useGlobalInterceptors(new RoleSerializerInterceptor(app.get(Reflector)));

  // Swagger — faqat prod bo'lmaganda ochamiz (API sirtini oshkor qilmaslik uchun)
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Hikvision Server')
      .setDescription('Hikvision FaceID (DS-K1T343MFWX) management API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, doc);
  }

  const port = config.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`Server: http://localhost:${port}/api`, 'Bootstrap');
  if (!isProd) {
    Logger.log(`Swagger: http://localhost:${port}/docs`, 'Bootstrap');
  }
}
bootstrap();
