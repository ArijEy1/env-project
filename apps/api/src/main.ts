import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Security headers including HSTS (max-age 1y, includeSubDomains). HSTS only
  // takes effect over HTTPS, so it's safe to always send.
  app.use(helmet());

  // Trust the reverse proxy so `req.ip` (used for rate limiting) and
  // `req.secure` / x-forwarded-proto (used for HTTPS enforcement) reflect the
  // real client. Set TRUST_PROXY=1 (hop count) or TRUST_PROXY=true in
  // deployment; leave unset for direct/local access.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : true);
  }

  // Enforce HTTPS in production: redirect any plain-HTTP request to https.
  // Gated by FORCE_HTTPS so local/dev over http still works.
  if (process.env.FORCE_HTTPS === 'true') {
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        return next();
      }
      return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
    });
  }

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 4000);
  // BIND_HOST=127.0.0.1 in production keeps the API reachable only via nginx.
  const host = process.env.BIND_HOST ?? '0.0.0.0';
  await app.listen(port, host);
  console.log(`API listening on http://${host}:${port}/api`);
}

// Don't let a stray rejection/exception silently take down the process.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
