import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
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
  const rawOrigins = configService.get<string>('ALLOWED_ORIGINS') || 'http://localhost:5173,http://localhost:3000';
  const allowedOrigins = rawOrigins.split(',').map(url => url.trim());

  app.enableCors({
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
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
