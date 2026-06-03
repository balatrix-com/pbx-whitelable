import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TraceMiddleware } from './common/trace.middleware';
import compression from 'compression';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Disable default body parser
  });

  app.setGlobalPrefix('api');

  // Hardening
  app.use(helmet());
  app.use(compression());

  // Configure body parsers with raw body for webhook
  const express = require('express');
  app.use(express.json({
    verify: (req: any, res: any, buf: any, encoding: any) => {
      if (req.url === '/billing/webhook') {
        req.rawBody = buf;
      }
    }
  }));
  app.use(express.urlencoded({ extended: true }));

  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableShutdownHooks();

  await app.listen(3000);
}
bootstrap();
