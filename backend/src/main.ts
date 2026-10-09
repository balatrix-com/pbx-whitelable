import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { ValidationPipe, ForbiddenException, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TraceMiddleware } from './common/trace.middleware';
import compression from 'compression';
import helmet from 'helmet';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Disable default body parser
  });

  app.setGlobalPrefix('api');

  // Hardening
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP to allow custom logos/favicons from other sources if needed
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(compression());

  // Configure body parsers with raw body for webhook
  const express = require('express');
  app.use('/api/uploads', express.static(uploadsDir, {
    setHeaders: (res: any) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }));
  app.use(express.json({
    verify: (req: any, res: any, buf: any, encoding: any) => {
      if (req.url === '/billing/webhook') {
        req.rawBody = buf;
      }
    }
  }));
  app.use(express.urlencoded({ extended: true }));

  const configService = app.get(ConfigService);
  const rawOrigins = configService.get<string>('ALLOWED_ORIGINS') || '';
  const allowedOrigins = rawOrigins.split(',').map(url => url.trim()).filter(url => url.length > 0);

  if (allowedOrigins.length === 0) {
    Logger.warn('ALLOWED_ORIGINS is empty or not set in .env! All cross-origin browser requests will be blocked.', 'Bootstrap');
  }

  app.enableCors({
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new ForbiddenException(`CORS Error: Origin ${origin} is not allowed`));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableShutdownHooks();

  await app.listen(3000);
}
bootstrap();
