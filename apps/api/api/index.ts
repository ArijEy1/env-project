// Vercel serverless entry for the NestJS API.
//
// Vercel routes every request (via the catch-all rewrite in vercel.json) to this
// function. We bootstrap Nest onto an Express instance ONCE per warm container
// and reuse it. The AppModule is imported from the PRE-BUILT `dist/` output so
// Vercel's esbuild never has to transform NestJS decorators — `nest build`
// (run via the vercel.json buildCommand) already emitted the decorator metadata.

import 'reflect-metadata';
import express from 'express';
import helmet from 'helmet';
import type { Request, Response } from 'express';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — resolved at deploy time from the compiled build output.
import { AppModule } from '../dist/app.module';

const server = express();
let bootstrapped: Promise<void> | null = null;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn'],
  });

  app.use(helmet());

  // Behind Vercel's edge, trust the proxy so req.ip / x-forwarded-proto are real.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    server.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : true);
  }

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  await app.init();
}

export default async function handler(req: Request, res: Response) {
  if (!bootstrapped) bootstrapped = bootstrap();
  await bootstrapped;
  server(req, res);
}
